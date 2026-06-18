import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { StudentAttempt } from '@ew-exam-portal/shared';

// Student joining the exam
export const joinExam = async (req: Request, res: Response) => {
    try {
        const { name, rollNumber, examCode, ipAddress, machineName } = req.body;

        if (!name || !rollNumber || !examCode) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Find the exam
        const { data: exam, error: examError } = await supabase
            .from('exams')
            .select('*')
            .eq('exam_code', examCode)
            .single();

        if (examError || !exam) {
            return res.status(404).json({ error: 'Exam not found' });
        }

        if (exam.status !== 'PUBLISHED') {
            return res.status(403).json({ error: 'Exam is not active' });
        }

        // Check time rules
        const now = new Date();
        const startTime = new Date(exam.start_time);
        const windowEnd = new Date(startTime.getTime() + exam.cooldown_minutes * 60000);

        if (now < startTime) {
            return res.status(403).json({ error: 'Exam has not started yet' });
        }

        if (now > windowEnd) {
            return res.status(403).json({ error: 'Exam entry window has closed' });
        }

        // Check if attempt exists (Reconnect)
        let { data: attempt } = await supabase
            .from('student_attempts')
            .select('*')
            .eq('exam_id', exam.id)
            .eq('roll_number', rollNumber)
            .single();

        if (attempt) {
            // Check if already ended
            if (['SUBMITTED', 'ENDED_BY_ADMIN', 'AUTO_SUBMITTED'].includes(attempt.status)) {
                return res.status(403).json({ error: 'Your exam session has already ended' });
            }

            // Update reconnect status
            await supabase
                .from('student_attempts')
                .update({ status: 'ACTIVE', ip_address: ipAddress, machine_name: machineName })
                .eq('id', attempt.id);

            return res.status(200).json({
                message: 'Reconnected successfully',
                attemptId: attempt.id,
                examId: exam.id
            });
        }

        // Assign randomized questions
        const { data: questions } = await supabase
            .from('questions')
            .select('id')
            .eq('exam_id', exam.id);

        let assignedIds: string[] = [];
        if (questions) {
            let shuffled = questions.sort(() => 0.5 - Math.random());
            assignedIds = shuffled.slice(0, exam.questions_to_display).map(q => q.id);
        }

        // Create new attempt
        const { data: newAttempt, error: attemptError } = await supabase
            .from('student_attempts')
            .insert([{
                exam_id: exam.id,
                student_name: name,
                roll_number: rollNumber,
                ip_address: ipAddress,
                machine_name: machineName,
                status: 'ACTIVE',
                start_time: new Date().toISOString(),
                assigned_question_ids: assignedIds
            }])
            .select()
            .single();

        if (attemptError) throw attemptError;

        res.status(201).json({
            message: 'Joined exam successfully',
            attemptId: newAttempt.id,
            examId: exam.id
        });

    } catch (err) {
        console.error('Join exam error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getQuestionsForAttempt = async (req: Request, res: Response) => {
    try {
        const { attemptId } = req.params;

        const { data: attempt, error: attemptError } = await supabase
            .from('student_attempts')
            .select('assigned_question_ids, exam_id')
            .eq('id', attemptId)
            .single();

        if (attemptError || !attempt) {
            return res.status(404).json({ error: 'Attempt not found' });
        }

        // Fetch the assigned questions (without the correct_option)
        const { data: questions, error: qError } = await supabase
            .from('questions')
            .select('id, question_text, option_a, option_b, option_c, option_d, marks, negative_marks')
            .in('id', attempt.assigned_question_ids);

        if (qError) throw qError;

        res.status(200).json(questions);

    } catch (err) {
        console.error('Get questions error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
