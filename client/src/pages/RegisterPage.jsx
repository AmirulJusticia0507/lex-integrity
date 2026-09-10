import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Scale, Mail, Lock, User, Eye, EyeOff, UserPlus, AlertCircle, Loader2, ShieldCheck, TrendingUp, FileText, Cpu, Camera, X } from 'lucide-react';
import CapCaptcha from '../components/auth/CapCaptcha';
import { useAuth } from '../components/auth/AuthContext';
import { apiUrl } from '../utils/http';
import Swal from 'sweetalert2';

const MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024;

const RegisterPage = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const goToDashboard = () => {
    Swal.fire({
      title: 'Akun berhasil dibuat!',
      text: 'Mengalihkan ke dashboard...',
      icon: 'success',
      timer: 1500,
      showConfirmButton: false,
      background: document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff',
      color: document.documentElement.classList.contains('dark') ? '#f9fafb' : '#111827',
    });

    setTimeout(() => {
      Swal.close();
      navigate('/');
    }, 1500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!captchaVerified) {
      setError('Harap selesaikan verifikasi CAPTCHA terlebih dahulu.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password dan konfirmasi password tidak cocok.');
      return;
    }

    if (password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, profile_photo: profilePhoto || null }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setAuth(data.data.token, data.data.user);
        goToDashboard();
      } else {
        setError(data.error || 'Pendaftaran gagal');
      }
    } catch (err) {
      console.error('Register error:', err);
      setError('Tidak dapat terhubung ke server');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar.');
      return;
    }
    if (file.size > MAX_PROFILE_PHOTO_SIZE) {
      setError('Foto profil maksimal 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProfilePhoto(String(reader.result || ''));
    reader.readAsDataURL(file);
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
            Bergabung dengan Lex-Integrity
          </h2>
          <p className="text-blue-100 text-sm leading-relaxed max-w-md">
            Daftar untuk mengakses fitur analisis kepatuhan regulasi berbasis AI.
            Jelajahi peraturan, deteksi kontradiksi, dan gunakan Chat AI secara offline.
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
          Dengan mendaftar, Anda menyetujui{' '}
          <Link to="/privacy" className="underline font-medium hover:text-white transition-colors">
            Kebijakan Privasi &amp; Cookies
          </Link>{' '}
          kami.
        </p>
        <p className="text-xs text-blue-200">
          <Link to="/help" className="underline font-medium hover:text-white transition-colors">
            Bantuan
          </Link>
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
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Daftar Akun Baru</h2>
              <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
                Buat akun untuk mengakses seluruh fitur Lex-Integrity.
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
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                  Foto Profil
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden dark:bg-blue-900/40">
                    {profilePhoto ? (
                      <img src={profilePhoto} alt="Preview foto profil" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                      <Camera className="h-4 w-4" />
                      Pilih Foto
                      <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                    </label>
                    {profilePhoto && (
                      <button
                        type="button"
                        onClick={() => setProfilePhoto('')}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-gray-700"
                      >
                        <X className="h-4 w-4" />
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="mis. john_doe"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="john@example.com"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Password
                </label>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Konfirmasi Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className={inputClass}
                  />
                </div>
              </div>

              <CapCaptcha onVerified={setCaptchaVerified} />

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Mendaftarkan...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Daftar
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 space-y-3 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Sudah punya akun?{' '}
                <Link to="/login" className="text-blue-600 hover:underline font-medium">
                  Masuk di sini
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

export default RegisterPage;
