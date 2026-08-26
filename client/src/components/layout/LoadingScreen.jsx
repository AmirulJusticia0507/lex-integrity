import React from 'react';
import { Scale, Loader2 } from 'lucide-react';

const LoadingScreen = ({ label = 'Memuat...', fullScreen = true }) => (
  <div
    className={`${
      fullScreen ? 'fixed inset-0 z-40' : 'w-full py-24'
    } flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900`}
  >
    <div className="relative mb-6">
      <div className="absolute inset-0 rounded-2xl bg-blue-500/40 animate-ping" />
      <div className="relative w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
        <Scale className="h-7 w-7 text-white" />
      </div>
    </div>
    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Lex-Integrity</p>
    <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
      <Loader2 className="h-4 w-4 text-blue-600 animate-spin dark:text-blue-400" />
      {label}
    </div>
  </div>
);

export default LoadingScreen;
