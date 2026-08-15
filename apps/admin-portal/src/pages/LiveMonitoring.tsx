import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../lib/api';
import socketService from '../lib/socket';
import { 
    ArrowLeft, 
    Play, 
    Megaphone, 
    BarChart2, 
    Square, 
    Search, 
    X, 
    RefreshCcw, 
    UserMinus, 
    CheckCircle, 
    Users, 
    Activity, 
    WifiOff, 
    AlertTriangle 
} from 'lucide-react';

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
    const [resumeStudent, setResumeStudent] = useState<Student | null>(null);
    const [resuming, setResuming] = useState(false);

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

        // Register exam code so reconnects re-subscribe automatically
        socketService.setMonitorExamId(id || null);

        socket.emit('admin_join');
        socket.emit('admin_monitor_exam', { examId: id });

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
            setStudents(prev => {
                const updated = prev.map(s =>
                    s.attemptId === update.attemptId ? { ...s, status: update.status as any, reasonLabel: update.reasonLabel } : s
                );
                if (update.reasonLabel && update.reasonLabel !== 'Normal') {
                    const student = prev.find(s => s.attemptId === update.attemptId);
                    toast.error(`${student?.name || 'Student'} auto-submitted: ${update.reasonLabel}`, { duration: 5000 });
                }
                return updated;
            });
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
            socketService.setMonitorExamId(null);
        };
    }, [exam?.exam_code, id]);

    const handleStartExam = () => {
        if (!exam || !id) return;
        const socket = socketService.getSocket();
        if (!socket) { toast.error('Not connected to server'); return; }
        socket.emit('exam:start', { examId: id });
        setExamStarted(true);
        toast.success(`Exam "${exam.title}" started! Students can now begin.`);
    };

    const handleEndExam = () => {
        if (!exam || !id || !window.confirm('End exam for ALL students? This cannot be undone.')) return;
        const socket = socketService.getSocket();
        socket?.emit('exam:end', { examId: id });
        setExamStarted(false);
        toast.success('Exam ended for all students');
        setTimeout(() => navigate(`/exams/${id}/results`), 1500);
    };

    const handleForceSubmit = (student: Student) => {
        const socket = socketService.getSocket();
        socket?.emit('force_submit', { attemptId: student.attemptId, socketId: student.socketId, examId: id });
        toast.success(`Force submitted ${student.name}`);
    };

    const handleRestartStudent = (student: Student) => {
        const socket = socketService.getSocket();
        socket?.emit('restart_student', { attemptId: student.attemptId, socketId: student.socketId, examId: id });
        toast.success(`Restarted ${student.name}'s exam`);
    };

    const handleEndStudent = (student: Student) => {
        const socket = socketService.getSocket();
        socket?.emit('end_student', { attemptId: student.attemptId, socketId: student.socketId, examId: id });
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

    const handleResumeSession = async () => {
        if (!resumeStudent || !id) return;
        setResuming(true);
        try {
            await api.post(`/exams/${id}/resume`, { rollNumber: resumeStudent.rollNumber });
            toast.success(`Resume granted to ${resumeStudent.name}. They can now rejoin where they left off.`);
            setStudents(prev => prev.map(s => s.attemptId === resumeStudent.attemptId ? { ...s, status: 'WAITING' } : s));
            setResumeStudent(null);
        } catch (e: any) {
            toast.error(e.response?.data?.error || 'Failed to grant resume');
        }
        setResuming(false);
    };

    const sendAnnouncement = () => {
        if (!announcement.trim() || !id) return;
        const socket = socketService.getSocket();
        socket?.emit('announcement', { examId: id, message: announcement });
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
            IN_PROGRESS: { label: 'In Progress', cls: 'bg-orange-100 text-orange-700 border border-orange-200' },
            SUBMITTED: { label: 'Submitted', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
            WAITING: { label: 'Waiting', cls: 'bg-slate-100 text-slate-700 border border-slate-200' },
            DISCONNECTED: { label: 'Disconnected', cls: 'bg-red-100 text-red-700 border border-red-200' },
            ENDED_BY_ADMIN: { label: 'Ended', cls: 'bg-slate-100 text-slate-600 border border-slate-200' },
        };
        const s = map[student.status] || { label: student.status, cls: 'bg-slate-100 text-slate-600 border border-slate-200' };
        return (
            <div className="flex flex-col gap-1 items-start">
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide ${s.cls}`}>{s.label}</span>
                {student.reasonLabel && student.reasonLabel !== 'Normal' && (
                    <span className="text-[10px] text-orange-600 font-bold bg-orange-50 px-1.5 py-0.5 rounded-sm border border-orange-100">
                        ⚡ {student.reasonLabel}
                    </span>
                )}
            </div>
        );
    };

    if (isLoading) return (
        <div className="flex items-center justify-center h-full bg-slate-50">
            <p className="text-slate-500 font-medium">Loading exam details...</p>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm sticky top-0 z-30">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/exams')} className="text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5 text-sm font-medium">
                        <ArrowLeft size={18} />
                        <span className="hidden md:inline">Back</span>
                    </button>
                    <div className="h-6 w-px bg-slate-200 hidden md:block" />
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 leading-tight">{exam?.title || 'Live Monitoring'}</h1>
                        <p className="text-xs font-medium text-slate-500 leading-tight">Code: <span className="font-mono bg-slate-100 px-1 rounded text-slate-600">{exam?.exam_code}</span> · {exam?.duration_minutes} min</p>
                    </div>
                    
                    {/* LIVE indicator */}
                    {examStarted ? (
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full ml-4">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            <span className="text-emerald-700 text-xs font-bold tracking-wide">LIVE</span>
                        </div>
                    ) : (
                        <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 ml-4 border border-slate-200">
                            NOT STARTED
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {!examStarted ? (
                        <button onClick={handleStartExam} className="bg-emerald-600 text-white text-sm font-semibold py-2 px-5 rounded-md hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm">
                            <Play size={16} className="fill-white" />
                            Start Exam
                        </button>
                    ) : (
                        <>
                            <button onClick={() => setShowAnnouncement(true)} className="bg-white border border-slate-200 text-slate-700 text-sm font-medium py-2 px-4 rounded-md hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm">
                                <Megaphone size={16} />
                                <span className="hidden sm:inline">Announce</span>
                            </button>
                            <button onClick={() => navigate(`/exams/${id}/results`)} className="bg-white border border-primary text-primary text-sm font-medium py-2 px-4 rounded-md hover:bg-slate-100 transition-colors flex items-center gap-2 shadow-sm">
                                <BarChart2 size={16} />
                                <span className="hidden sm:inline">Results</span>
                            </button>
                            <button onClick={handleEndExam} className="bg-red-600 text-white text-sm font-semibold py-2 px-5 rounded-md hover:bg-red-700 transition-colors flex items-center gap-2 shadow-sm">
                                <Square size={14} className="fill-white" />
                                End Exam
                            </button>
                        </>
                    )}
                </div>
            </header>

            {/* Announcement Modal */}
            {showAnnouncement && createPortal(
                <div className="fixed inset-0 bg-slate-900/40 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col w-[90vw] max-w-md" style={{ minWidth: '300px' }}>
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                <Megaphone size={18} className="text-primary" />
                                Send Announcement
                            </h3>
                            <button onClick={() => setShowAnnouncement(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <textarea
                                value={announcement}
                                onChange={e => setAnnouncement(e.target.value)}
                                className="w-full border border-slate-200 rounded-md p-3 text-sm text-slate-900 resize-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-slate-50"
                                rows={3}
                                placeholder="Type your announcement (e.g. '15 minutes remaining')..."
                            />
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex gap-3 justify-end">
                            <button onClick={() => setShowAnnouncement(false)} className="text-sm font-medium text-slate-600 px-4 py-2 rounded-md hover:bg-slate-200 transition-colors">Cancel</button>
                            <button onClick={sendAnnouncement} className="bg-primary text-white text-sm font-medium px-5 py-2 rounded-md hover:bg-black shadow-sm transition-colors">Send</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Grant Re-attempt Modal */}
            {reattemptStudent && createPortal(
                <div className="fixed inset-0 bg-slate-900/40 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col w-[90vw] max-w-sm" style={{ minWidth: '300px' }}>
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                                    <RefreshCcw className="text-orange-600" size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900">Grant Re-attempt?</h3>
                                </div>
                            </div>
                            <p className="text-sm text-slate-900 mb-1">
                                <strong>{reattemptStudent.name}</strong> ({reattemptStudent.rollNumber})
                            </p>
                            <p className="text-xs text-slate-500">
                                This will delete their current attempt and results. They will be able to join and take the exam again from scratch.
                            </p>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3">
                            <button onClick={() => setReattemptStudent(null)} className="text-sm font-medium text-slate-600 px-4 py-2 rounded-md hover:bg-slate-200 transition-colors">Cancel</button>
                            <button
                                onClick={handleGrantReattempt}
                                disabled={granting}
                                className="bg-orange-600 text-white text-sm font-medium px-5 py-2 rounded-md hover:bg-orange-700 shadow-sm transition-colors disabled:opacity-60"
                            >
                                {granting ? 'Granting...' : 'Grant Re-attempt'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Resume Session Modal */}
            {resumeStudent && createPortal(
                <div className="fixed inset-0 bg-slate-900/40 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col w-[90vw] max-w-sm" style={{ minWidth: '300px' }}>
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                    <Play className="text-blue-600" size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900">Resume Session?</h3>
                                </div>
                            </div>
                            <p className="text-sm text-slate-900 mb-1">
                                <strong>{resumeStudent.name}</strong> ({resumeStudent.rollNumber})
                            </p>
                            <p className="text-xs text-slate-500">
                                This allows the student to rejoin the exam and continue exactly where they left off with their remaining time. No answers will be deleted.
                            </p>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3">
                            <button onClick={() => setResumeStudent(null)} className="text-sm font-medium text-slate-600 px-4 py-2 rounded-md hover:bg-slate-200 transition-colors">Cancel</button>
                            <button
                                onClick={handleResumeSession}
                                disabled={resuming}
                                className="bg-blue-600 text-white text-sm font-medium px-5 py-2 rounded-md hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-60"
                            >
                                {resuming ? 'Resuming...' : 'Allow Resume'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                        {[
                            { label: 'Total Joined', value: students.length, icon: Users, color: 'text-primary', bg: 'bg-blue-50' },
                            { label: 'In Progress', value: inProgressCount, icon: Activity, color: 'text-orange-600', bg: 'bg-orange-50' },
                            { label: 'Submitted', value: submittedCount, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                            { label: 'Disconnected', value: disconnectedCount, icon: WifiOff, color: 'text-red-600', bg: 'bg-red-50' },
                        ].map(stat => {
                            const Icon = stat.icon;
                            return (
                                <div key={stat.label} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${stat.bg}`}>
                                        <Icon className={stat.color} size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                                        <p className="text-2xl font-bold text-slate-900 mt-0.5">{stat.value}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Students Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50">
                            <h3 className="text-base font-semibold text-slate-900 shrink-0">Connected Students</h3>
                            {/* Search */}
                            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-3 py-1.5 flex-1 min-w-[200px] max-w-sm focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                                <Search size={16} className="text-slate-400 shrink-0" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search by name or register no..."
                                    className="bg-transparent border-none outline-none text-slate-900 text-sm w-full placeholder:text-slate-400"
                                />
                                {search && (
                                    <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 flex items-center">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            <p className="text-xs font-medium text-slate-500 shrink-0 sm:w-auto text-right w-full sm:text-left">
                                Showing {filteredStudents.length} of {students.length}
                            </p>
                        </div>

                        {filteredStudents.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-center">
                                <Users size={48} strokeWidth={1} className="text-slate-300 mb-4" />
                                <p className="text-slate-500 text-sm font-medium">
                                    {search ? 'No students match your search.' : examStarted ? 'Waiting for students to join...' : 'Start the exam to allow students to join.'}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Register No.</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Progress</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Joined</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredStudents.map(student => (
                                            <tr key={student.attemptId} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <code className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">{student.rollNumber}</code>
                                                </td>
                                                <td className="px-6 py-4">{statusBadge(student)}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden shrink-0">
                                                            <div 
                                                                className={`h-full rounded-full transition-all duration-500 ${student.answered === totalQs ? 'bg-emerald-500' : 'bg-primary'}`} 
                                                                style={{ width: `${totalQs > 0 ? (student.answered / totalQs) * 100 : 0}%` }} 
                                                            />
                                                        </div>
                                                        <span className="text-xs font-medium text-slate-600">{student.answered}/{totalQs}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                                                    {new Date(student.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1.5">
                                                        {student.status === 'IN_PROGRESS' && (
                                                            <button onClick={() => handleForceSubmit(student)} title="Force Submit" className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                                                                <CheckCircle size={18} />
                                                            </button>
                                                        )}
                                                        {(student.status === 'SUBMITTED' || student.status === 'DISCONNECTED') && (
                                                            <button onClick={() => setResumeStudent(student)} title="Resume Session" className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                                                <Play size={18} />
                                                            </button>
                                                        )}
                                                        <button onClick={() => setReattemptStudent(student)} title="Grant Re-attempt" className="p-1.5 rounded-md text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors">
                                                            <RefreshCcw size={18} />
                                                        </button>
                                                        <button onClick={() => handleEndStudent(student)} title="End Session" className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                                            <UserMinus size={18} />
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
        </div>
    );
}
