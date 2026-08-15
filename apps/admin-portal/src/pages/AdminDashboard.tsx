import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import socketService from '../lib/socket';
import { 
    Plus, 
    List, 
    FileText, 
    RadioReceiver, 
    PlayCircle, 
    UserPlus, 
    CheckCircle, 
    StopCircle, 
    UserMinus, 
    Activity, 
    Monitor, 
    Clock, 
    Calendar 
} from 'lucide-react';

interface ActivityEvent {
    id: string;
    type: 'exam_started' | 'student_joined' | 'student_submitted' | 'exam_ended' | 'student_disconnected';
    message: string;
    time: string;
    examCode?: string;
}

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);
    const [activeExamCount, setActiveExamCount] = useState(0);

    const { data: stats, isLoading, refetch } = useQuery({
        queryKey: ['dashboardStats'],
        queryFn: async () => {
            const { data } = await api.get('/exams/stats');
            return data;
        },
        refetchInterval: 30000,
    });

    const { data: exams } = useQuery({
        queryKey: ['exams'],
        queryFn: async () => {
            const { data } = await api.get('/exams');
            return data as any[];
        },
        refetchInterval: 15000,
    });

    const addEvent = (event: Omit<ActivityEvent, 'id' | 'time'>) => {
        setActivityFeed(prev => [{
            id: Math.random().toString(36).slice(2),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            ...event
        }, ...prev].slice(0, 50));
    };

    useEffect(() => {
        const socket = socketService.connect();
        if (!socket) return;

        socket.emit('admin_join');

        socket.on('live_snapshot', (snapshot: any[]) => {
            setActiveExamCount(snapshot.length);
        });

        socket.on('admin:exam_started', (data: any) => {
            setActiveExamCount(c => c + 1);
            addEvent({ type: 'exam_started', message: `Exam ${data.examCode} started`, examCode: data.examCode });
            refetch();
        });

        socket.on('admin:exam_ended', (data: any) => {
            setActiveExamCount(c => Math.max(0, c - 1));
            addEvent({ type: 'exam_ended', message: `Exam ${data.examCode} ended` });
            refetch();
        });

        socket.on('student_connected', (data: any) => {
            addEvent({ type: 'student_joined', message: `${data.name || 'Student'} joined ${data.examCode || ''}`, examCode: data.examCode });
        });

        socket.on('student_submitted', (data: any) => {
            addEvent({ type: 'student_submitted', message: `A student submitted in ${data.examCode || ''}`, examCode: data.examCode });
        });

        socket.on('student_disconnected', (data: any) => {
            addEvent({ type: 'student_disconnected', message: `A student disconnected` });
        });

        return () => {
            socket.off('live_snapshot');
            socket.off('admin:exam_started');
            socket.off('admin:exam_ended');
            socket.off('student_connected');
            socket.off('student_submitted');
            socket.off('student_disconnected');
        };
    }, [refetch]);

    const activeExams = exams?.filter((e: any) => e.status === 'ACTIVE') || [];
    const upcomingExams = exams?.filter((e: any) => e.status === 'DRAFT' || e.status === 'PUBLISHED') || [];

    const getEventStyle = (type: ActivityEvent['type']) => {
        switch (type) {
            case 'exam_started': return { icon: PlayCircle, color: 'text-green-500', bg: 'bg-green-50' };
            case 'student_joined': return { icon: UserPlus, color: 'text-slate-500', bg: 'bg-blue-50' };
            case 'student_submitted': return { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50' };
            case 'exam_ended': return { icon: StopCircle, color: 'text-red-500', bg: 'bg-red-50' };
            case 'student_disconnected': return { icon: UserMinus, color: 'text-orange-500', bg: 'bg-orange-50' };
        }
    };

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
                    <p className="text-sm text-slate-500 mt-1">Overview of your examination activity.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/exams')} className="bg-white border border-slate-200 text-slate-700 text-sm font-medium py-2 px-4 rounded-md flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm">
                        <List size={16} />
                        All Exams
                    </button>
                    <button onClick={() => navigate('/exams/create')} className="bg-primary text-white text-sm font-medium py-2 px-4 rounded-md flex items-center gap-2 hover:bg-black transition-colors shadow-sm">
                        <Plus size={16} />
                        Create Exam
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center gap-5">
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="text-primary" size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Total Exams</p>
                        <p className="text-3xl font-bold text-slate-900 mt-1">{isLoading ? '—' : (stats?.totalExams ?? exams?.length ?? 0)}</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center gap-5 relative overflow-hidden">
                    <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
                        <RadioReceiver className="text-emerald-600" size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Active Examinations</p>
                        <div className="flex items-center gap-3 mt-1">
                            <p className="text-3xl font-bold text-slate-900">{activeExams.length || activeExamCount}</p>
                            {(activeExams.length > 0 || activeExamCount > 0) && (
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Exams */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                            <PlayCircle size={18} className="text-emerald-500" />
                            Live Monitoring
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {activeExams.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                                <Monitor size={48} strokeWidth={1} className="text-slate-300" />
                                <p className="text-sm">No exams currently active</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {activeExams.map((exam: any) => (
                                    <div key={exam.id} className="px-6 py-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                        <div>
                                            <p className="font-medium text-slate-900">{exam.title}</p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="inline-flex items-center text-xs text-slate-500 font-medium">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                                                    {exam.exam_code}
                                                </span>
                                                <span className="inline-flex items-center text-xs text-slate-500">
                                                    <Clock size={12} className="mr-1" />
                                                    {exam.duration_minutes}m
                                                </span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => navigate(`/exams/${exam.id}/live`)} 
                                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-slate-200 text-primary text-xs font-medium py-1.5 px-3 rounded-md shadow-sm hover:bg-slate-100 hover:border-slate-200 flex items-center gap-1.5"
                                        >
                                            <Monitor size={14} />
                                            View Live
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Real-Time Activity Feed */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                            <Activity size={18} className="text-primary" />
                            Activity Log
                        </h3>
                        {activityFeed.length > 0 && (
                            <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full shadow-sm">
                                {activityFeed.length} recent
                            </span>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        {activityFeed.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                                <Activity size={48} strokeWidth={1} className="text-slate-300" />
                                <p className="text-sm">Waiting for incoming events...</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activityFeed.map(event => {
                                    const { icon: Icon, color, bg } = getEventStyle(event.type);
                                    return (
                                        <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 bg-slate-50/50 transition-colors">
                                            <div className={`mt-0.5 w-8 h-8 rounded-full ${bg} flex items-center justify-center shrink-0`}>
                                                <Icon size={16} className={color} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-slate-800 font-medium truncate">{event.message}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">{event.time}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Upcoming Exams */}
            {upcomingExams.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                            <Calendar size={18} className="text-slate-600" />
                            Upcoming & Drafts
                        </h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {upcomingExams.slice(0, 5).map((exam: any) => (
                            <div key={exam.id} className="px-6 py-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-slate-900">{exam.title}</p>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-xs text-slate-500 font-medium">Code: {exam.exam_code}</span>
                                        <span className="text-xs text-slate-400">•</span>
                                        <span className="text-xs text-slate-500">
                                            {exam.start_time ? new Date(exam.start_time).toLocaleString() : 'No schedule set'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                                        exam.status === 'PUBLISHED' 
                                            ? 'bg-blue-50 text-blue-700 border-slate-200' 
                                            : 'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}>
                                        {exam.status}
                                    </span>
                                    <button 
                                        onClick={() => navigate(`/exams/${exam.id}/questions`)} 
                                        className="text-primary text-sm font-medium hover:text-blue-700 hover:underline"
                                    >
                                        Edit
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {upcomingExams.length > 5 && (
                        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-center">
                            <button onClick={() => navigate('/exams')} className="text-sm text-slate-600 font-medium hover:text-slate-900">
                                View all {upcomingExams.length} upcoming exams
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
