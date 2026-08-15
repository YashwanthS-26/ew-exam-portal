import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../lib/api';
import socketService from '../lib/socket';
import { 
    Plus, 
    Search, 
    Settings, 
    Trash2, 
    Play, 
    Radio, 
    BarChart2, 
    Edit, 
    UploadCloud, 
    X, 
    AlertTriangle,
    FileText,
    List,
    Eye
} from 'lucide-react';

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
    const [deleteConfirm, setDeleteConfirm] = useState<Exam | null>(null);
    const [publishConfirm, setPublishConfirm] = useState<Exam | null>(null);
    const [publishText, setPublishText] = useState('');

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
            setPublishConfirm(null);
            setPublishText('');
        } catch (e: any) {
            toast.error(e.response?.data?.error || 'Failed to publish');
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
            DRAFT: { cls: 'bg-slate-100 text-slate-600 border border-slate-200', dot: 'bg-slate-400' },
            PUBLISHED: { cls: 'bg-blue-50 text-blue-700 border border-slate-200', dot: 'bg-blue-500' },
            ACTIVE: { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' },
            ENDED: { cls: 'bg-red-50 text-red-700 border border-red-200', dot: 'bg-red-500' },
        };
        const s = map[status] || map['DRAFT'];
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${s.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status === 'ACTIVE' ? 'animate-pulse' : ''}`} />
                {status}
            </span>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
            <div className="w-full max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Exam Management</h2>
                        <p className="text-sm text-slate-500 mt-1">Create, manage, and monitor your examinations.</p>
                    </div>
                    <button onClick={() => navigate('/exams/create')} className="bg-primary text-white text-sm font-medium py-2.5 px-5 rounded-md hover:bg-black transition-colors shadow-sm flex items-center gap-2 self-start sm:self-auto">
                        <Plus size={18} />
                        Create New Exam
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col lg:flex-row gap-4 items-center shadow-sm">
                    <div className="w-full lg:w-1/3 flex items-center bg-slate-50 rounded-md px-3 py-2 border border-slate-200 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                        <Search size={18} className="text-slate-400 mr-2" />
                        <input
                            className="bg-transparent border-none focus:ring-0 outline-none w-full text-slate-900 text-sm placeholder-slate-400"
                            placeholder="Search by name or code..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap gap-1 bg-slate-50 p-1 rounded-md border border-slate-200">
                        {['ALL', 'DRAFT', 'PUBLISHED', 'ACTIVE', 'ENDED'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                                    filter === f 
                                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                                    : 'text-slate-500 hover:text-slate-900 border border-transparent'
                                }`}
                            >
                                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Exams Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {isLoading ? (
                        <div className="py-16 text-center text-slate-500 text-sm">Loading exams...</div>
                    ) : filteredExams.length === 0 ? (
                        <div className="py-16 flex flex-col items-center text-center">
                            <FileText size={48} className="text-slate-300 mb-3 stroke-1" />
                            <p className="text-slate-500 text-sm">No exams found matching your criteria.</p>
                            <button onClick={() => navigate('/exams/create')} className="mt-4 text-primary text-sm font-medium hover:underline">Create your first exam &rarr;</button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Exam</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Questions</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredExams.map((exam: Exam) => (
                                        <tr key={exam.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <p className="font-medium text-slate-900">{exam.title}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <code className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">{exam.exam_code}</code>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{exam.duration_minutes} min</td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{exam.total_questions_pool || 0}</td>
                                            <td className="px-6 py-4">{statusBadge(exam.status)}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                    {exam.status === 'DRAFT' && (
                                                        <>
                                                            <button onClick={() => navigate(`/exams/${exam.id}/questions`)} title="Edit Questions" className="p-2 rounded-md text-slate-400 hover:text-primary hover:bg-slate-100 transition-colors">
                                                                <List size={16} />
                                                            </button>
                                                            <button onClick={() => setPublishConfirm(exam)} title="Publish Exam" className="p-2 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                                                <UploadCloud size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {exam.status !== 'DRAFT' && (
                                                        <button onClick={() => navigate(`/exams/${exam.id}/questions`)} title="Preview Questions" className="p-2 rounded-md text-slate-400 hover:text-primary hover:bg-slate-100 transition-colors">
                                                            <Eye size={16} />
                                                        </button>
                                                    )}
                                                    {exam.status === 'PUBLISHED' && (
                                                        <button onClick={() => handleStartExam(exam)} title="Start Exam" className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-700 transition-colors shadow-sm">
                                                            <Play size={14} className="fill-white" />
                                                            Start
                                                        </button>
                                                    )}
                                                    {exam.status === 'ACTIVE' && (
                                                        <button onClick={() => navigate(`/exams/${exam.id}/live`)} className="px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-100 transition-colors">
                                                            <Radio size={14} className="animate-pulse" />
                                                            Live Monitoring
                                                        </button>
                                                    )}
                                                    {(exam.status === 'ACTIVE' || exam.status === 'ENDED') && (
                                                        <button onClick={() => navigate(`/exams/${exam.id}/results`)} title="View Results" className="p-2 rounded-md text-slate-400 hover:text-primary hover:bg-slate-100 transition-colors">
                                                            <BarChart2 size={16} />
                                                        </button>
                                                    )}
                                                    <div className="w-px h-5 bg-slate-200 mx-1 hidden sm:block"></div>
                                                    <button onClick={() => navigate(`/exams/${exam.id}/edit`)} title={exam.status === 'DRAFT' ? "Settings" : "Preview Settings"} className="p-2 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                                                        {exam.status === 'DRAFT' ? <Settings size={16} /> : <Eye size={16} />}
                                                    </button>
                                                    <button onClick={() => setDeleteConfirm(exam)} title="Delete" className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                                        <Trash2 size={16} />
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

            {/* Delete Confirm Modal */}
            {deleteConfirm && createPortal(
                <div className="fixed inset-0 bg-slate-900/40 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col w-[90vw] max-w-sm" style={{ minWidth: '300px' }}>
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                                    <AlertTriangle className="text-red-600" size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900">Delete Exam?</h3>
                                </div>
                            </div>
                            <p className="text-sm text-slate-600 mb-1">Are you sure you want to delete <strong>{deleteConfirm.title}</strong>?</p>
                            <p className="text-xs text-slate-500">All questions and student attempts will be permanently erased. This cannot be undone.</p>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
                            <button onClick={() => setDeleteConfirm(null)} className="text-sm font-medium text-slate-600 px-4 py-2 rounded-md hover:bg-slate-200 transition-colors">Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-red-700 transition-colors shadow-sm">Delete Exam</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Publish Confirm Modal */}
            {publishConfirm && createPortal(
                <div className="fixed inset-0 bg-slate-900/40 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col w-[90vw] max-w-sm" style={{ minWidth: '300px' }}>
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                    <UploadCloud className="text-blue-600" size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900">Publish Exam?</h3>
                                </div>
                            </div>
                            <p className="text-sm text-slate-600 mb-3">You are about to publish <strong>{publishConfirm.title}</strong>.</p>
                            <div className="bg-orange-50 border border-orange-200 text-orange-800 text-xs p-3 rounded-md mb-4 flex gap-2">
                                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                <p>Once published, the exam is locked. You will <strong>not</strong> be able to change settings, add questions, or modify content. Everything will be frozen.</p>
                            </div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Type <strong>publish</strong> to confirm
                            </label>
                            <input
                                type="text"
                                value={publishText}
                                onChange={(e) => setPublishText(e.target.value)}
                                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                placeholder="publish"
                            />
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
                            <button onClick={() => { setPublishConfirm(null); setPublishText(''); }} className="text-sm font-medium text-slate-600 px-4 py-2 rounded-md hover:bg-slate-200 transition-colors">Cancel</button>
                            <button 
                                onClick={() => handlePublish(publishConfirm)} 
                                disabled={publishText.toLowerCase() !== 'publish'}
                                className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Publish Exam
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
