import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { 
    ArrowLeft, 
    HelpCircle, 
    Save, 
    Trash2, 
    Plus, 
    Check,
    CheckCircle2,
    CircleDashed,
    AlertCircle,
    BookOpen
} from 'lucide-react';
import ExamQuestionImporter from '../components/ExamQuestionImporter';

type Option = { id: string; text: string; isCorrect: boolean };

type Question = {
    localId: string;      // client-side temp ID
    dbId?: string;        // real DB UUID (after save)
    text: string;
    options: Option[];
    marks: number;
    negativeMarks: number;
    saved: boolean;       // whether this question is saved to DB
    saving: boolean;
};

const defaultOptions = (): Option[] => [
    { id: 'A', text: '', isCorrect: true },
    { id: 'B', text: '', isCorrect: false },
    { id: 'C', text: '', isCorrect: false },
    { id: 'D', text: '', isCorrect: false },
];

const makeNewQuestion = (): Question => ({
    localId: Date.now().toString() + Math.random().toString(36).slice(2),
    text: '',
    options: defaultOptions(),
    marks: 1,
    negativeMarks: 0,
    saved: false,
    saving: false,
});

export default function QuestionBuilder() {
    const navigate = useNavigate();
    const { id: examId } = useParams<{ id: string }>();

    const [questions, setQuestions] = useState<Question[]>([]);
    const [examTitle, setExamTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [savingAll, setSavingAll] = useState(false);
    const [showBankImporter, setShowBankImporter] = useState(false);
    const [isReadonly, setIsReadonly] = useState(false);

    // Load exam and existing questions
    useEffect(() => {
        if (!examId) return;
        const load = async () => {
            try {
                const [examRes, qRes] = await Promise.all([
                    api.get(`/exams/${examId}`),
                    api.get(`/exams/${examId}/questions`),
                ]);
                setExamTitle(examRes.data?.title || 'Exam');
                setIsReadonly(examRes.data?.status !== 'DRAFT');
                const dbQuestions: any[] = qRes.data || [];
                // Map DB questions to our local format
                if (dbQuestions.length > 0) {
                    setQuestions(dbQuestions.map((dbQ: any) => ({
                        localId: dbQ.id,
                        dbId: dbQ.id,
                        text: dbQ.question_text || '',
                        options: [
                            { id: 'A', text: dbQ.option_a || '', isCorrect: dbQ.correct_option === 'A' },
                            { id: 'B', text: dbQ.option_b || '', isCorrect: dbQ.correct_option === 'B' },
                            { id: 'C', text: dbQ.option_c || '', isCorrect: dbQ.correct_option === 'C' },
                            { id: 'D', text: dbQ.option_d || '', isCorrect: dbQ.correct_option === 'D' },
                        ],
                        marks: Number(dbQ.marks) || 1,
                        negativeMarks: Number(dbQ.negative_marks) || 0,
                        saved: true,
                        saving: false,
                    })));
                }
            } catch (err) {
                console.error('Failed to load questions:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [examId]);

    const updateQ = (localId: string, updates: Partial<Question>) => {
        setQuestions(prev => prev.map(q =>
            q.localId === localId ? { ...q, ...updates, saved: false } : q
        ));
    };

    const setCorrectOption = (localId: string, optId: string) => {
        setQuestions(prev => prev.map(q =>
            q.localId === localId
                ? { ...q, saved: false, options: q.options.map(o => ({ ...o, isCorrect: o.id === optId })) }
                : q
        ));
    };

    const updateOption = (localId: string, optId: string, text: string) => {
        setQuestions(prev => prev.map(q =>
            q.localId === localId
                ? { ...q, saved: false, options: q.options.map(o => o.id === optId ? { ...o, text } : o) }
                : q
        ));
    };

    const addQuestion = () => {
        setQuestions(prev => [...prev, makeNewQuestion()]);
    };

    const handleImportBankQuestions = (bankQuestions: any[]) => {
        const newQuestions: Question[] = bankQuestions.map(q => ({
            localId: Date.now().toString() + Math.random().toString(36).slice(2),
            text: q.question_text,
            options: [
                { id: 'A', text: q.option_a, isCorrect: q.correct_option === 'A' },
                { id: 'B', text: q.option_b, isCorrect: q.correct_option === 'B' },
                { id: 'C', text: q.option_c || '', isCorrect: q.correct_option === 'C' },
                { id: 'D', text: q.option_d || '', isCorrect: q.correct_option === 'D' },
            ],
            marks: Number(q.marks) || 1,
            negativeMarks: Number(q.negative_marks) || 0,
            saved: false,
            saving: false
        }));
        setQuestions(prev => [...prev, ...newQuestions]);
        toast.success(`Imported ${newQuestions.length} questions into the builder!`);
    };

    // Save a single question to DB
    const saveQuestion = useCallback(async (localId: string) => {
        const q = questions.find(q => q.localId === localId);
        if (!q || !examId) return;

        if (!q.text.trim()) {
            toast.error('Question text cannot be empty');
            return;
        }
        if (q.options.filter(o => o.text.trim()).length < 2) {
            toast.error('At least 2 options with text are required');
            return;
        }

        setQuestions(prev => prev.map(x => x.localId === localId ? { ...x, saving: true } : x));

        try {
            const payload = {
                text: q.text,
                options: q.options,
                marks: q.marks,
                negativeMarks: q.negativeMarks,
            };

            let dbId = q.dbId;

            if (q.dbId) {
                // Question already saved — update via bulk replace
                // We'll just re-save all questions to keep it simple
                await saveAllQuestions();
                return;
            } else {
                // New question — save via single endpoint
                const res = await api.post(`/exams/${examId}/questions/single`, payload);
                dbId = res.data.id;
            }

            setQuestions(prev => prev.map(x =>
                x.localId === localId ? { ...x, dbId, saved: true, saving: false } : x
            ));
            toast.success('Question saved!', { duration: 1500 });
        } catch (err: any) {
            setQuestions(prev => prev.map(x => x.localId === localId ? { ...x, saving: false } : x));
            toast.error(err.response?.data?.error || 'Failed to save question');
        }
    }, [questions, examId]);

    // Save ALL questions (replaces all in DB)
    const saveAllQuestions = async () => {
        if (!examId) return;
        const valid = questions.filter(q => q.text.trim());
        if (valid.length === 0) {
            toast.error('Add at least one question with text');
            return;
        }

        setSavingAll(true);
        try {
            const payload = valid.map(q => ({
                text: q.text,
                options: q.options,
                marks: q.marks,
                negativeMarks: q.negativeMarks,
            }));

            const res = await api.post(`/exams/${examId}/questions`, { questions: payload });
            const saved: any[] = res.data || [];

            // Re-map all with DB IDs
            setQuestions(prev => {
                let dbIdx = 0;
                return prev
                    .filter(q => q.text.trim())
                    .map(q => ({
                        ...q,
                        dbId: saved[dbIdx]?.id || q.dbId,
                        saved: true,
                        saving: false,
                        localId: saved[dbIdx++]?.id || q.localId,
                    }));
            });
            toast.success(`${saved.length} question(s) saved!`);
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to save questions');
        } finally {
            setSavingAll(false);
        }
    };

    // Delete question from DB + local state
    const deleteQuestion = async (q: Question) => {
        if (q.dbId && examId) {
            try {
                await api.delete(`/exams/${examId}/questions/${q.dbId}`);
            } catch (err: any) {
                // If delete fails, still remove locally but warn
                console.error('Delete failed:', err.response?.data?.error);
            }
        }
        setQuestions(prev => prev.filter(x => x.localId !== q.localId));
        toast.success('Question removed');
    };

    const unsavedCount = questions.filter(q => !q.saved && q.text.trim()).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-slate-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 text-sm font-medium">Loading questions...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full relative overflow-hidden bg-slate-50">
            {/* Header */}
            <header className="flex justify-between items-center w-full px-6 h-16 bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/exams')} className="text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5 text-sm font-medium">
                        <ArrowLeft size={18} />
                        <span className="hidden md:inline">Back</span>
                    </button>
                    <div className="h-6 w-px bg-slate-200 hidden md:block" />
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 leading-tight">Question Builder</h1>
                        <p className="text-xs font-medium text-slate-500 leading-tight truncate max-w-[150px] md:max-w-xs">{examTitle}</p>
                    </div>
                    <span className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-md border border-slate-200">
                        <HelpCircle size={14} />
                        MCQ Only
                    </span>
                    {isReadonly && (
                        <span className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md border border-slate-200 ml-2">
                            <BookOpen size={14} />
                            Read-only (Published)
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    {unsavedCount > 0 && !isReadonly && (
                        <span className="text-sm font-semibold text-orange-600 hidden md:block flex items-center gap-1.5">
                            <AlertCircle size={16} />
                            {unsavedCount} unsaved
                        </span>
                    )}
                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-md border border-slate-200">
                        {questions.length} question{questions.length !== 1 ? 's' : ''}
                    </span>
                    {!isReadonly && (
                        <button
                            onClick={saveAllQuestions}
                            disabled={savingAll}
                            className="text-sm font-semibold bg-primary text-white hover:bg-black px-4 py-2 rounded-md transition-colors shadow-sm flex items-center gap-2 disabled:opacity-60"
                        >
                            {savingAll ? (
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Save size={16} />
                            )}
                            Save All
                        </button>
                    )}
                </div>
            </header>

            {/* Question List */}
            <div className="flex-1 overflow-y-auto p-6 pb-32">
                <div className="max-w-4xl mx-auto flex flex-col gap-6">
                    {questions.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-xl border border-slate-200 border-dashed shadow-sm">
                            <HelpCircle size={48} className="text-slate-300 block mb-4 mx-auto stroke-1" />
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">No questions yet</h3>
                            <p className="text-sm text-slate-500 mb-6">Add your first MCQ question manually, or import from your Question Bank.</p>
                            <div className="flex gap-4 justify-center">
                                <button onClick={addQuestion} className="bg-primary text-white text-sm font-medium px-5 py-2.5 rounded-md hover:bg-black transition-colors shadow-sm flex items-center gap-2">
                                    <Plus size={18} />
                                    Add Manual Question
                                </button>
                                <button onClick={() => setShowBankImporter(true)} className="bg-white text-indigo-700 border border-indigo-200 text-sm font-medium px-5 py-2.5 rounded-md hover:bg-indigo-50 transition-colors shadow-sm flex items-center gap-2">
                                    <BookOpen size={18} />
                                    Import from Bank
                                </button>
                            </div>
                        </div>
                    ) : (
                        questions.map((q, index) => (
                            <MCQCard
                                key={q.localId}
                                index={index}
                                question={q}
                                isReadonly={isReadonly}
                                onUpdateText={text => updateQ(q.localId, { text })}
                                onUpdateOption={(optId, text) => updateOption(q.localId, optId, text)}
                                onSetCorrect={optId => setCorrectOption(q.localId, optId)}
                                onUpdateMarks={marks => updateQ(q.localId, { marks })}
                                onUpdateNegMarks={negativeMarks => updateQ(q.localId, { negativeMarks })}
                                onSave={() => saveQuestion(q.localId)}
                                onDelete={() => deleteQuestion(q)}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* FAB - Add Question */}
            {!isReadonly && (
                <div className="absolute bottom-6 right-6 md:bottom-8 md:right-8 z-50 flex flex-col items-end gap-3">
                    <button
                        onClick={() => setShowBankImporter(true)}
                        className="w-12 h-12 bg-white text-indigo-600 rounded-full shadow-lg hover:bg-indigo-50 hover:scale-105 active:scale-95 transition-all flex items-center justify-center border border-indigo-100"
                        title="Import from Question Bank"
                    >
                        <BookOpen size={22} />
                    </button>
                    <button
                        onClick={addQuestion}
                        className="w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:bg-black hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                        title="Add Question Manually"
                    >
                        <Plus size={28} />
                    </button>
                </div>
            )}

            {showBankImporter && (
                <ExamQuestionImporter 
                    onClose={() => setShowBankImporter(false)}
                    onImport={handleImportBankQuestions}
                    existingQuestionTextList={questions.map(q => q.text.trim()).filter(Boolean)}
                />
            )}
        </div>
    );
}

interface MCQCardProps {
    index: number;
    question: Question;
    isReadonly: boolean;
    onUpdateText: (text: string) => void;
    onUpdateOption: (optId: string, text: string) => void;
    onSetCorrect: (optId: string) => void;
    onUpdateMarks: (marks: number) => void;
    onUpdateNegMarks: (neg: number) => void;
    onSave: () => void;
    onDelete: () => void;
}

function MCQCard({ index, question: q, isReadonly, onUpdateText, onUpdateOption, onSetCorrect, onUpdateMarks, onUpdateNegMarks, onSave, onDelete }: MCQCardProps) {
    return (
        <div className={`bg-white rounded-xl shadow-sm overflow-hidden transition-all border ${q.saved ? 'border-slate-200' : 'border-orange-200'}`}>
            {/* Card Header */}
            <div className={`px-6 py-3 flex items-center justify-between border-b ${q.saved ? 'bg-slate-50 border-slate-100' : 'bg-orange-50 border-orange-100'}`}>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-bold bg-slate-900 text-white w-8 h-8 rounded flex items-center justify-center shrink-0">
                        {index + 1}
                    </span>
                    <span className="text-sm font-semibold text-slate-700">Multiple Choice</span>
                    {q.saved ? (
                        <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                            <CheckCircle2 size={14} />
                            Saved
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-orange-600 text-xs font-semibold bg-orange-100 px-2 py-1 rounded-md border border-orange-200">
                            <AlertCircle size={14} />
                            Unsaved
                        </span>
                    )}
                </div>
                {!isReadonly && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onSave}
                            disabled={q.saving}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm ${q.saved ? 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50' : 'bg-primary text-white border border-transparent hover:bg-black'}`}
                        >
                            {q.saving ? (
                                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Save size={14} />
                            )}
                            {q.saving ? 'Saving...' : q.saved ? 'Update' : 'Save'}
                        </button>
                        <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                            <Trash2 size={18} />
                        </button>
                    </div>
                )}
            </div>

            <div className="p-6 flex flex-col gap-6">
                {/* Question Text */}
                <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Question *</label>
                    <textarea
                        value={q.text}
                        onChange={e => onUpdateText(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary resize-none p-4 text-base font-medium text-slate-900 bg-slate-50 outline-none transition-all placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-600"
                        placeholder="Type your question here..."
                        rows={2}
                        disabled={isReadonly}
                    />
                </div>

                {/* Options */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-slate-700">Answer Options</label>
                        <span className="text-xs text-slate-500">Click the circle to mark correct answer</span>
                    </div>
                    <div className="flex flex-col gap-3">
                        {q.options.map((opt) => (
                            <div key={opt.id} className={`flex items-center gap-3 rounded-lg border-2 p-3 transition-all ${isReadonly ? '' : 'cursor-pointer'} group ${opt.isCorrect ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-100 ' + (!isReadonly && 'hover:border-slate-300')}`}
                                onClick={() => !isReadonly && onSetCorrect(opt.id)}>
                                {/* Correct indicator */}
                                <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); if (!isReadonly) onSetCorrect(opt.id); }}
                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${opt.isCorrect ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 ' + (!isReadonly && 'group-hover:border-emerald-400')}`}
                                >
                                    {opt.isCorrect && <Check size={14} strokeWidth={3} className="text-white" />}
                                </button>
                                {/* Option letter */}
                                <span className={`text-sm w-7 h-7 flex items-center justify-center rounded shrink-0 font-bold ${opt.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {opt.id}
                                </span>
                                {/* Text input */}
                                <input
                                    value={opt.text}
                                    onClick={e => e.stopPropagation()}
                                    onChange={e => onUpdateOption(opt.id, e.target.value)}
                                    className={`flex-1 bg-transparent outline-none text-sm font-medium text-slate-900 placeholder-slate-400 disabled:text-slate-600`}
                                    placeholder={`Option ${opt.id}...`}
                                    disabled={isReadonly}
                                />
                                {opt.isCorrect && (
                                    <span className="text-xs font-bold text-emerald-600 shrink-0 uppercase tracking-wider">Correct</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Marks */}
                <div className="flex items-center gap-6 pt-4 border-t border-slate-100">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Marks</label>
                        <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={q.marks}
                            onChange={e => onUpdateMarks(parseFloat(e.target.value) || 0)}
                            className="w-24 border border-slate-200 rounded-md px-3 py-1.5 text-sm font-semibold text-slate-900 text-center focus:border-primary focus:ring-1 focus:ring-primary outline-none disabled:bg-slate-100 disabled:text-slate-600"
                            disabled={isReadonly}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Negative</label>
                        <input
                            type="number"
                            min={0}
                            step={0.25}
                            value={q.negativeMarks}
                            onChange={e => onUpdateNegMarks(parseFloat(e.target.value) || 0)}
                            className="w-24 border border-slate-200 rounded-md px-3 py-1.5 text-sm font-semibold text-red-600 text-center focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none disabled:bg-slate-100 disabled:text-slate-600"
                            disabled={isReadonly}
                        />
                    </div>
                    <div className="ml-auto">
                        <p className="text-sm text-slate-500">
                            Total: <strong className="text-slate-900">{q.marks}</strong> pts | Penalty: <strong className="text-red-600">-{q.negativeMarks}</strong>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
