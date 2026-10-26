import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  ShieldCheck, 
  Calendar, 
  CheckCircle2, 
  Edit3, 
  Link as LinkIcon, 
  Save,
  Lock
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { UserProfile, FamilyMember } from '../../types';

interface UserProfileViewProps {
  user: UserProfile;
  members: FamilyMember[];
  onRefreshUser: () => void;
  onSelectMember: (m: FamilyMember) => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  user,
  members,
  onRefreshUser,
  onSelectMember,
}) => {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const linkedMember = user.linkedMemberID
    ? members.find((m) => m.id === user.linkedMemberID) || null
    : null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMsg('');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName,
        updatedAt: new Date().toISOString(),
      });
      setMsg('Nama tampilan berhasil disimpan.');
      setIsEditing(false);
      onRefreshUser();
    } catch (err: unknown) {
      setMsg('Gagal memperbarui profil.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-stone-200/90 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-900 text-amber-300 font-bold text-2xl flex items-center justify-center shadow-md shrink-0">
            {displayName ? displayName.slice(0, 2).toUpperCase() : 'BN'}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold font-serif-heritage text-stone-900 truncate">
              {displayName || user.email}
            </h2>
            <div className="flex items-center gap-2 text-xs text-stone-500 mt-1">
              <span className="font-semibold text-emerald-800 uppercase px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                Peran: {user.role}
              </span>
              <span>·</span>
              <span className="font-mono text-stone-600">{user.email}</span>
            </div>
          </div>
        </div>

        {msg && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-medium">
            {msg}
          </div>
        )}
      </div>

      {/* Account Details Box */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200/90 shadow-xs space-y-4 text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <h3 className="font-semibold text-sm text-stone-900">
            Informasi Akun Firebase
          </h3>
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="text-emerald-800 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Batal' : 'Ubah Nama'}</span>
          </button>
        </div>

        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Nama Tampilan (Display Name)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-semibold cursor-pointer"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-stone-400 block mb-0.5">UID Pengguna</span>
              <span className="font-mono text-stone-700 block truncate">{user.uid}</span>
            </div>
            <div>
              <span className="text-stone-400 block mb-0.5">Alamat Email</span>
              <span className="font-medium text-stone-800">{user.email}</span>
            </div>
            <div>
              <span className="text-stone-400 block mb-0.5">Waktu Terdaftar</span>
              <span className="font-medium text-stone-800">
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString('id-ID') : '-'}
              </span>
            </div>
            <div>
              <span className="text-stone-400 block mb-0.5">Status Akun</span>
              <span className="font-medium text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Aktif
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Linked Member Card */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200/90 shadow-xs space-y-3">
        <h3 className="font-semibold text-sm text-stone-900 flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-emerald-800" />
          <span>Tautan Data Silsilah Keluarga</span>
        </h3>

        {linkedMember ? (
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between gap-4">
            <div>
              <h4 className="font-semibold text-stone-900 text-sm">{linkedMember.name}</h4>
              <p className="text-xs text-stone-500 mt-0.5">
                ID: {linkedMember.id} · {linkedMember.gender} · {linkedMember.birthPlace || 'Bani Nali'}
              </p>
            </div>
            <button
              onClick={() => onSelectMember(linkedMember)}
              className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Lihat di Pohon
            </button>
          </div>
        ) : (
          <p className="text-xs text-stone-500 leading-relaxed">
            Akun ini belum ditautkan ke entri anggota silsilah spesifik. 
            Hubungi Administrator di Panel Admin untuk menautkan akun Anda dengan nama di pohon keluarga Bani Nali.
          </p>
        )}
      </div>
    </div>
  );
};
