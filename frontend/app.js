console.log("JavaScript file loaded"); // Initial debug log

let questions = [];
let currentIndex = 0;
let totalCorrect = 0;
let answeredQuestions = [];

async function fetchWithRetry(url, options = {}, retries = 3) {
    console.log("fetchWithRetry called with URL:", url); // Debug log
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
    console.log("checkBackendHealth called"); // Debug log
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
    console.log("fetchQuestions called"); // Debug log
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
    console.log("initializeAnsweredQuestions called"); // Debug log
    answeredQuestions = questions.map(q => ({
        ...q,
        correct: normalizeAnswer(q.user_answer) === normalizeAnswer(q.correct_answer)
    }));
    console.log('Initialized answeredQuestions:', answeredQuestions);
}

function calculateAccuracies() {
    console.log("calculateAccuracies called"); // Debug log
    // Only count each question once
    const answered = answeredQuestions.filter(q => q.user_answer !== '');
    const correctCount = answered.filter(q => 
        normalizeAnswer(q.user_answer) === normalizeAnswer(q.correct_answer)
    ).length;
    
    const totalAccuracy = (answered.length === 0) ? 0 : (correctCount / answered.length) * 100;
    
    const last20 = answered.slice(-20);
    const last20Correct = last20.filter(q => 
        normalizeAnswer(q.user_answer) === normalizeAnswer(q.correct_answer)
    ).length;
    const rollingAccuracy = (last20.length === 0) ? 0 : (last20Correct / last20.length) * 100;

    // Calculate and update answered percentage with 2 decimal places
    const answeredPercentage = (answered.length / questions.length * 100).toFixed(2);
    document.getElementById('answeredPercentage').textContent = answeredPercentage;

    updateProgressBar('totalAccuracy', totalAccuracy);
    updateProgressBar('rollingAccuracy', rollingAccuracy);
}

function updateProgressBar(id, percentage) {
    console.log("updateProgressBar called with id:", id, "and percentage:", percentage); // Debug log
    const fillElement = document.getElementById(`${id}Fill`);
    const textElement = document.getElementById(`${id}Text`);
    const color = getColorForPercentage(percentage);
    fillElement.style.width = `${percentage}%`;
    fillElement.style.backgroundColor = color;
    textElement.textContent = `${percentage.toFixed(2)}%`;
}

function getColorForPercentage(percentage) {
    console.log("getColorForPercentage called with percentage:", percentage); // Debug log
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
    console.log("displayQuestion called"); // Debug log
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
    console.log("updateButtons called"); // Debug log
    const question = questions[currentIndex];
    if (question.user_answer) {
        document.getElementById('trueButton').disabled = true;
        document.getElementById('falseButton').disabled = true;
        const isCorrect = normalizeAnswer(question.user_answer) === normalizeAnswer(question.correct_answer);
        colorAnswers(isCorrect, question.user_answer);
    } else {
        document.getElementById('trueButton').disabled = false;
        document.getElementById('falseButton').disabled = false;
        document.getElementById('trueButton').className = 'button answer-button';
        document.getElementById('falseButton').className = 'button answer-button';
    }
    document.getElementById('backButton').disabled = currentIndex === 0;
    document.getElementById('forwardButton').disabled = currentIndex === questions.length - 1;
}

function colorAnswers(isCorrect, userAnswer) {
    console.log("colorAnswers called with isCorrect:", isCorrect, "and userAnswer:", userAnswer); // Debug log
    // Reset both buttons
    document.getElementById('trueButton').className = 'button answer-button';
    document.getElementById('falseButton').className = 'button answer-button';
    
    // Get the button ID for the user's answer
    const userAnswerNormalized = normalizeAnswer(userAnswer);
    const userButtonId = userAnswerNormalized === 'TRUE' ? 'trueButton' : 'falseButton';
    
    // Style the button the user clicked
    const userButton = document.getElementById(userButtonId);
    userButton.className = `button answer-button ${isCorrect ? 'correct' : 'incorrect'}`;
}

function normalizeAnswer(answer) {
    console.log("normalizeAnswer called with answer:", answer); // Debug log
    // Handle booleans:
    if (typeof answer === 'boolean') {
        return answer ? 'TRUE' : 'FALSE';
    }
    const normalized = answer.toString().toLowerCase().trim();
    if (normalized === 'true' || normalized === 'prawda') return 'TRUE';
    if (normalized === 'false' || normalized === 'fałsz' || normalized === 'falsz' || 
        normalized === 'fałs' || normalized === 'falš') return 'FALSE';
    return normalized.toUpperCase();
}

async function submitAnswer(answer) {
    console.log("submitAnswer called with:", answer); // Initial debug log
    try {
        const normalizedAnswer = normalizeAnswer(answer);
        console.log("Submitting answer:", normalizedAnswer);
        
        const response = await fetchWithRetry('/api/answer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ index: currentIndex, answer: normalizedAnswer }),
        });
        
        const data = await response.json();
        console.log("Server response:", data);
        
        if (data.success) {
            const question = questions[currentIndex];
            question.user_answer = normalizedAnswer;
            
            // Use the server's determination of correctness
            const isCorrect = data.correct;
            console.log("Answer correctness:", isCorrect);
            console.log("Normalized user answer:", normalizedAnswer);
            console.log("Normalized correct answer:", data.correct_answer);
            
            answeredQuestions[currentIndex].correct = isCorrect;
            answeredQuestions[currentIndex].user_answer = normalizedAnswer;
            
            if (isCorrect) {
                totalCorrect++;
            }
            
            calculateAccuracies();
            colorAnswers(isCorrect, normalizedAnswer);
            updateButtons();
        }
    } catch (error) {
        console.error("Error submitting answer:", error);
        alert(`Error submitting answer: ${error.message}`);
    }
}

async function resetWrongAnswers() {
    try {
        const response = await fetch('/reset-wrong', {
            method: 'POST'
        });
        
        // Force page reload regardless of response
        window.location.href = window.location.href;
        
    } catch (error) {
        console.error('Error resetting wrong answers:', error);
        alert('Failed to reset wrong answers. Please try again.');
    }
}

function navigate(direction) {
    console.log("navigate called with direction:", direction); // Debug log
    currentIndex += direction;
    displayQuestion();
}

document.getElementById('currentQuestion').addEventListener('change', (event) => {
    console.log("currentQuestion change event triggered"); // Debug log
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
