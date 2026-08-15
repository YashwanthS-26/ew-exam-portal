import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { 
    FileQuestion, Search, Plus, Filter, MoreVertical, 
    Upload, Download, Trash2, Edit2, Copy, BookOpen,
    Folder, ArrowLeft, FolderPlus, PlusCircle
} from 'lucide-react';
import QuestionBankImporter from '../components/QuestionBankImporter';
import AddQuestionModal from '../components/AddQuestionModal';

type Category = { id: string; name: string; description?: string; question_count?: number };
type Question = {
    id: string; category_id: string; question_text: string;
    option_a: string; option_b: string; option_c: string; option_d: string;
    correct_option: string; marks: number; negative_marks: number;
    difficulty: string; created_at: string;
    category?: Category;
};

export default function QuestionBank() {
    const navigate = useNavigate();
    const { categoryId } = useParams<{ categoryId: string }>();
    
    const [questions, setQuestions] = useState<Question[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [uncategorizedCount, setUncategorizedCount] = useState(0);
    const [loading, setLoading] = useState(true);
    
    // Filters for questions
    const [search, setSearch] = useState('');
    const [selectedDifficulty, setSelectedDifficulty] = useState<string>('ALL');

    const [showImporter, setShowImporter] = useState(false);
    const [showAddQuestion, setShowAddQuestion] = useState(false);
    
    // Create Category Modal state
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [creatingCategory, setCreatingCategory] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (categoryId) {
                // We are inside a category, fetch questions for this category
                const qRes = await api.get(`/question-bank?category_id=${categoryId}`);
                setQuestions(qRes.data || []);
                // Also need categories just for the title
                if (categories.length === 0) {
                    const cRes = await api.get('/question-bank/categories');
                    setCategories(cRes.data?.categories || []);
                    setUncategorizedCount(cRes.data?.uncategorizedCount || 0);
                }
            } else {
                // Top level, fetch only categories
                const cRes = await api.get('/question-bank/categories');
                setCategories(cRes.data?.categories || []);
                setUncategorizedCount(cRes.data?.uncategorizedCount || 0);
            }
        } catch (err: any) {
            toast.error('Failed to load Question Bank data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        setSearch('');
    }, [categoryId]);

    const handleCreateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;
        setCreatingCategory(true);
        try {
            await api.post('/question-bank/categories', { name: newCategoryName });
            toast.success('Category created');
            setShowCategoryModal(false);
            setNewCategoryName('');
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to create category');
        } finally {
            setCreatingCategory(false);
        }
    };

    const handleDeleteCategory = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this category? Questions inside will become uncategorized.')) return;
        try {
            await api.delete(`/question-bank/categories/${id}`);
            toast.success('Category deleted');
            fetchData();
        } catch (err) {
            toast.error('Failed to delete category');
        }
    };

    const handleDeleteQuestion = async (id: string) => {
        if (!confirm('Are you sure you want to delete this question? This will not affect exams that already imported it.')) return;
        try {
            await api.delete(`/question-bank/${id}`);
            toast.success('Question deleted');
            setQuestions(prev => prev.filter(q => q.id !== id));
        } catch (e: any) {
            toast.error('Failed to delete question');
        }
    };

    const handleDuplicateQuestion = async (q: Question) => {
        try {
            const res = await api.post('/question-bank', {
                ...q,
                question_text: q.question_text + ' (Copy)'
            });
            setQuestions([res.data, ...questions]);
            toast.success('Question duplicated');
        } catch (e: any) {
            toast.error('Failed to duplicate question');
        }
    };

    const exportToCSV = () => {
        const headers = ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Option', 'Marks', 'Negative Marks', 'Difficulty'];
        const csvContent = [
            headers.join(','),
            ...filteredQuestions.map(q => [
                `"${q.question_text.replace(/"/g, '""')}"`,
                `"${q.option_a.replace(/"/g, '""')}"`,
                `"${q.option_b.replace(/"/g, '""')}"`,
                `"${(q.option_c || '').replace(/"/g, '""')}"`,
                `"${(q.option_d || '').replace(/"/g, '""')}"`,
                q.correct_option,
                q.marks,
                q.negative_marks,
                q.difficulty
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'question_bank_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredQuestions = questions.filter(q => {
        const matchesSearch = q.question_text.toLowerCase().includes(search.toLowerCase());
        const matchesDiff = selectedDifficulty === 'ALL' || q.difficulty === selectedDifficulty;
        return matchesSearch && matchesDiff;
    });

    const activeCategory = categoryId ? categories.find(c => c.id === categoryId) : null;

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-10 shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                    {categoryId ? (
                        <button onClick={() => navigate('/question-bank')} className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center transition-colors">
                            <ArrowLeft size={20} className="text-slate-600" />
                        </button>
                    ) : (
                        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                            <BookOpen size={22} className="text-indigo-600" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 leading-tight">
                            {categoryId ? activeCategory?.name || 'Category' : 'Question Bank Categories'}
                        </h1>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">
                            {categoryId ? 'Manage questions within this category' : 'Select a category to view questions'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {categoryId ? (
                        <>
                            <button 
                                onClick={exportToCSV}
                                className="text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-md transition-colors shadow-sm flex items-center gap-2 hidden md:flex"
                            >
                                <Download size={16} /> Export
                            </button>
                            <button 
                                onClick={() => setShowImporter(true)}
                                className="text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 px-4 py-2 rounded-md transition-colors shadow-sm flex items-center gap-2"
                            >
                                <Upload size={16} /> Import
                            </button>
                            <button 
                                onClick={() => setShowAddQuestion(true)}
                                className="text-sm font-medium text-white bg-primary hover:bg-black px-4 py-2 rounded-md transition-colors shadow-sm flex items-center gap-2"
                            >
                                <PlusCircle size={16} /> Add Question
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={() => setShowCategoryModal(true)}
                            className="text-sm font-medium text-white bg-primary hover:bg-black px-4 py-2 rounded-md transition-colors shadow-sm flex items-center gap-2"
                        >
                            <FolderPlus size={16} /> Create Category
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="max-w-6xl mx-auto flex flex-col gap-6">
                    
                    {!categoryId ? (
                        /* CATEGORIES GRID VIEW */
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {/* "All Questions" virtual category if needed, or just Uncategorized */}
                            <div 
                                onClick={() => navigate('/question-bank/category/uncategorized')}
                                className="bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md rounded-xl p-5 cursor-pointer transition-all flex flex-col h-32 group"
                            >
                                <div className="flex items-start justify-between mb-auto">
                                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                        <Folder size={20} />
                                    </div>
                                </div>
                                <div className="flex items-end justify-between">
                                    <h3 className="font-bold text-slate-800 text-lg truncate pr-2">Uncategorized</h3>
                                    <span className="text-sm font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{uncategorizedCount} Qs</span>
                                </div>
                            </div>

                            {categories.map(cat => (
                                <div 
                                    key={cat.id}
                                    onClick={() => navigate(`/question-bank/category/${cat.id}`)}
                                    className="bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md rounded-xl p-5 cursor-pointer transition-all flex flex-col h-32 group relative"
                                >
                                    <div className="flex items-start justify-between mb-auto">
                                        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                            <Folder size={20} />
                                        </div>
                                        <button 
                                            onClick={(e) => handleDeleteCategory(e, cat.id)}
                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <h3 className="font-bold text-slate-800 text-lg truncate pr-2">{cat.name}</h3>
                                        <span className="text-sm font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{cat.question_count || 0} Qs</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* QUESTIONS LIST VIEW */
                        <>
                            {/* Filters Bar */}
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center justify-between">
                                <div className="flex gap-4 flex-wrap">
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
                                        value={selectedDifficulty} 
                                        onChange={e => setSelectedDifficulty(e.target.value)}
                                        className="px-3 py-2 text-sm border border-slate-200 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700 bg-white"
                                    >
                                        <option value="ALL">All Difficulties</option>
                                        <option value="Easy">Easy</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Hard">Hard</option>
                                    </select>
                                </div>
                                <div className="text-sm font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-md">
                                    {filteredQuestions.length} Questions
                                </div>
                            </div>

                            {/* Question List */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                {filteredQuestions.length === 0 ? (
                                    <div className="p-12 text-center text-slate-500">
                                        <FileQuestion size={48} className="mx-auto mb-4 text-slate-300 stroke-1" />
                                        <p className="text-lg font-medium text-slate-900 mb-1">No questions found</p>
                                        <p className="text-sm">Add questions manually or import them to this category.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                                                    <th className="p-4 pl-6">Question</th>
                                                    <th className="p-4">Difficulty</th>
                                                    <th className="p-4">Marks</th>
                                                    <th className="p-4 text-right pr-6">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredQuestions.map(q => (
                                                    <tr key={q.id} className="hover:bg-slate-50/50 transition-colors group">
                                                        <td className="p-4 pl-6">
                                                            <p className="text-sm font-medium text-slate-900 line-clamp-2" title={q.question_text}>
                                                                {q.question_text}
                                                            </p>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                                q.difficulty === 'Easy' ? 'bg-emerald-50 text-emerald-700' :
                                                                q.difficulty === 'Medium' ? 'bg-amber-50 text-amber-700' :
                                                                'bg-red-50 text-red-700'
                                                            }`}>
                                                                {q.difficulty}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-sm font-semibold text-slate-600">
                                                            {q.marks}
                                                        </td>
                                                        <td className="p-4 pr-6 text-right">
                                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => handleDuplicateQuestion(q)} title="Duplicate" className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md">
                                                                    <Copy size={16} />
                                                                </button>
                                                                <button onClick={() => handleDeleteQuestion(q.id)} title="Delete" className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md">
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
                        </>
                    )}
                </div>
            </div>

            {/* Create Category Modal */}
            {showCategoryModal && (
                <div className="fixed inset-0 bg-slate-900/40 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-[90vw] sm:w-[400px] overflow-hidden">
                        <form onSubmit={handleCreateCategory}>
                            <div className="p-6">
                                <h3 className="text-lg font-bold text-slate-900 mb-4">Create New Category</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Category Name *</label>
                                        <input 
                                            type="text" 
                                            autoFocus
                                            required
                                            value={newCategoryName}
                                            onChange={e => setNewCategoryName(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                            placeholder="e.g. Physics, Data Structures"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowCategoryModal(false)} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={creatingCategory || !newCategoryName.trim()} className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-black transition-colors disabled:opacity-50">
                                    {creatingCategory ? 'Creating...' : 'Create Category'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showImporter && (
                <QuestionBankImporter 
                    categoryId={categoryId === 'uncategorized' ? undefined : categoryId}
                    onClose={() => setShowImporter(false)} 
                    onSuccess={() => {
                        setShowImporter(false);
                        fetchData();
                    }} 
                />
            )}

            {showAddQuestion && (
                <AddQuestionModal 
                    categoryId={categoryId}
                    onClose={() => setShowAddQuestion(false)}
                    onSuccess={() => {
                        setShowAddQuestion(false);
                        fetchData();
                    }}
                />
            )}
        </div>
    );
}
