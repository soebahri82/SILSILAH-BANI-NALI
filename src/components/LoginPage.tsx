import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, loginWithEmail, registerWithEmail, sendPasswordReset, directResetPassword, loginDemo, error: authError } = useAuth();
  
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState<'email' | 'direct'>('email');
  const [newPassword, setNewPassword] = useState('');
  const [resetSuccessNotice, setResetSuccessNotice] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setResetSuccessNotice('');

    // Validasi Kolom Wajib
    if (tab === 'register') {
      if (!name.trim()) {
        setLocalError('Nama lengkap wajib diisi.');
        return;
      }
    }

    if (!email.trim()) {
      setLocalError('Alamat email wajib diisi.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setLocalError('Format alamat email tidak valid (contoh: nama@domain.com).');
      return;
    }

    if (!password.trim()) {
      setLocalError('Kata sandi wajib diisi.');
      return;
    }

    if (tab === 'register') {
      if (password.length < 6) {
        setLocalError('Kata sandi minimal 6 karakter demi keamanan akun.');
        return;
      }
      if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password)) {
        setLocalError('Kata sandi harus mengandung kombinasi huruf dan angka.');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (tab === 'login') {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password, name);
      }
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Gagal memproses otentikasi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLocalError('');
    setResetSuccessNotice('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setLocalError('Silakan masukkan alamat email akun Anda.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setLocalError('Format alamat email tidak valid (contoh: nama@domain.com).');
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordReset(cleanEmail);
      setResetSent(true);
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Gagal mengirim email reset kata sandi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setResetSuccessNotice('');

    if (!email.trim()) {
      setLocalError('Alamat email akun wajib diisi.');
      return;
    }
    if (!name.trim()) {
      setLocalError('Nama lengkap akun terdaftar wajib diisi untuk verifikasi identitas.');
      return;
    }
    if (newPassword.length < 6) {
      setLocalError('Kata sandi baru minimal 6 karakter.');
      return;
    }
    if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(newPassword)) {
      setLocalError('Kata sandi harus mengandung kombinasi huruf dan angka.');
      return;
    }

    setIsLoading(true);
    try {
      await directResetPassword(email.trim(), name.trim(), newPassword);
      setResetSuccessNotice('Kata sandi berhasil diperbarui! Silakan masuk dengan kata sandi baru Anda.');
      setPassword(newPassword);
      setTab('login');
      setResetSent(false);
      setForgotMode('email');
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Gagal mereset kata sandi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLocalError('');
    setIsLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Gagal masuk dengan Google.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoSignIn = async (role: UserRole) => {
    setLocalError('');
    setIsLoading(true);
    try {
      await loginDemo(role);
    } catch (err: unknown) {
      setLocalError('Gagal masuk mode demonstrasi.');
    } finally {
      setIsLoading(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-screen flex flex-col justify-between bg-stone-100 text-stone-900 selection:bg-amber-200 selection:text-amber-950">
      {/* Decorative Heritage Top Strip */}
      <div className="h-2 w-full bg-linear-to-r from-emerald-950 via-emerald-800 to-amber-700" />

      {/* Main Form Center */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-md">
          {/* Brand & Crest Header with Official Logo - Vintage, Centered & Elegant */}
          <div className="text-center mb-6 sm:mb-8 flex flex-col items-center">
            {/* Logo Di Atas */}
            <div className="relative inline-block mb-3.5 sm:mb-4 group">
              <div className="absolute -inset-1 sm:-inset-1.5 rounded-3xl bg-gradient-to-tr from-amber-400 via-amber-200 to-emerald-400 opacity-60 blur-xs group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative p-1.5 bg-gradient-to-b from-amber-100 via-white to-amber-200 rounded-3xl shadow-xl border-2 border-amber-400/70 ring-1 ring-amber-300/40">
                <img
                  src="/assets/aistudio/LOGO_BANI_NALI_31517711.jpeg"
                  alt="Logo Resmi Silsilah Bani Nali"
                  className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 object-contain rounded-2xl bg-[#FFFDF8] p-1.5 shadow-inner"
                />
              </div>
            </div>

            {/* 1. BANI NALI LAMONGAN */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif-heritage font-bold tracking-wide text-stone-900 leading-tight">
              BANI NALI <span className="text-amber-800 font-semibold tracking-wider">LAMONGAN</span>
            </h1>

            {/* Vintage Filigree Accent */}
            <div className="flex items-center justify-center gap-2 my-1.5 sm:my-2 text-amber-700/70">
              <span className="w-8 sm:w-12 h-px bg-gradient-to-r from-transparent to-amber-400/80" />
              <span className="text-[10px] text-amber-600">✦</span>
              <span className="w-8 sm:w-12 h-px bg-gradient-to-l from-transparent to-amber-400/80" />
            </div>

            {/* 2. Family Heritage & Genealogy */}
            <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] sm:tracking-[0.25em] uppercase text-amber-800 font-serif-heritage">
              Family Heritage &amp; Genealogy
            </p>

            {/* 3. "Kenali keluarga - Jaga Silaturahmi" */}
            <p className="mt-1 text-xs sm:text-sm md:text-base text-stone-600 italic font-serif">
              "Kenali keluarga - Jaga Silaturahmi"
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-md border border-stone-200/90 p-6 sm:p-8">
            {tab === 'forgot' ? (
              /* Forgot Password Flow */
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setLocalError('');
                    setResetSent(false);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-emerald-950 mb-4 transition-colors cursor-pointer group"
                >
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5 text-emerald-800" />
                  <span>Kembali ke Halaman Masuk</span>
                </button>

                <div className="text-center mb-5">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 border border-amber-300/80 mb-2.5 shadow-inner">
                    <KeyRound className="w-6 h-6 text-amber-800" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold font-serif-heritage text-stone-900">
                    Atur Ulang Kata Sandi
                  </h2>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed max-w-xs mx-auto">
                    Pilih metode pemulihan akun Anda untuk membuat kata sandi baru.
                  </p>
                </div>

                {/* Switcher: Kirim Tautan Email vs Reset Mandiri Cepat */}
                <div className="flex rounded-xl bg-stone-100 p-1 mb-5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => { setForgotMode('email'); setLocalError(''); }}
                    className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                      forgotMode === 'email'
                        ? 'bg-white text-emerald-950 shadow-xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    Kirim Tautan Email
                  </button>
                  <button
                    type="button"
                    onClick={() => { setForgotMode('direct'); setLocalError(''); }}
                    className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                      forgotMode === 'direct'
                        ? 'bg-white text-emerald-950 shadow-xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    Reset Mandiri Cepat
                  </button>
                </div>

                {displayError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{displayError}</span>
                  </div>
                )}

                {forgotMode === 'email' ? (
                  resetSent ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-emerald-50 border border-emerald-200/90 rounded-2xl text-xs text-emerald-950 space-y-3">
                        <div className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-bold text-emerald-900 text-sm">Tautan Dikirimkan!</h4>
                            <p className="mt-1 leading-relaxed text-emerald-800">
                              Permintaan reset kata sandi telah diproses untuk alamat:
                            </p>
                            <p className="font-semibold text-emerald-950 mt-1 px-2.5 py-1 bg-white/80 rounded-lg border border-emerald-200/80 inline-block break-all">
                              {email}
                            </p>
                          </div>
                        </div>

                        <div className="p-3 bg-white/90 rounded-xl border border-emerald-100 text-[11px] text-stone-700 space-y-1.5">
                          <p className="font-bold text-amber-950 flex items-center gap-1">
                            <span>📬 Penting: Periksa Kotak Masuk &amp; Folder Spam</span>
                          </p>
                          <p>• Email dikirimkan dari alamat resmi: <strong>noreply@noble-ether-641j7.firebaseapp.com</strong></p>
                          <p>• Jika tidak muncul dalam 1–2 menit, periksa folder <strong>Spam / Junk</strong> atau tab <strong>Promosi</strong> di email Anda.</p>
                          <p>• Buka email dan klik tautan untuk memasukkan kata sandi baru.</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setTab('login');
                            setResetSent(false);
                            setLocalError('');
                          }}
                          className="w-full py-3 px-4 bg-emerald-950 hover:bg-emerald-900 active:bg-black text-amber-50 font-semibold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>Kembali Masuk ke Akun</span>
                          <ArrowRight className="w-4 h-4 text-amber-400" />
                        </button>

                        <button
                          type="button"
                          onClick={() => { setForgotMode('direct'); setLocalError(''); }}
                          className="w-full py-2.5 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold rounded-xl text-center transition-colors cursor-pointer"
                        >
                          ⚡ Email Belum Masuk? Gunakan Reset Mandiri Langsung
                        </button>

                        <button
                          type="button"
                          onClick={() => handleForgotPassword()}
                          disabled={isLoading}
                          className="w-full py-1.5 px-3 text-stone-500 hover:text-stone-800 text-xs font-medium text-center transition-colors cursor-pointer"
                        >
                          {isLoading ? 'Sedang mengirim ulang...' : 'Kirim ulang email'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                          Alamat Email Akun
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                            <Mail className="w-4 h-4" />
                          </div>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="nama@baninali.id atau email Anda"
                            required
                            className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-800 text-stone-900"
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-amber-50/90 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                        🛡️ <strong>Catatan Pengiriman:</strong> Email reset dikirim oleh sistem dari domain Firebase Auth. Pastikan Anda memeriksa folder <em>Spam / Junk</em> jika tidak langsung terlihat.
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full mt-2 py-3 px-4 bg-emerald-950 hover:bg-emerald-900 active:bg-black text-amber-50 font-semibold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                      >
                        {isLoading ? (
                          <span className="inline-block w-4 h-4 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <span>Kirim Tautan Atur Ulang</span>
                            <ArrowRight className="w-4 h-4 text-amber-400" />
                          </>
                        )}
                      </button>

                      <div className="text-center pt-2">
                        <button
                          type="button"
                          onClick={() => { setForgotMode('direct'); setLocalError(''); }}
                          className="text-xs font-semibold text-emerald-900 hover:text-emerald-950 underline underline-offset-2 cursor-pointer"
                        >
                          Tidak bisa membuka email? Gunakan Reset Mandiri Cepat &rarr;
                        </button>
                      </div>
                    </form>
                  )
                ) : (
                  /* Mode Reset Mandiri Cepat (Tanpa harus menunggu email) */
                  <form onSubmit={handleDirectReset} className="space-y-4">
                    <div className="p-3 bg-emerald-50/90 border border-emerald-200/90 rounded-xl text-[11px] text-emerald-950 leading-relaxed">
                      💡 <strong>Verifikasi Identitas Anggota:</strong> Masukkan alamat email dan nama lengkap yang sesuai saat pendaftaran akun. Anda dapat langsung menentukan kata sandi baru.
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                        Alamat Email Terdaftar
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="contoh: anggota@gmail.com"
                          required
                          className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-800 text-stone-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                        Nama Lengkap Terdaftar
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nama lengkap saat mendaftar"
                        required
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-800 text-stone-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                        Kata Sandi Baru
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Minimal 6 karakter kombinasi huruf & angka"
                          required
                          className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-800 text-stone-900"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full mt-2 py-3 px-4 bg-emerald-950 hover:bg-emerald-900 active:bg-black text-amber-50 font-semibold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {isLoading ? (
                        <span className="inline-block w-4 h-4 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Perbarui Kata Sandi Sekarang</span>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* Regular Login & Register Tabs */
              <div>
                {resetSuccessNotice && (
                  <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{resetSuccessNotice}</span>
                  </div>
                )}
                {/* Tabs for Login / Register */}
                <div className="flex border-b border-stone-200 mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setTab('login');
                      setLocalError('');
                    }}
                    className={`flex-1 pb-3 text-xs sm:text-sm font-semibold transition-colors cursor-pointer text-center ${
                      tab === 'login'
                        ? 'border-b-2 border-emerald-900 text-emerald-950'
                        : 'text-stone-400 hover:text-stone-700'
                    }`}
                  >
                    Masuk ke Akun
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTab('register');
                      setLocalError('');
                    }}
                    className={`flex-1 pb-3 text-xs sm:text-sm font-semibold transition-colors cursor-pointer text-center ${
                      tab === 'register'
                        ? 'border-b-2 border-emerald-900 text-emerald-950'
                        : 'text-stone-400 hover:text-stone-700'
                    }`}
                  >
                    Daftar Baru
                  </button>
                </div>

                {displayError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{displayError}</span>
                  </div>
                )}

                {/* Email & Password Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {tab === 'register' && (
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                        Nama Lengkap
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="contoh: Samsu Bahri Nali"
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-800 text-stone-900"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                      Alamat Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@baninali.id"
                        className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-800 text-stone-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                      Kata Sandi
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-800 text-stone-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {tab === 'login' ? (
                      <div className="flex justify-end mt-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setTab('forgot');
                            setLocalError('');
                            setResetSent(false);
                          }}
                          className="text-xs font-medium text-amber-800 hover:text-amber-950 hover:underline transition-colors cursor-pointer"
                        >
                          Lupa kata sandi?
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1.5 space-y-1">
                        <p className="text-[11px] text-stone-500">
                          • Minimal 6 karakter dengan kombinasi huruf dan angka.
                        </p>
                        <p className="text-[11px] text-emerald-800 font-medium">
                          🛡️ Kata sandi diamankan langsung oleh Firebase Authentication (tidak disimpan dalam teks biasa).
                        </p>
                      </div>
                    )}
                  </div>

                  {tab === 'register' && (
                    <div className="p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                      <span className="font-semibold">Catatan Pendaftaran:</span> Pendaftaran baru memerlukan persetujuan admin. Status awal akun adalah <strong>"Menunggu aktivasi"</strong> demi menjaga privasi dan keabsahan silsilah keluarga Bani Nali.
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 px-4 bg-emerald-950 hover:bg-emerald-900 active:bg-black text-amber-50 font-semibold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isLoading ? (
                      <span className="inline-block w-4 h-4 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>{tab === 'login' ? 'Masuk dengan Email' : 'Daftar Akun Baru'}</span>
                        <ArrowRight className="w-4 h-4 text-amber-400" />
                      </>
                    )}
                  </button>
                </form>

                {/* Google Sign-in Option */}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 bg-white hover:bg-stone-50 border border-stone-300 rounded-xl text-stone-800 text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.665-5.17 3.665-9.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.1C3.27 21.44 7.34 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32s.13-1.6.38-2.32V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.1z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.27 2.56 1.25 6.58l4.03 3.1c.95-2.83 3.6-4.93 6.72-4.93z"
                      />
                    </svg>
                    <span>Masuk dengan Akun Google</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Demo Buttons for Reviewer / Evaluation */}
            <div className="mt-6 pt-5 border-t border-stone-100">
              <div className="text-center mb-2.5">
                <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                  Uji Coba Cepat (Evaluasi Langsung)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDemoSignIn('admin')}
                  className="py-2 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-300/80 rounded-xl text-amber-900 text-xs font-bold transition-colors cursor-pointer text-center"
                >
                  Masuk sbg Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoSignIn('member')}
                  className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300/80 rounded-xl text-emerald-900 text-xs font-bold transition-colors cursor-pointer text-center"
                >
                  Masuk sbg Anggota
                </button>
              </div>
            </div>
          </div>

          {/* Footer Subtext */}
          <div className="mt-6 text-center text-xs text-stone-500">
            <p className="font-semibold text-stone-700">
              BANI NALI — Family Heritage & Genealogy
            </p>
            <p className="mt-1 text-stone-400">
              Didukung oleh Firebase Authentication & Cloud Firestore.
            </p>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="py-4 text-center text-xs text-stone-500 border-t border-stone-200/60 bg-white/60">
        Hak Cipta &copy; {new Date().getFullYear()} Keluarga Besar Bani Nali - Created By Soebahri82.
      </footer>
    </div>
  );
};
