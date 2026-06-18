import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';

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
        <div className="bg-surface-container-lowest text-on-surface antialiased h-screen w-full flex overflow-hidden">
            {/* Left Side: Login Form Canvas */}
            <div className="w-full md:w-1/2 flex flex-col justify-center px-gutter md:px-xl py-lg bg-surface-container-lowest z-10 relative shadow-[10px_0_15px_-5px_rgba(0,0,0,0.02)]">
                <div className="max-w-[440px] w-full mx-auto">
                    {/* Brand Anchor */}
                    <div className="mb-xl flex items-center gap-xs">
                        <span className="material-symbols-outlined text-primary text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            dataset
                        </span>
                        <h1 className="font-display text-headline-md font-bold text-primary tracking-tight">Enlight Wisdom</h1>
                    </div>
                    {/* Intent Header */}
                    <div className="mb-lg">
                        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Welcome Back</h2>
                        <p className="font-body-md text-body-md text-on-surface-variant">Sign in to the enterprise admin portal to manage assessments.</p>
                    </div>
                    {/* Transactional Form */}
                    <form onSubmit={handleSubmit} className="flex flex-col gap-md">
                        {/* Email Input */}
                        <div className="flex flex-col gap-base relative">
                            <label className="font-label-md text-label-md text-on-surface" htmlFor="email">Email Address</label>
                            <div className="relative flex items-center">
                                <span className="material-symbols-outlined absolute left-3 text-outline-variant pointer-events-none text-[20px]">
                                    mail
                                </span>
                                <input
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-3 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                                    id="email"
                                    name="email"
                                    placeholder="admin@gmail.com"
                                    required
                                    type="email"
                                />
                            </div>
                        </div>
                        {/* Password Input */}
                        <div className="flex flex-col gap-base relative">
                            <label className="font-label-md text-label-md text-on-surface" htmlFor="password">Password</label>
                            <div className="relative flex items-center">
                                <span className="material-symbols-outlined absolute left-3 text-outline-variant pointer-events-none text-[20px]">
                                    lock
                                </span>
                                <input
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-3 py-3 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
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
                            className="w-full bg-primary text-on-primary py-3 px-6 rounded-lg font-label-md text-label-md font-semibold hover:bg-on-primary-fixed-variant active:scale-[0.98] transition-all shadow-[0_1px_3px_rgba(0,0,0,0.1),_0_10px_15px_-5px_rgba(0,0,0,0.1)] flex items-center justify-center gap-2 disabled:opacity-60"
                            type="submit"
                        >
                            {loading ? 'Signing In...' : 'Sign In'}
                            <span className="material-symbols-outlined text-[20px]">
                                arrow_forward
                            </span>
                        </button>
                    </form>
                    {/* Support Footer */}
                    <div className="mt-xl pt-lg border-t border-outline-variant/30 text-center">
                        <p className="font-body-md text-label-sm text-on-surface-variant">
                            Default: admin@gmail.com / 12345678
                        </p>
                    </div>
                </div>
            </div>
            {/* Right Side: Environmental Visual */}
            <div className="hidden md:flex w-1/2 bg-surface-container relative overflow-hidden items-center justify-center border-l border-outline-variant/20">
                <div className="absolute inset-0 w-full h-full bg-cover bg-center opacity-90 transition-opacity duration-1000 mix-blend-multiply" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCwKtBRavz1UgLm6yzO_3xqLv7EVTdX49Fb1CNcUZTS8HHvhPZgRkgpPuuSxxa6o1qPKCXwd2Atb9xZf2KHROQjsxFLMIKNjOReqx9kuUqGwEjne2uasDX5UTCTm3_Mr5bM_TAzrFdL-srp8C4uFb7GRSZXFSVCxe0WX_HG-1AS0nHesx3L28HbcC-nsuEqa6HqihKJCqtSBC12-Yj6Ofy2a6driOzw_XIZgWFQhoORkLf9Vt3muGct2J-nZrzFYKrlbPgkyJXb1JY')" }}>
                </div>
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-surface-container/50 to-transparent pointer-events-none"></div>
            </div>
        </div>
    );
}
