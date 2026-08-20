import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileText, AlertTriangle, TrendingUp, Users, BarChart2, Search, Grid, Database, Settings, Info, Moon, Sun, UserCircle, ChevronDown, LogIn, KeyRound, ShieldCheck, LogOut, ChevronLeft, ChevronRight, Menu, MessageSquare, Plus, Trash2, Clock, ScrollText } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lex_sidebar_collapsed') === 'true';
    }
    return false;
  });
  const { user, clearAuth } = useAuth();

  // Chat history state
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [showChatHistory, setShowChatHistory] = useState(false);

  const SESSIONS_KEY = 'lex_chat_sessions';

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

  useEffect(() => {
    localStorage.setItem('lex_sidebar_collapsed', String(collapsed));
    document.dispatchEvent(new CustomEvent('sidebar-collapse', { detail: { collapsed } }));
  }, [collapsed]);

  // Load chat sessions
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lex_chat_sessions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSessions(parsed);
          if (parsed.length > 0 && !currentSessionId) {
            setCurrentSessionId(parsed[0].id);
            setShowChatHistory(true);
          }
        }
      }
    } catch (e) {
      console.error('Gagal memuat sesi chat:', e);
    }
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('lex_dark_mode', String(next));
  };

  const toggleCollapse = () => {
    setCollapsed(c => !c);
  };

  // Chat history functions
  const createNewSession = () => {
    const now = new Date().toISOString();
    const newSession = {
      id: Date.now().toString(),
      title: 'Percakapan Baru',
      messages: [],
      ruleContext: null,
      createdAt: now,
      updatedAt: now,
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setShowChatHistory(true);
  };

  const loadSession = (session) => {
    setCurrentSessionId(session.id);
    setShowChatHistory(true);
  };

  const deleteSession = (sessionId, e) => {
    e.stopPropagation();
    if (confirm('Hapus percakapan ini?')) {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setShowChatHistory(false);
      }
    }
  };

  const toggleCollapseHandler = () => {
    setCollapsed(c => !c);
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
  
  const sidebarWidth = collapsed ? 'w-16' : 'w-64';
  const isChatRoute = location.pathname === '/chat';

  return (
    <aside className={`fixed left-0 top-0 h-full ${sidebarWidth} bg-white shadow-lg z-50 dark:bg-gray-800 transition-all duration-300`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between h-10">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">LI</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Lex-Integrity</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">AI Regulatory Compliance</p>
              </div>
            </div>
          )}
          <button
            onClick={toggleCollapseHandler}
            className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0 ${collapsed ? 'ml-auto' : 'ml-2'}`}
            aria-label={collapsed ? 'Perluas sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-5 w-5 text-gray-500" /> : <ChevronLeft className="h-5 w-5 text-gray-500" />}
          </button>
        </div>
      </div>
      
      <nav className="mt-4 px-2">
        {menuItems.map((item, index) => (
          <a
            key={index}
            href={item.path}
            className={`flex items-center px-3 py-2.5 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-blue-400 group ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="ml-3 font-medium group-hover:font-semibold">{item.label}</span>}
          </a>
        ))}
        <a
          href="/chat"
          className={`flex items-center px-3 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:bg-gray-700 group ${collapsed ? 'justify-center' : ''} ${isChatRoute ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30' : ''}`}
          aria-label="Chat dengan AI"
          title={collapsed ? 'Chat AI' : undefined}
        >
          <MessageSquare className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span className="ml-3 font-medium">Chat AI</span>}
        </a>
        <a
          href="/about"
          className={`flex items-center px-3 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:bg-gray-700 group ${collapsed ? 'justify-center' : ''}`}
          aria-label="Tentang Aplikasi"
          title={collapsed ? 'About' : undefined}
        >
          <Info className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span className="ml-3 font-medium">About</span>}
        </a>
        <button
          onClick={toggleDark}
          className={`flex items-center w-full px-3 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:bg-gray-700 group ${collapsed ? 'justify-center' : ''}`}
          aria-label="Toggle Dark Mode"
          title={collapsed ? (dark ? 'Mode Terang' : 'Mode Gelap') : undefined}
        >
          {dark ? <Sun className="h-5 w-5 flex-shrink-0" /> : <Moon className="h-5 w-5 flex-shrink-0" />}
          {!collapsed && <span className="ml-3 font-medium">{dark ? 'Mode Terang' : 'Mode Gelap'}</span>}
        </button>
      </nav>
      
      {/* Chat History Panel - Only show on /chat route and not collapsed */}
      {isChatRoute && !collapsed && (
        <div className="absolute bottom-0 left-0 right-0 top-0 pt-16 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="h-full flex flex-col">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">LI</span>
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Lex-Integrity</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">AI Regulatory Compliance</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  Riwayat Chat
                </h3>
                <div className="flex items-center gap-2">
                  <a
                    href="/"
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 hover:text-blue-600"
                    aria-label="Kembali ke Dashboard"
                    title="Kembali ke Dashboard"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12" />
                    </svg>
                  </a>
                  <button
                    onClick={createNewSession}
                    className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-900/30 transition-colors"
                    aria-label="Percakapan Baru"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Belum ada riwayat percakapan</p>
                  <p className="text-xs mt-1">Klik + untuk memulai</p>
                </div>
              ) : (
                sessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => loadSession(session)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-start gap-2 relative ${
                      currentSessionId === session.id
                        ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${currentSessionId === session.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`}>
                        {session.title}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(session.updatedAt)}
                      </p>
                      {session.ruleContext && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded dark:bg-blue-900 dark:text-blue-300">
                          {session.ruleContext.title?.slice(0, 20)}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => deleteSession(session.id, e)}
                      className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Hapus"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`absolute bottom-0 left-0 right-0 p-3 border-t border-gray-200 dark:border-gray-700 ${collapsed ? 'hidden' : 'block'}`}>
        <div className="flex items-center mb-3">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
            <span className="text-white text-xs font-bold">AI</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">Local LLM Mode</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">100% Offline & Free</p>
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

function formatDate(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Hari ini, ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === yesterday.toDateString()) return 'Kemarin, ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export default Sidebar;