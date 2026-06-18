import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// Helper to check if exam code is unique
const isExamCodeUnique = async (code: string, excludeId?: string) => {
    let query = supabase.from('exams').select('id').eq('exam_code', code);
    if (excludeId) {
        query = query.neq('id', excludeId);
    }
    const { data } = await query;
    return !data || data.length === 0;
};

export const createExam = async (req: Request, res: Response) => {
    try {
        const {
            title, description, exam_code, duration_minutes,
            cooldown_minutes, total_questions_pool, questions_to_display,
            randomization_enabled, show_results_to_students
        } = req.body;

        // Basic validation
        if (!title || !exam_code || !duration_minutes) {
            return res.status(400).json({ error: 'Missing required fields: title, exam_code, duration_minutes' });
        }

        if (!(await isExamCodeUnique(exam_code))) {
            return res.status(400).json({ error: 'Exam code must be unique' });
        }

        const pool = Number(total_questions_pool) || 0;
        const toDisplay = questions_to_display ? Number(questions_to_display) : pool;

        const insertPayload: Record<string, any> = {
            title,
            description: description || null,
            exam_code,
            duration_minutes: Number(duration_minutes),
            cooldown_minutes: Number(cooldown_minutes) || 0,
            total_questions_pool: pool,
            randomization_enabled: randomization_enabled !== undefined ? randomization_enabled : true,
            show_results_to_students: show_results_to_students !== undefined ? show_results_to_students : false,
            created_by: (req as any).user?.id || null,
            status: 'DRAFT',
            start_time: new Date().toISOString(), // Dummy value to satisfy DB NOT NULL constraint. Overwritten when exam starts.
        };
        // Only include questions_to_display if we have a non-zero value
        // This avoids Supabase JS stripping falsy 0
        insertPayload['questions_to_display'] = toDisplay > 0 ? toDisplay : pool > 0 ? pool : 1;

        const { data, error } = await supabase.from('exams').insert([insertPayload]).select().single();

        if (error) {
            console.error('Supabase insert error:', error);
            return res.status(400).json({ error: error.message });
        }

        res.status(201).json(data);
    } catch (err) {
        console.error('Create exam error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getExams = async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('exams')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.status(200).json(data);
    } catch (err) {
        console.error('Get exams error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getExam = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase.from('exams').select('*').eq('id', id).single();
        if (error) throw error;
        res.status(200).json(data);
    } catch (err) {
        console.error('Get exam error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const publishExam = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Check if there are enough questions
        const { count, error: qError } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('exam_id', id);

        if (qError) throw qError;

        const { data: examData } = await supabase.from('exams').select('total_questions_pool').eq('id', id).single();

        if (count === null || count < (examData?.total_questions_pool || 0)) {
            return res.status(400).json({ error: 'Not enough questions added to meet the question pool size' });
        }

        const { data, error } = await supabase
            .from('exams')
            .update({ status: 'PUBLISHED', updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json(data);
    } catch (err) {
        console.error('Publish exam error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getStats = async (req: Request, res: Response) => {
    try {
        const { count: totalExams } = await supabase.from('exams').select('*', { count: 'exact', head: true });
        const { count: activeExams } = await supabase.from('exams').select('*', { count: 'exact', head: true }).eq('status', 'PUBLISHED');
        
        // Mock data for candidates and completion rate as we might not have full tables yet
        // In a real app, query `exam_attempts` or similar
        const stats = {
            totalExams: totalExams || 0,
            activeExams: activeExams || 0,
            totalCandidates: 142, // Mocked
            completionRate: 85, // Mocked percentage
        };

        res.status(200).json(stats);
    } catch (err) {
        console.error('Get stats error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const addQuestions = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { questions } = req.body;

        if (!questions || !Array.isArray(questions)) {
            return res.status(400).json({ error: 'Questions must be an array' });
        }

        const { error: deleteError } = await supabase.from('questions').delete().eq('exam_id', id);
        if (deleteError) throw deleteError;

        if (questions.length === 0) {
            return res.status(200).json({ message: 'Questions cleared successfully' });
        }

        const optionLetters = ['A', 'B', 'C', 'D'];

        const questionsToInsert = questions.map((q: any) => {
            const options: any[] = q.options || [];
            const correctIndex = options.findIndex((o: any) => o.isCorrect === true);
            const correctOption = correctIndex >= 0 ? optionLetters[correctIndex] : 'A';

            return {
                exam_id: id,
                question_text: q.text || q.question_text || 'Untitled question',
                option_a: options[0]?.text || '',
                option_b: options[1]?.text || '',
                option_c: options[2]?.text || null,
                option_d: options[3]?.text || null,
                correct_option: correctOption,
                marks: Number(q.marks) || 1,
                negative_marks: Number(q.negativeMarks) || 0,
            };
        });

        const { data, error } = await supabase.from('questions').insert(questionsToInsert).select();

        if (error) {
            console.error('Add questions DB error:', error);
            return res.status(400).json({ error: error.message });
        }

        await supabase.from('exams')
            .update({ total_questions_pool: questions.length, questions_to_display: questions.length })
            .eq('id', id);

        res.status(200).json(data);
    } catch (err) {
        console.error('Add questions error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getExamQuestions = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase.from('questions').select('*').eq('exam_id', id).order('order_index');
        if (error) throw error;
        res.status(200).json(data);
    } catch (err) {
        console.error('Get questions error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateExam = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const { data, error } = await supabase.from('exams').update(updates).eq('id', id).select().single();
        if (error) {
            console.error('Update exam error:', error);
            return res.status(400).json({ error: error.message });
        }
        res.status(200).json(data);
    } catch (err) {
        console.error('Update exam error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getResults = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('student_attempts')
            .select(`
                id, student_name, roll_number, status, submission_time, created_at,
                exam:exams(title, exam_code, duration_minutes),
                result:results(final_score, total_marks)
            `)
            .eq('exam_id', id)
            .order('submission_time', { ascending: false });

        if (error) throw error;

        // Map the relation to what the frontend expects
        const formatted = data.map((attempt: any) => ({
            ...attempt,
            score: attempt.result?.[0]?.final_score || attempt.result?.final_score || 0,
            total_marks: attempt.result?.[0]?.total_marks || attempt.result?.total_marks || 0,
            submitted_at: attempt.submission_time
        }));

        res.status(200).json(formatted);
    } catch (err) {
        console.error('Get results error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getAllResults = async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('student_attempts')
            .select(`
                id, student_name, roll_number, status, submission_time,
                exam:exams(id, title, exam_code),
                result:results(final_score, total_marks)
            `)
            .in('status', ['SUBMITTED', 'FORCE_SUBMITTED', 'ENDED_BY_ADMIN', 'AUTO_SUBMITTED'])
            .order('submission_time', { ascending: false })
            .limit(100);

        if (error) throw error;

        // Map the relation to what the frontend expects
        const formatted = data.map((attempt: any) => ({
            ...attempt,
            score: attempt.result?.[0]?.final_score || attempt.result?.final_score || 0,
            total_marks: attempt.result?.[0]?.total_marks || attempt.result?.total_marks || 0,
            submitted_at: attempt.submission_time
        }));

        res.status(200).json(formatted);
    } catch (err) {
        console.error('Get all results error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteExam = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // Delete questions first (FK constraint)
        await supabase.from('questions').delete().eq('exam_id', id);
        // Delete attempts if any
        await supabase.from('student_attempts').delete().eq('exam_id', id);
        // Delete the exam
        const { error } = await supabase.from('exams').delete().eq('id', id);
        if (error) {
            console.error('Delete exam error:', error);
            return res.status(400).json({ error: error.message });
        }
        res.status(200).json({ message: 'Exam deleted successfully' });
    } catch (err) {
        console.error('Delete exam error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const addSingleQuestion = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const q = req.body;

        if (!q || !q.text) {
            return res.status(400).json({ error: 'Question text is required' });
        }

        const options: any[] = q.options || [];
        const optionLetters = ['A', 'B', 'C', 'D'];
        const correctIndex = options.findIndex((o: any) => o.isCorrect === true);
        const correctOption = correctIndex >= 0 ? optionLetters[correctIndex] : 'A';

        const payload = {
            exam_id: id,
            question_text: q.text,
            option_a: options[0]?.text || '',
            option_b: options[1]?.text || '',
            option_c: options[2]?.text || null,
            option_d: options[3]?.text || null,
            correct_option: correctOption,
            marks: Number(q.marks) || 1,
            negative_marks: Number(q.negativeMarks) || 0,
        };

        const { data, error } = await supabase.from('questions').insert(payload).select().single();
        if (error) {
            console.error('Add single question error:', error);
            return res.status(400).json({ error: error.message });
        }

        // Update pool count
        const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('exam_id', id);
        if (count !== null) {
            await supabase.from('exams').update({ total_questions_pool: count, questions_to_display: count }).eq('id', id);
        }

        res.status(201).json(data);
    } catch (err) {
        console.error('Add single question error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteSingleQuestion = async (req: Request, res: Response) => {
    try {
        const { id, qid } = req.params;
        const { error } = await supabase.from('questions').delete().eq('id', qid).eq('exam_id', id);
        if (error) return res.status(400).json({ error: error.message });

        // Update pool count
        const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('exam_id', id);
        if (count !== null) {
            await supabase.from('exams').update({ total_questions_pool: count, questions_to_display: count }).eq('id', id);
        }

        res.status(200).json({ message: 'Question deleted' });
    } catch (err) {
        console.error('Delete single question error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── PUBLIC: Validate exam code (Step 1 of student login) ────────────────────
export const validateExam = async (req: Request, res: Response) => {
    try {
        const examCode = String(req.params.examCode);
        const { data: exam, error } = await supabase
            .from('exams')
            .select('id, title, exam_code, duration_minutes, status')
            .eq('exam_code', examCode.toUpperCase().trim())
            .single();

        if (error || !exam) {
            return res.status(404).json({ error: 'Exam not found. Please check the exam code.' });
        }
        if (exam.status === 'DRAFT') {
            return res.status(403).json({ error: 'This exam has not been published yet.' });
        }
        if (exam.status === 'ENDED') {
            return res.status(403).json({ error: 'This exam has already ended.' });
        }
        if (exam.status === 'PUBLISHED') {
            return res.status(403).json({ error: 'Exam has not started yet. Please wait for your teacher to start it.' });
        }

        res.status(200).json({
            id: exam.id,
            title: exam.title,
            exam_code: exam.exam_code,
            duration_minutes: exam.duration_minutes,
        });
    } catch (err) {
        console.error('Validate exam error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── ADMIN: Grant re-attempt to a student ────────────────────────────────────
export const grantReattempt = async (req: Request, res: Response) => {
    try {
        const { id } = req.params; // exam id
        const { rollNumber } = req.body;

        if (!rollNumber) {
            return res.status(400).json({ error: 'rollNumber is required' });
        }

        // Delete existing attempt (cascade deletes answers and results)
        const { error } = await supabase
            .from('student_attempts')
            .delete()
            .eq('exam_id', id)
            .eq('roll_number', rollNumber.trim());

        if (error) {
            console.error('Grant reattempt error:', error);
            return res.status(400).json({ error: error.message });
        }

        res.status(200).json({ message: 'Re-attempt granted. Student can now join again.' });
    } catch (err) {
        console.error('Grant reattempt error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── PUBLIC: Student joins an exam ───────────────────────────────────────────
export const joinExam = async (req: Request, res: Response) => {
    require('fs').writeFileSync('c:\\Business\\exam\\ew-exam-portal\\apps\\backend\\joinExam_executed.txt', 'EXECUTED ' + Date.now());
    try {
        const { exam_code, student_name, roll_number, department } = req.body;

        if (!exam_code || !student_name || !roll_number) {
            return res.status(400).json({ error: 'exam_code, student_name and roll_number are required' });
        }

        // Look up exam
        const { data: exam, error: examErr } = await supabase
            .from('exams')
            .select('*')
            .eq('exam_code', exam_code.toUpperCase().trim())
            .single();

        if (examErr || !exam) {
            return res.status(404).json({ error: 'Exam not found. Check the exam code.' });
        }

        if (exam.status === 'DRAFT') {
            return res.status(403).json({ error: 'This exam has not been published yet.' });
        }

        if (exam.status === 'ENDED') {
            return res.status(403).json({ error: 'This exam has already ended.' });
        }

        // Must be ACTIVE to join (teacher must have clicked Start)
        if (exam.status === 'PUBLISHED') {
            return res.status(403).json({ error: 'Exam has not started yet. Please wait for the teacher to start the exam.' });
        }

        // Exam is ACTIVE — students can join freely, no cooldown window

        // Fetch questions (randomized if enabled)
        let questionsQuery = supabase
            .from('questions')
            .select('id, question_text, option_a, option_b, option_c, option_d, marks, negative_marks')
            .eq('exam_id', exam.id);

        const { data: allQuestions, error: qErr } = await questionsQuery;
        if (qErr) throw qErr;

        let questions = allQuestions || [];

        // Randomize if enabled
        if (exam.randomization_enabled && questions.length > 0) {
            questions = questions.sort(() => Math.random() - 0.5);
        }

        // Limit to questions_to_display
        const limit = Number(exam.questions_to_display) || questions.length;
        if (questions.length > limit) {
            questions = questions.slice(0, limit);
        }

        if (questions.length === 0) {
            return res.status(400).json({ error: 'This exam has no questions yet. Contact your teacher.' });
        }

        // Create attempt record — handle duplicate roll_number for same exam gracefully
        let attemptId: string | null = null;
        let assignedQuestionIds: string[] = [];

        // Check if this student already has an attempt for this exam
        const { data: existingAttempt } = await supabase
            .from('student_attempts')
            .select('id, status, assigned_question_ids')
            .eq('exam_id', exam.id)
            .eq('roll_number', roll_number.trim())
            .single();

        if (existingAttempt) {
            const attempt = existingAttempt as any;
            // Reuse existing attempt if not yet submitted
            if (['SUBMITTED', 'FORCE_SUBMITTED', 'AUTO_SUBMITTED'].includes(attempt.status)) {
                return res.status(403).json({ error: 'You have already submitted this exam.' });
            }
            if (attempt.status === 'ENDED_BY_ADMIN') {
                return res.status(403).json({ error: 'Your exam was ended by the admin.' });
            }
            attemptId = attempt.id;
            
            // If they already have assigned questions, use them
            const assignedIds = attempt.assigned_question_ids as string[];
            if (assignedIds && assignedIds.length > 0) {
                // Filter questions to match assigned ones
                const assignedSet = new Set(assignedIds!);
                questions = questions.filter(q => assignedSet.has(q.id));
                // Sort them to match the original assigned order
                questions.sort((a, b) => assignedIds!.indexOf(a.id) - assignedIds!.indexOf(b.id));
            } else {
                // If for some reason it's null, we update it
                assignedQuestionIds = questions.map(q => q.id);
                console.log('UPDATING existing attempt with IDs:', assignedQuestionIds);
                await supabase.from('student_attempts').update({ assigned_question_ids: assignedQuestionIds }).eq('id', attemptId);
            }
        } else {
            assignedQuestionIds = questions.map(q => q.id);
            require('fs').writeFileSync('c:\\Business\\exam\\ew-exam-portal\\apps\\backend\\debug.json', JSON.stringify({ assignedQuestionIds, firstQuestion: questions[0] }, null, 2));
            const { data: attempt, error: attErr } = await supabase
                .from('student_attempts')
                .insert({
                    exam_id: exam.id,
                    student_name: student_name.trim(),
                    roll_number: roll_number.trim(),
                    department: department ? department.trim() : null,
                    status: 'WAITING',
                    assigned_question_ids: assignedQuestionIds
                })
                .select('*')
                .single();

            if (attempt) {
                console.log('Inserted attempt:', attempt);
            }

            if (attErr || !attempt) {
                console.error('Create attempt DB error:', JSON.stringify(attErr));
                return res.status(500).json({
                    error: attErr?.message || 'Failed to register your attempt. Try again.',
                    details: attErr?.details || null,
                });
            }
            attemptId = attempt.id;
        }

        // Return everything the student client needs
        res.status(200).json({
            attemptId: attemptId,
            exam: {
                id: exam.id,
                title: exam.title,
                exam_code: exam.exam_code,
                duration_minutes: exam.duration_minutes,
                show_results_to_students: exam.show_results_to_students,
            },
            questions: questions.map((q: any) => ({
                id: q.id,
                text: q.question_text,
                options: [
                    { id: 'A', text: q.option_a || '' },
                    { id: 'B', text: q.option_b || '' },
                    { id: 'C', text: q.option_c || '' },
                    { id: 'D', text: q.option_d || '' },
                ].filter(o => o.text.trim() !== ''),
                marks: Number(q.marks) || 1,
                negativeMarks: Number(q.negative_marks) || 0,
            })),
        });
    } catch (err) {
        console.error('Join exam error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

