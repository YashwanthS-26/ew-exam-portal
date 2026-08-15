import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// ─── CATEGORIES ─────────────────────────────────────────────────────────────

export const getCategories = async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('question_categories')
            .select('*')
            .order('name');
        
        if (error) throw error;

        // Also fetch question counts for each category
        const { data: qData, error: qErr } = await supabase
            .from('question_bank')
            .select('category_id');
            
        const counts: Record<string, number> = {};
        let uncategorizedCount = 0;
        if (!qErr && qData) {
            qData.forEach(q => {
                if (q.category_id) {
                    counts[q.category_id] = (counts[q.category_id] || 0) + 1;
                } else {
                    uncategorizedCount++;
                }
            });
        }

        const categoriesWithCounts = data.map(c => ({
            ...c,
            question_count: counts[c.id] || 0
        }));

        res.status(200).json({ categories: categoriesWithCounts, uncategorizedCount });
    } catch (err: any) {
        console.error('Get categories error:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};

export const createCategory = async (req: Request, res: Response) => {
    try {
        const { name, description } = req.body;
        const { data, error } = await supabase
            .from('question_categories')
            .insert([{ 
                name: name.trim(), 
                description, 
                created_by: (req as any).user?.id || null 
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err: any) {
        console.error('Create category error:', err);
        res.status(400).json({ error: err.message });
    }
};

export const deleteCategory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // The foreign key is ON DELETE SET NULL, so questions will be uncategorized
        const { error } = await supabase.from('question_categories').delete().eq('id', id);
        if (error) throw error;
        res.status(200).json({ message: 'Category deleted successfully' });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};

// ─── QUESTIONS ─────────────────────────────────────────────────────────────

export const getQuestions = async (req: Request, res: Response) => {
    try {
        const { category_id } = req.query;
        let query = supabase
            .from('question_bank')
            .select('*, category:question_categories(id, name)')
            .order('created_at', { ascending: false });
            
        if (category_id === 'uncategorized') {
            query = query.is('category_id', null);
        } else if (category_id) {
            query = query.eq('category_id', category_id);
        }

        const { data, error } = await query;
        if (error) throw error;
        res.status(200).json(data);
    } catch (err: any) {
        console.error('Get question bank error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const addQuestion = async (req: Request, res: Response) => {
    try {
        const q = req.body;
        const payload = {
            category_id: q.category_id || null,
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c || null,
            option_d: q.option_d || null,
            correct_option: q.correct_option,
            marks: Number(q.marks) || 1,
            negative_marks: Number(q.negative_marks) || 0,
            difficulty: q.difficulty || 'Medium',
            explanation: q.explanation || null,
            created_by: (req as any).user?.id || null
        };

        const { data, error } = await supabase.from('question_bank').insert([payload]).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};

export const updateQuestion = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const q = req.body;
        
        const payload = {
            category_id: q.category_id || null,
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c || null,
            option_d: q.option_d || null,
            correct_option: q.correct_option,
            marks: Number(q.marks) || 1,
            negative_marks: Number(q.negative_marks) || 0,
            difficulty: q.difficulty || 'Medium',
            explanation: q.explanation || null,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase.from('question_bank').update(payload).eq('id', id).select().single();
        if (error) throw error;
        res.status(200).json(data);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};

export const deleteQuestion = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('question_bank').delete().eq('id', id);
        if (error) throw error;
        res.status(200).json({ message: 'Question deleted successfully' });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
};

// ─── BULK IMPORT ───────────────────────────────────────────────────────────

export const bulkImport = async (req: Request, res: Response) => {
    try {
        const { questions } = req.body;
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'No questions provided' });
        }

        const userId = (req as any).user?.id || null;

        const payloads = questions.map((q: any) => ({
            category_id: q.category_id || null,
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c || null,
            option_d: q.option_d || null,
            correct_option: q.correct_option,
            marks: Number(q.marks) || 1,
            negative_marks: Number(q.negative_marks) || 0,
            difficulty: q.difficulty || 'Medium',
            explanation: q.explanation || null,
            created_by: userId
        }));

        const { data, error } = await supabase.from('question_bank').insert(payloads).select();
        
        if (error) throw error;

        res.status(201).json({ 
            message: `${data.length} questions imported successfully`,
            imported_count: data.length,
            data
        });
    } catch (err: any) {
        console.error('Bulk import error:', err);
        res.status(500).json({ error: err.message || 'Bulk import failed' });
    }
};
