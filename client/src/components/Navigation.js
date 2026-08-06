import React from 'react';
import { theme } from '../config';

const Navigation = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/search', label: 'Pencarian', icon: '🔍' },
    { path: '/graph', label: 'Visualisasi', icon: '🕸️' },
    { path: '/analytics', label: 'Analitik', icon: '📈' },
    { path: '/admin', label: 'Admin', icon: '⚙️' }
  ];

  return (
    <nav className="bg-slate-800 border-b border-slate-700 fixed w-full z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <div className="h-8 w-8 bg-sky-500 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-lg">📚</span>
              </div>
              <span className="text-xl font-bold text-slate-50">Lex-Integrity</span>
            </div>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <NavLink key={item.path} {...item} />
            ))}
          </div>
          
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-slate-300 hover:text-white focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-slate-800 border-t border-slate-700">
            {navItems.map((item) => (
              <MobileNavLink key={item.path} {...item} onClick={() => setIsMobileMenuOpen(false)} />
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};

const NavLink = ({ path, label, icon }) => {
  const location = window.location;
  const isActive = location.pathname === path;
  
  return (
    <a
      href={path}
      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center space-x-2
        ${isActive 
          ? 'bg-sky-500 text-white' 
          : 'text-slate-300 hover:bg-slate-700 hover:text-white'}
      `}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </a>
  );
};

const MobileNavLink = ({ path, label, icon, onClick }) => {
  return (
    <a
      href={path}
      onClick={onClick}
      className="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors duration-200 flex items-center space-x-2"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </a>
  );
};

export default Navigation;