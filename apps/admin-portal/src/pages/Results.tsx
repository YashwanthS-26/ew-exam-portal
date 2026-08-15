import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import socketService from '../lib/socket';
import { 
    Trophy, 
    BarChart2, 
    FileText, 
    Users, 
    Award, 
    Target,
    Activity
} from 'lucide-react';

interface ResultsProps {
    preSelectedExamId?: string;
}

export default function Results({ preSelectedExamId }: ResultsProps) {
    const navigate = useNavigate();
    const [selectedExamId, setSelectedExamId] = useState<string | null>(preSelectedExamId || null);

    const { data: exams } = useQuery({
        queryKey: ['exams'],
        queryFn: async () => {
            const { data } = await api.get('/exams');
            return data as any[];
        },
    });

    const { data: results, isLoading, refetch } = useQuery({
        queryKey: ['results', selectedExamId],
        queryFn: async () => {
            if (selectedExamId) {
                const { data } = await api.get(`/exams/${selectedExamId}/results`);
                return data as any[];
            }
            const { data } = await api.get('/exams/results');
            return data as any[];
        },
        enabled: true,
        refetchInterval: 10000,
    });

    // Listen for real-time submissions
    useEffect(() => {
        const socket = socketService.connect();
        if (!socket) return;

        socket.emit('admin_join');

        socket.on('student_submitted', () => {
            refetch();
        });

        return () => {
            socket.off('student_submitted');
        };
    }, [refetch]);

    const completedExams = exams?.filter((e: any) => ['ACTIVE', 'ENDED'].includes(e.status)) || [];

    const topScore = results?.reduce((max: number, r: any) => Math.max(max, r.score || 0), 0) || 0;
    const avgScore = results && results.length > 0
        ? (results.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / results.length).toFixed(1)
        : '0';

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50 min-h-full">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Exam Results</h2>
                        <p className="text-sm text-slate-500 mt-1">Live results — updates automatically when students submit.</p>
                    </div>
                    <div className="flex items-center gap-3 print:hidden">
                        {/* Exam Filter */}
                        <div className="relative min-w-[240px]">
                            <select
                                value={selectedExamId || ''}
                                onChange={e => setSelectedExamId(e.target.value || null)}
                                className="w-full appearance-none bg-white border border-slate-200 text-slate-700 text-sm font-medium py-2.5 pl-4 pr-10 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-sm cursor-pointer"
                            >
                                <option value="">All Exams</option>
                                {completedExams.map((e: any) => (
                                    <option key={e.id} value={e.id}>{e.title} ({e.exam_code})</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                </svg>
                            </div>
                        </div>
                        <button 
                            onClick={() => window.print()} 
                            className="bg-primary text-white text-sm font-medium py-2.5 px-4 rounded-md hover:bg-black transition-colors shadow-sm flex items-center gap-2 shrink-0"
                            title="Export Results as PDF"
                        >
                            <FileText size={16} />
                            <span className="hidden sm:inline">Export PDF</span>
                        </button>
                    </div>
                </div>

                {/* Stats */}
                {results && results.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center gap-5">
                            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                                <Users className="text-primary" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Submissions</p>
                                <p className="text-3xl font-bold text-slate-900 mt-0.5">{results.length}</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center gap-5">
                            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center shrink-0">
                                <Target className="text-purple-600" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Average Score</p>
                                <p className="text-3xl font-bold text-slate-900 mt-0.5">{avgScore}</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center gap-5">
                            <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                                <Award className="text-amber-600" size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Top Score</p>
                                <p className="text-3xl font-bold text-amber-600 mt-0.5">{topScore}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Results Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50">
                        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2 shrink-0">
                            <Trophy size={18} className="text-amber-500" />
                            Performance Leaderboard
                        </h3>
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-[11px] font-bold text-emerald-700 tracking-wider uppercase">Live</span>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center text-center">
                            <Activity size={40} className="text-slate-300 mb-3 animate-pulse" />
                            <p className="text-slate-500 text-sm font-medium">Loading results...</p>
                        </div>
                    ) : !results || results.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-center">
                            <FileText size={48} strokeWidth={1} className="text-slate-300 mb-4" />
                            <p className="text-slate-500 text-sm font-medium">No results yet. Results appear as students submit.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white border-b border-slate-200">
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">Rank</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Roll No.</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Exam</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Submitted At</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {results.sort((a: any, b: any) => (b.score || 0) - (a.score || 0)).map((result: any, index: number) => {
                                        const percentage = result.total_marks > 0
                                            ? Math.round((result.score / result.total_marks) * 100)
                                            : 0;
                                        
                                        const isTopThree = index < 3;
                                            
                                        return (
                                            <tr key={result.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                                        index === 0 ? 'bg-amber-100 text-amber-700' :
                                                        index === 1 ? 'bg-slate-200 text-slate-700' :
                                                        index === 2 ? 'bg-orange-100 text-orange-800' :
                                                        'text-slate-500'
                                                    }`}>
                                                        {index + 1}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className={`text-sm font-semibold ${isTopThree ? 'text-slate-900' : 'text-slate-700'}`}>
                                                        {result.student_name || '—'}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <code className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                                        {result.roll_number || '—'}
                                                    </code>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                                                    {result.exam?.title || '—'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm font-bold ${
                                                            percentage >= 80 ? 'text-emerald-600' : 
                                                            percentage >= 50 ? 'text-slate-600' : 
                                                            'text-red-600'
                                                        }`}>
                                                            {result.score ?? '—'}
                                                        </span>
                                                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                            {percentage}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-500 font-medium">{result.total_marks ?? '—'}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase ${
                                                        result.status === 'SUBMITTED' 
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                    }`}>
                                                        {result.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                                                    {result.submitted_at ? new Date(result.submitted_at).toLocaleString([], {
                                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                    }) : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
