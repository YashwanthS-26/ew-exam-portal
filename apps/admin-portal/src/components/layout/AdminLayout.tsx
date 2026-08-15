import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, BarChart3, Plus, Menu, Search, Bell, HelpCircle, X, BookOpen } from 'lucide-react';

export default function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Close mobile menu on route change
    React.useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    const SidebarContent = () => (
        <>
            <div className="px-6 h-[72px] flex items-center justify-center border-b border-slate-100 shrink-0">
                <img src="/logo.png" alt="EW SHIKEN" className="w-44 object-contain" />
            </div>
            
            <div className="p-4 shrink-0">
                <button 
                    onClick={() => navigate('/exams/create')} 
                    className="w-full bg-primary hover:bg-black text-white text-sm font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    Create Exam
                </button>
            </div>

            <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
                <NavLink 
                    to="/dashboard" 
                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium ${
                        isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                >
                    <LayoutDashboard size={18} />
                    <span>Dashboard</span>
                </NavLink>
                
                <NavLink 
                    to="/exams" 
                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium ${
                        isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                >
                    <FileText size={18} />
                    <span>Exams</span>
                </NavLink>
                
                <NavLink 
                    to="/results" 
                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium ${
                        isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                >
                    <BarChart3 size={18} />
                    <span>Results</span>
                </NavLink>

                <NavLink 
                    to="/question-bank" 
                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium ${
                        isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                >
                    <BookOpen size={18} />
                    <span>Question Bank</span>
                </NavLink>
            </nav>
        </>
    );

    return (
        <div className="bg-slate-50 text-slate-900 font-sans h-screen overflow-hidden flex relative">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex flex-col h-full border-r border-slate-200 bg-white left-0 w-64 flex-shrink-0 z-40 transition-all duration-200 ease-in-out">
                <SidebarContent />
            </aside>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Mobile Sidebar */}
            <aside className={`fixed inset-y-0 left-0 bg-white w-64 flex-col h-full z-50 transform transition-transform duration-300 ease-in-out md:hidden flex shadow-2xl ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <SidebarContent />
            </aside>

            {/* Main Content Wrapper */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
                {/* TopNavBar */}
                <header className="flex justify-between items-center w-full px-4 md:px-6 h-16 bg-white border-b border-slate-200 shrink-0 z-30">
                    <div className="flex items-center gap-4">
                        <button 
                            className="md:hidden text-slate-500 hover:bg-slate-100 p-2 rounded-md transition-colors"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <Menu size={20} />
                        </button>
                        <div className="md:hidden flex items-center justify-center">
                            <img src="/logo.png" alt="EW SHIKEN" className="w-28 object-contain" />
                        </div>
                        
                        <div className="hidden md:flex items-center bg-slate-50 rounded-md px-3 py-1.5 w-72 border border-slate-200 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                            <Search size={16} className="text-slate-400 mr-2" />
                            <input 
                                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-400 text-slate-900" 
                                placeholder="Search..." 
                                type="text" 
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3">
                        <button className="text-slate-500 hover:bg-slate-100 p-2 rounded-md transition-colors relative">
                            <Bell size={20} />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                        </button>
                        <button className="text-slate-500 hover:bg-slate-100 p-2 rounded-md transition-colors hidden sm:block">
                            <HelpCircle size={20} />
                        </button>
                        <div className="ml-1 md:ml-2 flex items-center gap-3 pl-3 border-l border-slate-200">
                            <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center overflow-hidden cursor-pointer">
                                <img 
                                    alt="Profile" 
                                    className="w-full h-full object-cover" 
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAWaNDkneUXec9vmbJhPDCu0Wj-aeTGPCBzz1UYgOtXC0GnFDltCn_rHVPcLpi17CDmqeRpn0l0EvDNac6LjEJJzS-fpJuyLBviV-Q1_SNuIiEAKbXSBs4vjeN7CM_CWoC3OVHtoht2_btTeE8Js6y73DROr5jW6luBOp306fiFuLLTUKYF-5kpOdpLeZUAH60FBw7T7eZPQNMFJoCutiqrFR8n6iC9TYE3H0dVWtrSgXSrxC96fXIAX9o1GJefWxRz6uy7mMk1AUw" 
                                />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Scrollable Canvas */}
                <main className="flex-1 overflow-y-auto bg-slate-50 relative">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

