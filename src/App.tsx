import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { DashboardPage } from './components/DashboardPage';
import { PendingApprovalView } from './components/PendingApprovalView';
import { testConnection } from './firebase/config';

function AppContent() {
  const { userProfile, loading, isAdmin } = useAuth();

  useEffect(() => {
    testConnection();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4 text-center selection:bg-amber-100">
        {/* Floating Logo Badge with Existing Glow Effect */}
        <div className="relative group animate-float mb-7 sm:mb-8">
          <div className="absolute -inset-1.5 sm:-inset-2 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-amber-400 via-amber-200 to-emerald-400 opacity-70 blur-xs animate-pulse" />
          <div className="relative p-1.5 sm:p-2 bg-gradient-to-b from-amber-100 via-white to-amber-200 rounded-2xl sm:rounded-3xl shadow-xl border border-amber-300">
            <img
              src="/assets/aistudio/LOGO_BANI_NALI_31517711.jpeg"
              alt="Logo Silsilah Bani Nali"
              className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded-xl sm:rounded-2xl bg-white p-1"
            />
          </div>
        </div>

        {/* Elegant Indeterminate Loading Bar */}
        <div className="w-44 sm:w-56 h-1.5 sm:h-2 bg-stone-200/90 rounded-full overflow-hidden p-[1px] border border-amber-300/60 shadow-inner relative">
          <div className="w-1/2 h-full rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-emerald-700 shadow-xs animate-loading-bar" />
        </div>
      </div>
    );
  }

  // Not logged in -> LoginPage
  if (!userProfile) {
    return <LoginPage />;
  }

  // Admin always has immediate access
  if (isAdmin || userProfile.role === 'admin') {
    return <DashboardPage />;
  }

  // Check activation status for regular members
  const status = userProfile.activationStatus || (userProfile.active ? 'active' : 'pending');
  if (status !== 'active') {
    return <PendingApprovalView />;
  }

  return <DashboardPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
