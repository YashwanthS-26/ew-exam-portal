import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Mail, Lock, ArrowRight, Database } from 'lucide-react';

export default function AdminLogin() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('admin@gmail.com');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post('/auth/login', { email, password });
            const { token, user } = res.data;
            localStorage.setItem('auth_token', token);
            localStorage.setItem('auth_user', JSON.stringify(user));
            toast.success(`Welcome back, ${user.full_name || user.email}!`);
            navigate('/dashboard');
        } catch (err: any) {
            const msg = err?.response?.data?.error || 'Login failed. Please try again.';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-slate-50 text-slate-900 antialiased h-screen w-full flex overflow-hidden">
            {/* Left Side: Login Form Canvas */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 md:px-16 py-12 bg-white z-10 relative shadow-[10px_0_15px_-5px_rgba(0,0,0,0.02)]">
                <div className="max-w-[440px] w-full mx-auto">
                    {/* Brand Anchor */}
                    <div className="mb-12 flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center border border-slate-200">
                            <Database className="text-primary" size={24} />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">EW SHIKEN</h1>
                    </div>
                    {/* Intent Header */}
                    <div className="mb-10">
                        <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Welcome Back</h2>
                        <p className="text-base font-medium text-slate-500">Sign in to the enterprise admin portal to manage assessments.</p>
                    </div>
                    {/* Transactional Form */}
                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        {/* Email Input */}
                        <div className="flex flex-col gap-2 relative">
                            <label className="text-sm font-semibold text-slate-700" htmlFor="email">Email Address</label>
                            <div className="relative flex items-center">
                                <Mail className="absolute left-3.5 text-slate-400 pointer-events-none" size={18} />
                                <input
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                                    id="email"
                                    name="email"
                                    placeholder="admin@gmail.com"
                                    required
                                    type="email"
                                />
                            </div>
                        </div>
                        {/* Password Input */}
                        <div className="flex flex-col gap-2 relative">
                            <label className="text-sm font-semibold text-slate-700" htmlFor="password">Password</label>
                            <div className="relative flex items-center">
                                <Lock className="absolute left-3.5 text-slate-400 pointer-events-none" size={18} />
                                <input
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                                    id="password"
                                    name="password"
                                    placeholder="••••••••"
                                    required
                                    type="password"
                                />
                            </div>
                        </div>
                        {/* Primary Action */}
                        <button
                            disabled={loading}
                            className="mt-4 w-full bg-primary text-white py-3 px-6 rounded-lg text-sm font-bold hover:bg-black active:scale-[0.99] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
                            type="submit"
                        >
                            {loading ? 'Signing In...' : 'Sign In'}
                            <ArrowRight size={18} />
                        </button>
                    </form>
                    {/* Support Footer */}
                    <div className="mt-12 pt-8 border-t border-slate-100 text-center">
                        <p className="text-xs font-semibold text-slate-400 bg-slate-50 inline-block px-3 py-1.5 rounded-md border border-slate-200">
                            Demo: admin@gmail.com / 12345678
                        </p>
                    </div>
                </div>
            </div>
            {/* Right Side: Environmental Visual */}
            <div className="hidden lg:flex w-1/2 bg-slate-50 relative overflow-hidden items-center justify-center border-l border-slate-200">
                <div className="absolute inset-0 w-full h-full bg-cover bg-center opacity-[0.85] transition-opacity duration-1000 mix-blend-multiply" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCwKtBRavz1UgLm6yzO_3xqLv7EVTdX49Fb1CNcUZTS8HHvhPZgRkgpPuuSxxa6o1qPKCXwd2Atb9xZf2KHROQjsxFLMIKNjOReqx9kuUqGwEjne2uasDX5UTCTm3_Mr5bM_TAzrFdL-srp8C4uFb7GRSZXFSVCxe0WX_HG-1AS0nHesx3L28HbcC-nsuEqa6HqihKJCqtSBC12-Yj6Ofy2a6driOzw_XIZgWFQhoORkLf9Vt3muGct2J-nZrzFYKrlbPgkyJXb1JY')" }}>
                </div>
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-slate-100/30 to-transparent pointer-events-none"></div>
            </div>
        </div>
    );
}
