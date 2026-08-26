import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Scale, Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, Loader2, ShieldCheck, TrendingUp, FileText, Cpu } from 'lucide-react';
import CapCaptcha from '../components/auth/CapCaptcha';
import { useAuth } from '../components/auth/AuthContext';
import { goGoogleLogin, handleGoogleCallback } from '../components/auth/googleAuth';

const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

const LoginPage = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(null);
  const googleHandled = useRef(false);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code || googleHandled.current) return;
    googleHandled.current = true;
    setGoogleLoading(true);
    setError(null);
    (async () => {
      try {
        const result = await handleGoogleCallback(code);
        if (result.status === 'success') {
          setAuth(result.token, result.user);
          navigate('/');
          return;
        }
        if (result.status === 'exists') {
          setError('Akun telah ada. Silakan login seperti biasa.');
        } else {
          setError(result.message || 'Login Google gagal.');
        }
      } catch (err) {
        console.error('Google login error:', err);
        setError('Login Google gagal. Silakan coba lagi.');
      } finally {
        setGoogleLoading(false);
        setSearchParams({}, { replace: true });
      }
    })();
  }, [searchParams, setAuth, navigate, setSearchParams]);

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
        <p className="text-xs text-blue-200">
          Dengan masuk, Anda menyetujui{' '}
          <Link to="/privacy" className="underline font-medium hover:text-white transition-colors">
            Kebijakan Privasi &amp; Cookies
          </Link>{' '}
          kami.
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

            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs text-gray-400 dark:text-gray-500">atau</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            </div>

            <button
              type="button"
              onClick={goGoogleLogin}
              disabled={googleLoading || isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {googleLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses Google...
                </>
              ) : (
                <>
                  <GoogleIcon />
                  Login dengan akun Google
                </>
              )}
            </button>

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