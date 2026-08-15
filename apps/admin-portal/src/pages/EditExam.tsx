import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { 
    Save, 
    Menu, 
    ArrowRight, 
    Clock, 
    List, 
    Eye, 
    EyeOff, 
    FilePlus, 
    Shuffle,
    LayoutTemplate,
    RefreshCw,
    ArrowLeft
} from 'lucide-react';

export default function EditExam() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const [loading, setLoading] = useState(true);
    const [examData, setExamData] = useState({
        title: '',
        description: '',
        exam_code: '',
        duration_minutes: 60,
        cooldown_minutes: 0,
        total_questions_pool: 0,
        randomization_enabled: true,
        show_results_to_students: false,
    });
    
    useEffect(() => {
        const fetchExam = async () => {
            try {
                const res = await api.get(`/exams/${id}`);
                setExamData({
                    title: res.data.title || '',
                    description: res.data.description || '',
                    exam_code: res.data.exam_code || '',
                    duration_minutes: res.data.duration_minutes || 60,
                    cooldown_minutes: res.data.cooldown_minutes || 0,
                    total_questions_pool: res.data.total_questions_pool || 0,
                    randomization_enabled: res.data.randomization_enabled ?? true,
                    show_results_to_students: res.data.show_results_to_students ?? false,
                });
                setLoading(false);
            } catch (err: any) {
                toast.error('Failed to load exam details');
                navigate('/exams');
            }
        };
        fetchExam();
    }, [id, navigate]);

    const generateCode = () => {
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        setExamData({ ...examData, exam_code: code });
    };

    const handleSave = async () => {
        try {
            await api.patch(`/exams/${id}`, examData);
            toast.success('Exam updated successfully!');
            navigate('/exams');
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Failed to update exam');
        }
    };

    if (loading) return <div className="p-8 text-slate-500">Loading...</div>;

    return (
        <div className="flex flex-col h-full bg-background relative">
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-10 shadow-sm shrink-0 sticky top-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/exams')} className="text-slate-500 p-2 rounded-md hover:bg-slate-50 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 leading-tight">Edit Exam</h1>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">Settings</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleSave} 
                        className="text-sm font-medium text-white bg-primary hover:bg-black px-4 py-2 rounded-md transition-colors shadow-sm flex items-center gap-2"
                    >
                        <span>Save Changes</span>
                        <Save size={16} />
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="max-w-7xl mx-auto flex gap-8 items-start h-full">
                    {/* Main Form */}
                    <div className="flex-1 w-full flex flex-col gap-6 max-w-3xl">
                        {/* Basic Details */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="h-2 w-full bg-primary"></div>
                            <div className="p-6 md:p-8 flex flex-col gap-6">
                                <div>
                                    <input 
                                        value={examData.title} 
                                        onChange={e => setExamData({...examData, title: e.target.value})} 
                                        className="w-full text-3xl font-bold text-slate-900 placeholder:text-slate-300 border-none focus:ring-0 p-0 focus:outline-none" 
                                        placeholder="Exam Title" 
                                        type="text" 
                                    />
                                </div>
                                <div>
                                    <textarea 
                                        value={examData.description} 
                                        onChange={e => setExamData({...examData, description: e.target.value})} 
                                        className="w-full text-base text-slate-600 placeholder:text-slate-400 border-none focus:ring-0 p-0 focus:outline-none resize-none" 
                                        placeholder="Exam Description (Optional)" 
                                        rows={2}
                                    ></textarea>
                                </div>
                                <div className="mt-2 pt-4 border-t border-slate-100">
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Access Code (4 Digits)</label>
                                    <div className="flex gap-2 sm:w-1/2">
                                        <input 
                                            value={examData.exam_code} 
                                            onChange={e => {
                                                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                                setExamData({...examData, exam_code: val});
                                            }} 
                                            className="w-full rounded-md border border-slate-200 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary px-3 py-2 outline-none transition-all font-mono tracking-widest text-lg" 
                                            placeholder="e.g. 1234" 
                                            type="text" 
                                            maxLength={4}
                                        />
                                        <button 
                                            onClick={generateCode}
                                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-md border border-slate-200 transition-colors flex items-center gap-2 shrink-0"
                                            title="Generate Random Code"
                                        >
                                            <RefreshCw size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Timing & Access */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 flex flex-col gap-6">
                            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                                <Clock className="text-primary" size={24} />
                                <h2 className="text-lg font-semibold text-slate-900">Timing & Access</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Duration (Minutes)</label>
                                    <input 
                                        value={examData.duration_minutes} 
                                        onChange={e => setExamData({...examData, duration_minutes: parseInt(e.target.value) || 0})} 
                                        className="w-full rounded-md border border-slate-200 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary px-3 py-2 outline-none transition-all bg-slate-50" 
                                        min="1" 
                                        placeholder="60" 
                                        type="number" 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Question Settings */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 flex flex-col gap-6">
                            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                                <List className="text-primary" size={24} />
                                <h2 className="text-lg font-semibold text-slate-900">Question Settings</h2>
                            </div>
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-slate-50">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-900">Question Pool Size</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Limit how many questions are drawn from the total pool (0 = all).</p>
                                    </div>
                                    <input 
                                        value={examData.total_questions_pool} 
                                        onChange={e => setExamData({...examData, total_questions_pool: parseInt(e.target.value) || 0})} 
                                        className="w-20 rounded-md border border-slate-200 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary px-2 py-1.5 outline-none transition-all text-center bg-white" 
                                        min="0" 
                                        placeholder="All" 
                                        type="number" 
                                    />
                                </div>
                                <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-slate-50">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-900">Randomize Question Order</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Each student sees a different sequence.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            checked={examData.randomization_enabled} 
                                            onChange={e => setExamData({...examData, randomization_enabled: e.target.checked})} 
                                            className="sr-only peer" 
                                            type="checkbox" 
                                        />
                                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-offset-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Result Settings */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 flex flex-col gap-6">
                            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                                <Eye className="text-primary" size={24} />
                                <h2 className="text-lg font-semibold text-slate-900">Result Settings</h2>
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-slate-50">
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900">Show Results to Students</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Allow students to see their score immediately after submission.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        checked={examData.show_results_to_students} 
                                        onChange={e => setExamData({...examData, show_results_to_students: e.target.checked})} 
                                        className="sr-only peer" 
                                        type="checkbox" 
                                    />
                                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-offset-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Live Summary Sidebar */}
                    <aside className="hidden lg:block w-80 shrink-0 sticky top-6">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex justify-between items-center">
                                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                    <LayoutTemplate size={16} className="text-slate-500" />
                                    Live Summary
                                </h3>
                                <span className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold px-2 py-1 rounded">Edit Mode</span>
                            </div>
                            <div className="p-5 flex flex-col gap-4">
                                <div>
                                    <p className="text-xs font-medium text-slate-500 mb-1">Title</p>
                                    <p className="text-sm font-semibold text-slate-900 truncate" title={examData.title || 'Untitled'}>
                                        {examData.title || 'Untitled'}
                                    </p>
                                </div>
                                <hr className="border-slate-100" />
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1">
                                            <Clock size={14} className="text-slate-400" /> Duration
                                        </p>
                                        <p className="text-sm font-medium text-slate-900">{examData.duration_minutes || 0} mins</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1">
                                            <List size={14} className="text-slate-400" /> Pool
                                        </p>
                                        <p className="text-sm font-medium text-slate-900">
                                            {examData.total_questions_pool > 0 ? examData.total_questions_pool : 'All'} Qs
                                        </p>
                                    </div>
                                </div>
                                <hr className="border-slate-100" />
                                <div className="flex flex-wrap gap-2">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${examData.randomization_enabled ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                        <Shuffle size={14} className={examData.randomization_enabled ? "text-primary" : "text-slate-400"} /> 
                                        Randomize
                                    </span>
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${examData.show_results_to_students ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                        {examData.show_results_to_students ? <Eye size={14} className="text-emerald-600" /> : <EyeOff size={14} className="text-slate-400" />}
                                        Results {examData.show_results_to_students ? 'Shown' : 'Hidden'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}
