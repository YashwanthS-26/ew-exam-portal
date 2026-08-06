import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { saveAnswerLocal, markAnswersSynced, getAllAnswersForAttempt } from '../lib/db';

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

    // Load session
    const [session] = useState<ExamSession | null>(() => {
        try {
            const raw = sessionStorage.getItem('examSession');
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    });

    const [currentIdx, setCurrentIdx] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string | null>>({});
    // IMPORTANT: answersRef must be declared at component top, NOT after conditional returns.
    // handleSubmit and SyncWorker read from this ref to always get the latest answers.
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
    const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

    // Redirect if no session
    useEffect(() => {
        if (!session) {
            navigate('/');
        }
    }, [session, navigate]);

    // Load initial answers from IndexedDB
    useEffect(() => {
        if (!session) return;
        getAllAnswersForAttempt(session.attemptId).then(loaded => {
            setAnswers(prev => ({ ...prev, ...loaded }));
        });
    }, [session]);

    // Start lockdown when exam loads
    useEffect(() => {
        if (!session) return;
        if (isElectron) {
            (window as any).electronAPI.startLockdown();
            // Listen for violations from main process
            (window as any).electronAPI.onExamViolation((violation: string) => {
                handleViolation(violation);
            });
        }
        // Disable right-click and text selection
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
        // Emit to socket
        const socket = socketRef.current;
        if (socket && session) {
            socket.emit('violation_logged', {
                attemptId: session.attemptId,
                examCode: session.exam.exam_code,
                type,
                timestamp: new Date().toISOString(),
            });
        }
    }, [session]);

    // Set up timer
    useEffect(() => {
        if (!session) return;
        const durationSec = session.exam.duration_minutes * 60;
        setTimeLeft(durationSec);
    }, [session]);

    // Timer countdown
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

    // Socket connection (autosave effect is placed after saveAnswer declaration below)

    // Socket connection
    useEffect(() => {
        if (!session) return;

        const socket = io(SOCKET_URL, { transports: ['websocket'] });
        socketRef.current = socket;

        socket.on('connect', () => {
            // Join the exam room
            socket.emit('join_exam', {
                examCode: session.exam.exam_code,
                attemptId: session.attemptId,
                name: session.studentName,
                rollNumber: session.rollNumber,
            });
        });

        // Admin force-submits this student
        socket.on('force_submit', () => {
            handleSubmit(true);
        });

        // Admin ends this student
        socket.on('end_student', () => {
            alert('Your exam session has been ended by the teacher.');
            navigate('/');
        });

        // Admin broadcasts announcement
        socket.on('announcement', (msg: string) => {
            setAnnouncement(msg);
            setTimeout(() => setAnnouncement(null), 8000);
        });

        // Heartbeat
        const heartbeat = setInterval(() => {
            socket.emit('heartbeat');
        }, 30000);

        return () => {
            clearInterval(heartbeat);
            socket.disconnect();
        };
    }, [session]);

    const saveAnswer = useCallback((questionId: string, option: string | null) => {
        if (!session) return;
        saveAnswerLocal(session.attemptId, questionId, option);
    }, [session]);

    // HTTP-based sync worker: every 5s, POST all answers directly to Supabase via backend REST API
    useEffect(() => {
        if (submitted || !session) return;

        autosaveRef.current = setInterval(async () => {
            try {
                // Get ALL current answers (from React state via a ref — see answersRef below)
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
                    // Notify monitor dashboard via socket (fire and forget)
                    const socket = socketRef.current;
                    if (socket?.connected && session.exam.exam_code) {
                        socket.emit('sync_batch', {
                            attemptId: session.attemptId,
                            examCode: session.exam.exam_code,
                            answers: allAnswers,
                        }, () => {}); // ACK ignored — HTTP is the source of truth
                    }
                }
            } catch (e) {
                // Network error — will retry next cycle, answers are safe in IndexedDB
                console.warn('[SyncWorker] HTTP sync failed, will retry:', e);
            }
        }, 5000);

        return () => {
            if (autosaveRef.current) clearInterval(autosaveRef.current);
        };
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
        
        // Prevent background sync from racing with the final submit sync
        if (autosaveRef.current) clearInterval(autosaveRef.current);

        // GUARANTEED SAVE: POST all current answers directly to Supabase via HTTP
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
                        signal: AbortSignal.timeout(10000), // 10s timeout to survive Render cold starts
                    });
                    if (res.ok) saved = true;
                    else throw new Error(`HTTP ${res.status}`);
                } catch (e) {
                    retries++;
                    if (retries < maxRetries) {
                        // Exponential backoff: 1s, 2s, 4s, 8s...
                        const backoff = Math.min(1000 * Math.pow(2, retries - 1), 8000);
                        console.warn(`[Submit] HTTP sync failed. Retrying in ${backoff}ms... (Attempt ${retries}/${maxRetries})`);
                        await new Promise(r => setTimeout(r, backoff));
                    }
                }
            }
            if (!saved) {
                console.error('[Submit] CRITICAL: Could not save answers via HTTP after maximum retries');
                // Even on critical failure, we proceed to submit so the student isn't permanently locked out,
                // but we rely on local DB as the fallback write-ahead log.
            }
        }

        // Now emit submit to the socket
        const socket = socketRef.current;
        if (socket && session) {
            socket.emit('submit_exam', {
                attemptId: session.attemptId,
                examCode: session.exam.exam_code,
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
        // Hard fallback: always complete submit within 5 seconds
        setTimeout(() => {
            setSubmitted(true);
            setIsSubmitting(false);
            sessionStorage.removeItem('examSession');
        }, 5000);
    };

    // Auto-submit on network loss
    useEffect(() => {
        if (submitted || !session) return;
        const handleOffline = () => {
            handleSubmit(true, 'network_lost');
        };
        window.addEventListener('offline', handleOffline);
        return () => window.removeEventListener('offline', handleOffline);
    }, [submitted, session]);

    // Auto-submit when Electron app is about to quit
    useEffect(() => {
        if (!isElectron || submitted || !session) return;
        const api = (window as any).electronAPI;
        if (api?.onBeforeQuit) {
            api.onBeforeQuit(() => {
                handleSubmit(true, 'app_closed');
            });
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
    // answersRef is declared at component top — this effect keeps it in sync with state
    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);

    const answeredCount = Object.values(answers).filter(v => v !== null && v !== undefined).length;

    // ─── Submitted Screen ──────────────────────────────────────────────────
    if (submitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-orange-950 to-slate-900 flex items-center justify-center p-4">
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-10 text-center shadow-2xl" style={{ width: '100%', maxWidth: '440px', minWidth: '320px' }}>
                    <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
                        <span className="material-symbols-outlined text-white text-[40px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Exam Submitted!</h2>
                    <p className="text-white/60 mb-6">Your answers have been recorded.</p>
                    {result && (
                        <div className="bg-white/10 rounded-2xl p-5 mb-6">
                            <p className="text-white/60 text-sm mb-2">Your Score</p>
                            <p className="text-4xl font-bold text-white mb-1">{result.score} <span className="text-white/40 text-2xl">/ {result.totalMarks}</span></p>
                            <p className="text-white/50 text-sm">{result.correct} correct · {result.incorrect} incorrect · {result.skipped} skipped</p>
                            <div className="mt-3 bg-white/10 rounded-full h-2 overflow-hidden">
                                <div className="h-full bg-green-400 rounded-full" style={{ width: `${result.totalMarks > 0 ? (result.score / result.totalMarks) * 100 : 0}%` }} />
                            </div>
                        </div>
                    )}
                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate('/')}
                            className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-xl transition-colors"
                        >
                            Return to Home
                        </button>
                        {isElectron && (
                            <button
                                onClick={() => {
                                    (window as any).electronAPI.endLockdown();
                                    (window as any).electronAPI.quitApp();
                                }}
                                className="flex-1 bg-red-500 hover:bg-red-400 text-white font-semibold py-3 rounded-xl transition-colors"
                            >
                                Quit App
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ─── Question status for navigator ────────────────────────────────────
    const getQStatus = (q: Question, idx: number): QuestionStatus => {
        if (idx === currentIdx) return 'current';
        if (answers[q.id] !== null && answers[q.id] !== undefined) return 'answered';
        if (markedForReview.has(q.id)) return 'marked_review';
        return 'not_visited';
    };

    const statusClasses: Record<QuestionStatus, string> = {
        current:       'bg-blue-500 text-white ring-2 ring-blue-300 ring-offset-2 ring-offset-slate-900 scale-110 shadow-lg shadow-blue-500/40',
        answered:      'bg-emerald-500 text-white shadow-sm shadow-emerald-500/40 hover:bg-emerald-400',
        marked_review: 'bg-red-500 text-white shadow-sm shadow-red-500/40 hover:bg-red-400',
        not_visited:   'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600',
    };

    const timerClass = timeLeft < 300 ? 'text-red-400' : timeLeft < 600 ? 'text-orange-400' : 'text-green-400';

    return (
        <div className="h-screen flex flex-col bg-slate-900 text-white overflow-hidden">
            {/* ─── Header ───────────────────────────────────────────────────── */}
            <header className="flex items-center justify-between px-6 py-3 bg-slate-800 border-b border-white/10 shrink-0">
                <div>
                    <h1 className="font-bold text-white leading-tight">{session.exam.title}</h1>
                    <p className="text-white/40 text-xs">{session.studentName} · {session.rollNumber}</p>
                </div>
                <div className={`flex items-center gap-2 font-mono text-xl font-bold ${timerClass}`}>
                    <span className="material-symbols-outlined text-[20px]">timer</span>
                    {formatTime(timeLeft)}
                </div>
                <div className="flex items-center gap-2 ml-4 mr-4 text-xs font-semibold shrink-0" style={{ width: '120px' }}>
                    {syncQueueSize > 0 ? (
                        <span className="text-orange-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                            Syncing {syncQueueSize}...
                        </span>
                    ) : (
                        <span className="text-green-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">cloud_done</span>
                            Saved
                        </span>
                    )}
                </div>
                <button
                    onClick={() => setShowSubmitConfirm(true)}
                    className="bg-orange-500 hover:bg-orange-400 text-white font-semibold px-5 py-2 rounded-xl transition-colors text-sm"
                >
                    Submit Exam
                </button>
            </header>

            {/* ─── Announcement Banner ──────────────────────────────────────── */}
            {announcement && (
                <div className="bg-amber-500/20 border-b border-amber-400/30 px-6 py-3 flex items-center gap-3">
                    <span className="material-symbols-outlined text-amber-400 text-[18px]">campaign</span>
                    <p className="text-amber-200 text-sm">{announcement}</p>
                    <button onClick={() => setAnnouncement(null)} className="ml-auto text-amber-400 hover:text-white">
                        <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                </div>
            )}

            {/* ─── Violation Warning Banner ─────────────────────────────────── */}
            {showViolationBanner && (
                <div className="bg-red-600/90 px-6 py-2.5 flex items-center gap-3 shrink-0">
                    <span className="material-symbols-outlined text-white text-[18px]">warning</span>
                    <p className="text-white text-sm font-semibold">⚠️ Security violation detected! This has been logged and reported to the teacher.</p>
                    <button onClick={() => setShowViolationBanner(false)} className="ml-auto text-white/70 hover:text-white">
                        <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                </div>
            )}

            {/* ─── Submitting Overlay ───────────────────────────────────────── */}
            {isSubmitting && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-white/20 rounded-2xl p-6 shadow-2xl flex flex-col items-center">
                        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <h3 className="text-white font-bold text-lg">Submitting Exam...</h3>
                        <p className="text-white/60 text-sm mt-1">Syncing remaining answers to cloud.</p>
                    </div>
                </div>
            )}

            {/* ─── Main area ────────────────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden select-none">
                {/* Question Area */}
                <main className="flex-1 overflow-y-auto p-6 flex flex-col">
                    {currentQ ? (
                        <div className="max-w-3xl mx-auto w-full flex flex-col gap-6 flex-1">
                            {/* Question number + mark */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="bg-orange-500/20 text-orange-300 font-bold px-3 py-1 rounded-lg text-sm">
                                        Q{currentIdx + 1} / {questions.length}
                                    </span>
                                    <span className="text-white/40 text-sm">{currentQ.marks} mark{currentQ.marks !== 1 ? 's' : ''}</span>
                                    {currentQ.negativeMarks > 0 && (
                                        <span className="text-red-400/70 text-xs">-{currentQ.negativeMarks} for wrong</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => toggleMarkForReview(currentQ.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${markedForReview.has(currentQ.id) ? 'bg-orange-500/20 text-orange-400' : 'bg-white/10 text-white/50 hover:text-white'}`}
                                >
                                    <span className="material-symbols-outlined text-[16px]">flag</span>
                                    {markedForReview.has(currentQ.id) ? 'Marked' : 'Mark for Review'}
                                </button>
                            </div>

                            {/* Question text */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <p className="text-white text-base leading-relaxed">{currentQ.text}</p>
                            </div>

                            {/* Options */}
                            <div className="flex flex-col gap-3">
                                {currentQ.options.map((opt) => {
                                    const selected = answers[currentQ.id] === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => handleSelectOption(currentQ.id, opt.id)}
                                            className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                                                selected
                                                    ? 'bg-orange-500/20 border-orange-400 text-white'
                                                    : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20'
                                            }`}
                                        >
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                                                selected ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/50'
                                            }`}>
                                                {opt.id}
                                            </div>
                                            <span className="text-sm leading-relaxed">{opt.text}</span>
                                            {selected && (
                                                <span className="ml-auto material-symbols-outlined text-orange-400 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Navigation */}
                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/10">
                                <button
                                    onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                                    disabled={currentIdx === 0}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/20 text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
                                >
                                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                                    Previous
                                </button>

                                <div className="flex gap-2">
                                    {answers[currentQ.id] && (
                                        <button
                                            onClick={() => handleClearAnswer(currentQ.id)}
                                            className="px-4 py-2.5 rounded-xl border border-white/20 text-white/50 hover:text-white hover:bg-white/10 transition-colors text-sm"
                                        >
                                            Clear
                                        </button>
                                    )}
                                    {currentIdx === questions.length - 1 ? (
                                        <button
                                            onClick={() => setShowSubmitConfirm(true)}
                                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-white font-semibold transition-colors text-sm"
                                        >
                                            Submit Exam
                                            <span className="material-symbols-outlined text-[18px]">done_all</span>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))}
                                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold transition-colors text-sm"
                                        >
                                            Save & Next
                                            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-white/40">
                            No questions available.
                        </div>
                    )}
                </main>

                {/* ─── Sidebar Navigator ────────────────────────────────────── */}
                <aside className="w-64 border-l border-white/10 bg-slate-800/50 flex flex-col shrink-0 overflow-hidden">
                    <div className="p-4 border-b border-white/10">
                        <h3 className="font-semibold text-white text-sm mb-3">Question Navigator</h3>
                        <div className="flex flex-col gap-1.5 text-xs">
                            <span className="flex items-center gap-2 text-slate-300">
                                <span className="w-3 h-3 rounded bg-emerald-500 inline-block shadow shadow-emerald-500/50" />
                                Answered
                            </span>
                            <span className="flex items-center gap-2 text-slate-300">
                                <span className="w-3 h-3 rounded bg-red-500 inline-block shadow shadow-red-500/50" />
                                Marked for Review
                            </span>
                            <span className="flex items-center gap-2 text-slate-300">
                                <span className="w-3 h-3 rounded bg-blue-500 inline-block shadow shadow-blue-500/50" />
                                Current
                            </span>
                            <span className="flex items-center gap-2 text-slate-300">
                                <span className="w-3 h-3 rounded bg-slate-700 border border-slate-600 inline-block" />
                                Not Visited
                            </span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="grid grid-cols-5 gap-2">
                            {questions.map((q, idx) => {
                                const status = getQStatus(q, idx);
                                return (
                                    <button
                                        key={q.id}
                                        onClick={() => setCurrentIdx(idx)}
                                        className={`w-10 h-10 flex items-center justify-center rounded-lg font-bold text-xs transition-all ${statusClasses[status]}`}
                                    >
                                        {idx + 1}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="p-4 border-t border-white/10">
                        <div className="grid grid-cols-2 gap-2 text-center text-xs">
                            <div className="bg-white/5 rounded-lg p-2">
                                <p className="text-green-400 font-bold text-lg">{answeredCount}</p>
                                <p className="text-white/40">Answered</p>
                            </div>
                            <div className="bg-white/5 rounded-lg p-2">
                                <p className="text-white/60 font-bold text-lg">{questions.length - answeredCount}</p>
                                <p className="text-white/40">Remaining</p>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>

            {/* ─── Submit Confirm Modal ────────────────────────────────────── */}
            {showSubmitConfirm && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-white/20 rounded-2xl p-6 shadow-2xl" style={{ width: '100%', maxWidth: '380px', minWidth: '300px' }}>
                        <h3 className="text-white font-bold text-lg mb-2">Submit Exam?</h3>
                        <p className="text-white/60 text-sm mb-1">
                            You have answered <strong className="text-white">{answeredCount}</strong> of <strong className="text-white">{questions.length}</strong> questions.
                        </p>
                        {answeredCount < questions.length && (
                            <p className="text-orange-400 text-sm mb-4">
                                ⚠️ {questions.length - answeredCount} question{questions.length - answeredCount !== 1 ? 's' : ''} left unanswered.
                            </p>
                        )}
                        <p className="text-white/50 text-sm mb-5">This action cannot be undone.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowSubmitConfirm(false)}
                                className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/70 hover:bg-white/10 transition-colors text-sm"
                            >
                                Go Back
                            </button>
                            <button
                                onClick={() => handleSubmit(false)}
                                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold transition-colors text-sm"
                            >
                                Submit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
