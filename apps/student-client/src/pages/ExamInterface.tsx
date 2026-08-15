import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { saveAnswerLocal, markAnswersSynced, getAllAnswersForAttempt } from '../lib/db';
import {
    Clock, CheckCircle2, Wifi, WifiOff, RefreshCcw,
    Bookmark, ChevronLeft, ChevronRight, AlertTriangle,
    Flag, Circle, CheckCircle, Info, X, CloudCog
} from 'lucide-react';

const SOCKET_URL = (import.meta as any).env?.VITE_SOCKET_URL || 'https://ew-exam-portal-backend.onrender.com';
const API_URL = (import.meta as any).env?.VITE_API_URL || 'https://ew-exam-portal-backend.onrender.com';

interface Option {
    id: string;
    text: string;
}

interface Question {
    id: string;
    text: string;
    options: Option[];
    marks: number;
    negativeMarks: number;
}

interface ExamInfo {
    id: string;
    title: string;
    exam_code: string;
    duration_minutes: number;
    show_results_to_students: boolean;
    start_time?: string;
}

interface ExamSession {
    attemptId: string;
    exam: ExamInfo;
    questions: Question[];
    studentName: string;
    rollNumber: string;
}

type QuestionStatus = 'not_visited' | 'answered' | 'marked_review' | 'current';

export default function ExamInterface() {
    const navigate = useNavigate();
    const socketRef = useRef<Socket | null>(null);

    const [session] = useState<ExamSession | null>(() => {
        try {
            const raw = sessionStorage.getItem('examSession');
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    });

    const [currentIdx, setCurrentIdx] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string | null>>({});
    const answersRef = useRef<Record<string, string | null>>({});

    const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [announcement, setAnnouncement] = useState<string | null>(null);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [violations, setViolations] = useState<string[]>([]);
    const [showViolationBanner, setShowViolationBanner] = useState(false);
    const [syncQueueSize, setSyncQueueSize] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [online, setOnline] = useState(navigator.onLine);
    const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

    useEffect(() => {
        if (!session) { navigate('/'); }
    }, [session, navigate]);

    useEffect(() => {
        const up = () => setOnline(true);
        const down = () => setOnline(false);
        window.addEventListener('online', up);
        window.addEventListener('offline', down);
        return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
    }, []);

    useEffect(() => {
        if (!session) return;
        getAllAnswersForAttempt(session.attemptId).then(loaded => {
            setAnswers(prev => ({ ...prev, ...loaded }));
        });
    }, [session]);

    useEffect(() => {
        if (!session) return;
        if (isElectron) {
            (window as any).electronAPI.startLockdown();
            (window as any).electronAPI.onExamViolation((violation: string) => {
                handleViolation(violation);
            });
        }
        const noCtxMenu = (e: MouseEvent) => e.preventDefault();
        const noSelect = (e: Event) => e.preventDefault();
        document.addEventListener('contextmenu', noCtxMenu);
        document.addEventListener('selectstart', noSelect);
        return () => {
            document.removeEventListener('contextmenu', noCtxMenu);
            document.removeEventListener('selectstart', noSelect);
            if (isElectron) {
                (window as any).electronAPI.removeViolationListener?.();
                (window as any).electronAPI.endLockdown();
            }
        };
    }, [session, isElectron]);

    const handleViolation = useCallback((type: string) => {
        setViolations(prev => [...prev, type]);
        setShowViolationBanner(true);
        setTimeout(() => setShowViolationBanner(false), 5000);
        const socket = socketRef.current;
        if (socket && session) {
            socket.emit('violation_logged', {
                attemptId: session.attemptId,
                examId: session.exam.id,
                type,
                timestamp: new Date().toISOString(),
            });
        }
    }, [session]);

    useEffect(() => {
        if (!session) return;
        const durationSec = session.exam.duration_minutes * 60;
        if (session.exam.start_time) {
            const startMs = new Date(session.exam.start_time).getTime();
            const elapsedSec = Math.floor((Date.now() - startMs) / 1000);
            const remaining = Math.max(0, durationSec - elapsedSec);
            setTimeLeft(remaining);
        } else {
            setTimeLeft(durationSec);
        }
    }, [session]);

    useEffect(() => {
        if (submitted || timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleSubmit(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [submitted, timeLeft]);

    useEffect(() => {
        if (!session) return;
        const socket = io(SOCKET_URL, { transports: ['websocket'] });
        socketRef.current = socket;
        socket.on('connect', () => {
            socket.emit('join_exam', {
                examId: session.exam.id,
                attemptId: session.attemptId,
                name: session.studentName,
                rollNumber: session.rollNumber,
            });
        });
        socket.on('force_submit', () => handleSubmit(true));
        socket.on('end_student', () => {
            alert('Your exam session has been ended by the teacher.');
            navigate('/');
        });
        socket.on('announcement', (msg: string) => {
            setAnnouncement(msg);
            setTimeout(() => setAnnouncement(null), 8000);
        });
        const heartbeat = setInterval(() => { socket.emit('heartbeat'); }, 30000);
        return () => {
            clearInterval(heartbeat);
            socket.disconnect();
        };
    }, [session]);

    const saveAnswer = useCallback((questionId: string, option: string | null) => {
        if (!session) return;
        saveAnswerLocal(session.attemptId, questionId, option);
    }, [session]);

    useEffect(() => {
        if (submitted || !session) return;
        autosaveRef.current = setInterval(async () => {
            try {
                const allAnswers = Object.entries(answersRef.current)
                    .map(([questionId, selectedOption]) => ({ questionId, selectedOption: selectedOption ?? null }));
                if (allAnswers.length === 0) return;
                setSyncQueueSize(allAnswers.length);
                const res = await fetch(`${API_URL}/api/attempts/${session.attemptId}/answers`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ answers: allAnswers }),
                    signal: AbortSignal.timeout(8000),
                });
                if (res.ok) {
                    setSyncQueueSize(0);
                    const socket = socketRef.current;
                    if (socket?.connected && session.exam.id) {
                        socket.emit('sync_batch', {
                            attemptId: session.attemptId,
                            examId: session.exam.id,
                            answers: allAnswers,
                        }, () => {}); 
                    }
                }
            } catch (e) {
                console.warn('[SyncWorker] HTTP sync failed, will retry:', e);
            }
        }, 5000);
        return () => { if (autosaveRef.current) clearInterval(autosaveRef.current); };
    }, [submitted, session]);

    const handleSelectOption = (questionId: string, optId: string) => {
        setAnswers(prev => {
            const next = { ...prev, [questionId]: optId };
            saveAnswer(questionId, optId);
            return next;
        });
    };

    const handleClearAnswer = (questionId: string) => {
        setAnswers(prev => {
            const next = { ...prev, [questionId]: null };
            saveAnswer(questionId, null);
            return next;
        });
    };

    const toggleMarkForReview = (questionId: string) => {
        setMarkedForReview(prev => {
            const next = new Set(prev);
            if (next.has(questionId)) next.delete(questionId);
            else next.add(questionId);
            return next;
        });
    };

    const handleSubmit = async (auto = false, reason = 'normal') => {
        if (submitted) return;
        setIsSubmitting(true);
        setShowSubmitConfirm(false);
        if (autosaveRef.current) clearInterval(autosaveRef.current);

        const allAnswers = Object.entries(answersRef.current)
            .map(([questionId, selectedOption]) => ({ questionId, selectedOption: selectedOption ?? null }));

        if (allAnswers.length > 0) {
            let saved = false;
            let retries = 0;
            const maxRetries = 5;
            while (!saved && retries < maxRetries) {
                try {
                    const res = await fetch(`${API_URL}/api/attempts/${session!.attemptId}/answers`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ answers: allAnswers }),
                        signal: AbortSignal.timeout(10000),
                    });
                    if (res.ok) saved = true;
                    else throw new Error(`HTTP ${res.status}`);
                } catch (e) {
                    retries++;
                    if (retries < maxRetries) {
                        const backoff = Math.min(1000 * Math.pow(2, retries - 1), 8000);
                        await new Promise(r => setTimeout(r, backoff));
                    }
                }
            }
        }

        const socket = socketRef.current;
        if (socket && session) {
            socket.emit('submit_exam', {
                attemptId: session.attemptId,
                examId: session.exam.id,
                reason,
            });
            socket.once('exam_submitted', (data: any) => {
                if (data.result && session.exam.show_results_to_students) {
                    setResult(data.result);
                }
                setSubmitted(true);
                setIsSubmitting(false);
                sessionStorage.removeItem('examSession');
            });
        }
        setTimeout(() => {
            setSubmitted(true);
            setIsSubmitting(false);
            sessionStorage.removeItem('examSession');
        }, 5000);
    };

    useEffect(() => {
        if (submitted || !session) return;
        const handleOffline = () => handleSubmit(true, 'network_lost');
        window.addEventListener('offline', handleOffline);
        return () => window.removeEventListener('offline', handleOffline);
    }, [submitted, session]);

    useEffect(() => {
        if (!isElectron || submitted || !session) return;
        const api = (window as any).electronAPI;
        if (api?.onBeforeQuit) {
            api.onBeforeQuit(() => handleSubmit(true, 'app_closed'));
        }
        return () => api?.removeBeforeQuitListener?.();
    }, [isElectron, submitted, session]);

    const formatTime = (secs: number) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    if (!session) return null;

    const questions = session.questions;
    const currentQ = questions[currentIdx];

    useEffect(() => { answersRef.current = answers; }, [answers]);

    const answeredCount = Object.values(answers).filter(v => v !== null && v !== undefined).length;

    // ─── SUBMITTED SCREEN ──────────────────────────────────────────────────────────
    if (submitted) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
                <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-lg w-[440px] max-w-full">
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="text-emerald-500" size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Exam Submitted</h2>
                    <p className="text-slate-500 mb-8">Your responses have been successfully recorded.</p>
                    
                    {result && (
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 mb-8 text-left">
                            <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-2">Final Score</p>
                            <div className="flex items-baseline gap-2 mb-2">
                                <span className="text-4xl font-bold text-slate-900">{result.score}</span>
                                <span className="text-xl text-slate-400">/ {result.totalMarks}</span>
                            </div>
                            <div className="flex gap-4 text-sm text-slate-600 mb-4">
                                <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-500"/> {result.correct}</span>
                                <span className="flex items-center gap-1.5"><X size={16} className="text-red-500"/> {result.incorrect}</span>
                                <span className="flex items-center gap-1.5"><Circle size={16} className="text-slate-400"/> {result.skipped}</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${result.totalMarks > 0 ? (result.score / result.totalMarks) * 100 : 0}%` }} />
                            </div>
                        </div>
                    )}
                    
                    <div className="flex gap-3">
                        <button onClick={() => navigate('/')} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-colors text-sm">
                            Home
                        </button>
                        {isElectron && (
                            <button onClick={() => { (window as any).electronAPI.endLockdown(); (window as any).electronAPI.quitApp(); }}
                                className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                                Quit Application
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const getQStatus = (q: Question, idx: number): QuestionStatus => {
        if (idx === currentIdx) return 'current';
        if (answers[q.id] !== null && answers[q.id] !== undefined) return 'answered';
        if (markedForReview.has(q.id)) return 'marked_review';
        return 'not_visited';
    };

    // Note: 'current' state overrides the border and color entirely.
    const statusClasses: Record<QuestionStatus, string> = {
        current:       'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200',
        answered:      'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200',
        marked_review: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200',
        not_visited:   'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
    };

    const timerClass = timeLeft < 300 ? 'text-red-600 bg-red-50 border-red-100' : timeLeft < 600 ? 'text-amber-600 bg-amber-50 border-amber-100' : 'text-slate-800 bg-slate-50 border-slate-200';

    return (
        <div className="h-screen flex flex-col bg-slate-50 font-sans text-slate-900 overflow-hidden select-none">
            
            {/* ─── TOP HEADER ──────────────────────────────────────────────────────── */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10 relative">
                <div className="flex items-center gap-4">
                    <img src="./app-logo.png" alt="EW SHIKEN Logo" className="h-[48px] w-auto object-contain shrink-0 scale-110 origin-left" />
                    <div>
                        <h1 className="font-bold text-slate-900 text-lg leading-tight">{session.exam.title}</h1>
                        <div className="flex items-center gap-2 text-slate-500 text-xs">
                            <span className="font-semibold">{session.studentName}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span>{session.rollNumber}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span>{session.exam.exam_code}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowSubmitConfirm(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm shadow-sm"
                    >
                        Submit Examination
                    </button>
                </div>
            </header>

            {/* ─── BANNERS ──────────────────────────────────────────────────────────── */}
            {announcement && (
                <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3 shrink-0">
                    <Info className="text-amber-600" size={18} />
                    <p className="text-amber-900 text-sm font-medium">{announcement}</p>
                    <button onClick={() => setAnnouncement(null)} className="ml-auto text-amber-500 hover:text-amber-700"><X size={16}/></button>
                </div>
            )}

            {showViolationBanner && (
                <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center gap-3 shrink-0">
                    <AlertTriangle className="text-red-600" size={18} />
                    <p className="text-red-900 text-sm font-bold">Security violation detected! This has been logged and reported to the teacher.</p>
                    <button onClick={() => setShowViolationBanner(false)} className="ml-auto text-red-500 hover:text-red-700"><X size={16}/></button>
                </div>
            )}

            {isSubmitting && (
                <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xl flex flex-col items-center text-center w-[320px] max-w-full">
                        <RefreshCcw className="animate-spin text-blue-600 mb-4" size={32} />
                        <h3 className="text-slate-900 font-bold text-xl mb-1">Submitting Exam</h3>
                        <p className="text-slate-500 text-sm">Synchronizing your responses securely...</p>
                    </div>
                </div>
            )}

            {/* ─── MAIN 3-PANEL LAYOUT ──────────────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">
                
                {/* LEFT: Question Navigator */}
                <aside className="w-[280px] bg-white border-r border-slate-200 flex flex-col shrink-0 z-0">
                    <div className="p-5 border-b border-slate-100">
                        <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4">Navigator</h2>
                        <div className="grid grid-cols-2 gap-3 text-xs font-medium text-slate-600">
                            <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Answered</span>
                            <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Marked</span>
                            <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Unanswered</span>
                            <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Current</span>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                        <div className="grid grid-cols-5 gap-2.5">
                            {questions.map((q, idx) => {
                                const status = getQStatus(q, idx);
                                return (
                                    <button
                                        key={q.id}
                                        onClick={() => setCurrentIdx(idx)}
                                        className={`w-full aspect-square flex items-center justify-center rounded-xl font-bold text-sm border transition-all ${statusClasses[status]}`}
                                    >
                                        {idx + 1}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </aside>

                {/* CENTER: Question Content */}
                <main className="flex-1 flex flex-col bg-slate-50 relative overflow-y-auto custom-scrollbar">
                    {currentQ ? (
                        <div className="w-[896px] max-w-full mx-auto p-8 flex flex-col gap-6 flex-1">
                            
                            {/* Question Header */}
                            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                                <div className="flex items-center gap-4">
                                    <h2 className="text-2xl font-bold text-slate-900">Question {currentIdx + 1}</h2>
                                    <div className="flex items-center gap-2 text-xs font-semibold">
                                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200">{currentQ.marks} Mark{currentQ.marks !== 1 ? 's' : ''}</span>
                                        {currentQ.negativeMarks > 0 && (
                                            <span className="bg-red-50 text-red-600 px-2 py-1 rounded-md border border-red-100">-{currentQ.negativeMarks}</span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => toggleMarkForReview(currentQ.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                                        markedForReview.has(currentQ.id) 
                                        ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' 
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <Bookmark size={18} fill={markedForReview.has(currentQ.id) ? 'currentColor' : 'none'} />
                                    {markedForReview.has(currentQ.id) ? 'Marked for Review' : 'Mark for Review'}
                                </button>
                            </div>

                            {/* Question Text */}
                            <div className="text-slate-800 text-lg leading-relaxed mb-2 whitespace-pre-wrap">
                                {currentQ.text}
                            </div>

                            {/* Options */}
                            <div className="flex flex-col gap-3">
                                {currentQ.options.map((opt, i) => {
                                    const selected = answers[currentQ.id] === opt.id;
                                    const char = String.fromCharCode(65 + i); // A, B, C, D...
                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => handleSelectOption(currentQ.id, opt.id)}
                                            className={`group flex items-start gap-4 p-5 rounded-2xl border transition-all text-left w-full ${
                                                selected
                                                    ? 'bg-blue-50/50 border-blue-600 ring-1 ring-blue-600 shadow-sm'
                                                    : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50 shadow-sm'
                                            }`}
                                        >
                                            <div className="pt-0.5 shrink-0">
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                                    selected ? 'border-blue-600 bg-blue-600' : 'border-slate-300 group-hover:border-blue-400'
                                                }`}>
                                                    {selected && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                                                </div>
                                            </div>
                                            <div className="flex gap-4 w-full items-start">
                                                <span className={`font-bold text-sm pt-0.5 ${selected ? 'text-blue-700' : 'text-slate-400'}`}>{char}.</span>
                                                <span className={`text-base leading-relaxed ${selected ? 'text-blue-900 font-medium' : 'text-slate-700'}`}>{opt.text}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Navigation Bar inside center panel */}
                            <div className="mt-auto pt-8 pb-4 flex items-center justify-between">
                                <button
                                    onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                                    disabled={currentIdx === 0}
                                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-40 disabled:pointer-events-none"
                                >
                                    <ChevronLeft size={18} /> Previous
                                </button>
                                
                                <div className="flex gap-3">
                                    {answers[currentQ.id] && (
                                        <button
                                            onClick={() => handleClearAnswer(currentQ.id)}
                                            className="px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-500 font-semibold hover:bg-slate-50 hover:text-slate-700 transition-all"
                                        >
                                            Clear Response
                                        </button>
                                    )}
                                    {currentIdx === questions.length - 1 ? (
                                        <button
                                            onClick={() => setShowSubmitConfirm(true)}
                                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-all shadow-sm"
                                        >
                                            Submit <CheckCircle2 size={18} />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))}
                                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all shadow-sm"
                                        >
                                            Save & Next <ChevronRight size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400">
                            Loading questions...
                        </div>
                    )}
                </main>

                {/* RIGHT: Information Panel */}
                <aside className="w-[280px] bg-white border-l border-slate-200 flex flex-col shrink-0">
                    <div className="p-6 border-b border-slate-100 flex flex-col items-center">
                        <div className={`flex items-center justify-center gap-2 px-6 py-4 border rounded-2xl w-full mb-2 shadow-sm ${timerClass}`}>
                            <Clock size={24} className={timeLeft < 300 ? "animate-pulse" : ""} />
                            <span className="font-mono text-3xl font-bold tracking-tight">{formatTime(timeLeft)}</span>
                        </div>
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Time Remaining</p>
                    </div>

                    <div className="p-6 border-b border-slate-100 space-y-4">
                        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-2">Exam Overview</h3>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Total Questions</span>
                            <span className="font-bold text-slate-800">{questions.length}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Answered</span>
                            <span className="font-bold text-emerald-600">{answeredCount}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Unanswered</span>
                            <span className="font-bold text-slate-800">{questions.length - answeredCount}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
                        </div>
                    </div>

                    <div className="mt-auto p-6 bg-slate-50 border-t border-slate-200 flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            {online ? <Wifi size={18} className="text-emerald-500" /> : <WifiOff size={18} className="text-red-500" />}
                            <span className="text-sm font-semibold text-slate-700">{online ? 'Connected' : 'Offline Mode'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            {syncQueueSize > 0 ? (
                                <>
                                    <CloudCog size={18} className="text-blue-500 animate-pulse" />
                                    <span className="text-sm font-semibold text-blue-600">Syncing...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={18} className="text-emerald-500" />
                                    <span className="text-sm font-semibold text-emerald-600">All saved</span>
                                </>
                            )}
                        </div>
                    </div>
                </aside>

            </div>

            {/* ─── Submit Confirm Modal ────────────────────────────────────── */}
            {showSubmitConfirm && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xl w-[384px] max-w-full">
                        <h3 className="text-slate-900 font-bold text-xl mb-2">Ready to Submit?</h3>
                        <p className="text-slate-600 text-sm mb-4">
                            You have answered <strong className="text-slate-900">{answeredCount}</strong> out of <strong className="text-slate-900">{questions.length}</strong> questions.
                        </p>
                        
                        {answeredCount < questions.length && (
                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl mb-6 flex gap-3 items-start">
                                <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                                <p className="text-amber-800 text-sm font-medium">
                                    {questions.length - answeredCount} question{questions.length - answeredCount !== 1 ? 's are' : ' is'} left unanswered.
                                </p>
                            </div>
                        )}
                        
                        <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-6">This action cannot be undone.</p>
                        
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowSubmitConfirm(false)}
                                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold transition-colors text-sm"
                            >
                                Continue Exam
                            </button>
                            <button
                                onClick={() => handleSubmit(false)}
                                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors text-sm shadow-sm"
                            >
                                Submit Exam
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
