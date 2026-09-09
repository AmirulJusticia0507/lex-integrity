import React, { useEffect, useState } from 'react';
import { Loader2, Scale } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function RouteLoadingOverlay() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 450);
    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-white/75 backdrop-blur-sm dark:bg-gray-950/70">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-gray-200 bg-white px-6 py-5 shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <div className="relative">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Scale className="h-5 w-5 text-blue-700 dark:text-blue-300" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Lex-Integrity</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Memuat halaman...</p>
        </div>
      </div>
    </div>
  );
}
