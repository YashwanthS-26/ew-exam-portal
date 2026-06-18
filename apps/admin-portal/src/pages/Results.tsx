import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import socketService from '../lib/socket';

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
        <div className="p-sm md:p-lg">
            <div className="max-w-[1280px] mx-auto space-y-lg">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface">Exam Results</h2>
                        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Live results — updates automatically when students submit.</p>
                    </div>
                    {/* Exam Filter */}
                    <select
                        value={selectedExamId || ''}
                        onChange={e => setSelectedExamId(e.target.value || null)}
                        className="border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary"
                    >
                        <option value="">All Exams</option>
                        {completedExams.map((e: any) => (
                            <option key={e.id} value={e.id}>{e.title} ({e.exam_code})</option>
                        ))}
                    </select>
                </div>

                {/* Stats */}
                {results && results.length > 0 && (
                    <div className="grid grid-cols-3 gap-md">
                        <div className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/20 shadow-sm text-center">
                            <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">Total Submissions</p>
                            <p className="font-headline-lg text-headline-lg font-bold text-on-surface">{results.length}</p>
                        </div>
                        <div className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/20 shadow-sm text-center">
                            <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">Average Score</p>
                            <p className="font-headline-lg text-headline-lg font-bold text-on-surface">{avgScore}</p>
                        </div>
                        <div className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/20 shadow-sm text-center">
                            <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">Top Score</p>
                            <p className="font-headline-lg text-headline-lg font-bold text-primary">{topScore}</p>
                        </div>
                    </div>
                )}

                {/* Results Table */}
                <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
                    <div className="px-lg py-md border-b border-outline-variant/20 flex items-center justify-between">
                        <h3 className="font-title-md text-title-md text-on-surface flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-[20px]">leaderboard</span>
                            Results
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block"></span>
                            <span className="font-label-sm text-label-sm text-on-surface-variant">Live</span>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="py-16 text-center text-on-surface-variant font-body-md">Loading results...</div>
                    ) : !results || results.length === 0 ? (
                        <div className="py-16 text-center">
                            <span className="material-symbols-outlined text-[48px] text-outline-variant block mb-3">assignment</span>
                            <p className="font-body-md text-body-md text-on-surface-variant">No results yet. Results appear as students submit.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-surface-container-low text-on-surface-variant text-left">
                                        <th className="px-lg py-sm font-label-sm text-label-sm">#</th>
                                        <th className="px-lg py-sm font-label-sm text-label-sm">Student</th>
                                        <th className="px-lg py-sm font-label-sm text-label-sm">Roll No.</th>
                                        <th className="px-lg py-sm font-label-sm text-label-sm">Exam</th>
                                        <th className="px-lg py-sm font-label-sm text-label-sm">Score</th>
                                        <th className="px-lg py-sm font-label-sm text-label-sm">Total</th>
                                        <th className="px-lg py-sm font-label-sm text-label-sm">Status</th>
                                        <th className="px-lg py-sm font-label-sm text-label-sm">Submitted At</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-outline-variant/10">
                                    {results.map((result: any, index: number) => {
                                        const percentage = result.total_marks > 0
                                            ? Math.round((result.score / result.total_marks) * 100)
                                            : 0;
                                        return (
                                            <tr key={result.id} className="hover:bg-surface-container-low/50 transition-colors">
                                                <td className="px-lg py-md font-label-md text-label-md text-on-surface-variant">{index + 1}</td>
                                                <td className="px-lg py-md font-label-md text-label-md text-on-surface font-medium">{result.student_name || '—'}</td>
                                                <td className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant">{result.roll_number || '—'}</td>
                                                <td className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant">
                                                    {result.exam?.title || '—'}
                                                </td>
                                                <td className="px-lg py-md">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-label-md text-label-md font-bold ${percentage >= 80 ? 'text-green-600' : percentage >= 50 ? 'text-primary' : 'text-red-500'}`}>
                                                            {result.score ?? '—'}
                                                        </span>
                                                        <span className="font-label-sm text-label-sm text-on-surface-variant">({percentage}%)</span>
                                                    </div>
                                                </td>
                                                <td className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant">{result.total_marks ?? '—'}</td>
                                                <td className="px-lg py-md">
                                                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${result.status === 'SUBMITTED' ? 'bg-green-100 text-green-700' : 'bg-surface-container-high text-on-surface-variant'}`}>
                                                        {result.status}
                                                    </span>
                                                </td>
                                                <td className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant">
                                                    {result.submitted_at ? new Date(result.submitted_at).toLocaleString() : '—'}
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
