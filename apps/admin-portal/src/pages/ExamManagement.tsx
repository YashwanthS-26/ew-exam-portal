import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../lib/api';
import socketService from '../lib/socket';

interface Exam {
    id: string;
    title: string;
    exam_code: string;
    start_time?: string | null;
    duration_minutes: number;
    total_questions_pool: number;
    cooldown_minutes: number;
    status: 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'ENDED';
    show_results_to_students: boolean;
}

export default function ExamManagement() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [settingsExam, setSettingsExam] = useState<Exam | null>(null);
    const [settingsDuration, setSettingsDuration] = useState(60);
    const [settingsShowResults, setSettingsShowResults] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<Exam | null>(null);

    const { data: exams, isLoading } = useQuery({
        queryKey: ['exams'],
        queryFn: async () => {
            const { data } = await api.get('/exams');
            return data as Exam[];
        },
        refetchInterval: 15000,
    });

    const filteredExams = exams?.filter((e: Exam) => {
        const matchesFilter = filter === 'ALL' || e.status === filter;
        const matchesSearch = !search ||
            e.title.toLowerCase().includes(search.toLowerCase()) ||
            e.exam_code.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    }) || [];

    const handleStartExam = (exam: Exam) => {
        const socket = socketService.connect();
        if (!socket) { toast.error('Not connected'); return; }
        socket.emit('exam:start', { examId: exam.id, examCode: exam.exam_code });
        queryClient.invalidateQueries({ queryKey: ['exams'] });
        toast.success(`Exam "${exam.title}" started!`);
        navigate(`/exams/${exam.id}/live`);
    };

    const handlePublish = async (exam: Exam) => {
        try {
            await api.post(`/exams/${exam.id}/publish`);
            queryClient.invalidateQueries({ queryKey: ['exams'] });
            toast.success('Exam published!');
        } catch (e: any) {
            toast.error(e.response?.data?.error || 'Failed to publish');
        }
    };

    const openSettings = (exam: Exam) => {
        setSettingsExam(exam);
        setSettingsDuration(exam.duration_minutes || 60);
        setSettingsShowResults(exam.show_results_to_students || false);
    };

    const saveSettings = async () => {
        if (!settingsExam) return;
        try {
            await api.patch(`/exams/${settingsExam.id}`, {
                duration_minutes: settingsDuration,
                show_results_to_students: settingsShowResults,
            });
            queryClient.invalidateQueries({ queryKey: ['exams'] });
            toast.success('Settings saved!');
            setSettingsExam(null);
        } catch (e: any) {
            toast.error(e.response?.data?.error || 'Failed to save settings');
        }
    };

    const handleDelete = async (exam: Exam) => {
        try {
            await api.delete(`/exams/${exam.id}`);
            queryClient.invalidateQueries({ queryKey: ['exams'] });
            toast.success('Exam deleted');
            setDeleteConfirm(null);
        } catch (e: any) {
            toast.error(e.response?.data?.error || 'Failed to delete exam');
        }
    };

    const statusBadge = (status: string) => {
        const map: Record<string, { cls: string; dot: string }> = {
            DRAFT: { cls: 'bg-surface-container-high text-on-surface-variant', dot: 'bg-gray-400' },
            PUBLISHED: { cls: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
            ACTIVE: { cls: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
            ENDED: { cls: 'bg-red-100 text-red-600', dot: 'bg-red-500' },
        };
        const s = map[status] || map['DRAFT'];
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${s.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status === 'ACTIVE' ? 'animate-pulse' : ''}`} />
                {status}
            </span>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-lg lg:px-xl">
            <div className="w-full max-w-[1280px] mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">Exam Management</h2>
                        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Create, manage, and monitor your examinations.</p>
                    </div>
                    <button onClick={() => navigate('/exams/create')} className="bg-primary text-on-primary font-label-md text-label-md py-2.5 px-5 rounded-lg hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2 self-start sm:self-auto">
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        Create New Exam
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-md flex flex-col lg:flex-row gap-4 items-center">
                    <div className="w-full lg:w-1/3 flex items-center bg-surface-container-low rounded-lg px-3 py-2 border border-outline-variant focus-within:border-primary transition-all">
                        <span className="material-symbols-outlined text-on-surface-variant mr-2 text-[20px]">search</span>
                        <input
                            className="bg-transparent border-none focus:ring-0 outline-none w-full text-on-surface font-body-md text-body-md placeholder-on-surface-variant"
                            placeholder="Search by name or code..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-1 bg-surface-container-low p-1 rounded-lg border border-outline-variant">
                        {['ALL', 'DRAFT', 'PUBLISHED', 'ACTIVE', 'ENDED'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-md font-label-sm text-label-sm transition-colors ${filter === f ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                            >
                                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Exams Table */}
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 shadow-sm overflow-hidden">
                    {isLoading ? (
                        <div className="py-16 text-center text-on-surface-variant font-body-md">Loading exams...</div>
                    ) : filteredExams.length === 0 ? (
                        <div className="py-16 text-center">
                            <span className="material-symbols-outlined text-[48px] text-outline-variant block mb-3">quiz</span>
                            <p className="font-body-md text-body-md text-on-surface-variant">No exams found.</p>
                            <button onClick={() => navigate('/exams/create')} className="mt-4 text-primary font-label-md hover:underline">Create your first exam →</button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-surface-container-low border-b border-outline-variant/20">
                                        <th className="px-6 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Exam</th>
                                        <th className="px-6 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Code</th>
                                        <th className="px-6 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Duration</th>
                                        <th className="px-6 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Questions</th>
                                        <th className="px-6 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-outline-variant/10">
                                    {filteredExams.map((exam: Exam) => (
                                        <tr key={exam.id} className="hover:bg-surface-container-low/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <p className="font-label-md text-label-md text-on-surface font-semibold">{exam.title}</p>
                                            </td>
                                            <td className="px-6 py-4 font-label-sm text-label-sm text-on-surface-variant font-mono">{exam.exam_code}</td>
                                            <td className="px-6 py-4 font-label-sm text-label-sm text-on-surface-variant">{exam.duration_minutes} min</td>
                                            <td className="px-6 py-4 font-label-sm text-label-sm text-on-surface-variant">{exam.total_questions_pool || 0}</td>
                                            <td className="px-6 py-4">{statusBadge(exam.status)}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-1 flex-wrap">
                                                    {exam.status === 'DRAFT' && (
                                                        <>
                                                            <button onClick={() => navigate(`/exams/${exam.id}/questions`)} title="Edit Questions" className="px-2.5 py-1.5 rounded-lg hover:bg-primary/10 text-primary font-label-sm text-label-sm flex items-center gap-1 transition-colors">
                                                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                                                Edit
                                                            </button>
                                                            <button onClick={() => handlePublish(exam)} title="Publish" className="px-2.5 py-1.5 rounded-lg hover:bg-orange-50 text-orange-600 font-label-sm text-label-sm flex items-center gap-1 transition-colors">
                                                                <span className="material-symbols-outlined text-[16px]">publish</span>
                                                                Publish
                                                            </button>
                                                        </>
                                                    )}
                                                    {exam.status === 'PUBLISHED' && (
                                                        <button onClick={() => handleStartExam(exam)} className="px-3 py-1.5 rounded-lg bg-green-600 text-white font-label-sm text-label-sm flex items-center gap-1 hover:bg-green-700 transition-colors">
                                                            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                                                            Start
                                                        </button>
                                                    )}
                                                    {exam.status === 'ACTIVE' && (
                                                        <button onClick={() => navigate(`/exams/${exam.id}/live`)} className="px-2.5 py-1.5 rounded-lg bg-green-100 text-green-700 font-label-sm text-label-sm flex items-center gap-1 hover:bg-green-200 transition-colors">
                                                            <span className="material-symbols-outlined text-[16px] animate-pulse">radio_button_checked</span>
                                                            Live
                                                        </button>
                                                    )}
                                                    {(exam.status === 'ACTIVE' || exam.status === 'ENDED') && (
                                                        <button onClick={() => navigate(`/exams/${exam.id}/results`)} title="Results" className="px-2.5 py-1.5 rounded-lg hover:bg-primary/10 text-primary font-label-sm text-label-sm flex items-center gap-1 transition-colors">
                                                            <span className="material-symbols-outlined text-[16px]">bar_chart</span>
                                                            Results
                                                        </button>
                                                    )}
                                                    <button onClick={() => openSettings(exam)} title="Settings" className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
                                                        <span className="material-symbols-outlined text-[18px]">settings</span>
                                                    </button>
                                                    <button onClick={() => setDeleteConfirm(exam)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                                                        <span className="material-symbols-outlined text-[18px]">delete</span>
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

            {/* Settings Modal */}
            {settingsExam && createPortal(
                <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
                    <div 
                        className="bg-white rounded-2xl shadow-xl border border-outline-variant/20 flex flex-col"
                        style={{ width: '100%', maxWidth: '448px', minWidth: '320px' }}
                    >
                        <div className="px-lg py-md border-b border-outline-variant/20 flex items-center justify-between">
                            <h3 className="font-title-md text-title-md text-on-surface font-semibold truncate pr-4" title={`${settingsExam.title} — Settings`}>
                                {settingsExam.title} — Settings
                            </h3>
                            <button onClick={() => setSettingsExam(null)} className="text-on-surface-variant hover:text-on-surface shrink-0">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-lg space-y-5">
                            <div>
                                <label className="font-label-md text-label-md text-on-surface-variant block mb-1.5">Duration (minutes)</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={settingsDuration}
                                    onChange={e => setSettingsDuration(Number(e.target.value))}
                                    className="w-full border border-outline-variant rounded-lg px-3 py-2.5 font-body-md text-body-md focus:outline-none focus:border-primary bg-surface-container-low"
                                />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl">
                                <div>
                                    <p className="font-label-md text-label-md text-on-surface">Show Results to Students</p>
                                    <p className="font-label-sm text-label-sm text-on-surface-variant">Students see their score after submission</p>
                                </div>
                                <button
                                    onClick={() => setSettingsShowResults(v => !v)}
                                    className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${settingsShowResults ? 'bg-primary' : 'bg-outline-variant'}`}
                                >
                                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settingsShowResults ? 'translate-x-6' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                        </div>
                        <div className="px-lg py-md border-t border-outline-variant/20 flex justify-end gap-3">
                            <button onClick={() => setSettingsExam(null)} className="font-label-md text-label-md text-on-surface-variant px-4 py-2 rounded-lg hover:bg-surface-container-low">Cancel</button>
                            <button onClick={saveSettings} className="bg-primary text-on-primary font-label-md text-label-md px-5 py-2 rounded-lg hover:bg-primary/90 shadow-sm">Save Settings</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Delete Confirm Modal */}
            {deleteConfirm && createPortal(
                <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl border border-outline-variant/20" style={{ width: '100%', maxWidth: '400px', minWidth: '300px' }}>
                        <div className="p-lg">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-red-500">delete_forever</span>
                                </div>
                                <div>
                                    <h3 className="font-title-md text-title-md text-on-surface font-semibold">Delete Exam?</h3>
                                    <p className="font-label-sm text-label-sm text-on-surface-variant">This cannot be undone.</p>
                                </div>
                            </div>
                            <p className="font-body-md text-body-md text-on-surface mb-1"><strong>{deleteConfirm.title}</strong></p>
                            <p className="font-label-sm text-label-sm text-on-surface-variant">All questions and student attempts will be deleted.</p>
                        </div>
                        <div className="px-lg py-md border-t border-outline-variant/20 flex justify-end gap-3">
                            <button onClick={() => setDeleteConfirm(null)} className="font-label-md text-label-md text-on-surface-variant px-4 py-2 rounded-lg hover:bg-surface-container-low">Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="bg-red-600 text-white font-label-md text-label-md px-5 py-2 rounded-lg hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
