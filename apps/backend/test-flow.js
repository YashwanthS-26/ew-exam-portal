const axios = require('axios');
const API_URL = 'http://localhost:3000';

async function run() {
    try {
        console.log('1. Validating Exam...');
        // Try a dummy code if it exists, but actually we need an active exam.
        // First fetch all exams to find a published one.
        
        let examCode = 'TEST01';
        let examId = null;

        const examsRes = await axios.get(`${API_URL}/api/exams`);
        const publishedExams = examsRes.data.filter(e => e.status === 'PUBLISHED' || e.status === 'ACTIVE');
        if (publishedExams.length === 0) {
            console.error('No published or active exams found. Create one first.');
            return;
        }

        const activeExam = publishedExams[0];
        examCode = activeExam.exam_code;
        examId = activeExam.id;
        console.log(`Using active exam: ${examCode} (${activeExam.title})`);

        // Force it to ACTIVE if it's just PUBLISHED
        if (activeExam.status !== 'ACTIVE') {
            console.log('Publishing/Activating exam via Supabase is required, but let us try joining...');
        }

        console.log('2. Joining Exam...');
        const joinPayload = {
            exam_code: examCode,
            student_name: 'Test Student ' + Date.now(),
            roll_number: 'TST-' + Date.now(),
            department: 'Test Dept'
        };

        const joinRes = await axios.post(`${API_URL}/api/exams/join`, joinPayload);
        const { attemptId, questions } = joinRes.data;
        console.log(`Joined! Attempt ID: ${attemptId}, Total Questions: ${questions.length}`);

        if (questions.length === 0) {
            console.error('No questions in exam. Cannot test saving.');
            return;
        }

        console.log('3. Saving Answers...');
        const answers = [
            {
                questionId: questions[0].id,
                selectedOption: 'A'
            }
        ];

        try {
            const saveRes = await axios.post(`${API_URL}/api/attempts/${attemptId}/answers`, { answers });
            console.log('Save response:', saveRes.data);
        } catch (saveErr) {
            console.error('Save failed:', saveErr.response?.data || saveErr.message);
        }

        console.log('4. Evaluating...');
        try {
            const evalRes = await axios.post(`${API_URL}/api/attempts/${attemptId}/submit`);
            console.log('Evaluation response:', evalRes.data);
        } catch (evalErr) {
            console.error('Evaluate failed:', evalErr.response?.data || evalErr.message);
        }

    } catch (err) {
        console.error('Fatal Error:', err.response?.data || err.message);
    }
}

run();
