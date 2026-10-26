import React from 'react';
import { 
  Home, 
  GitBranch, 
  Users, 
  HeartHandshake, 
  Calendar, 
  ShieldCheck, 
  User, 
  X, 
  LogOut,
  Images 
} from 'lucide-react';
import { UserProfile } from '../../types';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: string;
  onSelectTab: (tab: string) => void;
  user: UserProfile;
  onLogout: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  isOpen,
  onClose,
  currentTab,
  onSelectTab,
  user,
  onLogout,
}) => {
  const isAdmin = user.role === 'admin';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'tree', label: 'Silsilah Keluarga', icon: GitBranch },
    { id: 'directory', label: 'Daftar Anggota', icon: Users },
    { id: 'relationship', label: 'Hubungan Kekerabatan', icon: HeartHandshake },
    { id: 'gallery', label: 'Album Foto Keluarga', icon: Images },
    { id: 'events', label: 'Acara Keluarga', icon: Calendar },
    { id: 'profile', label: 'Profil Saya', icon: User },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Panel Admin', icon: ShieldCheck });
  }

  return (
    <>
      {/* Mobile Drawer (When Open) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />

          {/* Drawer Box */}
          <div className="relative w-72 max-w-xs bg-white h-full p-6 flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                <div>
                  <h3 className="font-serif-heritage font-bold text-base text-stone-900">
                    BANI NALI
                  </h3>
                  <p className="text-[10px] uppercase font-semibold text-amber-800">
                    Family Heritage
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="mt-6 space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectTab(item.id);
                        onClose();
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-emerald-900 text-white shadow-xs'
                          : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-stone-500'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-stone-100 space-y-3">
              <div className="text-xs text-stone-600">
                <span className="font-semibold block text-stone-900">{user.displayName || user.email}</span>
                <span className="text-[10px] text-amber-800 uppercase font-bold">Peran: {user.role}</span>
              </div>
              <button
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar Akun</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar on Small Screens */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-stone-200/90 py-1.5 px-3 flex items-center justify-around shadow-lg">
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center p-1 text-[10px] font-medium transition-colors ${
            currentTab === 'dashboard' ? 'text-emerald-900 font-bold' : 'text-stone-500'
          }`}
        >
          <Home className="w-4 h-4" />
          <span className="mt-0.5">Beranda</span>
        </button>

        <button
          onClick={() => onSelectTab('tree')}
          className={`flex flex-col items-center p-1 text-[10px] font-medium transition-colors ${
            currentTab === 'tree' ? 'text-emerald-900 font-bold' : 'text-stone-500'
          }`}
        >
          <GitBranch className="w-4 h-4" />
          <span className="mt-0.5">Silsilah</span>
        </button>

        <button
          onClick={() => onSelectTab('directory')}
          className={`flex flex-col items-center p-1 text-[10px] font-medium transition-colors ${
            currentTab === 'directory' ? 'text-emerald-900 font-bold' : 'text-stone-500'
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="mt-0.5">Anggota</span>
        </button>

        <button
          onClick={() => onSelectTab('relationship')}
          className={`flex flex-col items-center p-1 text-[10px] font-medium transition-colors ${
            currentTab === 'relationship' ? 'text-emerald-900 font-bold' : 'text-stone-500'
          }`}
        >
          <HeartHandshake className="w-4 h-4" />
          <span className="mt-0.5">Kekerabatan</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => onSelectTab('admin')}
            className={`flex flex-col items-center p-1 text-[10px] font-medium transition-colors ${
              currentTab === 'admin' ? 'text-emerald-900 font-bold' : 'text-stone-500'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="mt-0.5">Admin</span>
          </button>
        )}
      </div>
    </>
  );
};
