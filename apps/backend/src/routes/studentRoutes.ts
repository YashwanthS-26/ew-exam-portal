import { Router } from 'express';
import { joinExam, getQuestionsForAttempt } from '../controllers/studentController';
import { submitExam } from '../controllers/evaluationController';

const router = Router();

router.post('/join', joinExam);
router.get('/:attemptId/questions', getQuestionsForAttempt);
router.post('/:attemptId/submit', submitExam);

export default router;
