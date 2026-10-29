import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FamilyMember, FamilyEvent, FamilyPhoto } from '../types';
import { subscribeMembers, seedInitialBaniNali, standardizeDatabaseRecords, deleteMember } from '../services/memberService';
import { subscribeEvents, seedInitialEvents } from '../services/eventService';
import { subscribePhotos, seedInitialPhotos } from '../services/photoService';
import { Header } from './layout/Header';
import { Sidebar } from './layout/Sidebar';
import { MobileNav } from './layout/MobileNav';
import { DashboardView } from './dashboard/DashboardView';
import { FamilyTreeViewer } from './familyTree/FamilyTreeViewer';
import { MemberDirectory } from './directory/MemberDirectory';
import { RelationshipCalculatorView } from './relationship/RelationshipCalculatorView';
import { EventsView } from './events/EventsView';
import { FamilyAlbumView } from './album/FamilyAlbumView';
import { AdminPanel } from './admin/AdminPanel';
import { UserProfileView } from './profile/UserProfileView';
import { MemberProfileModal } from './profile/MemberProfileModal';
import { Maximize2, Trash2, AlertTriangle } from 'lucide-react';
import { getGenderDisplay } from '../utils/genderUtils';

export const DashboardPage: React.FC = () => {
  const { userProfile, isAdmin, logout, refreshUserProfile } = useAuth();
  
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isTreeExpanded, setIsTreeExpanded] = useState<boolean>(true);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [photos, setPhotos] = useState<FamilyPhoto[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Admin Direct Edit Redirection State
  const [adminInitialTab, setAdminInitialTab] = useState<'members' | 'events' | 'users' | 'migration'>('members');
  const [memberToEdit, setMemberToEdit] = useState<FamilyMember | null>(null);
  const [eventToEdit, setEventToEdit] = useState<FamilyEvent | null>(null);

  // Modal Profile State
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [highlightedTreeMemberId, setHighlightedTreeMemberId] = useState<string | null>(null);

  // Delete Member Confirmation State
  const [memberToDelete, setMemberToDelete] = useState<FamilyMember | null>(null);
  const [isDeletingMember, setIsDeletingMember] = useState(false);

  // Mobile drawer state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Handlers to jump directly to Edit Member or Edit Event in Admin Panel
  const handleEditMemberFromAnywhere = (member: FamilyMember) => {
    setSelectedMember(null);
    setMemberToEdit(member);
    setEventToEdit(null);
    setAdminInitialTab('members');
    setCurrentTab('admin');
  };

  const handleEditEventFromAnywhere = (event: FamilyEvent) => {
    setEventToEdit(event);
    setMemberToEdit(null);
    setAdminInitialTab('events');
    setCurrentTab('admin');
  };

  const handleAddMemberFromAnywhere = () => {
    setMemberToEdit(null);
    setEventToEdit(null);
    setAdminInitialTab('members');
    setCurrentTab('admin');
  };

  const handleAddEventFromAnywhere = () => {
    setEventToEdit(null);
    setMemberToEdit(null);
    setAdminInitialTab('events');
    setCurrentTab('admin');
  };

  const handleConfirmDeleteMember = async () => {
    if (!memberToDelete) return;
    setIsDeletingMember(true);
    try {
      await deleteMember(memberToDelete.id);
      if (selectedMember?.id === memberToDelete.id) {
        setSelectedMember(null);
      }
      setMemberToDelete(null);
    } catch (err) {
      console.error('Gagal menghapus anggota:', err);
    } finally {
      setIsDeletingMember(false);
    }
  };

  // Subscribe to Firestore collections & auto-standardize database if admin
  useEffect(() => {
    setLoadingData(true);
    let unsubMembers: (() => void) | undefined;
    let unsubEvents: (() => void) | undefined;
    let unsubPhotos: (() => void) | undefined;

    try {
      unsubMembers = subscribeMembers(
        (data) => {
          setMembers(data);
          setLoadingData(false);
        },
        (err) => {
          console.error('Error fetching members:', err);
          setDataError(err.message);
          setLoadingData(false);
        }
      );

      unsubEvents = subscribeEvents(
        (data) => {
          setEvents(data);
        },
        (err) => {
          console.error('Error fetching events:', err);
        }
      );

      unsubPhotos = subscribePhotos(
        (data) => {
          setPhotos(data);
        },
        (err) => {
          console.error('Error fetching photos:', err);
        }
      );

      // Seed initial album photos if empty
      seedInitialPhotos().catch((e) => console.warn('Photo seed notice:', e));
    } catch (e: unknown) {
      setDataError(e instanceof Error ? e.message : 'Gagal terhubung ke Firestore.');
      setLoadingData(false);
    }

    return () => {
      if (unsubMembers) unsubMembers();
      if (unsubEvents) unsubEvents();
      if (unsubPhotos) unsubPhotos();
    };
  }, []);

  const handleSeedData = async () => {
    try {
      await seedInitialBaniNali();
      await seedInitialEvents();
    } catch (err) {
      console.error('Seed error:', err);
    }
  };

  const handleOpenTreeWithMember = (m: FamilyMember) => {
    setHighlightedTreeMemberId(m.id);
    setCurrentTab('tree');
  };

  if (!userProfile) return null;

  return (
    <div className="min-h-screen flex flex-col bg-stone-100 text-stone-900 pb-16 lg:pb-0">
      {/* Top Fixed Header */}
      <Header
        user={userProfile}
        members={members}
        onLogout={logout}
        onSelectMember={(m) => setSelectedMember(m)}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        onOpenProfile={() => setCurrentTab('profile')}
      />

      {/* Main Body with Sidebar + Tab Content */}
      <div
        className={`flex-1 w-full mx-auto py-5 sm:py-7 flex gap-6 sm:gap-8 transition-all ${
          currentTab === 'tree'
            ? isTreeExpanded
              ? 'max-w-full px-2 sm:px-4'
              : 'max-w-[1750px] px-3 sm:px-6'
            : 'max-w-7xl px-4 sm:px-6 lg:px-8'
        }`}
      >
        {/* Desktop Sidebar (can be collapsed in wide tree mode) */}
        {!(currentTab === 'tree' && isTreeExpanded) && (
          <Sidebar
            currentTab={currentTab}
            onSelectTab={(t) => setCurrentTab(t)}
            user={userProfile}
            onLogout={logout}
          />
        )}

        {/* Dynamic Tab Views */}
        <main className="flex-1 min-w-0">
          {loadingData ? (
            <div className="bg-white rounded-2xl border border-stone-200/90 p-10 sm:p-14 text-center text-stone-500 shadow-xs flex flex-col items-center justify-center">
              <div className="relative mb-4 animate-float">
                <div className="w-16 h-16 rounded-2xl bg-white p-1 border border-amber-300 shadow-xs flex items-center justify-center">
                  <img
                    src="/assets/aistudio/LOGO_BANI_NALI_31517711.jpeg"
                    alt="Logo Bani Nali"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-900 border-2 border-white flex items-center justify-center shadow-xs">
                  <span className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
              </div>
              <h3 className="text-sm font-semibold text-stone-900 font-serif-heritage">
                Memuat Data Silsilah Bani Nali...
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                Mengambil data langsung dari Cloud Firestore.
              </p>
            </div>
          ) : dataError ? (
            <div className="bg-red-50 rounded-2xl border border-red-200 p-8 text-center text-red-900 shadow-xs">
              <h3 className="text-base font-bold text-red-800">
                Terjadi Kesalahan Koneksi Data
              </h3>
              <p className="text-xs text-red-700 mt-1 max-w-md mx-auto">
                {dataError}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-red-800 hover:bg-red-900 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Coba Muat Ulang
              </button>
            </div>
          ) : (
            <>
              {currentTab === 'dashboard' && (
                <DashboardView
                  user={userProfile}
                  members={members}
                  events={events}
                  onNavigateTab={(t) => setCurrentTab(t)}
                  onSelectMember={(m) => setSelectedMember(m)}
                  onSeedInitialData={handleSeedData}
                />
              )}

              {currentTab === 'tree' && (
                <div className="space-y-4 mb-16">
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold font-serif-heritage text-stone-900">
                        Bagan Silsilah Interaktif (Family Tree)
                      </h2>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Silsilah pohon keluarga dinamis dari relasi parentID dan spouseID di Cloud Firestore
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        onClick={() => setIsTreeExpanded(!isTreeExpanded)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isTreeExpanded
                            ? 'bg-emerald-900 text-white shadow-xs'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200'
                        }`}
                        title={
                          isTreeExpanded
                            ? 'Kembalikan lebar standar dengan sidebar'
                            : 'Lebarkan tampilan silsilah (sembunyikan sidebar)'
                        }
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>{isTreeExpanded ? 'Tampilkan Sidebar' : 'Mode Layar Luas'}</span>
                      </button>
                    </div>
                  </div>

                  <FamilyTreeViewer
                    members={members}
                    onSelectMember={(m) => setSelectedMember(m)}
                    highlightedMemberId={highlightedTreeMemberId}
                  />
                </div>
              )}

              {currentTab === 'directory' && (
                <MemberDirectory
                  members={members}
                  isAdmin={isAdmin}
                  onSelectMember={(m) => setSelectedMember(m)}
                  onAddNewMember={handleAddMemberFromAnywhere}
                  onEditMember={handleEditMemberFromAnywhere}
                />
              )}

              {currentTab === 'relationship' && (
                <RelationshipCalculatorView
                  members={members}
                  onSelectMember={(m) => setSelectedMember(m)}
                />
              )}

              {currentTab === 'gallery' && (
                <FamilyAlbumView
                  photos={photos}
                  user={userProfile}
                  isAdmin={isAdmin}
                />
              )}

              {currentTab === 'events' && (
                <EventsView
                  events={events}
                  isAdmin={isAdmin}
                  onAddEvent={handleAddEventFromAnywhere}
                  onEditEvent={handleEditEventFromAnywhere}
                />
              )}

              {currentTab === 'profile' && (
                <UserProfileView
                  user={userProfile}
                  members={members}
                  onRefreshUser={refreshUserProfile}
                  onSelectMember={(m) => setSelectedMember(m)}
                />
              )}

              {currentTab === 'admin' && isAdmin && (
                <AdminPanel
                  members={members}
                  events={events}
                  initialTab={adminInitialTab}
                  initialEditMember={memberToEdit}
                  initialEditEvent={eventToEdit}
                  onClearInitialEditMember={() => setMemberToEdit(null)}
                  onClearInitialEditEvent={() => setEventToEdit(null)}
                  onRefreshData={() => {}}
                  onSelectMember={(m) => setSelectedMember(m)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile Nav & Drawer */}
      <MobileNav
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        currentTab={currentTab}
        onSelectTab={(t) => setCurrentTab(t)}
        user={userProfile}
        onLogout={logout}
      />

      {/* Detail Member Modal */}
      <MemberProfileModal
        member={selectedMember}
        allMembers={members}
        isAdmin={isAdmin}
        onClose={() => setSelectedMember(null)}
        onSelectMember={(m) => setSelectedMember(m)}
        onOpenTreeWithMember={handleOpenTreeWithMember}
        onEditMember={handleEditMemberFromAnywhere}
        onDeleteMember={(m) => setMemberToDelete(m)}
      />

      {/* Delete Member Confirmation Modal */}
      {memberToDelete && (
        <div 
          onClick={() => !isDeletingMember && setMemberToDelete(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
          >
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shadow-inner">
                <Trash2 className="w-7 h-7" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold font-serif-heritage text-stone-900">
                  Konfirmasi Hapus Anggota
                </h3>
                <p className="text-sm font-medium text-stone-700 leading-relaxed">
                  Apakah yakin akan menghapus <span className="font-bold text-red-700 underline underline-offset-2">&quot;{memberToDelete.name}&quot;</span> ?
                </p>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-left text-xs text-stone-600 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-stone-400">ID Anggota:</span>
                  <span className="font-mono font-semibold text-stone-800">{memberToDelete.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-400">Jenis Kelamin:</span>
                  <span className="font-medium text-stone-800">{getGenderDisplay(memberToDelete.gender)}</span>
                </div>
                {memberToDelete.birthDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-stone-400">Tanggal Lahir:</span>
                    <span className="text-stone-800">{memberToDelete.birthDate}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-stone-200 text-[11px] text-red-600 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Data yang dihapus tidak dapat dipulihkan dari basis data silsilah.</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeletingMember}
                  onClick={() => setMemberToDelete(null)}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isDeletingMember}
                  onClick={handleConfirmDeleteMember}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isDeletingMember ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Ya, Hapus Anggota</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto py-6 bg-white border-t border-stone-200 text-center text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-serif-heritage font-bold text-stone-900">BANI NALI</span>
            <span className="text-stone-300">|</span>
            <span className="text-stone-600">Family Heritage & Genealogy</span>
          </div>
          <p className="text-stone-400">
            Platform Silsilah & Warisan Keluarga Bani Nali. Hak Cipta &copy; {new Date().getFullYear()}.
          </p>
        </div>
      </footer>
    </div>
  );
};
