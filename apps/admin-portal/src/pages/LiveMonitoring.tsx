import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../lib/api';
import socketService from '../lib/socket';

interface Student {
    attemptId: string;
    name: string;
    rollNumber: string;
    socketId: string;
    joinedAt: string;
    status: 'WAITING' | 'IN_PROGRESS' | 'SUBMITTED' | 'DISCONNECTED' | 'ENDED_BY_ADMIN';
    answered: number;
    reasonLabel?: string;
}

export default function LiveMonitoring() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [students, setStudents] = useState<Student[]>([]);
    const [examStarted, setExamStarted] = useState(false);
    const [announcement, setAnnouncement] = useState('');
    const [showAnnouncement, setShowAnnouncement] = useState(false);
    const [search, setSearch] = useState('');
    const [reattemptStudent, setReattemptStudent] = useState<Student | null>(null);
    const [granting, setGranting] = useState(false);

    const { data: exam, isLoading } = useQuery({
        queryKey: ['exam', id],
        queryFn: async () => {
            const { data } = await api.get(`/exams/${id}`);
            return data;
        }
    });

    const { data: questions } = useQuery({
        queryKey: ['exam-questions', id],
        queryFn: async () => {
            const { data } = await api.get(`/exams/${id}/questions`);
            return data as any[];
        }
    });

    useEffect(() => {
        if (!exam) return;
        setExamStarted(exam.status === 'ACTIVE');
    }, [exam]);

    useEffect(() => {
        if (!exam?.exam_code) return;
        const socket = socketService.connect();
        if (!socket) return;

        socket.emit('admin_join');
        socket.emit('admin_monitor_exam', { examCode: exam.exam_code });

        socket.on('exam_live_snapshot', (data: any) => {
            setStudents(data.students || []);
        });

        socket.on('student_joined', (student: Student) => {
            setStudents(prev => {
                const exists = prev.find(s => s.attemptId === student.attemptId);
                if (exists) return prev.map(s => s.attemptId === student.attemptId ? student : s);
                return [...prev, student];
            });
            toast.success(`${student.name} joined!`);
        });

        socket.on('student_update', (update: { attemptId: string; status: string; reasonLabel?: string }) => {
            setStudents(prev => prev.map(s =>
                s.attemptId === update.attemptId ? { ...s, status: update.status as any, reasonLabel: update.reasonLabel } : s
            ));
            if (update.reasonLabel && update.reasonLabel !== 'Normal') {
                const student = students.find(s => s.attemptId === update.attemptId);
                toast.error(`${student?.name || 'Student'} auto-submitted: ${update.reasonLabel}`, { duration: 5000 });
            }
        });

        socket.on('student_progress', (update: { attemptId: string; answered: number }) => {
            setStudents(prev => prev.map(s =>
                s.attemptId === update.attemptId ? { ...s, answered: update.answered } : s
            ));
        });

        socket.on('exam:started', () => setExamStarted(true));

        return () => {
            socket.off('exam_live_snapshot');
            socket.off('student_joined');
            socket.off('student_update');
            socket.off('student_progress');
            socket.off('exam:started');
        };
    }, [exam?.exam_code]);

    const handleStartExam = () => {
        if (!exam) return;
        const socket = socketService.getSocket();
        if (!socket) { toast.error('Not connected to server'); return; }
        socket.emit('exam:start', { examId: id, examCode: exam.exam_code });
        setExamStarted(true);
        toast.success(`Exam "${exam.title}" started! Students can now begin.`);
    };

    const handleEndExam = () => {
        if (!exam || !window.confirm('End exam for ALL students? This cannot be undone.')) return;
        const socket = socketService.getSocket();
        socket?.emit('exam:end', { examId: id, examCode: exam.exam_code });
        setExamStarted(false);
        toast.success('Exam ended for all students');
        setTimeout(() => navigate(`/exams/${id}/results`), 1500);
    };

    const handleForceSubmit = (student: Student) => {
        const socket = socketService.getSocket();
        socket?.emit('force_submit', { attemptId: student.attemptId, socketId: student.socketId, examCode: exam?.exam_code });
        toast.success(`Force submitted ${student.name}`);
    };

    const handleRestartStudent = (student: Student) => {
        const socket = socketService.getSocket();
        socket?.emit('restart_student', { attemptId: student.attemptId, socketId: student.socketId, examCode: exam?.exam_code });
        toast.success(`Restarted ${student.name}'s exam`);
    };

    const handleEndStudent = (student: Student) => {
        const socket = socketService.getSocket();
        socket?.emit('end_student', { attemptId: student.attemptId, socketId: student.socketId, examCode: exam?.exam_code });
        toast(`Ended ${student.name}'s session`);
    };

    const handleGrantReattempt = async () => {
        if (!reattemptStudent || !id) return;
        setGranting(true);
        try {
            await api.post(`/exams/${id}/reattempt`, { rollNumber: reattemptStudent.rollNumber });
            toast.success(`Re-attempt granted to ${reattemptStudent.name}. They can now join again.`);
            setStudents(prev => prev.filter(s => s.attemptId !== reattemptStudent.attemptId));
            setReattemptStudent(null);
        } catch (e: any) {
            toast.error(e.response?.data?.error || 'Failed to grant re-attempt');
        }
        setGranting(false);
    };

    const sendAnnouncement = () => {
        if (!announcement.trim()) return;
        const socket = socketService.getSocket();
        socket?.emit('announcement', { examCode: exam?.exam_code, message: announcement });
        toast.success('Announcement sent to all students!');
        setAnnouncement('');
        setShowAnnouncement(false);
    };

    const totalQs = questions?.length || 0;
    const submittedCount = students.filter(s => s.status === 'SUBMITTED').length;
    const inProgressCount = students.filter(s => s.status === 'IN_PROGRESS').length;
    const disconnectedCount = students.filter(s => s.status === 'DISCONNECTED').length;

    const filteredStudents = students.filter(s =>
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.rollNumber.toLowerCase().includes(search.toLowerCase())
    );

    const statusBadge = (student: Student) => {
        const map: Record<string, { label: string; cls: string }> = {
            IN_PROGRESS: { label: 'In Progress', cls: 'bg-orange-100 text-orange-700' },
            SUBMITTED: { label: 'Submitted', cls: 'bg-green-100 text-green-700' },
            WAITING: { label: 'Waiting', cls: 'bg-yellow-100 text-yellow-700' },
            DISCONNECTED: { label: 'Disconnected', cls: 'bg-red-100 text-red-600' },
            ENDED_BY_ADMIN: { label: 'Ended', cls: 'bg-surface-container-high text-on-surface-variant' },
        };
        const s = map[student.status] || { label: student.status, cls: 'bg-surface-container-high text-on-surface-variant' };
        return (
            <div className="flex flex-col gap-0.5">
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
                {student.reasonLabel && student.reasonLabel !== 'Normal' && (
                    <span className="text-[10px] text-orange-500 font-medium">⚡ {student.reasonLabel}</span>
                )}
            </div>
        );
    };

    if (isLoading) return (
        <div className="flex items-center justify-center h-full">
            <p className="text-on-surface-variant">Loading exam...</p>
        </div>
    );

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <header className="bg-surface-container-lowest border-b border-outline-variant/30 px-lg py-sm flex items-center justify-between shrink-0 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/exams')} className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 font-label-md">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="font-title-lg text-title-lg text-on-surface font-semibold">{exam?.title || 'Live Monitoring'}</h1>
                        <p className="font-label-sm text-label-sm text-on-surface-variant">{exam?.exam_code} · {exam?.duration_minutes} min</p>
                    </div>
                    {/* LIVE indicator */}
                    {examStarted ? (
                        <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded-full">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-600"></span>
                            </span>
                            <span className="text-green-700 text-[12px] font-bold tracking-wide">LIVE</span>
                        </div>
                    ) : (
                        <span className="px-3 py-1 rounded-full text-[12px] font-bold bg-surface-container-high text-on-surface-variant">NOT STARTED</span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {!examStarted ? (
                        <button onClick={handleStartExam} className="bg-green-600 text-white font-label-md text-label-md py-2 px-5 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm">
                            <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                            Start Exam
                        </button>
                    ) : (
                        <>
                            <button onClick={() => setShowAnnouncement(true)} className="border border-outline-variant font-label-md text-label-md py-2 px-4 rounded-lg hover:bg-surface-container-low transition-colors flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">campaign</span>
                                Announce
                            </button>
                            <button onClick={() => navigate(`/exams/${id}/results`)} className="border border-primary text-primary font-label-md text-label-md py-2 px-4 rounded-lg hover:bg-primary/5 transition-colors flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">bar_chart</span>
                                Results
                            </button>
                            <button onClick={handleEndExam} className="bg-red-600 text-white font-label-md text-label-md py-2 px-5 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">stop</span>
                                End Exam
                            </button>
                        </>
                    )}
                </div>
            </header>

            {/* Announcement Modal */}
            {showAnnouncement && createPortal(
                <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
                    <div className="bg-surface-container-lowest rounded-2xl p-lg shadow-xl" style={{ width: '100%', maxWidth: '448px', minWidth: '300px' }}>
                        <h3 className="font-title-md text-title-md text-on-surface mb-4">Send Announcement</h3>
                        <textarea
                            value={announcement}
                            onChange={e => setAnnouncement(e.target.value)}
                            className="w-full border border-outline-variant rounded-lg p-3 font-body-md text-body-md resize-none focus:outline-none focus:border-primary bg-surface-container-low"
                            rows={3}
                            placeholder="Type your announcement..."
                        />
                        <div className="flex gap-3 mt-4 justify-end">
                            <button onClick={() => setShowAnnouncement(false)} className="font-label-md text-label-md text-on-surface-variant px-4 py-2 rounded-lg hover:bg-surface-container-low">Cancel</button>
                            <button onClick={sendAnnouncement} className="bg-primary text-on-primary font-label-md text-label-md px-5 py-2 rounded-lg hover:bg-primary/90">Send</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Grant Re-attempt Modal */}
            {reattemptStudent && createPortal(
                <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl border border-outline-variant/20" style={{ width: '100%', maxWidth: '400px', minWidth: '300px' }}>
                        <div className="p-lg">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-orange-500">restart_alt</span>
                                </div>
                                <div>
                                    <h3 className="font-title-md text-title-md text-on-surface font-semibold">Grant Re-attempt?</h3>
                                    <p className="font-label-sm text-label-sm text-on-surface-variant">This will delete their current attempt and results.</p>
                                </div>
                            </div>
                            <p className="font-body-md text-body-md text-on-surface mb-1">
                                <strong>{reattemptStudent.name}</strong> ({reattemptStudent.rollNumber})
                            </p>
                            <p className="font-label-sm text-label-sm text-on-surface-variant">
                                They will be able to join and take the exam again from scratch.
                            </p>
                        </div>
                        <div className="px-lg py-md border-t border-outline-variant/20 flex justify-end gap-3">
                            <button onClick={() => setReattemptStudent(null)} className="font-label-md text-label-md text-on-surface-variant px-4 py-2 rounded-lg hover:bg-surface-container-low">Cancel</button>
                            <button
                                onClick={handleGrantReattempt}
                                disabled={granting}
                                className="bg-orange-600 text-white font-label-md text-label-md px-5 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-60"
                            >
                                {granting ? 'Granting...' : 'Grant Re-attempt'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <div className="flex-1 overflow-y-auto p-lg">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-md mb-lg">
                    {[
                        { label: 'Total Joined', value: students.length, icon: 'groups', color: 'text-primary' },
                        { label: 'In Progress', value: inProgressCount, icon: 'pending', color: 'text-orange-600' },
                        { label: 'Submitted', value: submittedCount, icon: 'check_circle', color: 'text-green-600' },
                        { label: 'Disconnected', value: disconnectedCount, icon: 'wifi_off', color: 'text-red-600' },
                    ].map(stat => (
                        <div key={stat.label} className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/20 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`material-symbols-outlined text-[18px] ${stat.color}`}>{stat.icon}</span>
                                <p className="font-label-sm text-label-sm text-on-surface-variant">{stat.label}</p>
                            </div>
                            <p className="font-headline-lg text-headline-lg font-bold text-on-surface">{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Students Table */}
                <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
                    <div className="px-lg py-md border-b border-outline-variant/20 flex flex-wrap items-center justify-between gap-4">
                        <h3 className="font-title-md text-title-md text-on-surface shrink-0">Connected Students</h3>
                        {/* Search */}
                        <div className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/30 rounded-lg px-3 py-2 flex-1 min-w-[200px] max-w-md">
                            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">search</span>
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search by name or register no..."
                                className="bg-transparent outline-none text-on-surface font-label-md text-label-md w-full placeholder:text-on-surface-variant/60"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="text-on-surface-variant hover:text-on-surface flex items-center">
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                            )}
                        </div>
                        <p className="font-label-sm text-label-sm text-on-surface-variant shrink-0 sm:w-auto text-right w-full sm:text-left">{filteredStudents.length} of {students.length}</p>
                    </div>

                    {filteredStudents.length === 0 ? (
                        <div className="py-16 text-center">
                            <span className="material-symbols-outlined text-[48px] text-outline-variant block mb-3">group</span>
                            <p className="font-body-md text-body-md text-on-surface-variant">
                                {search ? 'No students match your search.' : examStarted ? 'Waiting for students to join...' : 'Start the exam to allow students to join.'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-surface-container-low text-on-surface-variant text-left">
                                        <th className="px-lg py-sm font-label-sm text-label-sm">Name</th>
                                        <th className="px-lg py-sm font-label-sm text-label-sm">Register No.</th>
                                        <th className="px-lg py-sm font-label-sm text-label-sm">Status</th>
                                        <th className="px-lg py-sm font-label-sm text-label-sm">Progress</th>
                                        <th className="px-lg py-sm font-label-sm text-label-sm">Joined</th>
                                        <th className="px-lg py-sm font-label-sm text-label-sm">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-outline-variant/10">
                                    {filteredStudents.map(student => (
                                        <tr key={student.attemptId} className="hover:bg-surface-container-low/50 transition-colors">
                                            <td className="px-lg py-md font-label-md text-label-md text-on-surface font-medium">{student.name}</td>
                                            <td className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant">{student.rollNumber}</td>
                                            <td className="px-lg py-md">{statusBadge(student)}</td>
                                            <td className="px-lg py-md">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-24 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                                                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${totalQs > 0 ? (student.answered / totalQs) * 100 : 0}%` }} />
                                                    </div>
                                                    <span className="font-label-sm text-label-sm text-on-surface-variant">{student.answered}/{totalQs}</span>
                                                </div>
                                            </td>
                                            <td className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant">
                                                {new Date(student.joinedAt).toLocaleTimeString()}
                                            </td>
                                            <td className="px-lg py-md">
                                                <div className="flex items-center gap-1">
                                                    {student.status === 'IN_PROGRESS' && (
                                                        <button onClick={() => handleForceSubmit(student)} title="Force Submit" className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors">
                                                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                                        </button>
                                                    )}
                                                    <button onClick={() => setReattemptStudent(student)} title="Grant Re-attempt" className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-600 transition-colors">
                                                        <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                                                    </button>
                                                    <button onClick={() => handleEndStudent(student)} title="End Session" className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors">
                                                        <span className="material-symbols-outlined text-[18px]">person_off</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
