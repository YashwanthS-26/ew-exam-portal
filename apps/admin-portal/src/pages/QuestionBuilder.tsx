import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';

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
            <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-on-surface-variant font-body-md">Loading questions...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full relative overflow-hidden bg-surface-container-low">
            {/* Header */}
            <header className="flex justify-between items-center w-full px-lg h-16 bg-surface-container-lowest border-b border-outline-variant sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/exams')} className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 font-label-md text-label-md">
                        <span className="material-symbols-outlined">arrow_back</span>
                        <span className="hidden md:inline">Back</span>
                    </button>
                    <div className="h-6 w-px bg-outline-variant hidden md:block" />
                    <div>
                        <h1 className="font-title-md text-title-md text-on-surface leading-tight">Question Builder</h1>
                        <p className="font-label-sm text-label-sm text-on-surface-variant leading-tight">{examTitle}</p>
                    </div>
                    <span className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary font-label-sm text-label-sm rounded-full">
                        <span className="material-symbols-outlined text-[14px]">quiz</span>
                        MCQ Only
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {unsavedCount > 0 && (
                        <span className="font-label-sm text-label-sm text-orange-500 hidden md:block">
                            {unsavedCount} unsaved
                        </span>
                    )}
                    <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container-high px-3 py-1.5 rounded-lg">
                        {questions.length} question{questions.length !== 1 ? 's' : ''}
                    </span>
                    <button
                        onClick={saveAllQuestions}
                        disabled={savingAll}
                        className="font-label-md text-label-md bg-primary text-on-primary hover:bg-primary/90 px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-2 disabled:opacity-60"
                    >
                        {savingAll ? (
                            <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <span className="material-symbols-outlined text-[18px]">save</span>
                        )}
                        Save All
                    </button>
                </div>
            </header>

            {/* Question List */}
            <div className="flex-1 overflow-y-auto p-md md:p-lg pb-32">
                <div className="max-w-[860px] mx-auto flex flex-col gap-lg">
                    {questions.length === 0 ? (
                        <div className="text-center py-20 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 border-dashed">
                            <span className="material-symbols-outlined text-[56px] text-outline-variant block mb-4">quiz</span>
                            <h3 className="font-title-md text-title-md text-on-surface mb-2">No questions yet</h3>
                            <p className="font-body-md text-body-md text-on-surface-variant mb-6">Click the + button below to add your first MCQ question.</p>
                            <button onClick={addQuestion} className="bg-primary text-on-primary font-label-md text-label-md px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 mx-auto">
                                <span className="material-symbols-outlined text-[18px]">add</span>
                                Add First Question
                            </button>
                        </div>
                    ) : (
                        questions.map((q, index) => (
                            <MCQCard
                                key={q.localId}
                                index={index}
                                question={q}
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
            <div className="absolute bottom-6 right-6 md:bottom-8 md:right-8 z-50 flex flex-col items-end gap-3">
                <button
                    onClick={addQuestion}
                    className="w-14 h-14 bg-primary text-on-primary rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
                    title="Add Question"
                >
                    <span className="material-symbols-outlined text-[28px]">add</span>
                </button>
            </div>
        </div>
    );
}

// ─── MCQ Card Component ───────────────────────────────────────────────────────
interface MCQCardProps {
    index: number;
    question: Question;
    onUpdateText: (text: string) => void;
    onUpdateOption: (optId: string, text: string) => void;
    onSetCorrect: (optId: string) => void;
    onUpdateMarks: (marks: number) => void;
    onUpdateNegMarks: (neg: number) => void;
    onSave: () => void;
    onDelete: () => void;
}

function MCQCard({ index, question: q, onUpdateText, onUpdateOption, onSetCorrect, onUpdateMarks, onUpdateNegMarks, onSave, onDelete }: MCQCardProps) {
    return (
        <div className={`bg-surface-container-lowest rounded-2xl border shadow-sm overflow-hidden transition-all ${q.saved ? 'border-green-200' : 'border-orange-200'}`}>
            {/* Card Header */}
            <div className={`px-md py-3 flex items-center justify-between border-b ${q.saved ? 'bg-green-50/50 border-green-100' : 'bg-orange-50/50 border-orange-100'}`}>
                <div className="flex items-center gap-3">
                    <span className="font-label-md text-label-md font-bold bg-primary text-on-primary w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                        {index + 1}
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Multiple Choice Question</span>
                    {q.saved ? (
                        <span className="flex items-center gap-1 text-green-600 font-label-sm text-label-sm">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            Saved
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-orange-500 font-label-sm text-label-sm">
                            <span className="material-symbols-outlined text-[14px]">pending</span>
                            Unsaved
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onSave}
                        disabled={q.saving}
                        className={`px-3 py-1.5 rounded-lg font-label-sm text-label-sm flex items-center gap-1.5 transition-colors ${q.saved ? 'text-green-600 hover:bg-green-50' : 'bg-primary text-on-primary hover:bg-primary/90'}`}
                    >
                        {q.saving ? (
                            <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <span className="material-symbols-outlined text-[14px]">save</span>
                        )}
                        {q.saving ? 'Saving...' : q.saved ? 'Update' : 'Save'}
                    </button>
                    <button onClick={onDelete} className="p-1.5 text-on-surface-variant hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </div>
            </div>

            <div className="p-lg flex flex-col gap-lg">
                {/* Question Text */}
                <div>
                    <label className="font-label-md text-label-md text-on-surface-variant mb-2 block">Question *</label>
                    <textarea
                        value={q.text}
                        onChange={e => onUpdateText(e.target.value)}
                        className="w-full border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none p-4 font-body-lg text-body-lg text-on-surface bg-surface-container-lowest outline-none transition-all"
                        placeholder="Type your question here..."
                        rows={2}
                    />
                </div>

                {/* Options */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <label className="font-label-md text-label-md text-on-surface">Answer Options</label>
                        <span className="font-label-sm text-label-sm text-on-surface-variant">Click the circle to mark correct answer</span>
                    </div>
                    <div className="flex flex-col gap-3">
                        {q.options.map((opt, optIdx) => (
                            <div key={opt.id} className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-all cursor-pointer group ${opt.isCorrect ? 'border-green-400 bg-green-50' : 'border-outline-variant/50 hover:border-outline-variant'}`}
                                onClick={() => onSetCorrect(opt.id)}>
                                {/* Correct indicator */}
                                <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); onSetCorrect(opt.id); }}
                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${opt.isCorrect ? 'border-green-500 bg-green-500' : 'border-outline-variant group-hover:border-green-400'}`}
                                >
                                    {opt.isCorrect && <span className="material-symbols-outlined text-white text-[14px]">check</span>}
                                </button>
                                {/* Option letter */}
                                <span className={`font-label-md text-label-md w-7 h-7 flex items-center justify-center rounded-lg shrink-0 font-bold ${opt.isCorrect ? 'bg-green-500 text-white' : 'bg-surface-container-high text-on-surface-variant'}`}>
                                    {opt.id}
                                </span>
                                {/* Text input */}
                                <input
                                    value={opt.text}
                                    onClick={e => e.stopPropagation()}
                                    onChange={e => onUpdateOption(opt.id, e.target.value)}
                                    className={`flex-1 bg-transparent outline-none font-body-md text-body-md text-on-surface placeholder-on-surface-variant/50`}
                                    placeholder={`Option ${opt.id}...`}
                                />
                                {opt.isCorrect && (
                                    <span className="font-label-sm text-label-sm text-green-600 shrink-0">✓ Correct</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Marks */}
                <div className="flex items-center gap-lg">
                    <div className="flex flex-col gap-1.5">
                        <label className="font-label-sm text-label-sm text-on-surface-variant">Marks</label>
                        <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={q.marks}
                            onChange={e => onUpdateMarks(parseFloat(e.target.value) || 0)}
                            className="w-24 border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md text-on-surface text-center focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="font-label-sm text-label-sm text-on-surface-variant">Negative Marks</label>
                        <input
                            type="number"
                            min={0}
                            step={0.25}
                            value={q.negativeMarks}
                            onChange={e => onUpdateNegMarks(parseFloat(e.target.value) || 0)}
                            className="w-24 border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md text-on-surface text-center focus:border-red-400 focus:ring-1 focus:ring-red-300 outline-none"
                        />
                    </div>
                    <p className="font-label-sm text-label-sm text-on-surface-variant mt-4">
                        Total: <strong>{q.marks}</strong> marks | Penalty: <strong>-{q.negativeMarks}</strong>
                    </p>
                </div>
            </div>
        </div>
    );
}
