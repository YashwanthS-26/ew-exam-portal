import { Router } from 'express';
import {
    getCategories,
    createCategory,
    deleteCategory,
    getQuestions,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    bulkImport
} from '../controllers/questionBankController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Protected routes (Only Teachers/Admins)
router.use(authMiddleware);

// Categories
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.delete('/categories/:id', deleteCategory);

// Questions
router.get('/', getQuestions);
router.post('/', addQuestion);
router.put('/:id', updateQuestion);
router.delete('/:id', deleteQuestion);

// Bulk Import
router.post('/import', bulkImport);

export default router;
