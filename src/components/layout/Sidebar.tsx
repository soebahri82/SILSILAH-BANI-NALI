import React from 'react';
import { 
  Home, 
  GitBranch, 
  Users, 
  HeartHandshake, 
  Calendar, 
  User, 
  ShieldCheck, 
  LogOut,
  ChevronRight,
  Images
} from 'lucide-react';
import { UserProfile } from '../../types';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  user: UserProfile;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
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
    <aside className="w-64 shrink-0 hidden lg:flex flex-col justify-between bg-white rounded-2xl border border-stone-200/90 p-4 shadow-xs self-start sticky top-24">
      <div className="space-y-6">
        {/* Heritage Crest Title Mini */}
        <div className="px-3 py-2 bg-stone-50 rounded-xl border border-stone-200/70">
          <div className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
            Menu Utama
          </div>
          <div className="text-xs font-semibold text-stone-800 font-serif-heritage">
            Bani Nali Genealogy
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-stone-500'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-amber-300" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom User Info & Logout */}
      <div className="pt-4 border-t border-stone-100 space-y-3">
        <div className="px-3 py-2 bg-emerald-50/70 rounded-xl border border-emerald-100 text-xs">
          <div className="font-semibold text-emerald-950 truncate">
            {user.displayName || user.email}
          </div>
          <div className="text-[10px] text-emerald-800 font-medium">
            Peran: <strong className="uppercase">{user.role}</strong>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-stone-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar Sesi</span>
        </button>
      </div>
    </aside>
  );
};
