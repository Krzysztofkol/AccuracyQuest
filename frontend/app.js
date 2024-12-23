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
            // Find first unanswered question
            currentIndex = questions.findIndex(q => !q.user_answer);
            // If all questions are answered, stay at the beginning
            if (currentIndex === -1) currentIndex = 0;
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
    console.log('Initialized answeredQuestions:', answeredQuestions);
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
    percentage = Math.max(0, Math.min(100, percentage));
    let r, g, b = 0;
    if (percentage <= 50) {
        return 'rgb(255, 0, 0)';
    } else {
        const adjustedPercentage = (percentage - 50) * 2;
        if (adjustedPercentage < 50) {
            r = 255;
            g = Math.round(5.1 * adjustedPercentage);
        } else {
            r = Math.round(510 - 5.1 * adjustedPercentage);
            g = 255;
        }
    }
    return `rgb(${r}, ${g}, ${b})`;
}

function displayQuestion() {
    if (questions.length === 0) {
        document.getElementById('questionText').textContent = 'No questions available.';
        return;
    }
    const question = questions[currentIndex];
    document.getElementById('questionText').textContent = `[${question.subject}] ${question.question}`;
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

// Start the application
checkBackendHealth();
