import { Server, Socket } from 'socket.io';
import { supabase } from '../config/supabase';
import { evaluateExam } from '../controllers/evaluationController';
import { flushAttemptToSupabase } from '../redisSyncWorker';

// Track active exams and connected students in memory for speed
// Keyed by examId
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
        socket.on('admin_monitor_exam', async (payload: { examId: string }) => {
            socket.join(`monitor:${payload.examId}`);
            let exam = liveExams.get(payload.examId);
            
            // If backend restarted or exam not in memory, hydrate from DB
            if (!exam) {
                const { data: dbExam } = await supabase.from('exams').select('exam_code, start_time, status').eq('id', payload.examId).single();
                if (dbExam && dbExam.status === 'ACTIVE') {
                    exam = {
                        examId: payload.examId,
                        examCode: dbExam.exam_code,
                        startedAt: dbExam.start_time || new Date().toISOString(),
                        students: new Map(),
                    };
                    
                    const { data: attempts } = await supabase.from('student_attempts')
                        .select('id, student_name, roll_number, socket_id, joined_at, status, submit_reason')
                        .eq('exam_id', payload.examId);
                        
                    if (attempts) {
                        for (const a of attempts) {
                            const { count } = await supabase.from('student_answers').select('*', { count: 'exact', head: true }).eq('attempt_id', a.id);
                            
                            const label = a.submit_reason === 'network_lost' ? 'Network Lost' :
                                      a.submit_reason === 'app_closed' ? 'App Closed' :
                                      a.submit_reason === 'timeout' ? 'Time Expired' : 
                                      (a.submit_reason ? 'Normal' : undefined);
                                      
                            exam.students.set(a.id, {
                                attemptId: a.id,
                                name: a.student_name,
                                rollNumber: a.roll_number,
                                socketId: a.socket_id,
                                joinedAt: a.joined_at,
                                status: a.status,
                                answered: count || 0,
                                reasonLabel: label
                            });
                        }
                    }
                    liveExams.set(payload.examId, exam);
                }
            }

            if (exam) {
                socket.emit('exam_live_snapshot', {
                    examCode: exam.examCode,
                    examId: exam.examId,
                    startedAt: exam.startedAt,
                    students: Array.from(exam.students.values()),
                });
            }
        });

        // Admin starts an exam
        socket.on('exam:start', async (payload: { examId: string; examCode?: string }) => {
            const { examId } = payload;
            
            // Look up examCode from db if not passed
            let examCode = payload.examCode;
            if (!examCode) {
                const { data } = await supabase.from('exams').select('exam_code').eq('id', examId).single();
                examCode = data?.exam_code || 'UNKNOWN';
            }
            
            const startTimeISO = new Date().toISOString();
            // Update DB
            await supabase.from('exams')
                .update({ status: 'ACTIVE', start_time: startTimeISO })
                .eq('id', examId);

            // Register in live map
            liveExams.set(examId, {
                examId,
                examCode: examCode as string,
                startedAt: startTimeISO,
                students: new Map(),
            });

            // Broadcast to all students waiting in exam room
            io.to(`exam:${examId}`).emit('exam:started', { examId, startedAt: startTimeISO });

            // Notify all admins
            io.to('admin_room').emit('admin:exam_started', {
                examId,
                examCode,
                startedAt: startTimeISO,
            });

            console.log(`Exam ${examCode} (ID: ${examId}) started by admin at ${startTimeISO}`);
        });

        // Admin ends exam for all
        socket.on('exam:end', async (payload: { examId: string }) => {
            const { examId } = payload;

            // Force submit all pending attempts - flush Redis first to ensure all answers are saved
            const exam = liveExams.get(examId);
            if (exam) {
                for (const [, student] of exam.students) {
                    if (student.status === 'IN_PROGRESS' && student.attemptId) {
                        await flushAttemptToSupabase(student.attemptId);
                        await evaluateExam(student.attemptId);
                    }
                }
            }

            // Update DB
            await supabase.from('exams').update({ status: 'ENDED' }).eq('id', examId);

            // Notify all students in room to auto-submit
            io.to(`exam:${examId}`).emit('force_submit');

            // Clean up live map
            liveExams.delete(examId);

            // Notify admins
            io.to('admin_room').emit('admin:exam_ended', { examId, examCode: exam?.examCode });
        });

        // Admin force-submits a specific student
        socket.on('force_submit', async (payload: { attemptId: string; socketId: string; examId: string }) => {
            await flushAttemptToSupabase(payload.attemptId);
            await evaluateExam(payload.attemptId);
            if (payload.socketId) {
                io.to(payload.socketId).emit('force_submit');
            }
            // Update student status in live map
            const exam = liveExams.get(payload.examId);
            if (exam) {
                const student = exam.students.get(payload.attemptId);
                if (student) student.status = 'SUBMITTED';
            }
            io.to(`monitor:${payload.examId}`).emit('student_update', { attemptId: payload.attemptId, status: 'SUBMITTED' });
        });

        socket.on('end_student', async (payload: { attemptId: string; socketId: string; examId: string }) => {
            await supabase.from('student_attempts').update({ status: 'ENDED_BY_ADMIN' }).eq('id', payload.attemptId);
            if (payload.socketId) {
                io.to(payload.socketId).emit('end_student');
            }
            const exam = liveExams.get(payload.examId);
            if (exam) exam.students.delete(payload.attemptId);
            io.to(`monitor:${payload.examId}`).emit('student_update', { attemptId: payload.attemptId, status: 'ENDED_BY_ADMIN' });
        });

        socket.on('restart_student', async (payload: { attemptId: string; socketId: string; examId: string }) => {
            await supabase.from('student_attempts').update({ status: 'WAITING' }).eq('id', payload.attemptId);
            await supabase.from('student_answers').delete().eq('attempt_id', payload.attemptId);
            if (payload.socketId) {
                io.to(payload.socketId).emit('restart_student');
            }
            const exam = liveExams.get(payload.examId);
            if (exam) {
                const student = exam.students.get(payload.attemptId);
                if (student) student.status = 'WAITING';
            }
            io.to(`monitor:${payload.examId}`).emit('student_update', { attemptId: payload.attemptId, status: 'WAITING' });
        });

        socket.on('announcement', (payload: { examId: string; message: string }) => {
            io.to(`exam:${payload.examId}`).emit('announcement', payload.message);
        });

        // ─── STUDENT ─────────────────────────────────────────────────────────
        socket.on('join_exam', async (payload: { examId: string; attemptId: string; name: string; rollNumber: string }) => {
            socket.join(`exam:${payload.examId}`);
            await supabase.from('student_attempts')
                .update({ socket_id: socket.id, status: 'IN_PROGRESS' })
                .eq('id', payload.attemptId);

            // Get accurate answered count from DB in case of reconnect
            const { count: answeredCount } = await supabase
                .from('student_answers')
                .select('*', { count: 'exact', head: true })
                .eq('attempt_id', payload.attemptId);

            const studentInfo = {
                attemptId: payload.attemptId,
                name: payload.name,
                rollNumber: payload.rollNumber,
                socketId: socket.id,
                joinedAt: new Date().toISOString(),
                status: 'IN_PROGRESS',
                answered: answeredCount || 0,
            };

            // Update live map
            const exam = liveExams.get(payload.examId);
            if (exam) {
                exam.students.set(payload.attemptId, studentInfo);
            }

            // Notify admins
            io.to('admin_room').emit('student_connected', { ...studentInfo, examId: payload.examId, examCode: exam?.examCode });
            io.to(`monitor:${payload.examId}`).emit('student_joined', studentInfo);
        });

        socket.on('sync_batch', async (payload: { attemptId: string; examId: string; answers: { questionId: string; selectedOption: string | null }[] }, callback: (err: any, res?: any) => void) => {
            // sync_batch is now MONITORING ONLY — HTTP POST /api/attempts/:id/answers is the guaranteed save path.
            // This event only updates the live monitoring dashboard answered-count.
            try {
                if (callback) {
                    callback(null, { success: true });
                }

                if (payload.examId && payload.answers) {
                    const exam = liveExams.get(payload.examId);
                    if (exam) {
                        const student = exam.students.get(payload.attemptId);
                        if (student) {
                            const nonNullCount = payload.answers.filter(a => a.selectedOption !== null).length;
                            student.answered = Math.max(student.answered || 0, nonNullCount);
                        }
                    }
                    io.to(`monitor:${payload.examId}`).emit('student_progress', {
                        attemptId: payload.attemptId,
                        answered: exam?.students.get(payload.attemptId)?.answered ?? 0,
                    });
                }
            } catch (err) {
                console.error('sync_batch error:', err);
                if (callback) callback(null, { success: true }); // never fail the client
            }
        });


        socket.on('submit_exam', async (payload: { attemptId: string; examId: string; reason?: string }) => {
            const reason = payload.reason || 'normal';
            // Flush any pending Redis answers BEFORE scoring to ensure all answers are counted
            await flushAttemptToSupabase(payload.attemptId);
            const result = await evaluateExam(payload.attemptId);

            // Store submit reason
            await supabase.from('student_attempts')
                .update({ submit_reason: reason })
                .eq('id', payload.attemptId);

            socket.emit('exam_submitted', { success: true, result });

            // Update live map
            const exam = liveExams.get(payload.examId);
            if (exam) {
                const student = exam.students.get(payload.attemptId);
                if (student) student.status = 'SUBMITTED';
            }

            // Notify admins with reason
            const label = reason === 'network_lost' ? 'Network Lost' :
                          reason === 'app_closed' ? 'App Closed' :
                          reason === 'timeout' ? 'Time Expired' : 'Normal';
            io.to('admin_room').emit('student_submitted', { attemptId: payload.attemptId, examId: payload.examId, examCode: exam?.examCode, reason, reasonLabel: label });
            io.to(`monitor:${payload.examId}`).emit('student_update', { attemptId: payload.attemptId, status: 'SUBMITTED', reason, reasonLabel: label });
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
                            io.to(`monitor:${exam.examId}`).emit('student_update', { attemptId: data.id, status: 'DISCONNECTED' });
                        }
                    }
                }
            }
        });
    });
};
