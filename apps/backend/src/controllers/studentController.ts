import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { StudentAttempt } from '@ew-exam-portal/shared';
import { validateAppVersion } from '../config/version';

// Student joining the exam
export const joinExam = async (req: Request, res: Response) => {
    try {
        const { name, rollNumber, examCode, ipAddress, machineName, app_version, appVersion } = req.body;

        if (!name || !rollNumber || !examCode) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate application version
        const versionCheck = validateAppVersion(app_version || appVersion);
        if (!versionCheck.valid) {
            return res.status(400).json({
                error: 'Application Update Required',
                details: `Your application version is outdated or not supported for this examination. Required version: ${versionCheck.requiredVersion}. Installed version: ${versionCheck.clientVersion}. Please contact your examination administrator to get the latest application setup.`,
                required_version: versionCheck.requiredVersion,
                installed_version: versionCheck.clientVersion,
            });
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

// Bulk save answers directly to Supabase via HTTP — the guaranteed reliable save path
export const saveAnswers = async (req: Request, res: Response) => {
    try {
        const { attemptId } = req.params;
        const { answers } = req.body as {
            answers: { questionId: string; selectedOption: string | null }[];
        };

        if (!attemptId || !answers || !Array.isArray(answers) || answers.length === 0) {
            return res.status(400).json({ error: 'Invalid payload' });
        }

        // Server-side validation for Lock Question Navigation
        const { data: attempt } = await supabase
            .from('student_attempts')
            .select('exam_id, assigned_question_ids')
            .eq('id', attemptId)
            .single();

        if (attempt?.exam_id) {
            const { data: exam } = await supabase
                .from('exams')
                .select('lock_question_navigation')
                .eq('id', attempt.exam_id)
                .single();

            if (exam?.lock_question_navigation) {
                const assignedIds: string[] = attempt.assigned_question_ids || [];
                if (assignedIds.length > 0) {
                    // Fetch existing answers from database
                    const { data: existingAnswers } = await supabase
                        .from('student_answers')
                        .select('question_id, selected_option')
                        .eq('attempt_id', attemptId)
                        .not('selected_option', 'is', null);

                    const answeredMap = new Map((existingAnswers || []).map(a => [a.question_id, a.selected_option]));
                    const incomingMap = new Map(answers.map(a => [a.questionId, a.selectedOption]));

                    for (const a of answers) {
                        const qIndex = assignedIds.indexOf(a.questionId);
                        if (qIndex > 0) {
                            // Ensure all preceding questions have an answer (either saved in DB or present in batch)
                            for (let j = 0; j < qIndex; j++) {
                                const prevQId = assignedIds[j];
                                const hasPrev = answeredMap.has(prevQId) || (incomingMap.has(prevQId) && incomingMap.get(prevQId) !== null);
                                if (!hasPrev) {
                                    return res.status(403).json({
                                        error: 'Question navigation is locked. Questions must be answered sequentially.'
                                    });
                                }
                            }
                        }

                        // Prevent modifying a previous question if a subsequent question has already been answered
                        if (answeredMap.has(a.questionId) && a.selectedOption !== answeredMap.get(a.questionId)) {
                            let hasSubsequentAnswered = false;
                            for (let k = qIndex + 1; k < assignedIds.length; k++) {
                                if (answeredMap.has(assignedIds[k])) {
                                    hasSubsequentAnswered = true;
                                    break;
                                }
                            }
                            if (hasSubsequentAnswered) {
                                return res.status(403).json({
                                    error: 'Question navigation is locked. You cannot modify previous answers.'
                                });
                            }
                        }
                    }
                }
            }
        }

        const upsertPayload = answers.map(a => ({
            attempt_id: attemptId,
            question_id: a.questionId,
            selected_option: a.selectedOption,
            saved_at: new Date().toISOString(),
        }));

        const { error } = await supabase
            .from('student_answers')
            .upsert(upsertPayload, { onConflict: 'attempt_id, question_id' });

        if (error) {
            console.error('[saveAnswers] Supabase upsert error:', error);
            return res.status(500).json({ error: 'Failed to save answers' });
        }

        return res.status(200).json({ success: true, saved: answers.length });

    } catch (err) {
        console.error('[saveAnswers] Error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
