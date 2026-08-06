import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

// ─── Core evaluation logic ────────────────────────────────────────────────────
export const evaluateExam = async (attemptId: string) => {
    try {
        console.log(`[EVALUATE] Starting evaluation for attempt: ${attemptId}`);

        const { data: attempt, error: attemptError } = await supabase
            .from('student_attempts')
            .select('*')
            .eq('id', attemptId)
            .single();

        if (attemptError || !attempt) {
            console.error(`[EVALUATE] Attempt not found: ${attemptId}`, attemptError);
            throw new Error('Attempt not found');
        }

        console.log(`[EVALUATE] Attempt found. exam_id=${attempt.exam_id}, assigned=${attempt.assigned_question_ids?.length ?? 0}`);

        // Check if already evaluated — do NOT re-evaluate on normal path
        const { data: existingResult } = await supabase
            .from('results')
            .select('id')
            .eq('attempt_id', attemptId)
            .single();

        if (existingResult) {
            console.log(`[EVALUATE] Already evaluated (result id=${existingResult.id}), skipping.`);
            return { success: true, message: 'Already evaluated' };
        }

        // Fetch student's saved answers
        const { data: answers, error: answerError } = await supabase
            .from('student_answers')
            .select('question_id, selected_option')
            .eq('attempt_id', attemptId);

        if (answerError) throw answerError;
        console.log(`[EVALUATE] student_answers rows: ${answers?.length ?? 0}`);

        // Fetch all questions for the exam
        const { data: questions, error: qError } = await supabase
            .from('questions')
            .select('id, correct_option, marks, negative_marks')
            .eq('exam_id', attempt.exam_id);

        if (qError) throw qError;
        console.log(`[EVALUATE] Questions in exam: ${questions?.length ?? 0}`);

        const questionMap = new Map((questions || []).map(q => [q.id, q]));

        let correctCount = 0;
        let wrongCount = 0;
        let skippedCount = 0;
        let totalMarks = 0;
        let negativeMarksTotal = 0;

        const allAssignedIds: string[] = attempt.assigned_question_ids || [];

        for (const qId of allAssignedIds) {
            const q = questionMap.get(qId);
            if (!q) {
                console.warn(`[EVALUATE] Question ${qId} not in questionMap — deleted after assignment?`);
                continue;
            }

            const answer = answers?.find(a => a.question_id === qId);

            if (!answer || answer.selected_option === null || answer.selected_option === '' || answer.selected_option === 'null') {
                skippedCount++;
            } else if (answer.selected_option === q.correct_option) {
                correctCount++;
                totalMarks += Number(q.marks);
                console.log(`[EVALUATE] Q=${qId} CORRECT (${answer.selected_option}===${q.correct_option}) +${q.marks}`);
            } else {
                wrongCount++;
                totalMarks -= Number(q.negative_marks);
                negativeMarksTotal += Number(q.negative_marks);
                console.log(`[EVALUATE] Q=${qId} WRONG (${answer.selected_option}!==${q.correct_option}) -${q.negative_marks}`);
            }
        }

        console.log(`[EVALUATE] RESULT: correct=${correctCount} wrong=${wrongCount} skipped=${skippedCount} score=${totalMarks}`);

        const maxPossibleMarks = allAssignedIds.reduce((sum, qId) => {
            const q = questionMap.get(qId);
            return sum + (q ? Number(q.marks) : 0);
        }, 0);

        const percentage = maxPossibleMarks > 0 ? (totalMarks / maxPossibleMarks) * 100 : 0;

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

        if (resultError) {
            console.error(`[EVALUATE] Failed to save result:`, resultError);
            throw resultError;
        }

        console.log(`[EVALUATE] Saved result OK. final_score=${totalMarks}`);

        if (!['SUBMITTED', 'AUTO_SUBMITTED', 'ENDED_BY_ADMIN', 'FORCE_SUBMITTED'].includes(attempt.status)) {
            await supabase.from('student_attempts')
                .update({ status: 'SUBMITTED', submission_time: new Date().toISOString() })
                .eq('id', attemptId);
        }

        return {
            success: true,
            score: totalMarks,
            correct: correctCount,
            incorrect: wrongCount,
            skipped: skippedCount,
            totalMarks: maxPossibleMarks
        };

    } catch (err) {
        console.error('[EVALUATE] Fatal error:', err);
        return { success: false, error: err };
    }
};

// ─── HTTP: POST /api/attempts/:attemptId/submit ───────────────────────────────
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

// ─── HTTP: POST /api/attempts/:attemptId/re-evaluate ─────────────────────────
// Deletes the existing result row and re-runs evaluation from scratch.
// Use this to fix students who got score=0 due to a previous sync/save bug.
export const reEvaluate = async (req: Request, res: Response) => {
    const { attemptId } = req.params;
    const id = String(attemptId);
    if (!id) return res.status(400).json({ error: 'Missing attemptId' });

    console.log(`[RE-EVALUATE] Requested for attempt: ${id}`);

    const { error: deleteErr } = await supabase
        .from('results')
        .delete()
        .eq('attempt_id', id);

    if (deleteErr) {
        console.error('[RE-EVALUATE] Could not delete old result:', deleteErr);
        return res.status(500).json({ error: 'Could not delete old result: ' + deleteErr.message });
    }

    const result = await evaluateExam(id);
    if (result.success) {
        res.status(200).json({ message: 'Re-evaluated successfully', result });
    } else {
        res.status(500).json({ error: 'Re-evaluation failed' });
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
};
