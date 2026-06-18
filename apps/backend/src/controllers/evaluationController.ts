import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export const evaluateExam = async (attemptId: string) => {
    try {
        // Get the attempt
        const { data: attempt, error: attemptError } = await supabase
            .from('student_attempts')
            .select('*')
            .eq('id', attemptId)
            .single();

        if (attemptError || !attempt) throw new Error('Attempt not found');

        // Check if already evaluated
        const { data: existingResult } = await supabase
            .from('results')
            .select('id')
            .eq('attempt_id', attemptId)
            .single();

        if (existingResult) return { success: true, message: 'Already evaluated' };

        // Fetch answers
        const { data: answers, error: answerError } = await supabase
            .from('student_answers')
            .select('question_id, selected_option')
            .eq('attempt_id', attemptId);

        if (answerError) throw answerError;

        // Fetch questions for this exam to get correct answers and marks
        const { data: questions, error: qError } = await supabase
            .from('questions')
            .select('id, correct_option, marks, negative_marks')
            .eq('exam_id', attempt.exam_id);

        if (qError) throw qError;

        const questionMap = new Map(questions.map(q => [q.id, q]));
        
        let correctCount = 0;
        let wrongCount = 0;
        let skippedCount = 0;
        let totalMarks = 0;
        let negativeMarksTotal = 0;

        // The student might not have an answer row for every assigned question
        // Any assigned question without an answer row is considered skipped.
        const answeredIds = new Set(answers?.map(a => a.question_id) || []);
        
        const allAssignedIds: string[] = attempt.assigned_question_ids || [];
        
        for (const qId of allAssignedIds) {
            const q = questionMap.get(qId);
            if (!q) continue;

            const answer = answers?.find(a => a.question_id === qId);
            
            if (!answer || answer.selected_option === null || answer.selected_option === '') {
                skippedCount++;
            } else if (answer.selected_option === q.correct_option) {
                correctCount++;
                totalMarks += Number(q.marks);
            } else {
                wrongCount++;
                totalMarks -= Number(q.negative_marks);
                negativeMarksTotal += Number(q.negative_marks);
            }
        }

        const maxPossibleMarks = allAssignedIds.reduce((sum, qId) => {
            const q = questionMap.get(qId);
            return sum + (q ? Number(q.marks) : 0);
        }, 0);

        const percentage = maxPossibleMarks > 0 ? (totalMarks / maxPossibleMarks) * 100 : 0;

        // Save result
        const { error: resultError } = await supabase
            .from('results')
            .insert([{
                attempt_id: attemptId,
                exam_id: attempt.exam_id,
                correct_count: correctCount,
                wrong_count: wrongCount,
                skipped_count: skippedCount,
                total_marks: totalMarks,
                negative_marks: negativeMarksTotal,
                final_score: totalMarks,
                percentage: Number(percentage.toFixed(2))
            }]);

        if (resultError) throw resultError;

        // Update attempt status if not already
        if (attempt.status !== 'SUBMITTED' && attempt.status !== 'AUTO_SUBMITTED' && attempt.status !== 'ENDED_BY_ADMIN') {
             await supabase.from('student_attempts').update({ status: 'SUBMITTED', submission_time: new Date().toISOString() }).eq('id', attemptId);
        }

        return { success: true };

    } catch (err) {
        console.error('Evaluation error:', err);
        return { success: false, error: err };
    }
};

export const submitExam = async (req: Request, res: Response) => {
    const { attemptId } = req.params;
    if (!attemptId) return res.status(400).json({ error: 'Missing attemptId' });
    const result = await evaluateExam(attemptId as string);
    if (result.success) {
        res.status(200).json({ message: 'Exam submitted and evaluated successfully' });
    } else {
        res.status(500).json({ error: 'Evaluation failed' });
    }
};

export const getResults = async (req: Request, res: Response) => {
    const { examId } = req.params;
    
    const { data, error } = await supabase
        .from('results')
        .select('*, student_attempts(student_name, roll_number)')
        .eq('exam_id', examId)
        .order('final_score', { ascending: false });

    if (error) {
        return res.status(500).json({ error: 'Failed to fetch results' });
    }

    res.status(200).json(data);
}
