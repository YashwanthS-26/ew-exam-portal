import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { X, Upload, CheckCircle2, AlertCircle, FileSpreadsheet, Download } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

interface ImporterProps {
    onClose: () => void;
    onSuccess: () => void;
    categoryId?: string;
}

type ParsedRow = {
    Question: string; A: string; B: string; C: string; D: string;
    Answer: string; Marks: number; Category: string; Tags: string; Difficulty: string;
};

type ValidationResult = {
    isValid: boolean;
    errors: string[];
    data: any;
};

export default function QuestionBankImporter({ onClose, onSuccess, categoryId }: ImporterProps) {
    const [step, setStep] = useState(1);
    const [results, setResults] = useState<ValidationResult[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isCSV = file.name.endsWith('.csv');
        const isExcel = file.name.match(/\.(xlsx|xls)$/);

        if (isCSV) {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    validateData(results.data as any[]);
                }
            });
        } else if (isExcel) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);
                validateData(data);
            };
            reader.readAsBinaryString(file);
        } else {
            toast.error('Unsupported file format. Please upload a CSV or Excel file.');
        }
    };

    const validateData = (data: any[]) => {
        const validated = data.map((row, index) => {
            const errors: string[] = [];
            const r = row as ParsedRow;
            
            if (!r.Question?.trim()) errors.push('Question text is missing');
            if (!r.A?.trim()) errors.push('Option A is missing');
            if (!r.B?.trim()) errors.push('Option B is missing');
            if (!r.Answer?.trim()) errors.push('Correct Answer is missing');
            else if (!['A', 'B', 'C', 'D'].includes(r.Answer.trim().toUpperCase())) {
                errors.push('Correct Answer must be A, B, C, or D');
            }
            if (r.Marks !== undefined && isNaN(Number(r.Marks))) {
                errors.push('Marks must be a number');
            }

            return {
                isValid: errors.length === 0,
                errors,
                data: {
                    question_text: r.Question || '',
                    option_a: r.A || '',
                    option_b: r.B || '',
                    option_c: r.C || '',
                    option_d: r.D || '',
                    correct_option: r.Answer?.toUpperCase() || 'A',
                    marks: Number(r.Marks) || 1,
                    negative_marks: 0,
                    difficulty: r.Difficulty || 'Medium',
                    category_id: categoryId || null
                }
            };
        });

        setResults(validated);
        setStep(2);
    };

    const validCount = results.filter(r => r.isValid).length;
    const errorCount = results.length - validCount;

    const handleImport = async () => {
        const validData = results.filter(r => r.isValid).map(r => r.data);
        if (validData.length === 0) {
            toast.error('No valid questions to import');
            return;
        }

        setUploading(true);
        try {
            await api.post('/question-bank/import', { questions: validData });
            toast.success(`${validData.length} questions imported successfully!`);
            onSuccess();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Import failed');
        } finally {
            setUploading(false);
        }
    };

    const downloadTemplate = () => {
        const headers = ['Question', 'A', 'B', 'C', 'D', 'Answer', 'Marks', 'Category', 'Difficulty'];
        const sample = ['What is TCP?', 'Transmission Control Protocol', 'Transfer Control Protocol', 'Test Protocol', 'None', 'A', '1', 'Networking', 'Medium'];
        const csv = [headers.join(','), sample.map(s => `"${s}"`).join(',')].join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'question_import_template.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col w-[90vw] max-w-3xl max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <FileSpreadsheet className="text-indigo-600" size={20} />
                        Bulk Import Questions
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                    {step === 1 && (
                        <div className="flex flex-col items-center justify-center text-center py-10">
                            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6">
                                <Upload size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 mb-2">Upload your file</h2>
                            <p className="text-slate-500 mb-8 max-w-sm">
                                Import questions via CSV or Excel format. Download our template to ensure your data is formatted correctly.
                            </p>
                            
                            <div className="flex gap-4">
                                <button onClick={downloadTemplate} className="flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors text-sm">
                                    <Download size={18} />
                                    Download Template
                                </button>
                                <label className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors text-sm cursor-pointer shadow-sm">
                                    <Upload size={18} />
                                    Select File
                                    <input 
                                        type="file" 
                                        accept=".csv, .xlsx, .xls" 
                                        className="hidden" 
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                    />
                                </label>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="flex flex-col h-full">
                            <div className="grid grid-cols-2 gap-4 mb-6 shrink-0">
                                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                                        <CheckCircle2 size={20} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-emerald-900">Ready to Import</p>
                                        <p className="text-2xl font-bold text-emerald-700">{validCount}</p>
                                    </div>
                                </div>
                                <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center gap-3">
                                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                                        <AlertCircle size={20} className="text-red-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-red-900">Errors Found</p>
                                        <p className="text-2xl font-bold text-red-700">{errorCount}</p>
                                    </div>
                                </div>
                            </div>

                            {errorCount > 0 && (
                                <div className="mb-4">
                                    <h4 className="font-semibold text-slate-800 text-sm mb-3">Validation Errors (Rows will be skipped)</h4>
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                                        {results.map((r, i) => !r.isValid && (
                                            <div key={i} className="p-3 border-b border-slate-100 text-sm">
                                                <strong className="text-slate-700">Row {i + 2}: </strong>
                                                <span className="text-red-600">{r.errors.join(', ')}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-auto bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <p className="text-sm text-slate-600 mb-4">
                                    <strong>{validCount}</strong> valid questions will be imported into the Question Bank. Invalid rows will be ignored.
                                </p>
                                <div className="flex gap-3 justify-end">
                                    <button onClick={() => setStep(1)} className="px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors">
                                        Back
                                    </button>
                                    <button 
                                        onClick={handleImport}
                                        disabled={validCount === 0 || uploading}
                                        className="px-6 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        {uploading ? 'Importing...' : `Import ${validCount} Questions`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
