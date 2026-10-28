import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { DashboardPage } from './components/DashboardPage';
import { testConnection } from './firebase/config';
function AppContent() {
  const { user, userProfile, loading } = useAuth();

  useEffect(() => {
    testConnection();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4 text-center selection:bg-amber-100">
        <div className="relative mb-4 group">
          <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-tr from-amber-400 via-amber-200 to-emerald-400 opacity-70 blur-xs animate-pulse" />
          <div className="relative p-1.5 bg-gradient-to-b from-amber-100 via-white to-amber-200 rounded-2xl shadow-xl border border-amber-300">
            <img
              src="/assets/aistudio/LOGO_BANI_NALI_31517711.jpeg"
              alt="Logo Silsilah Bani Nali"
              className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-xl bg-white p-1"
            />
          </div>
        </div>

        <h1 className="font-serif-heritage text-2xl sm:text-3xl font-bold text-stone-900 tracking-wide">
          BANI NALI
        </h1>
        <p className="text-xs uppercase font-semibold tracking-widest text-amber-800 mt-1">
          Lamongan · Family Heritage &amp; Genealogy
        </p>
        <p className="text-xs text-stone-500 italic font-serif mt-1">
          "Kenali keluarga - Jaga Silaturahmi"
        </p>

        <div className="mt-6 inline-flex items-center gap-2.5 px-4 py-2 bg-white/80 backdrop-blur-xs rounded-full border border-stone-200 shadow-2xs text-xs text-stone-600">
          <span className="w-4 h-4 border-2 border-emerald-800 border-t-amber-500 rounded-full animate-spin" />
          <span className="font-medium">Memuat portal silsilah keluarga...</span>
        </div>
      </div>
    );
  }

  return userProfile ? <DashboardPage /> : <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
