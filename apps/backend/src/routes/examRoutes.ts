import { Router } from 'express';
import {
    createExam, getExams, getExam, publishExam, getStats,
    addQuestions, getExamQuestions, updateExam, getResults, getAllResults,
    deleteExam, addSingleQuestion, deleteSingleQuestion, joinExam,
    validateExam, grantReattempt
} from '../controllers/examController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// ─── PUBLIC ───────────────────────────────────────────────────────────────────
router.get('/stats', getStats);
router.get('/results', getAllResults);
router.post('/join', joinExam);              // Student joins exam
router.get('/validate/:examCode', validateExam);  // Validate exam code (step 1)
router.get('/', getExams);

// Protected - create
router.post('/', authMiddleware, createExam);

// Single exam (order matters: specific paths before :id params)
router.get('/:id', getExam);
router.patch('/:id', authMiddleware, updateExam);
router.delete('/:id', authMiddleware, deleteExam);
router.post('/:id/publish', authMiddleware, publishExam);

// Questions bulk
router.post('/:id/questions', authMiddleware, addQuestions);
router.get('/:id/questions', authMiddleware, getExamQuestions);

// Questions single (save-as-you-go)
router.post('/:id/questions/single', authMiddleware, addSingleQuestion);
router.delete('/:id/questions/:qid', authMiddleware, deleteSingleQuestion);

// Results
router.get('/:id/results', authMiddleware, getResults);

// Grant re-attempt to a student
router.post('/:id/reattempt', authMiddleware, grantReattempt);

export default router;
