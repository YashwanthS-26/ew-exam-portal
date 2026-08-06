const axios = require('axios');
const { io } = require('socket.io-client');

const API_URL = 'http://localhost:3000';
const NUM_STUDENTS = 70;
const DURATION_SECONDS = 15;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runStudent(index, examCode) {
    const studentName = `LoadTest Student ${index}`;
    const rollNumber = `LT-${index}`;
    let attemptId = null;
    let questions = [];

    // 1. Join Exam via HTTP
    try {
        const joinRes = await axios.post(`${API_URL}/api/exams/join`, {
            student_name: studentName,
            roll_number: rollNumber,
            exam_code: examCode,
            department: 'LoadTest Dept'
        });
        attemptId = joinRes.data.attemptId;
    } catch (e) {
        console.error(`[Student ${index}] Failed to join:`, e.response?.data || e.message);
        return false;
    }

    // 2. Connect Socket
    const socket = io(API_URL, { transports: ['websocket'] });
    socket.emit('join_exam', { examCode, attemptId, name: studentName, rollNumber });

    // 3. Fetch Questions
    try {
        const qRes = await axios.get(`${API_URL}/api/attempts/${attemptId}/questions`);
        questions = qRes.data;
    } catch (e) {
        console.error(`[Student ${index}] Failed to fetch questions:`, e.response?.data || e.message);
        return false;
    }

    if (questions.length === 0) {
        console.error(`[Student ${index}] No questions assigned!`);
        return false;
    }

    // 4. Simulate active answering over time
    const answersMap = {};
    const iterations = Math.floor(DURATION_SECONDS / 5); // Submit batch every 5 seconds
    
    for (let i = 0; i < iterations; i++) {
        await delay(5000);
        // Answer a random question
        const q = questions[Math.floor(Math.random() * questions.length)];
        const opts = ['A', 'B', 'C', 'D'];
        answersMap[q.id] = opts[Math.floor(Math.random() * opts.length)];
        
        const answersArray = Object.entries(answersMap).map(([questionId, selectedOption]) => ({ questionId, selectedOption }));
        
        // POST to backend
        try {
            await axios.post(`${API_URL}/api/attempts/${attemptId}/answers`, { answers: answersArray });
        } catch (e) {
            console.error(`[Student ${index}] Sync failed:`, e.response?.data || e.message);
        }
    }

    // 5. Final Submit via Socket
    return new Promise((resolve) => {
        socket.emit('submit_exam', { attemptId, examCode, reason: 'normal' });
        socket.once('exam_submitted', (data) => {
            if (data.success && data.result) {
                // Ensure the result has a score and did not fail due to missing answers
                if (data.result.score === 0 && data.result.correct === 0 && data.result.wrong === 0) {
                     console.error(`[Student ${index}] FAILED: Scored 0 with no answers evaluated!`);
                     resolve(false);
                } else {
                     console.log(`[Student ${index}] Finished successfully. Score: ${data.result.score}/${data.result.totalMarks}`);
                     resolve(true);
                }
            } else {
                resolve(false);
            }
            socket.disconnect();
        });
        
        // Failsafe timeout
        setTimeout(() => {
            console.error(`[Student ${index}] Socket timeout during submission`);
            resolve(false);
        }, 10000);
    });
}

async function startLoadTest() {
    console.log(`Starting Load Test with ${NUM_STUDENTS} concurrent students...`);
    
    // First, find an active exam
    let examCode = 'TEST1';
    try {
        const examsRes = await axios.get(`${API_URL}/api/exams`);
        const activeExams = examsRes.data.filter(e => e.status === 'PUBLISHED' || e.status === 'ACTIVE');
        if (activeExams.length > 0) {
            examCode = activeExams[0].exam_code;
        }
    } catch (e) {
        console.warn('Could not fetch active exams, defaulting to TEST1');
    }

    console.log(`Using Exam Code: ${examCode}`);

    const promises = [];
    for (let i = 0; i < NUM_STUDENTS; i++) {
        promises.push(runStudent(i, examCode));
        // Stagger connections slightly by 50ms to simulate real-world realistic joining
        await delay(50);
    }

    console.log('All students spawned. Waiting for test duration to complete...');
    
    const results = await Promise.all(promises);
    const successes = results.filter(r => r === true).length;
    const failures = results.length - successes;

    console.log('\n--- LOAD TEST RESULTS ---');
    console.log(`Total Students: ${NUM_STUDENTS}`);
    console.log(`Successful Submissions: ${successes}`);
    console.log(`Failures: ${failures}`);

    if (failures > 0) {
        console.error('CRITICAL FAILURE: System could not handle the load safely.');
        process.exit(1);
    } else {
        console.log('SUCCESS: System handled 70 concurrent users flawlessly.');
        process.exit(0);
    }
}

startLoadTest();
