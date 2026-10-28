import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Clock, ShieldAlert, LogOut, RefreshCw, CheckCircle2, UserCheck, AlertOctagon } from 'lucide-react';

export const PendingApprovalView: React.FC = () => {
  const { userProfile, logout, refreshUserProfile } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const status = userProfile?.activationStatus || (userProfile?.active ? 'active' : 'pending');

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      await refreshUserProfile();
      setRefreshMessage('Status akun berhasil diperbarui.');
    } catch (e) {
      setRefreshMessage('Gagal memperbarui status. Silakan coba lagi.');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-between text-stone-900 selection:bg-amber-200">
      {/* Top Heritage Strip */}
      <div className="h-2 w-full bg-linear-to-r from-emerald-950 via-emerald-800 to-amber-700" />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-lg">
          {/* Logo Badge */}
          <div className="text-center mb-6 flex flex-col items-center">
            <div className="relative inline-block mb-3.5 group animate-float">
              <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-tr from-amber-400 via-amber-200 to-emerald-400 opacity-70 blur-xs" />
              <div className="relative p-1.5 bg-gradient-to-b from-amber-100 via-white to-amber-200 rounded-3xl shadow-xl border-2 border-amber-400/70 ring-1 ring-amber-300/40">
                <img
                  src="/assets/aistudio/LOGO_BANI_NALI_31517711.jpeg"
                  alt="Logo Resmi Silsilah Bani Nali"
                  className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-2xl bg-[#FFFDF8] p-1 shadow-inner"
                />
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-serif-heritage font-bold tracking-wide text-stone-900 leading-tight">
              BANI NALI <span className="text-amber-800 font-semibold tracking-wider">LAMONGAN</span>
            </h1>
            <p className="mt-1 text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-amber-800 font-serif-heritage">
              Family Heritage &amp; Genealogy
            </p>
          </div>

          {/* Main Status Card */}
          <div className="bg-white rounded-2xl shadow-md border border-stone-200/90 p-6 sm:p-8">
            {status === 'pending' && (
              <div className="space-y-5 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-700 flex items-center justify-center shadow-xs">
                  <Clock className="w-7 h-7" />
                </div>

                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 mb-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    Menunggu Aktivasi
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold font-serif-heritage text-stone-900 mt-1">
                    Menunggu Persetujuan Admin
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 mt-2 font-medium">
                    Akun Anda sedang menunggu persetujuan admin.
                  </p>
                </div>

                {/* Account Details Box */}
                <div className="bg-stone-50 rounded-xl p-4 border border-stone-200/80 text-left space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-stone-200/60">
                    <span className="text-stone-500">Nama Lengkap:</span>
                    <span className="font-semibold text-stone-900">{userProfile?.displayName || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-stone-200/60">
                    <span className="text-stone-500">Alamat Email:</span>
                    <span className="font-semibold text-stone-900 font-mono text-[11px]">{userProfile?.email || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-stone-200/60">
                    <span className="text-stone-500">Waktu Pendaftaran:</span>
                    <span className="font-medium text-stone-800">{formatDate(userProfile?.registeredAt || userProfile?.createdAt)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-stone-500">Status Akses:</span>
                    <span className="font-bold text-amber-800">Menunggu aktivasi</span>
                  </div>
                </div>

                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/70 rounded-xl text-left text-xs text-emerald-950 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Data pendaftaran Anda telah tersimpan dengan aman di database. Demi menjaga privasi dan keabsahan silsilah trah Bani Nali, administrator akan memeriksa dan mengaktifkan akun Anda sebelum Anda dapat mengakses silsilah keluarga.
                  </p>
                </div>

                {refreshMessage && (
                  <p className="text-xs text-emerald-700 font-medium">{refreshMessage}</p>
                )}

                {/* Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex-1 py-2.5 px-4 bg-emerald-900 hover:bg-emerald-800 text-amber-50 font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>Periksa Status Persetujuan</span>
                  </button>

                  <button
                    type="button"
                    onClick={logout}
                    className="py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs sm:text-sm rounded-xl border border-stone-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-stone-500" />
                    <span>Keluar</span>
                  </button>
                </div>
              </div>
            )}

            {status === 'rejected' && (
              <div className="space-y-5 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 border-2 border-red-300 text-red-700 flex items-center justify-center shadow-xs">
                  <ShieldAlert className="w-7 h-7" />
                </div>

                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-red-100 text-red-900 border border-red-300 mb-2">
                    Pendaftaran Ditolak
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold font-serif-heritage text-stone-900 mt-1">
                    Akses Tidak Disetujui
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 mt-2 font-medium">
                    Pendaftaran akun Anda ditolak oleh admin. Silakan hubungi pengurus keluarga besar Bani Nali untuk konfirmasi lebih lanjut.
                  </p>
                </div>

                <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 text-left space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-stone-500">Email:</span>
                    <span className="font-semibold text-stone-900 font-mono">{userProfile?.email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-500">Waktu Keputusan:</span>
                    <span className="font-medium text-stone-800">{formatDate(userProfile?.decisionAt || userProfile?.updatedAt)}</span>
                  </div>
                  {userProfile?.decidedBy && (
                    <div className="flex justify-between items-center">
                      <span className="text-stone-500">Diverifikasi oleh:</span>
                      <span className="font-medium text-stone-800">{userProfile.decidedBy}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Kembali ke Halaman Masuk</span>
                  </button>
                </div>
              </div>
            )}

            {status === 'disabled' && (
              <div className="space-y-5 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-800 flex items-center justify-center shadow-xs">
                  <AlertOctagon className="w-7 h-7" />
                </div>

                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-stone-200 text-stone-800 border border-stone-300 mb-2">
                    Akun Dinonaktifkan
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold font-serif-heritage text-stone-900 mt-1">
                    Akun Dinonaktifkan oleh Admin
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 mt-2 font-medium">
                    Akun Anda saat ini dinonaktifkan oleh administrator. Silakan hubungi pengurus silsilah keluarga Bani Nali untuk mengaktifkan kembali akun Anda.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Keluar</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 text-center text-xs text-stone-500">
            <p className="font-semibold text-stone-700">BANI NALI — Silsilah &amp; Dokumentasi Keluarga</p>
            <p className="mt-0.5 text-stone-400">Hubungi pengurus keluarga jika membutuhkan aktivasi segera.</p>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-stone-500 border-t border-stone-200/60 bg-white/60">
        Hak Cipta &copy; {new Date().getFullYear()} Keluarga Besar Bani Nali. Dilindungi Undang-Undang.
      </footer>
    </div>
  );
};
