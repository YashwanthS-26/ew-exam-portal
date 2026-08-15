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
        <div className="min-h-screen bg-[#F8F9FA] flex flex-col relative px-4">
            {/* Top Left Logo */}
            <div className="absolute top-6 left-6 md:top-10 md:left-12 flex items-center gap-3">
                <img src="/logo.png" alt="EW SHIKEN" className="h-8 object-contain" />
            </div>

            {/* Centered Login Card */}
            <div className="flex-1 flex flex-col justify-center items-center">
                <div className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 p-8 md:p-10 w-full max-w-[480px]">
                    <div className="mb-8">
                        <p className="text-slate-500 text-sm font-medium mb-1">Please enter your details</p>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome back</h1>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        {/* Email Input */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-slate-700" htmlFor="email">Email address</label>
                            <input
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                id="email"
                                name="email"
                                placeholder="Enter your email"
                                required
                                type="email"
                            />
                        </div>

                        {/* Password Input */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-slate-700" htmlFor="password">Password</label>
                            <input
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                id="password"
                                name="password"
                                placeholder="••••••••"
                                required
                                type="password"
                            />
                        </div>

                        {/* Remember Me & Forgot Password */}
                        <div className="flex items-center justify-between mt-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary accent-primary" 
                                />
                                <span className="text-sm font-medium text-slate-600">Remember for 30 days</span>
                            </label>
                            <button type="button" onClick={() => toast("Forgot password functionality coming soon")} className="text-sm font-medium text-primary hover:underline">
                                Forgot password
                            </button>
                        </div>

                        {/* Primary Action */}
                        <button
                            disabled={loading}
                            className="mt-2 w-full bg-primary text-white py-3 px-6 rounded-lg text-sm font-medium hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-60"
                            type="submit"
                        >
                            {loading ? 'Signing in...' : 'Sign in'}
                        </button>
                    </form>

                    {/* Bottom Links */}
                    <div className="mt-8 text-center">
                        <p className="text-sm font-medium text-slate-500">
                            Don't have an account?{' '}
                            <button type="button" onClick={() => toast("Please contact super-admin to create an account")} className="text-primary hover:underline">
                                Sign up
                            </button>
                        </p>
                    </div>
                </div>

                {/* Demo Credentials */}
                <div className="mt-8 text-center">
                    <p className="text-xs font-semibold text-slate-400 bg-white inline-block px-3 py-1.5 rounded-md border border-slate-200 shadow-sm">
                        Demo: admin@gmail.com / 12345678
                    </p>
                </div>
            </div>
        </div>
    );
}
