import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Scale, ArrowLeft, Mail, Lock, Eye, EyeOff, Save, AlertCircle, Loader2, CheckCircle, User, Phone, ShieldCheck, ShieldOff, QrCode, Camera, X } from 'lucide-react';
import { useAuth } from '../components/auth/AuthContext';
import { apiUrl } from '../utils/http';

const SHOW_2FA_PANEL = false;

const Profile = () => {
  const { user, setAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [profilePhotoSize, setProfilePhotoSize] = useState(64);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // 2FA state
  const [show2faSetup, setShow2faSetup] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [is2faLoading, setIs2faLoading] = useState(false);
  const [showDisable2fa, setShowDisable2fa] = useState(false);
  const [disableOtpCode, setDisableOtpCode] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('lex_dark_mode');
    if (saved === 'true') document.documentElement.classList.add('dark');
    return () => document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('lex_auth_token');
        const res = await fetch(apiUrl('/api/auth/profile'), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setEmail(data.data.email);
          setPhone(data.data.phone || '');
          setProfilePhoto(data.data.profile_photo || '');
          setProfilePhotoSize(data.data.profile_photo_size || 64);
          setUsername(data.data.username);
          setRole(data.data.role);
          setTwoFactorEnabled(data.data.two_factor_enabled);
        }
      } catch (err) {
        console.error('Gagal memuat profil:', err);
      } finally {
        setIsFetching(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword && newPassword !== confirmPassword) {
      setError('Password baru dan konfirmasi password tidak cocok.');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setError('Password baru minimal 6 karakter.');
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('lex_auth_token');
      const response = await fetch(apiUrl('/api/auth/profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email, phone: phone || undefined, profile_photo: profilePhoto || null, profile_photo_size: profilePhotoSize, currentPassword: currentPassword || undefined, newPassword: newPassword || undefined }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setAuth(token, data.data);
        setSuccess('Profil berhasil diperbarui!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(data.error || 'Gagal memperbarui profil');
      }
    } catch (err) {
      console.error('Profile update error:', err);
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
    if (file.size > 500 * 1024) {
      setError('Foto profil maksimal 500KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProfilePhoto(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleSetup2fa = async () => {
    setIs2faLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('lex_auth_token');
      const res = await fetch(apiUrl('/api/auth/2fa/setup'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setQrCode(data.data.qrCode);
        setSecret(data.data.secret);
        setShow2faSetup(true);
      } else {
        setError(data.error || 'Gagal menyiapkan 2FA');
      }
    } catch (err) {
      setError('Tidak dapat terhubung ke server');
    } finally {
      setIs2faLoading(false);
    }
  };

  const handleVerify2fa = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setError('Kode OTP harus 6 digit.');
      return;
    }
    setIs2faLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('lex_auth_token');
      const res = await fetch(apiUrl('/api/auth/2fa/verify'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: otpCode })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTwoFactorEnabled(true);
        setShow2faSetup(false);
        setOtpCode('');
        setQrCode('');
        setSecret('');
        setSuccess('2FA berhasil diaktifkan!');
      } else {
        setError(data.error || 'Verifikasi gagal');
      }
    } catch (err) {
      setError('Tidak dapat terhubung ke server');
    } finally {
      setIs2faLoading(false);
    }
  };

  const handleDisable2fa = async () => {
    if (!disableOtpCode || disableOtpCode.length !== 6) {
      setError('Kode OTP harus 6 digit.');
      return;
    }
    setIs2faLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('lex_auth_token');
      const res = await fetch(apiUrl('/api/auth/2fa/disable'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: disableOtpCode })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTwoFactorEnabled(false);
        setShowDisable2fa(false);
        setDisableOtpCode('');
        setSuccess('2FA berhasil dinonaktifkan!');
      } else {
        setError(data.error || 'Gagal menonaktifkan 2FA');
      }
    } catch (err) {
      setError('Tidak dapat terhubung ke server');
    } finally {
      setIs2faLoading(false);
    }
  };

  const inputClass = "w-full pl-10 pr-10 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100";
  const avatarStyle = { width: `${profilePhotoSize}px`, height: `${profilePhotoSize}px` };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Scale className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 dark:text-gray-100">Lex-Integrity</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">AI Policy & Regulatory Compliance Matrix</p>
            </div>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Beranda
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">Profil Saya</h1>
          <p className="text-sm text-gray-500 mt-2 dark:text-gray-400">Kelola email, password, dan keamanan akun Anda</p>
        </div>

        <div className="space-y-6">
          {/* Card Profil */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200/70 p-6 md:p-8 dark:bg-gray-800 dark:border-gray-700">
            {isFetching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
                <div
                  className="shrink-0 max-w-32 max-h-32 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden dark:bg-blue-900/40"
                  style={avatarStyle}
                >
                  {profilePhoto ? (
                    <img src={profilePhoto} alt={username} className="w-full h-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">{username}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{role === 'admin' ? 'Administrator' : 'User'}</p>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm dark:bg-gray-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-green-50 text-green-700 text-sm dark:bg-green-900/40 dark:text-green-400">
                <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Foto Profil */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Foto Profil
                </h3>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div
                    className="shrink-0 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden dark:bg-blue-900/40"
                    style={avatarStyle}
                  >
                    {profilePhoto ? (
                      <img src={profilePhoto} alt="Preview foto profil" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                        <Camera className="h-4 w-4" />
                        Pilih Foto
                        <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                      </label>
                      {profilePhoto && (
                        <button
                          type="button"
                          onClick={() => setProfilePhoto('')}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-gray-700"
                        >
                          <X className="h-4 w-4" />
                          Hapus Foto
                        </button>
                      )}
                    </div>
                    <label className="block">
                      <span className="mb-2 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
                        <span>Ukuran foto</span>
                        <span>{profilePhotoSize}px</span>
                      </span>
                      <input
                        type="range"
                        min="48"
                        max="160"
                        step="4"
                        value={profilePhotoSize}
                        onChange={(e) => setProfilePhotoSize(Number(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Email */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Ubah Email
                </h3>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="email@example.com"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* WhatsApp */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Nomor WhatsApp
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                  Untuk notifikasi dan verifikasi keamanan.
                </p>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Ubah Password
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Kosongkan jika tidak ingin mengubah password.</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Password Lama</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className={inputClass}
                      />
                      <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Password Baru</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className={inputClass}
                      />
                      <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Konfirmasi Password Baru</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : <><Save className="h-4 w-4" /> Simpan Perubahan</>}
              </button>
            </form>
          </div>

          {/* Card 2FA */}
          {SHOW_2FA_PANEL && <div className="bg-white rounded-xl shadow-sm border border-gray-200/70 p-6 md:p-8 dark:bg-gray-800 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-500" />
              Autentikasi Dua Faktor (2FA)
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Tambahkan lapisan keamanan ekstra dengan mengharuskan kode OTP dari aplikasi authenticator (Google Authenticator, Authy, dll) saat login.
            </p>

            {twoFactorEnabled ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700 text-sm dark:bg-green-900/40 dark:text-green-400">
                  <ShieldCheck className="h-4 w-4" />
                  2FA sudah aktif
                </div>
                {!showDisable2fa ? (
                  <button
                    onClick={() => setShowDisable2fa(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors dark:text-red-400 dark:border-red-700 dark:hover:bg-gray-700"
                  >
                    <ShieldOff className="h-4 w-4" />
                    Nonaktifkan 2FA
                  </button>
                ) : (
                  <div className="space-y-3 p-4 border border-red-200 rounded-lg dark:border-red-800">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Masukkan kode OTP dari aplikasi authenticator untuk menonaktifkan 2FA:
                    </p>
                    <input
                      type="text"
                      value={disableOtpCode}
                      onChange={(e) => setDisableOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-center text-lg tracking-widest font-mono"
                      maxLength={6}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleDisable2fa}
                        disabled={is2faLoading}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {is2faLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Nonaktifkan'}
                      </button>
                      <button
                        onClick={() => { setShowDisable2fa(false); setDisableOtpCode(''); }}
                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 text-yellow-700 text-sm dark:bg-yellow-900/40 dark:text-yellow-400">
                  <ShieldCheck className="h-4 w-4" />
                  2FA belum aktif
                </div>

                {!show2faSetup ? (
                  <button
                    onClick={handleSetup2fa}
                    disabled={is2faLoading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {is2faLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><QrCode className="h-4 w-4" /> Aktifkan 2FA</>}
                  </button>
                ) : (
                  <div className="space-y-4 p-4 border border-blue-200 rounded-lg dark:border-blue-800">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      1. Scan QR code di bawah ini dengan aplikasi authenticator:
                    </p>
                    <div className="flex justify-center">
                      <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48 rounded-lg border border-gray-200 dark:border-gray-700" />
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 dark:bg-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Atau masukkan manual:</p>
                      <code className="text-sm font-mono text-gray-800 dark:text-gray-200 break-all">{secret}</code>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      2. Masukkan kode OTP dari aplikasi:
                    </p>
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 text-center text-lg tracking-widest font-mono"
                      maxLength={6}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleVerify2fa}
                        disabled={is2faLoading}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {is2faLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verifikasi & Aktifkan'}
                      </button>
                      <button
                        onClick={() => { setShow2faSetup(false); setOtpCode(''); setQrCode(''); setSecret(''); }}
                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>}
        </div>

        <p className="text-center text-sm text-gray-500 pt-6 dark:text-gray-400">
          © {new Date().getFullYear()} <span className="font-medium text-gray-700 dark:text-gray-300">Amirul Putra Justicia</span>. Hak cipta dilindungi.
        </p>
      </main>
    </div>
  );
};

export default Profile;
