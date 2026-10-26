import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Search, 
  LogOut, 
  User, 
  Menu, 
  X,
  Bell,
  Sparkles
} from 'lucide-react';
import { UserProfile, FamilyMember } from '../../types';

interface HeaderProps {
  user: UserProfile;
  members: FamilyMember[];
  onLogout: () => void;
  onSelectMember: (m: FamilyMember) => void;
  onOpenMobileMenu: () => void;
  onOpenProfile: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  members,
  onLogout,
  onSelectMember,
  onOpenMobileMenu,
  onOpenProfile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Global search suggestions
  const searchResults = searchQuery.trim().length > 1
    ? members.filter((m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.birthPlace?.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/90 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          {/* Mobile Menu Trigger & Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenMobileMenu}
              className="p-2 -ml-2 rounded-xl text-stone-700 hover:bg-stone-100 lg:hidden cursor-pointer"
              aria-label="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Brand Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-linear-to-br from-emerald-950 via-emerald-900 to-stone-900 text-amber-400 flex items-center justify-center shadow-xs ring-1 ring-amber-400/30">
                <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="hidden xs:block">
                <div className="flex items-baseline gap-2">
                  <span className="font-serif-heritage text-base sm:text-xl font-bold tracking-wider text-stone-900">
                    BANI NALI
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs font-semibold tracking-widest text-amber-800 uppercase">
                  Family Heritage & Genealogy
                </p>
              </div>
            </div>
          </div>

          {/* Global Search Bar */}
          <div className="flex-1 max-w-md relative hidden md:block">
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Cari anggota silsilah di seluruh database..."
                className="w-full pl-10 pr-4 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-800 text-stone-900"
              />
            </div>

            {/* Search Dropdown Modal/List */}
            {isSearchOpen && searchResults.length > 0 && (
              <div 
                className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-lg border border-stone-200 overflow-hidden z-50 animate-in fade-in"
              >
                <div className="p-2 border-b border-stone-100 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                  Hasil Pencarian Global ({searchResults.length})
                </div>
                {searchResults.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      onSelectMember(m);
                      setSearchQuery('');
                      setIsSearchOpen(false);
                    }}
                    className="p-2.5 hover:bg-stone-50 flex items-center justify-between cursor-pointer border-b border-stone-50 last:border-b-0"
                  >
                    <div>
                      <div className="text-xs font-semibold text-stone-900">{m.name}</div>
                      <div className="text-[10px] text-stone-500">
                        {m.gender} {m.birthPlace ? `· ${m.birthPlace}` : ''}
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-800 font-medium">Buka &rarr;</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Section: User Profile & Logout */}
          <div className="flex items-center gap-3">
            <div
              onClick={onOpenProfile}
              className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center justify-center border border-emerald-300">
                {user.displayName ? user.displayName.slice(0, 2).toUpperCase() : 'BN'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-stone-900 leading-tight">
                  {user.displayName || user.email.split('@')[0]}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] uppercase font-bold text-amber-800 bg-amber-50 px-1 rounded">
                    {user.role}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 transition-colors cursor-pointer"
              title="Keluar dari akun"
            >
              <LogOut className="w-4 h-4 text-stone-600" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
