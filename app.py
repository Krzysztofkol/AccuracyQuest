import os
import csv
import random
import logging
import json
import sys
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS, cross_origin

# Add immediate debugging
print("Python executable:", sys.executable)
print("Current working directory:", os.getcwd())

# Load configuration
with open('config.json') as config_file:
    config = json.load(config_file)
    PORT = config['backend_port']

# Change static_url_path to empty string to serve from root
app = Flask(__name__, static_folder='frontend', static_url_path='')
CORS(app)

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Update CSV file path
CSV_FILE = os.path.join('questions', 'questions.csv')

def get_subject_files():
    questions_dir = 'questions'
    return [f for f in os.listdir(questions_dir) 
            if f.endswith('.csv') and f != 'questions.csv']

def normalize_answer(answer):
    """Normalize answer to uppercase TRUE/FALSE regardless of language"""
    answer = str(answer).lower().strip()
    if answer in ['true', 'prawda']:
        return 'TRUE'
    elif answer in ['false', 'fałsz', 'falsz', 'fałs', 'falš']:
        return 'FALSE'
    return answer.upper()

def read_subject_file(filename):
    questions = []
    subject = os.path.splitext(filename)[0]
    filepath = os.path.join('questions', filename)
    try:
        logger.debug(f"Reading subject file: {filepath}")
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.read().splitlines()
            # Skip the header line
            if len(lines) > 0:
                lines = lines[1:]
            for line in lines:
                # Split from the right into at most 3 parts
                parts = line.rsplit('|', 2)
                if len(parts) >= 2:
                    question = parts[0]
                    answer = parts[1]
                    user_answer = parts[2] if len(parts) == 3 else ''
                    questions.append({
                        'subject': subject,
                        'question': question,
                        'correct_answer': normalize_answer(answer),
                        'user_answer': ''
                    })
                else:
                    logger.warning(f"Invalid row in {filename}: {line}")
        logger.info(f"Successfully loaded {len(questions)} questions from {filename}")
    except Exception as e:
        logger.error(f"Error reading subject file {filename}: {e}")
        logger.exception(e)  # Log full traceback
    return questions

def create_questions_file():
    all_questions = []
    subject_files = get_subject_files()
    subject_questions = {f: read_subject_file(f) for f in subject_files}
    
    while True:
        # Get subjects that still have questions
        available_subjects = {
            subject: questions 
            for subject, questions in subject_questions.items() 
            if len(questions) > 0
        }
        
        if not available_subjects:
            break
            
        # Take one round of questions - one from each available subject
        round_questions = []
        for subject, questions in available_subjects.items():
            question = random.choice(questions)
            round_questions.append(question)
            # Remove the selected question from available pool
            subject_questions[subject].remove(question)
        
        # Shuffle the round questions before adding to final list
        random.shuffle(round_questions)
        all_questions.extend(round_questions)
    
    # Write to questions.csv
    with open(CSV_FILE, 'w', encoding='utf-8', newline='') as file:
        writer = csv.writer(file, delimiter=';', quotechar='"', quoting=csv.QUOTE_ALL, escapechar='\\')
        writer.writerow(['subject', 'question', 'answer', 'user_answer'])
        for q in all_questions:
            writer.writerow([q['subject'], q['question'], q['correct_answer'], q['user_answer']])
    
    return all_questions

def sort_questions_by_answered(questions):
    """Sort questions so answered ones appear first while maintaining relative order."""
    answered = [q for q in questions if q['user_answer']]
    unanswered = [q for q in questions if not q['user_answer']]
    return answered + unanswered

def get_questions_hash():
    """Generate a hash representing the current state of subject files"""
    hash_str = ""
    for filename in sorted(get_subject_files()):
        filepath = os.path.join('questions', filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                hash_str += f.read()
        except Exception as e:
            logger.error(f"Error reading file {filename} for hash: {e}")
    return hash(hash_str)

def remove_unanswered_questions(questions):
    """Remove all unanswered questions from the list"""
    return [q for q in questions if q['user_answer']]

def sample_new_questions():
    """Sample new questions from all subject files"""
    return create_questions_file()

def check_and_update_questions():
    """Check for changes in subject files and update questions if needed"""
    # Read questions without checking for updates to prevent recursion
    questions = read_questions(check_for_updates=False)
    if not questions:
        return sample_new_questions()

    # Keep only answered questions
    answered_questions = remove_unanswered_questions(questions)
    
    # Sample new questions
    new_questions = sample_new_questions()
    
    # Remove any new questions that match answered questions to avoid duplicates
    answered_set = {(q['subject'], q['question']) for q in answered_questions}
    unique_new_questions = [
        q for q in new_questions 
        if (q['subject'], q['question']) not in answered_set
    ]
    
    # Combine answered questions with new ones
    updated_questions = answered_questions + unique_new_questions
    
    # Write the updated questions back to file
    write_questions(updated_questions)
    
    return updated_questions

def read_questions(check_for_updates=True):
    """Read questions from CSV file. Set check_for_updates=False to skip update check."""
    questions = []
    try:
        if not os.path.exists(CSV_FILE):
            return create_questions_file()
            
        with open(CSV_FILE, 'r', encoding='utf-8') as file:
            reader = csv.reader(file, delimiter=';', quotechar='"', escapechar='\\', quoting=csv.QUOTE_ALL)
            next(reader)  # Skip header
            for row in reader:
                if len(row) >= 3:
                    correct_answer = normalize_answer(row[2])
                    user_answer = normalize_answer(row[3]) if len(row) > 3 and row[3] else ''
                    questions.append({
                        'subject': row[0],
                        'question': row[1],
                        'correct_answer': correct_answer,
                        'user_answer': user_answer
                    })
        
        # Only check for updates if flag is True
        if check_for_updates:
            current_hash = get_questions_hash()
            try:
                with open('questions/last_hash.txt', 'r') as f:
                    last_hash = int(f.read().strip())
            except:
                last_hash = None
                
            if last_hash != current_hash:
                logger.info("Changes detected in subject files, updating questions...")
                questions = check_and_update_questions()
                # Save new hash
                with open('questions/last_hash.txt', 'w') as f:
                    f.write(str(current_hash))
        
        questions = sort_questions_by_answered(questions)
        logger.info(f"Successfully loaded {len(questions)} questions")
    except Exception as e:
        logger.error(f"Error reading CSV file: {e}")
    return questions

def write_questions(questions):
    try:
        os.makedirs(os.path.dirname(CSV_FILE), exist_ok=True)
        with open(CSV_FILE, 'w', encoding='utf-8', newline='') as file:
            writer = csv.writer(file, delimiter=';', quotechar='"', quoting=csv.QUOTE_ALL, escapechar='\\')
            writer.writerow(['subject', 'question', 'answer', 'user_answer'])
            for q in questions:
                writer.writerow([q['subject'], q['question'], q['correct_answer'], q['user_answer']])
        logger.info(f"Successfully wrote {len(questions)} questions to {CSV_FILE}")
    except Exception as e:
        logger.error(f"Error writing to CSV file: {e}")

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

# Add route for serving static files from frontend directory
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

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
    
    index = data['index']
    answer = normalize_answer(data['answer'])
    questions = read_questions()
    
    if 0 <= index < len(questions):
        normalized_correct = normalize_answer(questions[index]['correct_answer'])
        logger.debug(f"Comparing answers - User: {answer}, Correct: {normalized_correct}")
        correct = (answer == normalized_correct)
        logger.debug(f"Answer is {'correct' if correct else 'incorrect'}")
        questions[index]['user_answer'] = answer
        write_questions(questions)
        logger.info(f"Answer submitted successfully for question {index}")
        return jsonify({
            'success': True,
            'correct': correct,
            'correct_answer': normalized_correct
        })

    logger.error(f"Invalid question index: {index}")
    return jsonify({'success': False, 'error': 'Invalid question index'}), 400

@app.route('/reset-wrong', methods=['POST'])
@cross_origin()
def reset_wrong_answers():
    try:
        questions = read_questions()
        for q in questions:
            if q['user_answer'] and normalize_answer(q['user_answer']) != normalize_answer(q['correct_answer']):
                q['user_answer'] = ''
        
        write_questions(questions)
        return jsonify({"status": "success"}), 200
    except Exception as e:
        print(f"Error in reset_wrong_answers: {str(e)}", file=sys.stderr)
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/update-questions', methods=['POST'])
@cross_origin()
def force_update_questions():
    try:
        questions = check_and_update_questions()
        return jsonify({"status": "success", "question_count": len(questions)}), 200
    except Exception as e:
        logger.error(f"Error updating questions: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    try:
        # Ensure questions directory exists
        os.makedirs('questions', exist_ok=True)
        
        # Add startup logging
        print(f"Starting server on port {PORT}")
        print(f"Static folder path: {os.path.abspath(app.static_folder)}")
        print(f"CSV file path: {os.path.abspath(CSV_FILE)}")
        
        app.run(host='0.0.0.0', port=PORT, debug=True)
    except Exception as e:
        print(f"Startup error: {str(e)}", file=sys.stderr)
        input("Press Enter to exit...")
        sys.exit(1)