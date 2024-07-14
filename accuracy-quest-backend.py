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