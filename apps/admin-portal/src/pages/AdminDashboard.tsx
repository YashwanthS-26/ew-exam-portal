import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import socketService from '../lib/socket';

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
            time: new Date().toLocaleTimeString(),
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
            addEvent({ type: 'student_submitted', message: `A student submitted in exam ${data.examCode || ''}`, examCode: data.examCode });
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

    // Count active exams from fetched list
    const activeExams = exams?.filter((e: any) => e.status === 'ACTIVE') || [];
    const upcomingExams = exams?.filter((e: any) => e.status === 'DRAFT' || e.status === 'PUBLISHED') || [];

    const eventIcon = (type: ActivityEvent['type']) => {
        switch (type) {
            case 'exam_started': return { icon: 'play_circle', color: 'text-green-500' };
            case 'student_joined': return { icon: 'person_add', color: 'text-orange-500' };
            case 'student_submitted': return { icon: 'check_circle', color: 'text-primary' };
            case 'exam_ended': return { icon: 'stop_circle', color: 'text-red-500' };
            case 'student_disconnected': return { icon: 'person_off', color: 'text-orange-500' };
        }
    };

    return (
        <div className="p-sm md:p-lg">
            <div className="max-w-[1280px] mx-auto space-y-lg">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface">Dashboard</h2>
                        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Real-time overview of your examination environment.</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button onClick={() => navigate('/exams/create')} className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-sm">
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            Create Exam
                        </button>
                        <button onClick={() => navigate('/exams')} className="bg-surface-container-lowest border border-outline-variant text-on-surface font-label-md text-label-md py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-surface-container-low transition-colors">
                            <span className="material-symbols-outlined text-[18px]">list</span>
                            All Exams
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-2 gap-md">
                    <div className="bg-surface-container-lowest rounded-2xl p-lg border border-outline-variant/20 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-primary-container rounded-xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-primary text-[22px]">quiz</span>
                            </div>
                            <p className="font-label-md text-label-md text-on-surface-variant">Total Exams</p>
                        </div>
                        <p className="font-display text-[36px] font-bold text-on-surface">{isLoading ? '—' : (stats?.totalExams ?? exams?.length ?? 0)}</p>
                    </div>

                    <div className="bg-surface-container-lowest rounded-2xl p-lg border border-outline-variant/20 shadow-sm relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-green-600 text-[22px]">radio_button_checked</span>
                            </div>
                            <p className="font-label-md text-label-md text-on-surface-variant">Tests Happening Now</p>
                        </div>
                        <p className="font-display text-[36px] font-bold text-on-surface">{activeExams.length || activeExamCount}</p>
                        {(activeExams.length > 0 || activeExamCount > 0) && (
                            <span className="absolute top-3 right-3 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
                    {/* Active Exams */}
                    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
                        <div className="px-lg py-md border-b border-outline-variant/20 flex items-center justify-between">
                            <h3 className="font-title-md text-title-md text-on-surface flex items-center gap-2">
                                <span className="material-symbols-outlined text-green-500 text-[20px]">play_circle</span>
                                Active Exams
                            </h3>
                        </div>
                        <div className="divide-y divide-outline-variant/10">
                            {activeExams.length === 0 ? (
                                <div className="p-lg text-center text-on-surface-variant font-body-md">
                                    <span className="material-symbols-outlined text-[36px] text-outline-variant mb-2 block">hourglass_empty</span>
                                    No exams running right now
                                </div>
                            ) : activeExams.map((exam: any) => (
                                <div key={exam.id} className="px-lg py-md flex items-center justify-between">
                                    <div>
                                        <p className="font-label-md text-label-md text-on-surface font-semibold">{exam.title}</p>
                                        <p className="font-label-sm text-label-sm text-on-surface-variant">{exam.exam_code} · {exam.duration_minutes} min</p>
                                    </div>
                                    <button onClick={() => navigate(`/exams/${exam.id}/live`)} className="text-primary font-label-sm text-label-sm hover:underline flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[16px]">monitor</span>
                                        Monitor
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Real-Time Activity Feed */}
                    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
                        <div className="px-lg py-md border-b border-outline-variant/20 flex items-center justify-between">
                            <h3 className="font-title-md text-title-md text-on-surface flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-[20px]">stream</span>
                                Live Activity
                            </h3>
                            <span className="font-label-sm text-label-sm text-on-surface-variant">{activityFeed.length} events</span>
                        </div>
                        <div className="divide-y divide-outline-variant/10 max-h-80 overflow-y-auto">
                            {activityFeed.length === 0 ? (
                                <div className="p-lg text-center text-on-surface-variant font-body-md">
                                    <span className="material-symbols-outlined text-[36px] text-outline-variant mb-2 block">notifications_none</span>
                                    Waiting for activity...
                                </div>
                            ) : activityFeed.map(event => {
                                const { icon, color } = eventIcon(event.type);
                                return (
                                    <div key={event.id} className="px-lg py-sm flex items-center gap-3">
                                        <span className={`material-symbols-outlined text-[18px] shrink-0 ${color}`}>{icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-label-sm text-label-sm text-on-surface truncate">{event.message}</p>
                                        </div>
                                        <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0">{event.time}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Upcoming Exams */}
                {upcomingExams.length > 0 && (
                    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
                        <div className="px-lg py-md border-b border-outline-variant/20">
                            <h3 className="font-title-md text-title-md text-on-surface">Upcoming Exams</h3>
                        </div>
                        <div className="divide-y divide-outline-variant/10">
                            {upcomingExams.slice(0, 5).map((exam: any) => (
                                <div key={exam.id} className="px-lg py-md flex items-center justify-between">
                                    <div>
                                        <p className="font-label-md text-label-md text-on-surface font-semibold">{exam.title}</p>
                                        <p className="font-label-sm text-label-sm text-on-surface-variant">
                                            {exam.exam_code} · {exam.start_time ? new Date(exam.start_time).toLocaleString() : 'Not scheduled'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${exam.status === 'PUBLISHED' ? 'bg-orange-100 text-orange-700' : 'bg-surface-container-high text-on-surface-variant'}`}>
                                            {exam.status}
                                        </span>
                                        <button onClick={() => navigate(`/exams/${exam.id}/questions`)} className="text-primary font-label-sm text-label-sm hover:underline">
                                            Edit
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
