import { Router } from 'express';
import { joinExam, getQuestionsForAttempt, saveAnswers } from '../controllers/studentController';
import { submitExam } from '../controllers/evaluationController';
import { reEvaluate } from '../controllers/evaluationController';

const router = Router();

router.post('/join', joinExam);
router.get('/:attemptId/questions', getQuestionsForAttempt);
router.post('/:attemptId/answers', saveAnswers);   // Bulk save answers via HTTP — primary guaranteed path
router.post('/:attemptId/submit', submitExam);
router.post('/:attemptId/re-evaluate', reEvaluate); // Admin: re-calculate score for an attempt

export default router;
