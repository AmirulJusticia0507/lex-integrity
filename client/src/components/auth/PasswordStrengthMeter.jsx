import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
  Shield,
} from 'lucide-react';

const ICONS = { weak: AlertCircle, medium: Shield, strong: ShieldCheck };
const COLORS = { weak: 'bg-red-500', medium: 'bg-yellow-400', strong: 'bg-green-500' };
const TEXT = {
  weak: 'Lemah',
  medium: 'Sedang',
  strong: 'Kuat',
};

const CRITERIA = [
  { label: 'Minimal 8 karakter', test: (p) => p.length >= 8 },
  { label: 'Mengandung huruf besar', test: (p) => /[A-Z]/.test(p) },
  { label: 'Mengandung huruf kecil', test: (p) => /[a-z]/.test(p) },
  { label: 'Mengandung angka', test: (p) => /\d/.test(p) },
  { label: 'Mengandung simbol', test: (p) => /[!@#$%^&*(),.?\":{}|<>]/.test(p) },
];

export default function PasswordStrengthMeter({ password, onChange, name = 'password', label = 'Password' }) {
  const [showMeter, setShowMeter] = useState(false);

  useEffect(() => {
    if (password) setShowMeter(true);
  }, [password]);

  const passed = CRITERIA.filter((c) => c.test(password));
  let strength = 'weak';
  if (passed.length >= 4) strength = 'strong';
  else if (passed.length >= 2) strength = 'medium';

  const Icon = ICONS[strength];
  const pct = (passed.length / CRITERIA.length) * 100;

  return (
    <div className="mb-3">
      <label className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        <span>{label}</span>
        {showMeter && password && (
          <button
            type="button"
            onClick={() => setShowMeter(false)}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            aria-label="Sembunyikan meter"
          >
            tutup
          </button>
        )}
      </label>
      <div className="relative">
        <input
          type="password"
          value={password}
          onChange={onChange}
          name={name}
          required
          placeholder="Masukkan password"
          className="w-full pl-10 pr-10 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
        />
        <Shield className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
      </div>

      {showMeter && password && (
        <div className="mt-2 space-y-1.5 text-xs animate-fade-slide-down">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
            <Icon className={`h-4 w-4 text-${strength === 'weak' ? 'red' : strength === 'medium' ? 'yellow' : 'green'}-500`} />
            <span className="font-medium">{TEXT[strength]}</span>
            <span className="text-gray-400">
              ({passed.length}/{CRITERIA.length})
            </span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full dark:bg-gray-600 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${COLORS[strength]}`}
              style={{ width: pct }}
            />
          </div>
          <ul className="grid grid-cols-1 gap-0.5">
            {CRITERIA.map((c, i) => {
              const ok = c.test(password);
              return (
                <li key={i} className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                  {ok ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-gray-300" />
                  )}
                  {c.label}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export function validatePassword(password) {
  return CRITERIA.every((c) => c.test(password));
}
