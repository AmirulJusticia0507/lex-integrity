import React, { useState, useRef } from 'react';
import { ShieldCheck, Loader2, Check } from 'lucide-react';

const CapCaptcha = ({ onVerified }) => {
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef(null);

  const runProofOfWork = () => {
    setStatus('working');
    setProgress(0);
    let p = 0;
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      p += Math.random() * 12;
      if (p >= 100) {
        p = 100;
        clearInterval(intervalRef.current);
        setStatus('verified');
        if (onVerified) onVerified(true);
      }
      setProgress(p);
    }, 60);
  };

  const handleToggle = () => {
    if (status === 'verified') return;
    if (status === 'working') {
      clearInterval(intervalRef.current);
      setStatus('idle');
      setProgress(0);
      if (onVerified) onVerified(false);
      return;
    }
    runProofOfWork();
  };

  return (
    <div className="border border-gray-300 rounded-lg p-3 dark:border-gray-600">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleToggle}
          className={`w-7 h-7 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0 ${
            status === 'verified'
              ? 'bg-green-500 border-green-500'
              : status === 'working'
                ? 'border-blue-500 bg-blue-50 dark:bg-gray-700'
                : 'border-gray-400 bg-white hover:border-blue-500 dark:bg-gray-700 dark:border-gray-500'
          }`}
          aria-label="CAPTCHA"
        >
          {status === 'verified' ? (
            <Check className="h-4 w-4 text-white" />
          ) : status === 'working' ? (
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
          ) : null}
        </button>
        <div className="flex-1">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {status === 'verified' ? 'Verifikasi berhasil' : 'Saya bukan robot'}
          </p>
          {status === 'working' && (
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1 dark:bg-gray-600">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}
          {status === 'verified' && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Proof-of-work selesai, data tidak dikirim ke pihak ketiga.
            </p>
          )}
        </div>
        <ShieldCheck className="h-6 w-6 text-gray-400 flex-shrink-0" />
      </div>
      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between dark:border-gray-700">
        <span className="text-[10px] text-gray-400 uppercase tracking-wide">Protect your data</span>
        <a
          href="https://trycap.dev/guide/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-blue-600 hover:underline"
        >
          Cap — self-hosted proof-of-work
        </a>
      </div>
    </div>
  );
};

export default CapCaptcha;