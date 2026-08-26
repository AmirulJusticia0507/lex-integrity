import React, { useState } from 'react';
import { Menu } from 'lucide-react';

/** Topbar khusus layar kecil (<md): tombol buka sidebar drawer + brand + dark mode */
export const MobileTopBar = () => {
  const [dark, setDark] = useState(() => localStorage.getItem('lex_dark_mode') === 'true');

  const openSidebar = () => {
    window.dispatchEvent(new CustomEvent('sidebar-mobile-toggle'));
  };

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('lex_dark_mode', String(next));
  };

  return (
    <header className="md:hidden sticky top-0 z-40 flex items-center gap-3 bg-white/95 backdrop-blur border-b border-gray-200 px-4 py-2.5 dark:bg-gray-800/95 dark:border-gray-700">
      <button
        onClick={openSidebar}
        className="p-2 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors dark:text-gray-300 dark:hover:bg-gray-700"
        aria-label="Buka menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">LI</span>
        </div>
        <span className="font-bold text-gray-800 truncate dark:text-gray-100">Lex-Integrity</span>
      </div>
      <button
        onClick={toggleDark}
        className="ml-auto p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors dark:text-gray-400 dark:hover:bg-gray-700"
        aria-label="Toggle dark mode"
      >
        {dark ? '☀️' : '🌙'}
      </button>
    </header>
  );
};

export default MobileTopBar;
