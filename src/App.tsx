import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { DashboardPage } from './components/DashboardPage';
import { testConnection } from './firebase/config';
import { ShieldCheck } from 'lucide-react';

function AppContent() {
  const { user, userProfile, loading } = useAuth();

  useEffect(() => {
    testConnection();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-emerald-950 via-emerald-900 to-stone-900 text-amber-400 flex items-center justify-center shadow-lg mb-4 ring-4 ring-amber-100">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="font-serif-heritage text-2xl font-bold text-stone-900 tracking-wide">
          BANI NALI
        </h1>
        <p className="text-xs uppercase font-semibold tracking-widest text-amber-800 mt-1">
          Family Heritage & Genealogy
        </p>
        <div className="mt-6 flex items-center gap-2 text-xs text-stone-500">
          <span className="w-4 h-4 border-2 border-emerald-900 border-t-transparent rounded-full animate-spin" />
          <span>Menghubungkan ke layanan silsilah...</span>
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
