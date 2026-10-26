import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  UserPlus, 
  KeyRound,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, loginWithEmail, registerWithEmail, loginDemo, error: authError } = useAuth();
  
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('soebahri82@gmail.com');
  const [password, setPassword] = useState('keluargabesar2026');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!email.trim() || !password.trim()) {
      setLocalError('Silakan lengkapi email dan kata sandi Anda.');
      return;
    }

    setIsLoading(true);
    try {
      if (tab === 'login') {
        await loginWithEmail(email, password);
      } else {
        if (!name.trim()) {
          setLocalError('Silakan masukkan nama lengkap Anda.');
          setIsLoading(false);
          return;
        }
        await registerWithEmail(email, password, name);
      }
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Gagal memproses otentikasi.');
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
          {/* Brand & Crest Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-emerald-950 via-emerald-900 to-stone-900 text-amber-400 shadow-lg mb-3 ring-4 ring-amber-100/80">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-semibold tracking-wide text-stone-900 font-serif-heritage">
              BANI NALI
            </h1>
            <p className="mt-1 text-xs sm:text-sm font-semibold tracking-widest uppercase text-amber-800">
              Family Heritage & Genealogy
            </p>
            <p className="mt-1.5 text-xs text-stone-600 max-w-xs mx-auto">
              Portal silsilah keluarga, arsip sejarah, dan temu ukhuwah antargenerasi.
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-md border border-stone-200/90 p-6 sm:p-8">
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
                    placeholder="contoh: Ahmad Fauzi Nali"
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
        Hak Cipta &copy; {new Date().getFullYear()} Keluarga Besar Bani Nali. Dilindungi Undang-Undang.
      </footer>
    </div>
  );
};
