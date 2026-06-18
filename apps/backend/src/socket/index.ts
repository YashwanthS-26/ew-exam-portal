import { Server, Socket } from 'socket.io';
import { supabase } from '../config/supabase';
import { evaluateExam } from '../controllers/evaluationController';

// Track active exams and connected students in memory for speed
export const liveExams: Map<string, { examId: string; examCode: string; startedAt: string; students: Map<string, any> }> = new Map();

export const setupSocketHandlers = (io: Server) => {
    io.on('connection', (socket: Socket) => {
        console.log(`Client connected: ${socket.id}`);

        // ─── ADMIN ───────────────────────────────────────────────────────────
        socket.on('admin_join', () => {
            socket.join('admin_room');
            // Send current live snapshot
            const snapshot = Array.from(liveExams.values()).map(e => ({
                examId: e.examId,
                examCode: e.examCode,
                startedAt: e.startedAt,
                studentCount: e.students.size,
                students: Array.from(e.students.values()),
            }));
            socket.emit('live_snapshot', snapshot);
        });

        // Admin joins a specific exam room for live monitoring
        socket.on('admin_monitor_exam', (payload: { examCode: string }) => {
            socket.join(`monitor:${payload.examCode}`);
            const exam = liveExams.get(payload.examCode);
            if (exam) {
                socket.emit('exam_live_snapshot', {
                    examCode: payload.examCode,
                    examId: exam.examId,
                    startedAt: exam.startedAt,
                    students: Array.from(exam.students.values()),
                });
            }
        });

        // Admin starts an exam
        socket.on('exam:start', async (payload: { examId: string; examCode: string }) => {
            const { examId, examCode } = payload;
            
            const startTimeISO = new Date().toISOString();
            // Update DB
            await supabase.from('exams')
                .update({ status: 'ACTIVE', start_time: startTimeISO })
                .eq('id', examId);

            // Register in live map
            liveExams.set(examCode, {
                examId,
                examCode,
                startedAt: new Date().toISOString(),
                students: new Map(),
            });

            // Broadcast to all students waiting in exam room
            io.to(examCode).emit('exam:started', { examCode, startedAt: new Date().toISOString() });

            // Notify all admins
            io.to('admin_room').emit('admin:exam_started', {
                examId,
                examCode,
                startedAt: startTimeISO,
            });

            console.log(`Exam ${examCode} started by admin at ${startTimeISO}`);
        });

        // Admin ends exam for all
        socket.on('exam:end', async (payload: { examId: string; examCode: string }) => {
            const { examId, examCode } = payload;

            // Force submit all pending attempts
            const exam = liveExams.get(examCode);
            if (exam) {
                for (const [, student] of exam.students) {
                    if (student.status === 'IN_PROGRESS' && student.attemptId) {
                        await evaluateExam(student.attemptId);
                    }
                }
            }

            // Update DB
            await supabase.from('exams').update({ status: 'ENDED' }).eq('id', examId);

            // Notify all students in room to auto-submit
            io.to(examCode).emit('force_submit');

            // Clean up live map
            liveExams.delete(examCode);

            // Notify admins
            io.to('admin_room').emit('admin:exam_ended', { examId, examCode });
        });

        // Admin force-submits a specific student
        socket.on('force_submit', async (payload: { attemptId: string; socketId: string; examCode: string }) => {
            await evaluateExam(payload.attemptId);
            if (payload.socketId) {
                io.to(payload.socketId).emit('force_submit');
            }
            // Update student status in live map
            const exam = liveExams.get(payload.examCode);
            if (exam) {
                const student = exam.students.get(payload.attemptId);
                if (student) student.status = 'SUBMITTED';
            }
            io.to(`monitor:${payload.examCode}`).emit('student_update', { attemptId: payload.attemptId, status: 'SUBMITTED' });
        });

        socket.on('end_student', async (payload: { attemptId: string; socketId: string; examCode: string }) => {
            await supabase.from('student_attempts').update({ status: 'ENDED_BY_ADMIN' }).eq('id', payload.attemptId);
            if (payload.socketId) {
                io.to(payload.socketId).emit('end_student');
            }
            const exam = liveExams.get(payload.examCode);
            if (exam) exam.students.delete(payload.attemptId);
            io.to(`monitor:${payload.examCode}`).emit('student_update', { attemptId: payload.attemptId, status: 'ENDED_BY_ADMIN' });
        });

        socket.on('restart_student', async (payload: { attemptId: string; socketId: string; examCode: string }) => {
            await supabase.from('student_attempts').update({ status: 'WAITING' }).eq('id', payload.attemptId);
            await supabase.from('student_answers').delete().eq('attempt_id', payload.attemptId);
            if (payload.socketId) {
                io.to(payload.socketId).emit('restart_student');
            }
            const exam = liveExams.get(payload.examCode);
            if (exam) {
                const student = exam.students.get(payload.attemptId);
                if (student) student.status = 'WAITING';
            }
            io.to(`monitor:${payload.examCode}`).emit('student_update', { attemptId: payload.attemptId, status: 'WAITING' });
        });

        socket.on('announcement', (payload: { examCode: string; message: string }) => {
            io.to(payload.examCode).emit('announcement', payload.message);
        });

        // ─── STUDENT ─────────────────────────────────────────────────────────
        socket.on('join_exam', async (payload: { examCode: string; attemptId: string; name: string; rollNumber: string }) => {
            socket.join(payload.examCode);
            await supabase.from('student_attempts')
                .update({ socket_id: socket.id, status: 'IN_PROGRESS' })
                .eq('id', payload.attemptId);

            const studentInfo = {
                attemptId: payload.attemptId,
                name: payload.name,
                rollNumber: payload.rollNumber,
                socketId: socket.id,
                joinedAt: new Date().toISOString(),
                status: 'IN_PROGRESS',
                answered: 0,
            };

            // Update live map
            const exam = liveExams.get(payload.examCode);
            if (exam) {
                exam.students.set(payload.attemptId, studentInfo);
            }

            // Notify admins
            io.to('admin_room').emit('student_connected', { ...studentInfo, examCode: payload.examCode });
            io.to(`monitor:${payload.examCode}`).emit('student_joined', studentInfo);
        });

        socket.on('save_answer', async (payload: { attemptId: string; questionId: string; selectedOption: string | null; examCode: string; answered: number }) => {
            try {
                const { error } = await supabase.from('student_answers').upsert({
                    attempt_id: payload.attemptId,
                    question_id: payload.questionId,
                    selected_option: payload.selectedOption,
                    saved_at: new Date().toISOString()
                }, { onConflict: 'attempt_id, question_id' });

                if (error) throw error;
                socket.emit('autosave', { status: 'success', questionId: payload.questionId });

                // Update progress in live map
                if (payload.examCode) {
                    const exam = liveExams.get(payload.examCode);
                    if (exam) {
                        const student = exam.students.get(payload.attemptId);
                        if (student && payload.answered !== undefined) {
                            student.answered = payload.answered;
                        }
                    }
                    io.to(`monitor:${payload.examCode}`).emit('student_progress', {
                        attemptId: payload.attemptId,
                        answered: payload.answered,
                    });
                }
            } catch (err) {
                console.error('Save answer error via socket:', err);
            }
        });

        socket.on('submit_exam', async (payload: { attemptId: string; examCode: string; reason?: string }) => {
            const reason = payload.reason || 'normal';
            const result = await evaluateExam(payload.attemptId);

            // Store submit reason
            await supabase.from('student_attempts')
                .update({ submit_reason: reason })
                .eq('id', payload.attemptId);

            socket.emit('exam_submitted', { success: true, result });

            // Update live map
            const exam = liveExams.get(payload.examCode);
            if (exam) {
                const student = exam.students.get(payload.attemptId);
                if (student) student.status = 'SUBMITTED';
            }

            // Notify admins with reason
            const label = reason === 'network_lost' ? 'Network Lost' :
                          reason === 'app_closed' ? 'App Closed' :
                          reason === 'timeout' ? 'Time Expired' : 'Normal';
            io.to('admin_room').emit('student_submitted', { attemptId: payload.attemptId, examCode: payload.examCode, reason, reasonLabel: label });
            io.to(`monitor:${payload.examCode}`).emit('student_update', { attemptId: payload.attemptId, status: 'SUBMITTED', reason, reasonLabel: label });
        });

        socket.on('heartbeat', () => {
            socket.emit('heartbeat_ack', new Date().toISOString());
        });

        socket.on('disconnect', async () => {
            console.log(`Client disconnected: ${socket.id}`);
            const { data } = await supabase.from('student_attempts').select('id, exam_id, status').eq('socket_id', socket.id).single();
            if (data && !['SUBMITTED', 'FORCE_SUBMITTED', 'AUTO_SUBMITTED', 'ENDED_BY_ADMIN'].includes(data.status)) {
                await supabase.from('student_attempts').update({ status: 'DISCONNECTED' }).eq('id', data.id);
                io.to('admin_room').emit('student_disconnected', { attemptId: data.id, socketId: socket.id });
                
                // Update all live maps
                for (const [, exam] of liveExams) {
                    if (exam.students.has(data.id)) {
                        const student = exam.students.get(data.id);
                        if (student && !['SUBMITTED', 'FORCE_SUBMITTED', 'AUTO_SUBMITTED', 'ENDED_BY_ADMIN'].includes(student.status)) {
                            student.status = 'DISCONNECTED';
                            io.to(`monitor:${exam.examCode}`).emit('student_update', { attemptId: data.id, status: 'DISCONNECTED' });
                        }
                    }
                }
            }
        });
    });
};
