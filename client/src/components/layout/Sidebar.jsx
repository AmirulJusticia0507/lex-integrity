import React, { useEffect, useState } from 'react';
import { FileText, AlertTriangle, TrendingUp, Users, BarChart2, Search, Grid, Database, Settings, Info, Moon, Sun, UserCircle, ChevronDown, LogIn, KeyRound, ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';

export const Sidebar = () => {
  const [dark, setDark] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { user, clearAuth } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    const saved = localStorage.getItem('lex_dark_mode');
    const initial = saved ? saved === 'true' : false;
    setDark(initial);
    document.documentElement.classList.toggle('dark', initial);
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('lex_dark_mode', String(next));
  };

  const menuItems = [
    { icon: Grid, label: 'Dashboard', path: '/' },
    { icon: FileText, label: 'Explorer', path: '/rules' },
    { icon: Search, label: 'Search', path: '/rules/search' },
    { icon: BarChart2, label: 'Legal Matrix', path: '/matrix' },
    { icon: TrendingUp, label: 'Analytics', path: '/analytics' },
    { icon: Database, label: 'Dashboard', path: '/dashboard' },
    { icon: Settings, label: 'Data Management', path: '/data' }
  ];
  
  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white shadow-lg z-50 dark:bg-gray-800">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Lex-Integrity</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">AI Regulatory Compliance Matrix</p>
      </div>
      
      <nav className="mt-6">
        {menuItems.map((item, index) => (
          <a
            key={index}
            href={item.path}
            className="flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-blue-400"
          >
            <item.icon className="h-5 w-5 mr-3" />
            <span className="font-medium">{item.label}</span>
          </a>
        ))}
        <a
          href="/chat"
          className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100 transition-colors dark:text-gray-300 dark:hover:bg-gray-700"
          aria-label="Chat dengan AI">
          <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 15a2 2 0 01-2 2H5a2 2 0 01-2-2V3a2 2 0 012-2h11l5 5v5a2 2 0 01-2 2z" />
          </svg>
          <span className="font-medium">Chat AI</span>
        </a>
        <a
          href="/about"
          className="flex items-center px-6 py-3 text-gray-700 hover:bg-gray-100 transition-colors dark:text-gray-300 dark:hover:bg-gray-700"
          aria-label="Tentang Aplikasi">
          <Info className="h-5 w-5 mr-3" />
          <span className="font-medium">About</span>
        </a>
        <button
          onClick={toggleDark}
          className="flex items-center w-full px-6 py-3 text-gray-700 hover:bg-gray-100 transition-colors dark:text-gray-300 dark:hover:bg-gray-700"
          aria-label="Toggle Dark Mode">
          {dark ? <Sun className="h-5 w-5 mr-3" /> : <Moon className="h-5 w-5 mr-3" />}
          <span className="font-medium">{dark ? 'Mode Terang' : 'Mode Gelap'}</span>
        </button>
      </nav>
      
      <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
            <span className="text-white text-sm font-bold">AI</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Local LLM Mode</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">100% Offline & Free</p>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setAccountOpen(!accountOpen)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-700"
            aria-label="Menu Akun"
          >
            <span className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
              <UserCircle className="h-5 w-5 mr-2" />
              Akun
            </span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
          </button>

          {accountOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 space-y-1 z-50 animate-fade-slide-down dark:bg-gray-800 dark:border-gray-700">
              {user ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 text-sm">
                    <UserCircle className="h-5 w-5 text-blue-500" />
                    <span className="font-medium text-gray-800 dark:text-gray-100">{user.username}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">({user.role})</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 rounded hover:bg-red-50 transition-colors dark:text-red-400 dark:hover:bg-gray-800"
                    aria-label="Keluar"
                  >
                    <LogOut className="h-4 w-4" />
                    Keluar
                  </button>
                </>
              ) : (
                <>
                  <a
                    href="/login"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-blue-400"
                  >
                    <LogIn className="h-4 w-4" />
                    Masuk
                  </a>
                  <a
                    href="/forgot-password"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-blue-400"
                  >
                    <KeyRound className="h-4 w-4" />
                    Lupa Password
                  </a>
                  <a
                    href="/reset-password"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-blue-400"
                  >
                    <KeyRound className="h-4 w-4" />
                    Reset Password
                  </a>
                </>
              )}
              <div className="border-t border-gray-100 pt-1 mt-1 dark:border-gray-700">
                <a
                  href="https://trycap.dev/guide/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 rounded hover:bg-gray-50 transition-colors dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  <ShieldCheck className="h-4 w-4" />
                  CAPTCHA Guide
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};