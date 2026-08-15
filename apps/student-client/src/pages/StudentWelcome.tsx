import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ShieldAlert, Loader2, XCircle, CheckCircle2,
    RefreshCw, LogOut, ChevronRight, Hash, User,
    Building, FileText, Monitor, CheckCircle, AlertTriangle
} from 'lucide-react';

const API_BASE = ((import.meta as any).env?.VITE_API_URL || 'https://ew-exam-portal-backend.onrender.com') + '/api';

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
    code: 'VS Code',
    discord: 'Discord',
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    anydesk: 'AnyDesk',
    teamviewer: 'TeamViewer',
    teamviewer_service: 'TeamViewer Service',
};

type Screen = 'scan' | 'blocked' | 'scan_error' | 'code' | 'instructions' | 'details' | 'joining';

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

    const handleCodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const code = examCode.toUpperCase().trim();
        if (!code) { setError('Please enter an exam code.'); return; }

        setScreen('joining');
        try {
            const res = await fetch(`${API_BASE}/exams/validate/${code}`);
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Invalid exam code.');
                setScreen('code');
                return;
            }
            setExamInfo(data);
            setScreen('instructions');
        } catch {
            setError('Cannot connect to server. Make sure you have internet access.');
            setScreen('code');
        }
    };

    const handleDetailsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!name.trim() || !registerNumber.trim() || !department.trim()) {
            setError('Please fill in all fields.');
            return;
        }
        if (!/^[a-zA-Z0-9]+$/.test(registerNumber.trim())) {
            setError('Register Number must be alphanumeric.');
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
            setError('Cannot connect to server.');
            setScreen('details');
        }
    };

    // ─── Render Helpers ───────────────────────────────────────────────

    const TopBar = () => (
        <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-50">
            <div className="flex items-center gap-3">
                <img src="./app-logo.png" alt="EW SHIKEN Logo" className="h-[44px] w-auto object-contain scale-110 origin-left" />
            </div>
            {isElectron && (
                <button
                    onClick={handleQuit}
                    className="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                >
                    <LogOut size={16} /> Quit
                </button>
            )}
        </header>
    );

    const ChecklistRow = ({ label, checking, blocked }: { label: string; checking: boolean; blocked: boolean }) => (
        <div className={`flex items-center gap-3 p-3 mb-2 rounded-xl border ${blocked ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="shrink-0">
                {checking ? <Loader2 className="animate-spin text-blue-500" size={18} /> : 
                 blocked ? <XCircle className="text-red-500" size={18} /> : 
                 <CheckCircle2 className="text-emerald-500" size={18} />}
            </div>
            <span className={`flex-1 text-sm ${blocked ? 'text-red-800 font-medium' : 'text-slate-600'}`}>{label}</span>
            {blocked && (
                <span className="text-[10px] font-bold tracking-wider text-red-600 bg-red-100 px-2 py-0.5 rounded-md uppercase">Running</span>
            )}
        </div>
    );

    const StatusIndicator = ({ ok, label }: { ok: boolean; label: string }) => (
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-xs text-slate-500 font-medium">{label}</span>
        </div>
    );

    // ─── SCREENS ──────────────────────────────────────────────────────

    let content = null;

    if (screen === 'scan') {
        content = (
            <div className="w-[440px] max-w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8 flex flex-col">
                <div className="mx-auto w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-6">
                    <Monitor className="text-blue-600" size={24} />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 text-center mb-1">System Check</h1>
                <p className="text-slate-500 text-sm text-center mb-8">Verifying secure environment...</p>
                <div className="flex flex-col max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {Object.entries(FORBIDDEN_LABELS).map(([key, label]) => (
                        <ChecklistRow key={key} label={label} checking={scanning} blocked={blockedApps.includes(key)} />
                    ))}
                </div>
            </div>
        );
    } else if (screen === 'blocked') {
        content = (
            <div className="w-[440px] max-w-full bg-white border border-red-200 rounded-2xl shadow-sm p-8 flex flex-col">
                <div className="mx-auto w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-6">
                    <ShieldAlert className="text-red-600" size={24} />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 text-center mb-1">Action Required</h1>
                <p className="text-slate-500 text-sm text-center mb-6">Close the following applications to continue.</p>
                
                <div className="flex flex-col max-h-[250px] overflow-y-auto pr-2 custom-scrollbar mb-6">
                    {Object.entries(FORBIDDEN_LABELS).map(([key, label]) => (
                        <ChecklistRow key={key} label={label} checking={false} blocked={blockedApps.includes(key)} />
                    ))}
                </div>
                
                <div className="flex gap-3 mt-auto">
                    {isElectron && (
                        <button onClick={handleQuit} className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-colors">
                            Quit
                        </button>
                    )}
                    <button onClick={runScan} disabled={scanning} className="flex-[2] py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                        {scanning ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                        {scanning ? 'Scanning...' : 'Re-scan System'}
                    </button>
                </div>
            </div>
        );
    } else if (screen === 'scan_error') {
        content = (
            <div className="w-[440px] max-w-full bg-white border border-red-200 rounded-2xl shadow-sm p-8 text-center">
                <div className="mx-auto w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-6">
                    <XCircle className="text-red-600" size={24} />
                </div>
                <h1 className="text-xl font-bold text-slate-900 mb-2">Security Check Failed</h1>
                <p className="text-slate-600 text-sm mb-8">{error}</p>
                <div className="flex gap-3">
                    {isElectron && (
                        <button onClick={handleQuit} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-colors">Quit</button>
                    )}
                    <button onClick={runScan} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors">Try Again</button>
                </div>
            </div>
        );
    } else if (screen === 'joining') {
        content = (
            <div className="text-center flex flex-col items-center">
                <Loader2 className="animate-spin text-blue-600 mb-6" size={48} strokeWidth={2} />
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    {examInfo ? 'Joining Examination...' : 'Verifying Exam Code...'}
                </h2>
                <p className="text-slate-500">Please wait securely.</p>
                {isElectron && (
                    <button onClick={handleQuit} className="mt-8 px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-semibold text-sm transition-colors">
                        Cancel & Quit
                    </button>
                )}
            </div>
        );
    } else if (screen === 'code') {
        content = (
            <div className="w-[440px] max-w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Enter Exam Code</h1>
                <p className="text-slate-500 text-sm mb-8">Provided by your invigilator.</p>

                {error && (
                    <div className="flex items-center gap-3 bg-red-50 border border-red-200 p-3 rounded-xl mb-6">
                        <XCircle className="text-red-600 shrink-0" size={18} />
                        <p className="text-red-800 text-sm font-medium">{error}</p>
                    </div>
                )}

                <form onSubmit={handleCodeSubmit} className="flex flex-col gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Exam Code</label>
                        <input
                            type="text"
                            value={examCode}
                            onChange={e => setExamCode(e.target.value.toUpperCase())}
                            placeholder="e.g. MATH01"
                            required
                            autoFocus
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-lg font-bold text-center uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-300"
                        />
                    </div>
                    
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                        Verify Code <ChevronRight size={18} />
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                    <StatusIndicator ok={online} label="Network" />
                    {isElectron && <StatusIndicator ok={blockedApps.length === 0} label="Security" />}
                </div>
            </div>
        );
    } else if (screen === 'instructions') {
        content = (
            <div className="w-[440px] max-w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
                {examInfo && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex items-start gap-4">
                        <div className="bg-blue-100 text-blue-600 p-2 rounded-lg mt-0.5"><FileText size={20} /></div>
                        <div className="flex-1">
                            <h3 className="font-bold text-blue-900">{examInfo.title}</h3>
                            <p className="text-blue-700/70 text-sm mt-0.5">Code: {examInfo.exam_code} · {examInfo.duration_minutes} min</p>
                        </div>
                    </div>
                )}
                <h1 className="text-2xl font-bold text-slate-900 mb-4">Exam Instructions</h1>
                
                <ul className="text-slate-600 text-sm space-y-4 mb-8">
                    <li className="flex gap-3 items-start"><CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={16} /> <span>Total duration is <strong>{examInfo?.duration_minutes} minutes</strong>. The timer will start once you join.</span></li>
                    <li className="flex gap-3 items-start"><ShieldAlert className="text-red-500 shrink-0 mt-0.5" size={16} /> <span>Do not switch tabs, open other applications, or attempt to use external monitors.</span></li>
                    <li className="flex gap-3 items-start"><Monitor className="text-red-500 shrink-0 mt-0.5" size={16} /> <span>Your screen, keyboard, and mouse activity are being strictly monitored.</span></li>
                    <li className="flex gap-3 items-start"><AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} /> <span>Any violation will be logged and may result in immediate termination of the exam.</span></li>
                </ul>

                <button onClick={() => setScreen('details')} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                    Continue <ChevronRight size={18} />
                </button>
                <button onClick={() => { setExamInfo(null); setScreen('code'); }} className="w-full mt-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-colors text-sm">
                    Back to Code
                </button>
            </div>
        );
    } else if (screen === 'details') {
        content = (
            <div className="w-[440px] max-w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
                {examInfo && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8 flex items-start gap-4">
                        <div className="bg-blue-100 text-blue-600 p-2 rounded-lg mt-0.5"><FileText size={20} /></div>
                        <div className="flex-1">
                            <h3 className="font-bold text-blue-900">{examInfo.title}</h3>
                            <p className="text-blue-700/70 text-sm mt-0.5">Code: {examInfo.exam_code} · {examInfo.duration_minutes} min</p>
                        </div>
                        <button onClick={() => { setExamInfo(null); setScreen('code'); setError(''); }} className="text-blue-400 hover:text-blue-700 p-1">
                            <XCircle size={18} />
                        </button>
                    </div>
                )}

                <h1 className="text-2xl font-bold text-slate-900 mb-1">Student Details</h1>
                <p className="text-slate-500 text-sm mb-6">Confirm your identity before starting.</p>

                {error && (
                    <div className="flex items-center gap-3 bg-red-50 border border-red-200 p-3 rounded-xl mb-6">
                        <XCircle className="text-red-600 shrink-0" size={18} />
                        <p className="text-red-800 text-sm font-medium">{error}</p>
                    </div>
                )}

                <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                        <div className="relative">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text" value={name} onChange={e => setName(e.target.value)}
                                placeholder="Your Name" required
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400 font-medium"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Register Number</label>
                        <div className="relative">
                            <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text" value={registerNumber} onChange={e => setRegisterNumber(e.target.value.toUpperCase())}
                                placeholder="e.g. 21CS001" required
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400 font-bold tracking-wide"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Department</label>
                        <div className="relative">
                            <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text" value={department} onChange={e => setDepartment(e.target.value)}
                                placeholder="e.g. Computer Science" required
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400 font-medium"
                            />
                        </div>
                    </div>
                    
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2">
                        Start Examination <ChevronRight size={18} />
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col selection:bg-blue-200">
            <TopBar />
            <main className="flex-1 flex flex-col items-center justify-center p-6 pt-20 w-full">
                {content}
            </main>
        </div>
    );
}
