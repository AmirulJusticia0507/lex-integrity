import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Scale, Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, Loader2, ShieldCheck, TrendingUp, FileText, Cpu } from 'lucide-react';
import CapCaptcha from '../components/auth/CapCaptcha';
import { useAuth } from '../components/auth/AuthContext';

const LoginPage = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!captchaVerified) {
      setError('Harap selesaikan verifikasi CAPTCHA terlebih dahulu.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username_or_email: identifier, password }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setAuth(data.data.token, data.data.user);
        navigate('/');
      } else {
        setError(data.error || 'Login gagal');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Tidak dapat terhubung ke server');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full pl-10 pr-10 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur">
            <Scale className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Lex-Integrity</h1>
            <p className="text-sm text-blue-200">AI Regulatory Compliance Matrix</p>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-white leading-snug">
            Analisis Kepatuhan Regulasi<br />Berbasis AI Lokal
          </h2>
          <p className="text-blue-100 text-sm leading-relaxed max-w-md">
            Platform produk hukum Indonesia yang menggabungkan scraping otomatis JDIH,
            PostgreSQL, dan model bahasa lokal untuk mendeteksi celah serta kontradiksi
            antar peraturan — 100% offline.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-lg p-4 text-center backdrop-blur">
              <FileText className="h-6 w-6 text-white mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">+500</p>
              <p className="text-xs text-blue-200">Peraturan</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4 text-center backdrop-blur">
              <TrendingUp className="h-6 w-6 text-white mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">Real-time</p>
              <p className="text-xs text-blue-200">Analisis</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4 text-center backdrop-blur">
              <Cpu className="h-6 w-6 text-white mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">100%</p>
              <p className="text-xs text-blue-200">Offline LLM</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-blue-200">
          © {new Date().getFullYear()} Amirul Justicia — Lex-Integrity. Hak cipta dilindungi.
        </p>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center">
              <Scale className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Lex-Integrity</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8 dark:bg-gray-800 animate-fade-slide-down">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Masuk</h2>
              <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
                Selamat datang kembali! Silakan masuk ke akun Anda.
              </p>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm dark:bg-gray-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Username atau Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    placeholder="mis. admin"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Lupa password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    aria-label="Tampilkan password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="mr-2 rounded"
                />
                Ingat saya
              </label>

              <CapCaptcha onVerified={setCaptchaVerified} />

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Masuk
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 space-y-3 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Lupa password?{' '}
                <Link to="/forgot-password" className="text-blue-600 hover:underline">
                  Reset di sini
                </Link>
              </p>
              <a
                href="https://trycap.dev/guide/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <ShieldCheck className="h-4 w-4" />
                Dilindungi oleh CAPTCHA proof-of-work self-hosted (Cap)
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;