import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Scale, Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setResult({ success: true, message: data.message });
      } else {
        setResult({ success: false, message: data.error || 'Gagal mengirim link reset' });
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setResult({ success: false, message: 'Tidak dapat terhubung ke server' });
    } finally {
      setIsLoading(false);
    }
  };

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

          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Lupa Password?</h2>
          <p className="text-sm text-gray-500 mt-1 mb-6 dark:text-gray-400">
            Masukkan email terdaftar Anda, dan kami akan mengirimkan link untuk mereset password.
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
                  className="w-full pl-10 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
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
                  Mengirim...
                </>
              ) : (
                'Kirim Link Reset'
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

export default ForgotPassword;