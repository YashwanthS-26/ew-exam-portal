import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'http://localhost:3000/api';

// Apps that are NOT allowed
const FORBIDDEN_LABELS: Record<string, string> = {
    chrome: 'Google Chrome',
    msedge: 'Microsoft Edge',
    firefox: 'Mozilla Firefox',
    brave: 'Brave Browser',
    opera: 'Opera Browser',
    chatgpt: 'ChatGPT',
    claude: 'Claude AI',
    gemini: 'Gemini AI',
    copilot: 'Microsoft Copilot',
    cursor: 'Cursor AI',
    windsurf: 'Windsurf',
};

type Screen = 'scan' | 'blocked' | 'scan_error' | 'code' | 'details' | 'joining';

interface ExamInfo {
    id: string;
    title: string;
    exam_code: string;
    duration_minutes: number;
}

export default function StudentWelcome() {
    const navigate = useNavigate();
    const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

    const [screen, setScreen] = useState<Screen>(isElectron ? 'scan' : 'code');
    const [blockedApps, setBlockedApps] = useState<string[]>([]);
    const [scanning, setScanning] = useState(false);

    // Step 1: exam code
    const [examCode, setExamCode] = useState('');
    const [examInfo, setExamInfo] = useState<ExamInfo | null>(null);

    // Step 2: student details
    const [name, setName] = useState('');
    const [registerNumber, setRegisterNumber] = useState('');
    const [department, setDepartment] = useState('');

    const [error, setError] = useState('');
    const [online, setOnline] = useState(navigator.onLine);

    useEffect(() => {
        const up = () => setOnline(true);
        const down = () => setOnline(false);
        window.addEventListener('online', up);
        window.addEventListener('offline', down);
        return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
    }, []);

    // Auto-scan on launch (Electron only)
    useEffect(() => {
        if (isElectron) { runScan(); }
    }, [isElectron]);

    const runScan = useCallback(async () => {
        setScanning(true);
        setBlockedApps([]);
        setError('');
        try {
            const result = await (window as any).electronAPI.scanProcesses();
            if (!result.success) {
                setError('Security scan failed. Please contact your invigilator.');
                setScreen('scan_error');
                setScanning(false);
                return;
            }
            const blocked: string[] = result.blocked || [];
            setBlockedApps(blocked);
            if (blocked.length > 0) {
                setScreen('blocked');
            } else {
                setScreen('code');
            }
        } catch {
            setError('Security scan crashed. Please restart the app.');
            setScreen('scan_error');
        }
        setScanning(false);
    }, []);

    const handleQuit = () => {
        if (isElectron) { (window as any).electronAPI.quitApp(); }
    };

    // Step 1: Validate exam code
    const handleCodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const code = examCode.toUpperCase().trim();
        if (!code) { setError('Please enter an exam code.'); return; }

        setScreen('joining'); // show loading briefly
        try {
            const res = await fetch(`${API_BASE}/exams/validate/${code}`);
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Invalid exam code.');
                setScreen('code');
                return;
            }
            setExamInfo(data);
            setScreen('details');
        } catch {
            setError('Cannot connect to server. Make sure the backend is running.');
            setScreen('code');
        }
    };

    // Step 2: Join with student details
    const handleDetailsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!name.trim() || !registerNumber.trim() || !department.trim()) {
            setError('Please fill in all fields.');
            return;
        }
        // Alphanumeric check for register number
        if (!/^[a-zA-Z0-9]+$/.test(registerNumber.trim())) {
            setError('Register Number must be alphanumeric (letters and numbers only).');
            return;
        }

        setScreen('joining');
        try {
            const res = await fetch(`${API_BASE}/exams/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exam_code: examCode.toUpperCase().trim(),
                    student_name: name.trim(),
                    roll_number: registerNumber.trim(),
                    department: department.trim(),
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Failed to join exam.');
                setScreen('details');
                return;
            }
            sessionStorage.setItem('examSession', JSON.stringify({
                attemptId: data.attemptId,
                exam: data.exam,
                questions: data.questions,
                studentName: name.trim(),
                rollNumber: registerNumber.trim(),
                department: department.trim(),
            }));
            navigate('/exam');
        } catch {
            setError('Cannot connect to server. Make sure the backend is running.');
            setScreen('details');
        }
    };

    // ─── SCANNING SCREEN ──────────────────────────────────────────────────────────
    if (screen === 'scan') {
        return (
            <FullBg>
                <Card>
                    <IconBox color="#f59e0b">⏳</IconBox>
                    <h1 style={s.title}>Scanning System...</h1>
                    <p style={s.sub}>Checking for unauthorized applications</p>
                    <div style={{ width: '100%', marginTop: 12 }}>
                        {Object.entries(FORBIDDEN_LABELS).map(([key, label]) => (
                            <ChecklistRow key={key} label={label} checking={scanning} blocked={blockedApps.includes(key)} />
                        ))}
                    </div>
                </Card>
            </FullBg>
        );
    }

    // ─── BLOCKED SCREEN ───────────────────────────────────────────────────────────
    if (screen === 'blocked') {
        return (
            <FullBg>
                <Card wide>
                    <IconBox color="#ef4444">🚫</IconBox>
                    <h1 style={s.title}>Unauthorized Apps Detected</h1>
                    <p style={s.sub}>Close these applications before you can continue</p>

                    <div style={{ width: '100%', marginTop: 8 }}>
                        {Object.entries(FORBIDDEN_LABELS).map(([key, label]) => (
                            <ChecklistRow key={key} label={label} checking={false} blocked={blockedApps.includes(key)} />
                        ))}
                    </div>

                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 16, textAlign: 'center' }}>
                        Close all listed applications, then click Re-scan
                    </p>

                    <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 8 }}>
                        <button onClick={handleQuit} style={s.btnSecondary}>
                            ✕ Quit
                        </button>
                        <button
                            onClick={runScan}
                            disabled={scanning}
                            style={{ ...s.btnPrimary, background: '#f59e0b', flex: 2, opacity: scanning ? 0.6 : 1 }}
                        >
                            {scanning ? '⏳ Scanning...' : '🔄 Re-scan'}
                        </button>
                    </div>
                </Card>
            </FullBg>
        );
    }

    // ─── JOINING SCREEN ───────────────────────────────────────────────────────────
    if (screen === 'joining') {
        return (
            <FullBg>
                <div style={{ textAlign: 'center' }}>
                    <Spinner large />
                    <p style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginTop: 20 }}>
                        {examInfo ? 'Joining Exam...' : 'Verifying Exam Code...'}
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Please wait</p>
                    {isElectron && (
                        <button onClick={handleQuit} style={{ ...s.btnSecondary, marginTop: 30 }}>
                            ✕ Cancel & Quit
                        </button>
                    )}
                </div>
            </FullBg>
        );
    }

    // ─── SCAN ERROR SCREEN ────────────────────────────────────────────────────────
    if (screen === 'scan_error') {
        return (
            <FullBg>
                <Card wide>
                    <IconBox color="#ef4444">⚠️</IconBox>
                    <h1 style={s.title}>Security Check Failed</h1>
                    <p style={s.sub}>{error}</p>
                    <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 20 }}>
                        <button onClick={handleQuit} style={{ ...s.btnSecondary, flex: 1 }}>
                            ✕ Quit
                        </button>
                        <button onClick={runScan} style={{ ...s.btnPrimary, flex: 1 }}>
                            🔄 Try Again
                        </button>
                    </div>
                </Card>
            </FullBg>
        );
    }

    // ─── STEP 1: EXAM CODE SCREEN ─────────────────────────────────────────────
    if (screen === 'code') {
        return (
            <FullBg>
                <TopBar isElectron={isElectron} onQuit={handleQuit} />
                <div style={{ marginTop: 52 }}>
                    <Card>
                        <IconBox color="linear-gradient(135deg,#f29d66,#e38450)">📋</IconBox>
                        <h1 style={s.title}>Enter Exam Code</h1>
                        <p style={s.sub}>Ask your teacher for the exam code</p>

                        {error && (
                            <div style={s.errorBox}>
                                <span>⚠️</span>
                                <p style={{ margin: 0, color: '#fca5a5', fontSize: 14 }}>{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleCodeSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <Field label="Exam Code">
                                <input
                                    type="text"
                                    value={examCode}
                                    onChange={e => setExamCode(e.target.value.toUpperCase())}
                                    placeholder="e.g. MATH01"
                                    required
                                    autoFocus
                                    style={{ ...s.input, letterSpacing: '0.12em', fontWeight: 700, fontSize: 20, textAlign: 'center' }}
                                    onFocus={e => (e.target.style.borderColor = '#f29d66')}
                                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
                                />
                            </Field>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                                <button type="submit" style={s.btnPrimary}>
                                    → Verify Code
                                </button>
                                {isElectron && (
                                    <button
                                        type="button"
                                        onClick={handleQuit}
                                        style={{
                                            ...s.btnSecondary,
                                            background: 'rgba(239,68,68,0.1)',
                                            borderColor: 'rgba(239,68,68,0.2)',
                                            color: '#fca5a5',
                                            width: '100%',
                                        }}
                                    >
                                        ✕ Quit Application
                                    </button>
                                )}
                            </div>
                        </form>

                        <div style={{ width: '100%', marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>System Status</p>
                            <StatusRow ok={online} label="Internet Connection" />
                            {isElectron && (
                                <div style={{ marginTop: 6 }}>
                                    <StatusRow ok={blockedApps.length === 0} label="Security Check" />
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </FullBg>
        );
    }

    // ─── STEP 2: STUDENT DETAILS SCREEN ──────────────────────────────────────
    return (
        <FullBg>
            <TopBar isElectron={isElectron} onQuit={handleQuit} />
            <div style={{ marginTop: 52 }}>
                <Card>
                    {/* Exam info banner */}
                    {examInfo && (
                        <div style={{
                            width: '100%', background: 'rgba(59,130,246,0.15)',
                            border: '1px solid rgba(59,130,246,0.3)', borderRadius: 12,
                            padding: '10px 14px', marginBottom: 4,
                            display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                            <span style={{ fontSize: 20 }}>📝</span>
                            <div>
                                <p style={{ color: '#93c5fd', fontWeight: 700, fontSize: 14, margin: 0 }}>{examInfo.title}</p>
                                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, margin: 0 }}>
                                    Code: {examInfo.exam_code} · {examInfo.duration_minutes} min
                                </p>
                            </div>
                            <button
                                onClick={() => { setExamInfo(null); setScreen('code'); setError(''); }}
                                style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18 }}
                                title="Change exam code"
                            >✕</button>
                        </div>
                    )}

                    <IconBox color="linear-gradient(135deg,#f29d66,#e38450)">👤</IconBox>
                    <h1 style={s.title}>Your Details</h1>
                    <p style={s.sub}>Enter your information to start the exam</p>

                    {error && (
                        <div style={s.errorBox}>
                            <span>⚠️</span>
                            <p style={{ margin: 0, color: '#fca5a5', fontSize: 14 }}>{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleDetailsSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <Field label="Full Name">
                            <input
                                type="text" value={name} onChange={e => setName(e.target.value)}
                                placeholder="e.g. Yashwanth Kumar" required style={s.input}
                                onFocus={e => (e.target.style.borderColor = '#f29d66')}
                                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
                            />
                        </Field>
                        <Field label="Register Number">
                            <input
                                type="text" value={registerNumber}
                                onChange={e => setRegisterNumber(e.target.value.toUpperCase())}
                                placeholder="e.g. 21CS001" required
                                style={{ ...s.input, letterSpacing: '0.06em', fontWeight: 600 }}
                                onFocus={e => (e.target.style.borderColor = '#f29d66')}
                                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
                            />
                        </Field>
                        <Field label="Department">
                            <input
                                type="text" value={department} onChange={e => setDepartment(e.target.value)}
                                placeholder="e.g. Computer Science" required style={s.input}
                                onFocus={e => (e.target.style.borderColor = '#f29d66')}
                                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
                            />
                        </Field>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                            <button type="submit" style={{ ...s.btnPrimary, background: 'linear-gradient(135deg,#f29d66,#e38450)' }}>
                                🚀 Start Exam
                            </button>
                            {isElectron && (
                                <button
                                    type="button"
                                    onClick={handleQuit}
                                    style={{
                                        ...s.btnSecondary,
                                        background: 'rgba(239,68,68,0.1)',
                                        borderColor: 'rgba(239,68,68,0.2)',
                                        color: '#fca5a5',
                                        width: '100%',
                                    }}
                                >
                                    ✕ Quit Application
                                </button>
                            )}
                        </div>
                    </form>
                </Card>
            </div>
        </FullBg>
    );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function TopBar({ isElectron, onQuit }: { isElectron: boolean; onQuit: () => void }) {
    return (
        <div style={s.topBar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={s.logoBox}>📋</div>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Enlight Wisdom</span>
            </div>
            {isElectron && (
                <button
                    onClick={onQuit}
                    style={{
                        background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                        color: '#fca5a5', padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
                        fontSize: 13, fontWeight: 600, fontFamily: 'Inter,sans-serif',
                    }}
                    title="Quit application"
                >
                    ✕ Quit
                </button>
            )}
        </div>
    );
}

function ChecklistRow({ label, checking, blocked }: { label: string; checking: boolean; blocked: boolean }) {
    const icon = checking ? '⏳' : blocked ? '✗' : '✓';
    const color = checking ? '#f59e0b' : blocked ? '#ef4444' : '#22c55e';
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: blocked ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.06)',
            border: `1px solid ${blocked ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.15)'}`,
            borderRadius: 8, padding: '7px 12px', marginBottom: 6,
        }}>
            <span style={{ fontSize: 14, color, width: 18, textAlign: 'center' }}>{icon}</span>
            <span style={{ color: blocked ? '#fca5a5' : 'rgba(255,255,255,0.6)', fontSize: 13, flex: 1 }}>{label}</span>
            {blocked && (
                <span style={{ color: '#f87171', fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.2)', padding: '2px 8px', borderRadius: 6 }}>
                    RUNNING
                </span>
            )}
        </div>
    );
}

function FullBg({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            width: '100vw', height: '100vh',
            background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Inter,sans-serif', overflowY: 'auto', userSelect: 'none',
        }}>
            {children}
        </div>
    );
}

function Card({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
    return (
        <div style={{
            width: wide ? 520 : 460, maxWidth: 'calc(100vw - 40px)',
            background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: 36,
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
            {children}
        </div>
    );
}

function IconBox({ children, color }: { children: React.ReactNode; color: string }) {
    return (
        <div style={{
            width: 60, height: 60, background: color, borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, marginBottom: 6,
            boxShadow: '0 8px 25px rgba(59,130,246,0.3)',
        }}>
            {children}
        </div>
    );
}

function Spinner({ large }: { large?: boolean }) {
    const size = large ? 48 : 36;
    return (
        <>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <div style={{
                width: size, height: size,
                border: `${large ? 4 : 3}px solid rgba(255,255,255,0.15)`,
                borderTop: `${large ? 4 : 3}px solid #60a5fa`,
                borderRadius: '50%', animation: 'spin 1s linear infinite',
                margin: '16px auto 0',
            }} />
        </>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ width: '100%' }}>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: '0.04em' }}>
                {label.toUpperCase()}
            </label>
            {children}
        </div>
    );
}

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '7px 12px' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: ok ? '#22c55e' : '#ef4444', boxShadow: ok ? '0 0 6px #22c55e' : '0 0 6px #ef4444' }} />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, flex: 1 }}>{label}</span>
            <span style={{ color: ok ? '#4ade80' : '#f87171', fontSize: 12, fontWeight: 700 }}>{ok ? 'OK' : 'Error'}</span>
        </div>
    );
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const s = {
    title: { color: '#fff', fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', textAlign: 'center' as const },
    sub: { color: 'rgba(255,255,255,0.45)', fontSize: 14, margin: '2px 0 10px', textAlign: 'center' as const },
    topBar: {
        position: 'fixed' as const, top: 0, left: 0, right: 0, height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px',
        background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)', zIndex: 50,
    },
    logoBox: { width: 28, height: 28, background: '#f29d66', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 },
    input: {
        width: '100%', boxSizing: 'border-box' as const,
        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 12, padding: '12px 14px', color: '#fff', fontSize: 15,
        outline: 'none', fontFamily: 'Inter,sans-serif', transition: 'border-color 0.2s',
    },
    btnPrimary: {
        width: '100%', padding: '13px', marginTop: 4,
        background: 'linear-gradient(135deg,#f29d66,#e38450)',
        color: '#fff', border: 'none', borderRadius: 12,
        fontSize: 15, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxShadow: '0 4px 20px rgba(59,130,246,0.35)', fontFamily: 'Inter,sans-serif',
        flex: 1,
    },
    btnSecondary: {
        padding: '13px 20px', background: 'rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 12, cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'Inter,sans-serif',
    },
    errorBox: {
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 12, padding: '12px 14px', width: '100%',
    },
};
