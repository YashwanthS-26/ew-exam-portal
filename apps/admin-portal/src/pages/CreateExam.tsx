import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';

export default function CreateExam() {
    const navigate = useNavigate();
    const [examData, setExamData] = useState({
        title: 'Midterm Assessment 2024',
        description: '',
        exam_code: '',
        duration_minutes: 60,
        cooldown_minutes: 0,
        total_questions_pool: 0,
        randomization_enabled: true,
        show_results_to_students: false,
    });
    
    const [savedId, setSavedId] = useState<string | null>(null);

    const handleSave = async () => {
        try {
            const res = await api.post('/exams', examData);
            const newId = res.data.id;
            setSavedId(newId);
            toast.success('Exam created! Now add your questions.');
            navigate(`/exams/${newId}/questions`);
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Failed to create exam');
        }
    };

    return (
        <div className="flex flex-col h-full relative">
                <header className="bg-surface-container-lowest border-b border-outline-variant/30 px-lg py-sm flex justify-between items-center z-10 shadow-sm shrink-0">
                    <div className="flex items-center gap-4">
                        <button className="md:hidden text-on-surface-variant p-2 rounded-full hover:bg-surface-container-low">
                            <span className="material-symbols-outlined">menu</span>
                        </button>
                        <div>
                            <h1 className="font-title-lg text-title-lg text-on-surface">Create New Exam</h1>
                            <p className="font-label-sm text-label-sm text-on-surface-variant">Draft</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => toast('Preview not available in draft state.')} className="font-label-md text-label-md text-primary bg-surface hover:bg-surface-container-low px-4 py-2 rounded-lg border border-primary transition-colors">
                            Preview
                        </button>
                        <button onClick={handleSave} className="font-label-md text-label-md text-on-primary bg-primary hover:bg-primary/90 px-4 py-2 rounded-lg transition-colors shadow-sm level-2-shadow flex items-center gap-2">
                            <span>Save Draft</span>
                            <span className="material-symbols-outlined text-[18px]">save</span>
                        </button>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-lg">
                    <div className="max-w-[1280px] mx-auto h-full">
                            <div className="flex-1 w-full flex flex-col gap-md max-w-3xl">
                                <div className="h-3 w-full bg-primary rounded-t-xl -mb-md z-10 relative"></div>
                                <div className="bg-surface-container-lowest rounded-xl p-md md:p-lg shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_15px_-5px_rgba(0,0,0,0.05)] border border-outline-variant/20 relative z-0">
                                    <div className="flex flex-col gap-6">
                                        <div>
                                            <input value={examData.title} onChange={e => setExamData({...examData, title: e.target.value})} className="w-full form-input-minimal font-headline-md text-headline-md text-on-surface placeholder:text-outline focus:ring-0" placeholder="Exam Title" type="text" />
                                        </div>
                                        <div>
                                            <textarea value={examData.description} onChange={e => setExamData({...examData, description: e.target.value})} className="w-full form-input-minimal font-body-md text-body-md text-on-surface-variant placeholder:text-outline focus:ring-0 resize-none" placeholder="Exam Description (Optional)" rows={2}></textarea>
                                        </div>
                                        <div className="mt-2">
                                            <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">Access Code</label>
                                            <input value={examData.exam_code} onChange={e => setExamData({...examData, exam_code: e.target.value})} className="w-1/2 form-input-minimal font-body-md text-body-md text-on-surface focus:ring-0" placeholder="e.g., NEO-2024" type="text" />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-surface-container-lowest rounded-xl p-md md:p-lg shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_15px_-5px_rgba(0,0,0,0.05)] border border-outline-variant/20 flex flex-col gap-6">
                                    <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-4">
                                        <span className="material-symbols-outlined text-primary">schedule</span>
                                        <h2 className="font-title-lg text-title-lg text-on-surface">Timing &amp; Access</h2>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block font-label-md text-label-md text-on-surface mb-2">Duration (Minutes)</label>
                                            <input value={examData.duration_minutes} onChange={e => setExamData({...examData, duration_minutes: parseInt(e.target.value) || 0})} className="w-full rounded-lg border-outline-variant focus:border-primary focus:ring-primary shadow-sm font-body-md text-body-md text-on-surface bg-surface-bright" min="1" placeholder="60" type="number" />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-surface-container-lowest rounded-xl p-md md:p-lg shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_15px_-5px_rgba(0,0,0,0.05)] border border-outline-variant/20 flex flex-col gap-6">
                                    <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-4">
                                        <span className="material-symbols-outlined text-primary">list_alt</span>
                                        <h2 className="font-title-lg text-title-lg text-on-surface">Question Settings</h2>
                                    </div>
                                    <div className="flex flex-col gap-6">
                                        <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-outline-variant/30 bg-surface-bright">
                                            <div>
                                                <h3 className="font-body-md text-body-md font-semibold text-on-surface">Question Pool Size</h3>
                                                <p className="font-label-sm text-label-sm text-on-surface-variant">Limit how many questions are drawn from the total pool.</p>
                                            </div>
                                            <input value={examData.total_questions_pool} onChange={e => setExamData({...examData, total_questions_pool: parseInt(e.target.value) || 0})} className="w-24 rounded-lg border-outline-variant focus:border-primary focus:ring-primary shadow-sm font-body-md text-body-md text-on-surface text-center" min="1" placeholder="All" type="number" />
                                        </div>
                                        <div className="flex items-center justify-between p-4 rounded-lg border border-outline-variant/30 bg-surface-bright">
                                            <div>
                                                <h3 className="font-body-md text-body-md font-semibold text-on-surface">Randomize Question Order</h3>
                                                <p className="font-label-sm text-label-sm text-on-surface-variant">Each student sees a different sequence.</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input checked={examData.randomization_enabled} onChange={e => setExamData({...examData, randomization_enabled: e.target.checked})} className="sr-only peer" type="checkbox" />
                                                <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-container/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-outline-variant after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-surface-container-lowest rounded-xl p-md md:p-lg shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_15px_-5px_rgba(0,0,0,0.05)] border border-outline-variant/20 flex flex-col gap-6">
                                    <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-4">
                                        <span className="material-symbols-outlined text-primary">visibility</span>
                                        <h2 className="font-title-lg text-title-lg text-on-surface">Result Settings</h2>
                                    </div>
                                    <div className="flex items-center justify-between p-4 rounded-lg border border-outline-variant/30 bg-surface-bright">
                                        <div>
                                            <h3 className="font-body-md text-body-md font-semibold text-on-surface">Show Results to Students</h3>
                                            <p className="font-label-sm text-label-sm text-on-surface-variant">Allow students to see their score immediately after submission.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input checked={examData.show_results_to_students} onChange={e => setExamData({...examData, show_results_to_students: e.target.checked})} className="sr-only peer" type="checkbox" />
                                            <div className="w-11 h-6 bg-outline-variant peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-container/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-outline-variant after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                        </label>
                                    </div>
                                </div>
                                <div className="flex gap-4 mt-4">
                                    <button onClick={handleSave} className="flex-1 py-4 bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 font-label-md text-label-md shadow-sm">
                                        <span className="material-symbols-outlined">save</span>
                                        Save Changes
                                    </button>
                                    {savedId && (
                                        <button onClick={() => navigate(`/exams/${savedId}/questions`)} className="flex-1 py-4 bg-surface-container-high text-on-surface rounded-xl hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2 font-label-md text-label-md border border-outline-variant/30">
                                            <span className="material-symbols-outlined">arrow_forward</span>
                                            Continue to Questions
                                        </button>
                                    )}
                                </div>
                            </div>
                            <aside className="hidden lg:block w-80 shrink-0 sticky top-lg">
                                <div className="bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_15px_-5px_rgba(0,0,0,0.05)] border border-outline-variant/20 overflow-hidden">
                                    <div className="bg-surface-container-low px-4 py-3 border-b border-outline-variant/20 flex justify-between items-center">
                                        <h3 className="font-label-md text-label-md font-semibold text-on-surface flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[18px]">preview</span>
                                            Live Summary
                                        </h3>
                                        <span className="bg-secondary-container text-on-secondary-container text-[10px] uppercase font-bold px-2 py-1 rounded">Draft</span>
                                    </div>
                                    <div className="p-4 flex flex-col gap-4">
                                        <div>
                                            <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">Title</p>
                                            <p className="font-body-md text-body-md text-on-surface font-medium truncate" id="preview-title">Midterm Assessment 2024</p>
                                        </div>
                                        <hr className="border-outline-variant/20" />
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">timer</span> Duration</p>
                                                <p className="font-body-md text-body-md text-on-surface">60 mins</p>
                                            </div>
                                            <div>
                                                <p className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">format_list_numbered</span> Pool</p>
                                                <p className="font-body-md text-body-md text-on-surface">All Qs</p>
                                            </div>
                                        </div>
                                        <hr className="border-outline-variant/20" />
                                        <div className="flex flex-wrap gap-2">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-surface-container-high rounded text-xs font-medium text-on-surface">
                                                <span className="material-symbols-outlined text-[14px] text-primary">shuffle</span> Random
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-surface-container-high rounded text-xs font-medium text-on-surface opacity-50 line-through">
                                                <span className="material-symbols-outlined text-[14px]">visibility</span> Results Hidden
                                            </span>
                                        </div>
                                    </div>
                                    <div className="bg-surface-bright p-4 text-center border-t border-outline-variant/20">
                                        <span className="material-symbols-outlined text-outline-variant text-4xl mb-2">post_add</span>
                                        <p className="font-label-sm text-label-sm text-on-surface-variant">No questions added yet.</p>
                                    </div>
                                </div>
                            </aside>
                    </div>
                </div>
        </div>
    );
}
