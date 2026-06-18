import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

export default function AdminLayout() {
    const navigate = useNavigate();

    return (
        <div className="bg-background text-on-background font-body-md text-body-md h-screen overflow-hidden flex">
            {/* SideNavBar */}
            <aside className="hidden md:flex flex-col h-full border-r border-outline-variant bg-surface docked left-0 h-screen w-64 flex-shrink-0 z-40 transition-all duration-200 ease-in-out">
                <div className="p-md flex items-center gap-3 border-b border-outline-variant/30">
                    <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-on-primary">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
                    </div>
                    <div>
                        <h1 className="font-headline-md text-headline-md font-black text-primary">Enlight Wisdom</h1>
                        <p className="font-label-sm text-label-sm text-on-surface-variant">Enterprise Admin</p>
                    </div>
                </div>
                <div className="p-4">
                    <button onClick={() => navigate('/exams/create')} className="w-full bg-primary hover:bg-primary-container text-on-primary hover:text-on-primary-container font-label-md text-label-md py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm">
                        <span className="material-symbols-outlined">add</span>
                        Create New Exam
                    </button>
                </div>
                <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
                    <NavLink to="/dashboard" className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ease-in-out group ${isActive ? 'bg-secondary-container text-on-secondary-container font-bold' : 'text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md'}`}>
                        <span className="material-symbols-outlined group-hover:scale-110 transition-transform">dashboard</span>
                        <span>Dashboard</span>
                    </NavLink>
                    <NavLink to="/exams" className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ease-in-out group ${isActive ? 'bg-secondary-container text-on-secondary-container font-bold' : 'text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md'}`}>
                        <span className="material-symbols-outlined group-hover:scale-110 transition-transform">assignment</span>
                        <span>Exams</span>
                    </NavLink>
                    <NavLink to="/results" className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ease-in-out group ${isActive ? 'bg-secondary-container text-on-secondary-container font-bold' : 'text-on-surface-variant hover:bg-surface-container-high font-label-md text-label-md'}`}>
                        <span className="material-symbols-outlined group-hover:scale-110 transition-transform">analytics</span>
                        <span>Results</span>
                    </NavLink>
                </nav>
            </aside>
            {/* Main Content Wrapper */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* TopNavBar */}
                <header className="flex justify-between items-center w-full px-md h-16 bg-surface-container-lowest docked full-width top-0 sticky z-50 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button className="md:hidden text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-colors">
                            <span className="material-symbols-outlined">menu</span>
                        </button>
                        <div className="md:hidden font-display text-headline-md font-bold text-primary">Enlight Wisdom</div>
                        <div className="hidden md:flex items-center bg-surface-container-low rounded-full px-4 py-2 w-64 border border-transparent focus-within:border-primary-container focus-within:ring-2 focus-within:ring-primary-container/20 transition-all">
                            <span className="material-symbols-outlined text-on-surface-variant text-[20px] mr-2">search</span>
                            <input className="bg-transparent border-none outline-none text-body-md w-full placeholder:text-on-surface-variant/70" placeholder="Search exams, students..." type="text" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-colors relative cursor-pointer active:opacity-80">
                            <span className="material-symbols-outlined">notifications</span>
                            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-error rounded-full border-2 border-surface-container-lowest"></span>
                        </button>
                        <button className="text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-colors cursor-pointer active:opacity-80">
                            <span className="material-symbols-outlined">help_outline</span>
                        </button>
                        <div className="ml-2 w-9 h-9 rounded-full bg-surface-container-highest border border-outline-variant/30 flex items-center justify-center cursor-pointer overflow-hidden">
                            <img alt="Administrator Profile" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAWaNDkneUXec9vmbJhPDCu0Wj-aeTGPCBzz1UYgOtXC0GnFDltCn_rHVPcLpi17CDmqeRpn0l0EvDNac6LjEJJzS-fpJuyLBviV-Q1_SNuIiEAKbXSBs4vjeN7CM_CWoC3OVHtoht2_btTeE8Js6y73DROr5jW6luBOp306fiFuLLTUKYF-5kpOdpLeZUAH60FBw7T7eZPQNMFJoCutiqrFR8n6iC9TYE3H0dVWtrSgXSrxC96fXIAX9o1GJefWxRz6uy7mMk1AUw" />
                        </div>
                    </div>
                </header>
                {/* Main Scrollable Canvas */}
                <main className="flex-1 overflow-y-auto bg-surface">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
