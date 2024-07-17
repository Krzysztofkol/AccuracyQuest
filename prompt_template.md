# Context:
I'm developing "AccuracyQuest" web app for taking quizzes. I attach screenshot of how it looks.
# Codebase:
## Folder Contents:
### Folder structure:
```
_AccuracyQuest-github-version/
├── accuracy-quest-backend.py
├── accuracy-quest-frontend.html
├── questions.csv
└── start-accuracy-quest.bat
```
## File Contents:
### `accuracy-quest-backend.py`:
```py
# accuracy-quest-backend.py
import os
import csv
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import logging
app = Flask(__name__, static_folder='.')
CORS(app)  # Enable CORS for all routes
# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
CSV_FILE = 'questions.csv'
def read_questions():
    questions = []
    try:
        with open(CSV_FILE, 'r', encoding='utf-8') as file:
            reader = csv.reader(file, delimiter='|')
            next(reader)  # Skip header
            for row in reader:
                if len(row) >= 2:
                    questions.append({
                        'question': row[0],
                        'correct_answer': row[1],
                        'user_answer': row[2] if len(row) > 2 else ''
                    })
        logger.info(f"Successfully loaded {len(questions)} questions from {CSV_FILE}")
    except Exception as e:
        logger.error(f"Error reading CSV file: {e}")
    return questions
def write_questions(questions):
    try:
        with open(CSV_FILE, 'w', encoding='utf-8', newline='') as file:
            writer = csv.writer(file, delimiter='|')
            writer.writerow(['question', 'answer', 'user_answer'])
            for q in questions:
                writer.writerow([q['question'], q['correct_answer'], q['user_answer']])
        logger.info(f"Successfully wrote {len(questions)} questions to {CSV_FILE}")
    except Exception as e:
        logger.error(f"Error writing to CSV file: {e}")
@app.route('/')
def index():
    return send_from_directory('.', 'accuracy-quest-frontend.html')
@app.route('/health')
def health_check():
    logger.info("Health check endpoint accessed")
    return jsonify({"status": "healthy"}), 200
@app.route('/api/questions')
def get_questions():
    logger.info("Fetching questions")
    questions = read_questions()
    if not questions:
        logger.error("No questions available")
        return jsonify({"error": "No questions available"}), 500
    return jsonify(questions)
@app.route('/api/answer', methods=['POST'])
def submit_answer():
    data = request.json
    logger.info(f"Received answer submission: {data}")
    if not data or 'index' not in data or 'answer' not in data:
        logger.error("Invalid request data for answer submission")
        return jsonify({'success': False, 'error': 'Invalid request data'}), 400
    index, answer = data['index'], data['answer']
    questions = read_questions()
    if 0 <= index < len(questions):
        correct = (answer == questions[index]['correct_answer'])
        questions[index]['user_answer'] = answer
        write_questions(questions)
        logger.info(f"Answer submitted successfully for question {index}")
        return jsonify({
            'success': True,
            'correct': correct,
            'correct_answer': questions[index]['correct_answer']
        })
    logger.error(f"Invalid question index: {index}")
    return jsonify({'success': False, 'error': 'Invalid question index'}), 400
if __name__ == '__main__':
    logger.info(f"Current working directory: {os.getcwd()}")
    logger.info(f"CSV file path: {os.path.abspath(CSV_FILE)}")
    app.run(host='0.0.0.0', port=8080, debug=True)
```
### `accuracy-quest-frontend.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AccuracyQuest</title>
    <style>
        body {
            background-color: #f3f4f6;
            font-family: Arial, sans-serif;
        }
        .container {
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .accuracy {
            font-size: 18px;
            font-weight: bold;
        }
        .question-info {
            font-size: 18px;
            font-weight: bold;
            display: flex;
            align-items: center;
        }
        #currentQuestion {
            width: 30px;
            text-align: center;
            margin: 0 5px;
        }
        .question {
            font-size: 24px;
            margin-top: 20px;
            margin-bottom: 20px;
            text-align: left;
        }
        .buttons-container {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-bottom: 20px; /* Add margin-bottom to buttons-container */
        }
        .button-row {
            display: flex;
            gap: 10px;
        }
        .button {
            flex: 1;
            padding: 15px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            text-align: center;
        }
        .button:disabled {
            cursor: not-allowed;
        }
        .navigation-button {
            background-color: #4299e1;
            color: white;
        }
        .navigation-button:disabled {
            background-color: #a0aec0;
        }
        .answer-button {
            background-color: #e2e8f0;
        }
        .correct {
            background-color: #48bb78;
            color: white;
        }
        .incorrect {
            background-color: #e53e3e;
            color: white;
        }
		.progress-bar {
			width: 200px;
			height: 20px;
			background-color: #e0e0e0;
			border-radius: 10px;
			overflow: hidden;
			position: relative;
			display: inline-block;
			margin-left: 10px;
		}
		.progress-fill {
			height: 100%;
			width: 0;
			transition: width 0.5s ease-out, background-color 0.5s ease-out;
		}
		.progress-text {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			color: #000000;
			font-weight: bold;
			z-index: 1;
		}
    </style>
</head>
<body>
<div id="app" class="container">
    <div class="header">
        <div>
			<div class="accuracy">
				Total Accuracy:
				<div class="progress-bar" id="totalAccuracyBar">
					<div class="progress-fill" id="totalAccuracyFill"></div>
					<div class="progress-text" id="totalAccuracyText">0%</div>
				</div>
			</div>
			<div class="accuracy">
				20-Rolling Accuracy:
				<div class="progress-bar" id="rollingAccuracyBar">
					<div class="progress-fill" id="rollingAccuracyFill"></div>
					<div class="progress-text" id="rollingAccuracyText">0%</div>
				</div>
			</div>
        </div>
        <div class="question-info">
            Question <input type="text" id="currentQuestion" value="1">/<span id="totalQuestions">0</span>
        </div>
    </div>
    <div class="buttons-container">
        <div class="button-row">
            <button onclick="navigate(-1)" id="backButton" class="button navigation-button">Back</button>
            <button onclick="navigate(1)" id="forwardButton" class="button navigation-button">Forward</button>
        </div>
        <div class="button-row">
            <button onclick="submitAnswer('True')" id="trueButton" class="button answer-button">True</button>
            <button onclick="submitAnswer('False')" id="falseButton" class="button answer-button">False</button>
        </div>
    </div>
    <div id="questionContainer">
        <p id="questionText" class="question"></p>
    </div>
</div>
<script>
let questions = [];
let currentIndex = 0;
let totalCorrect = 0;
let answeredQuestions = [];
async function fetchWithRetry(url, options = {}, retries = 3) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
    } catch (error) {
        if (retries > 0) {
            console.log(`Retrying fetch to ${url}. Attempts left: ${retries - 1}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return fetchWithRetry(url, options, retries - 1);
        }
        throw error;
    }
}
async function checkBackendHealth() {
    try {
        const response = await fetchWithRetry('/health');
        const data = await response.json();
        if (data.status === 'healthy') {
            await fetchQuestions();
        }
    } catch (error) {
        console.error("Backend health check failed:", error);
        document.getElementById('questionText').textContent = `Error: Unable to connect to the backend. Please check if the server is running. (${error.message})`;
    }
}
async function fetchQuestions() {
    try {
        const response = await fetchWithRetry('/api/questions');
        questions = await response.json();
        if (Array.isArray(questions) && questions.length > 0) {
            document.getElementById('totalQuestions').textContent = questions.length;
            initializeAnsweredQuestions();
            calculateAccuracies();
            displayQuestion();
        } else {
            throw new Error("No questions received from the server");
        }
    } catch (error) {
        console.error("Error fetching questions:", error);
        document.getElementById('questionText').textContent = `Error loading questions: ${error.message}. Please check the console and ensure the backend is running.`;
    }
}
function initializeAnsweredQuestions() {
    answeredQuestions = questions.map(q => ({ ...q, correct: q.user_answer === q.correct_answer }));
}
function calculateAccuracies() {
    const answeredCount = answeredQuestions.filter(q => q.user_answer !== '').length;
    totalCorrect = answeredQuestions.filter(q => q.user_answer === q.correct_answer).length;
    const totalAccuracy = (answeredCount === 0) ? 0 : (totalCorrect / answeredCount) * 100;
    const last20Answered = answeredQuestions.filter(q => q.user_answer !== '').slice(-20);
    const last20Correct = last20Answered.filter(q => q.user_answer === q.correct_answer).length;
    const rollingAccuracy = (last20Answered.length === 0) ? 0 : (last20Correct / last20Answered.length) * 100;
    document.getElementById('totalAccuracy').textContent = totalAccuracy.toFixed(0);
    document.getElementById('rollingAccuracy').textContent = rollingAccuracy.toFixed(0);
}
function calculateAccuracies() {
    const answeredCount = answeredQuestions.filter(q => q.user_answer !== '').length;
    totalCorrect = answeredQuestions.filter(q => q.user_answer === q.correct_answer).length;
    const totalAccuracy = (answeredCount === 0) ? 0 : (totalCorrect / answeredCount) * 100;
    const last20Answered = answeredQuestions.filter(q => q.user_answer !== '').slice(-20);
    const last20Correct = last20Answered.filter(q => q.user_answer === q.correct_answer).length;
    const rollingAccuracy = (last20Answered.length === 0) ? 0 : (last20Correct / last20Answered.length) * 100;
    updateProgressBar('totalAccuracy', totalAccuracy);
    updateProgressBar('rollingAccuracy', rollingAccuracy);
}
function updateProgressBar(id, percentage) {
    const fillElement = document.getElementById(`${id}Fill`);
    const textElement = document.getElementById(`${id}Text`);
    const color = getColorForPercentage(percentage);
    fillElement.style.width = `${percentage}%`;
    fillElement.style.backgroundColor = color;
    textElement.textContent = `${percentage.toFixed(0)}%`;
}
function getColorForPercentage(percentage) {
    if (percentage <= 50) {
        // Red from 0% to 50%
        return 'rgb(255, 0, 0)';
    } else {
        // Transition from red to yellow to green from 50% to 100%
        const green = Math.round(((percentage - 50) / 50) * 255);
        const red = Math.round(((100 - percentage) / 50) * 255);
        return `rgb(${red}, ${green}, 0)`;
    }
}
function displayQuestion() {
    if (questions.length === 0) {
        document.getElementById('questionText').textContent = 'No questions available.';
        return;
    }
    const question = questions[currentIndex];
    document.getElementById('questionText').textContent = question.question;
    document.getElementById('currentQuestion').value = currentIndex + 1;
    updateButtons();
}
function updateButtons() {
    const question = questions[currentIndex];
    if (question.user_answer) {
        document.getElementById('trueButton').disabled = true;
        document.getElementById('falseButton').disabled = true;
        colorAnswers(question.user_answer === question.correct_answer, question.user_answer);
    } else {
        document.getElementById('trueButton').disabled = false;
        document.getElementById('falseButton').disabled = false;
        document.getElementById('trueButton').className = 'button answer-button';
        document.getElementById('falseButton').className = 'button answer-button';
    }
    document.getElementById('backButton').disabled = currentIndex === 0;
    document.getElementById('forwardButton').disabled = currentIndex === questions.length - 1;
}
function colorAnswers(isCorrect, answer) {
    document.getElementById('trueButton').className = 'button answer-button';
    document.getElementById('falseButton').className = 'button answer-button';
    const selectedButton = document.getElementById(`${answer.toLowerCase()}Button`);
    selectedButton.className = `button answer-button ${isCorrect ? 'correct' : 'incorrect'}`;
}
async function submitAnswer(answer) {
    try {
        const response = await fetchWithRetry('/api/answer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ index: currentIndex, answer }),
        });
        const data = await response.json();
        if (data.success) {
            const question = questions[currentIndex];
            question.user_answer = answer;
            const isCorrect = data.correct;
            answeredQuestions[currentIndex].correct = isCorrect;
            answeredQuestions[currentIndex].user_answer = answer;
            if (isCorrect) {
                totalCorrect++;
            }
            calculateAccuracies();
            colorAnswers(isCorrect, answer);
            updateButtons();
        }
    } catch (error) {
        console.error("Error submitting answer:", error);
        alert(`Error submitting answer: ${error.message}`);
    }
}
function navigate(direction) {
    currentIndex += direction;
    displayQuestion();
}
document.getElementById('currentQuestion').addEventListener('change', (event) => {
    let value = parseInt(event.target.value, 10);
    if (isNaN(value) || value < 1 || value > questions.length) {
        event.target.value = currentIndex + 1;
    } else {
        currentIndex = value - 1;
        displayQuestion();
    }
});
checkBackendHealth();
</script>
</body>
</html>
```
### `questions.csv`:
```csv
question|answer|user_answer
Question #1 - Answer: False|False|False
Question #2 - Answer: True|True|True
Question #3 - Answer: False|False|True
Question #4 - Answer: True|True|True
```
### `start-accuracy-quest.bat`:
```bat
@echo off
cd /d "%~dp0"
start python accuracy-quest-backend.py
start http://localhost:8080
```
# Problem:
I dislike the colors of the progress bar. I would like brighter colors from 50% to 100% like matplotlib's "RdYlGn" cmap.
# Task:
Make code changes. Lets 1. understand problem, 2. make detailed to-do list, 3. devise detailed plan to solve problem. Then lets take deep breath, carry out plan, and solve problem step by step.