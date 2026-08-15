import React, { useState, useEffect } from 'react';
import { X, Search, CheckSquare, Square, DownloadCloud } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

interface ImporterProps {
    onClose: () => void;
    onImport: (questions: any[]) => void;
    existingQuestionTextList: string[];
}

export default function ExamQuestionImporter({ onClose, onImport, existingQuestionTextList }: ImporterProps) {
    const [questions, setQuestions] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchBank = async () => {
            try {
                const [qRes, cRes] = await Promise.all([
                    api.get('/question-bank'),
                    api.get('/question-bank/categories')
                ]);
                setQuestions(qRes.data || []);
                setCategories(cRes.data?.categories || []);
            } catch (err: any) {
                toast.error('Failed to load Question Bank');
            } finally {
                setLoading(false);
            }
        };
        fetchBank();
    }, []);

    const filteredQuestions = questions.filter(q => {
        const matchesSearch = q.question_text.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = selectedCategory === 'ALL' || q.category_id === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const toggleSelection = (id: string, isAlreadyAdded: boolean) => {
        if (isAlreadyAdded) return;
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleAll = () => {
        const available = filteredQuestions.filter(q => !existingQuestionTextList.includes(q.question_text));
        if (selectedIds.size === available.length && available.length > 0) {
            setSelectedIds(new Set()); // deselect all
        } else {
            setSelectedIds(new Set(available.map(q => q.id))); // select all filtered
        }
    };

    const handleImport = () => {
        const selected = questions.filter(q => selectedIds.has(q.id));
        onImport(selected);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col w-[90vw] max-w-4xl max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <DownloadCloud className="text-indigo-600" size={20} />
                        Import from Question Bank
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 flex flex-col h-full overflow-hidden bg-slate-50">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-4 mb-4 shrink-0 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search questions..." 
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-64 outline-none"
                            />
                        </div>
                        <select 
                            value={selectedCategory} 
                            onChange={e => setSelectedCategory(e.target.value)}
                            className="px-3 py-2 text-sm border border-slate-200 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
                        >
                            <option value="ALL">All Categories</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <div className="ml-auto flex items-center gap-2">
                            <span className="text-sm font-semibold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-md">
                                {selectedIds.size} Selected
                            </span>
                        </div>
                    </div>

                    {/* Question List */}
                    <div className="flex-1 overflow-y-auto bg-white rounded-lg shadow-sm border border-slate-200">
                        {loading ? (
                            <div className="p-10 flex justify-center">
                                <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : filteredQuestions.length === 0 ? (
                            <div className="p-10 text-center text-slate-500 text-sm">
                                No questions found matching your filters.
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold sticky top-0">
                                        <th className="p-3 pl-4 w-10">
                                            <button onClick={toggleAll} className="text-slate-400 hover:text-indigo-600">
                                                {selectedIds.size > 0 ? <CheckSquare size={18} className="text-indigo-600"/> : <Square size={18} />}
                                            </button>
                                        </th>
                                        <th className="p-3">Question</th>
                                        <th className="p-3">Category</th>
                                        <th className="p-3">Marks</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredQuestions.map(q => {
                                        const isSelected = selectedIds.has(q.id);
                                        const isAlreadyAdded = existingQuestionTextList.includes(q.question_text);
                                        return (
                                            <tr 
                                                key={q.id} 
                                                onClick={() => toggleSelection(q.id, isAlreadyAdded)}
                                                className={`transition-colors ${isAlreadyAdded ? 'bg-slate-50 opacity-60 cursor-not-allowed' : 'hover:bg-slate-50/50 cursor-pointer'} ${isSelected ? 'bg-indigo-50/30' : ''}`}
                                            >
                                                <td className="p-3 pl-4">
                                                    {isAlreadyAdded ? (
                                                        <span className="text-xs font-bold text-slate-400 uppercase">Added</span>
                                                    ) : (
                                                        <div className="text-slate-400">
                                                            {isSelected ? <CheckSquare size={18} className="text-indigo-600"/> : <Square size={18} />}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3 text-sm text-slate-900 font-medium">
                                                    <div className="line-clamp-2" title={q.question_text}>{q.question_text}</div>
                                                </td>
                                                <td className="p-3 text-sm text-slate-500">
                                                    {q.category?.name || '-'}
                                                </td>
                                                <td className="p-3 text-sm text-slate-500 font-semibold">
                                                    {q.marks}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0 bg-white rounded-b-xl">
                    <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button 
                        onClick={handleImport}
                        disabled={selectedIds.size === 0}
                        className="px-6 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
                    >
                        Import {selectedIds.size} Questions
                    </button>
                </div>
            </div>
        </div>
    );
}
