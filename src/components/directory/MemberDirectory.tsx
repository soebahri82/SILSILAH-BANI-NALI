import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  LayoutGrid, 
  List, 
  UserPlus, 
  MapPin, 
  Calendar, 
  Phone,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Lock,
  Heart
} from 'lucide-react';
import { FamilyMember } from '../../types';
import { getMemberSpouses } from '../../utils/familyTreeUtils';
import { isMale, isFemale, getGenderCode, getGenderDisplay } from '../../utils/genderUtils';

interface MemberDirectoryProps {
  members: FamilyMember[];
  isAdmin: boolean;
  onSelectMember: (m: FamilyMember) => void;
  onAddNewMember?: () => void;
}

export const MemberDirectory: React.FC<MemberDirectoryProps> = ({
  members,
  isAdmin,
  onSelectMember,
  onAddNewMember,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'L' | 'P'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'living' | 'deceased'>('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'birth_asc' | 'birth_desc'>('name_asc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Filter and sort logic
  const filteredMembers = useMemo(() => {
    return members
      .filter((m) => {
        // Search filter
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchName = m.name.toLowerCase().includes(q);
          const matchPlace = m.birthPlace?.toLowerCase().includes(q);
          const matchBio = m.bio?.toLowerCase().includes(q);
          if (!matchName && !matchPlace && !matchBio) return false;
        }

        // Gender filter: L or P
        if (genderFilter !== 'all' && getGenderCode(m.gender) !== genderFilter) {
          return false;
        }

        // Status filter
        if (statusFilter === 'living' && m.deathDate) return false;
        if (statusFilter === 'deceased' && !m.deathDate) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
        if (sortBy === 'birth_asc') return (a.birthDate || '').localeCompare(b.birthDate || '');
        if (sortBy === 'birth_desc') return (b.birthDate || '').localeCompare(a.birthDate || '');
        return 0;
      });
  }, [members, searchTerm, genderFilter, statusFilter, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredMembers.length / pageSize) || 1;
  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMembers.slice(start, start + pageSize);
  }, [filteredMembers, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* Header & Controls Bar */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold font-serif-heritage text-stone-900">
              Daftar Anggota Keluarga
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Direktori seluruh keturunan dan kerabat Bani Nali ({filteredMembers.length} terdata)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && onAddNewMember && (
              <button
                onClick={onAddNewMember}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Tambah Anggota</span>
              </button>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center p-1 bg-stone-100 rounded-lg border border-stone-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
                title="Tampilan Kartu"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
                title="Tampilan Tabel"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter and Search Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari nama, kota, bio..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-800 text-stone-900"
            />
          </div>

          {/* Gender Filter */}
          <div>
            <select
              value={genderFilter}
              onChange={(e) => {
                setGenderFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-800 text-stone-900"
            >
              <option value="all">Semua Jenis Kelamin</option>
              <option value="L">L = Laki-laki</option>
              <option value="P">P = Perempuan</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-800 text-stone-900"
            >
              <option value="all">Semua Status Hidup</option>
              <option value="living">Masih Hidup</option>
              <option value="deceased">Almarhum / Almarhumah</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-800 text-stone-900"
            >
              <option value="name_asc">Urutkan: Nama (A – Z)</option>
              <option value="name_desc">Urutkan: Nama (Z – A)</option>
              <option value="birth_asc">Tahun Lahir (Terlama)</option>
              <option value="birth_desc">Tahun Lahir (Terbaru)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main List Display */}
      {paginatedMembers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-stone-500">
          <ShieldAlert className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <h3 className="text-base font-semibold text-stone-800">
            Tidak Ada Anggota Ditemukan
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
            Silakan sesuaikan kata kunci pencarian atau ubah filter untuk menampilkan data keluarga.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedMembers.map((member) => {
            const male = isMale(member.gender);
            const isDeceased = !!member.deathDate;
            const bYear = member.birthDate ? member.birthDate.split('-')[0] : '';
            const dYear = member.deathDate ? member.deathDate.split('-')[0] : '';

            return (
              <div
                key={member.id}
                onClick={() => onSelectMember(member)}
                className="bg-white rounded-2xl border border-stone-200/90 hover:border-emerald-700 p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start gap-3.5 mb-3">
                    {member.photoURL ? (
                      <img
                        src={member.photoURL}
                        alt={member.name}
                        className="w-12 h-12 rounded-xl object-cover border border-stone-200 shrink-0"
                      />
                    ) : (
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                          male
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-stone-900 group-hover:text-emerald-900 truncate">
                        {member.name}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-0.5">
                        <span className={male ? 'text-emerald-800 font-semibold' : 'text-amber-800 font-semibold'}>
                          {getGenderDisplay(member.gender)}
                        </span>
                        {isDeceased && (
                          <>
                            <span>·</span>
                            <span className="text-[10px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-600 font-medium border border-stone-200">
                              Wafat
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-stone-600 my-2">
                    {member.birthPlace && (
                      <div className="flex items-center gap-2 truncate">
                        <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="truncate">{member.birthPlace}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span>
                        {isDeceased
                          ? `${bYear || '?'} – ${dYear} (Alm.)`
                          : bYear ? `Lahir tahun ${bYear}` : 'Tahun belum dicatat'}
                      </span>
                    </div>

                    {(() => {
                      const spouses = getMemberSpouses(member, members);
                      if (spouses.length === 0) return null;
                      return (
                        <div className="flex items-center gap-1.5 text-amber-800 bg-amber-50/80 p-1.5 rounded-lg border border-amber-200/70 text-[11px] mt-1">
                          <Heart className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="truncate font-medium">
                            {spouses.length > 1
                              ? `${spouses.length} Pasangan: ${spouses.map((s) => s.name.split(' ')[0]).join(', ')}`
                              : `Pasangan: ${spouses[0].name}`}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-100 mt-2 flex items-center justify-between text-[11px] text-stone-400">
                  <span>ID: {member.id}</span>
                  <span className="text-emerald-800 font-medium group-hover:underline">
                    Buka Profil &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table List View */
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700">
              <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider text-[11px] border-b border-stone-200">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Nama Lengkap</th>
                  <th className="py-3.5 px-4 font-semibold">Gender</th>
                  <th className="py-3.5 px-4 font-semibold">Kelahiran</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">Domisili</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {paginatedMembers.map((member) => (
                  <tr
                    key={member.id}
                    onClick={() => onSelectMember(member)}
                    className="hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-semibold text-stone-900 flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${
                          isMale(member.gender)
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="truncate max-w-xs">{member.name}</span>
                    </td>
                    <td className="py-3 px-4 text-stone-600 font-medium">
                      {getGenderDisplay(member.gender)}
                    </td>
                    <td className="py-3 px-4 text-stone-600">
                      {member.birthDate || '-'}
                      {member.birthPlace ? ` (${member.birthPlace})` : ''}
                    </td>
                    <td className="py-3 px-4">
                      {member.deathDate ? (
                        <span className="text-[10px] bg-stone-200/80 text-stone-700 px-2 py-0.5 rounded font-medium">
                          Wafat ({member.deathDate.split('-')[0]})
                        </span>
                      ) : (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">
                          Hidup
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-stone-600 truncate max-w-xs">
                      {isAdmin || member.privacy !== 'private' ? (
                        member.address || '-'
                      ) : (
                        <span className="text-stone-400 italic flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Privat
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-emerald-800">
                      Detail &rarr;
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-stone-200 text-xs text-stone-600">
          <div>
            Halaman <span className="font-semibold text-stone-900">{currentPage}</span> dari{' '}
            <span className="font-semibold text-stone-900">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
