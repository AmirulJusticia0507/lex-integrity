import React from 'react';
import { FileText, AlertTriangle, TrendingUp, Users, BarChart2, Search, Grid, Database, Settings } from 'lucide-react';

export const Sidebar = () => {
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
    <aside className="fixed left-0 top-0 h-full w-64 bg-white shadow-lg z-50">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-800">Lex-Integrity</h1>
        <p className="text-sm text-gray-600">AI Regulatory Compliance Matrix</p>
      </div>
      
      <nav className="mt-6">
        {menuItems.map((item, index) => (
          <a
            key={index}
            href={item.path}
            className="flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
          >
            <item.icon className="h-5 w-5 mr-3" />
            <span className="font-medium">{item.label}</span>
          </a>
        ))}
      </nav>
      
      <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-200">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
            <span className="text-white text-sm font-bold">AI</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">Local LLM Mode</p>
            <p className="text-xs text-gray-600">100% Offline & Free</p>
          </div>
        </div>
      </div>
    </aside>
  );
};