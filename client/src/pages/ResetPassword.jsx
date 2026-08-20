import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Scale, Mail, Eye, EyeOff, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import PasswordStrengthMeter, { validatePassword } from '../components/auth/PasswordStrengthMeter';

const ResetPassword = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResult(null);
       if (password !== confirmPassword) {
      setResult({ success: false, message: 'Konfirmasi password tidak cocok' });
      return;
    }
    if (!validatePassword(password)) {
      setResult({ success: false, message: 'Password lemah. Gunakan minimal 8 karakter, huruf besar/kecil, angka, dan simbol.' });
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setResult({ success: true, message: data.message });
        setPassword('');
        setConfirmPassword('');
      } else {
        setResult({ success: false, message: data.error || 'Gagal mereset password' });
      }
    } catch (err) {
      console.error('Reset password error:', err);
      setResult({ success: false, message: 'Tidak dapat terhubung ke server' });
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full pl-10 pr-10 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center">
            <Scale className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Lex-Integrity</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 dark:bg-gray-800 animate-fade-slide-down">
          <Link to="/login" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 dark:hover:text-gray-300">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Login
          </Link>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reset Password</h2>
          <p className="text-sm text-gray-500 mt-1 mb-6 dark:text-gray-400">
            Buat password baru untuk akun Anda.
          </p>

          {result && (
            <div className={`mb-4 flex items-start gap-2 p-3 rounded-lg text-sm ${result.success
                ? 'bg-green-50 text-green-700 dark:bg-gray-700 dark:text-green-400'
                : 'bg-red-50 text-red-700 dark:bg-gray-700 dark:text-red-400'}`}>
              {result.success
                ? <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                : <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
              {result.message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="mis. user@contoh.com"
                  className={inputClass}
                />
              </div>
            </div>

              <PasswordStrengthMeter
            label="Password Baru"
            name="password"
            password={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
              Konfirmasi Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Ulangi password baru"
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>

          <p className="mt-6 text-sm text-gray-600 dark:text-gray-300">
            Sudah ingat password?{' '}
            <Link to="/login" className="text-blue-600 hover:underline">
              Masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;