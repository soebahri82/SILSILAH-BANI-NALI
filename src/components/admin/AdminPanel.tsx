import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  ShieldCheck, 
  Database, 
  Plus, 
  Edit3, 
  Trash2, 
  Download, 
  Upload, 
  AlertTriangle,
  Link,
  UserCheck,
  UserX,
  Clock,
  Check,
  X,
  CheckCircle2,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { FamilyMember, FamilyEvent, UserProfile } from '../../types';
import { 
  addMember, 
  updateMember, 
  deleteMember, 
  uploadMemberPhoto
} from '../../services/memberService';
import { 
  getMemberSpouseIds, 
  getMemberSpouses 
} from '../../utils/familyTreeUtils';
import { 
  getGenderCode, 
  getGenderDisplay, 
  getGenderLabel,
  isMale,
  isFemale 
} from '../../utils/genderUtils';
import { 
  getFatherOfMember, 
  getMotherOfMember 
} from '../../utils/relationshipCalculator';
import { 
  addEvent, 
  updateEvent, 
  deleteEvent
} from '../../services/eventService';

interface AdminPanelProps {
  members: FamilyMember[];
  events: FamilyEvent[];
  initialTab?: 'members' | 'events' | 'users' | 'migration';
  initialEditMember?: FamilyMember | null;
  initialEditEvent?: FamilyEvent | null;
  onClearInitialEditMember?: () => void;
  onClearInitialEditEvent?: () => void;
  onRefreshData: () => void;
  onSelectMember: (m: FamilyMember) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  members,
  events,
  initialTab,
  initialEditMember,
  initialEditEvent,
  onClearInitialEditMember,
  onClearInitialEditEvent,
  onRefreshData,
  onSelectMember,
}) => {
  const [activeTab, setActiveTab] = useState<'members' | 'events' | 'users' | 'migration'>(
    initialTab || 'members'
  );
  const { userProfile: currentAdminProfile } = useAuth();
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Member Form State
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [selectedSpouseIds, setSelectedSpouseIds] = useState<string[]>([]);
  const [memberFormData, setMemberFormData] = useState<Partial<FamilyMember>>({
    name: '',
    gender: 'L',
    birthDate: '',
    deathDate: '',
    birthPlace: '',
    address: '',
    phone: '',
    parentID: '',
    spouseID: '',
    privacy: 'family',
    bio: '',
    photoURL: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isSavingMember, setIsSavingMember] = useState(false);

  // Delete Member Confirmation State
  const [memberToDelete, setMemberToDelete] = useState<FamilyMember | null>(null);
  const [isDeletingMember, setIsDeletingMember] = useState(false);

  // Event Form State
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<FamilyEvent | null>(null);
  const [eventFormData, setEventFormData] = useState<Partial<FamilyEvent>>({
    namaAcara: '',
    tanggal: '',
    tempat: '',
    deskripsi: '',
  });

  // Delete Event Confirmation State
  const [eventToDelete, setEventToDelete] = useState<FamilyEvent | null>(null);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  // Delete User Confirmation State
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Load Users from Firestore
  // Helper to ensure admin account and proper deduplication
  const processUsersList = (rawList: UserProfile[]): UserProfile[] => {
    const adminEmail = 'soebahri82@gmail.com';
    const userMap = new Map<string, UserProfile>();

    // 1. Tambahkan Admin Utama
    const foundAdmin = rawList.find((u) => u.email?.toLowerCase() === adminEmail);
    const adminUser: UserProfile = foundAdmin ? { ...foundAdmin, role: 'admin', active: true, activationStatus: 'active' } : {
      uid: 'admin_soebahri82',
      email: adminEmail,
      displayName: currentAdminProfile?.displayName || 'Samsu Bahri Nali (Administrator)',
      role: 'admin',
      active: true,
      activationStatus: 'active',
      registeredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    userMap.set(adminEmail, adminUser);

    // 2. Tambahkan akun dari rawList (Firestore)
    rawList.forEach((u) => {
      const em = (u.email || '').toLowerCase().trim();
      if (!em || em === adminEmail) return;
      userMap.set(em, u);
    });

    // 3. Gabungkan akun dari localStorage dengan prioritas status aktivasi
    try {
      const localListStr = localStorage.getItem('baninali_registered_users');
      if (localListStr) {
        const localList: UserProfile[] = JSON.parse(localListStr);
        localList.forEach((lu) => {
          const em = (lu.email || '').toLowerCase().trim();
          if (!em || em === adminEmail) return;
          const existing = userMap.get(em);
          if (!existing) {
            userMap.set(em, lu);
          } else {
            // Jika akun sudah diaktifkan di salah satu tempat, pertahankan status active
            const isAnyActive = existing.activationStatus === 'active' || existing.active || lu.activationStatus === 'active' || lu.active;
            const preferredStatus = isAnyActive
              ? 'active'
              : (existing.activationStatus === 'disabled' || lu.activationStatus === 'disabled')
              ? 'disabled'
              : (existing.activationStatus === 'rejected' || lu.activationStatus === 'rejected')
              ? 'rejected'
              : (existing.activationStatus || lu.activationStatus || 'pending');

            userMap.set(em, {
              ...lu,
              ...existing,
              activationStatus: preferredStatus,
              active: preferredStatus === 'active',
              displayName: existing.displayName || lu.displayName,
              decisionAt: existing.decisionAt || lu.decisionAt,
              decidedBy: existing.decidedBy || lu.decidedBy,
            });
          }
        });
      }
    } catch (e) {}

    return Array.from(userMap.values());
  };

  // Load Users from Firestore & local cache
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const fetched: UserProfile[] = [];
      snap.forEach((d) => fetched.push({ ...d.data(), uid: d.id } as UserProfile));
      const finalList = processUsersList(fetched);
      setUsersList(finalList);
    } catch (err) {
      console.warn('Error loading users from Firestore, using local list:', err);
      const finalList = processUsersList([]);
      setUsersList(finalList);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      // Load cached users first for instant render
      const initialUsers = processUsersList([]);
      setUsersList(initialUsers);

      // Realtime listener handles initial snapshot + live updates
      let unsubscribe: (() => void) | undefined;
      try {
        unsubscribe = onSnapshot(
          collection(db, 'users'),
          (snap) => {
            const fetched: UserProfile[] = [];
            snap.forEach((d) => fetched.push({ ...d.data(), uid: d.id } as UserProfile));
            const finalList = processUsersList(fetched);
            setUsersList(finalList);
            setLoadingUsers(false);
          },
          (err) => {
            console.warn('Realtime users listener notice (using local cache):', err);
            setLoadingUsers(false);
          }
        );
      } catch (listenerErr) {
        console.warn('Listener error:', listenerErr);
        setLoadingUsers(false);
      }

      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [activeTab]);

  // Open Member Modal for Add/Edit
  const handleOpenMemberModal = (m?: FamilyMember) => {
    const memberMap = new Map<string, FamilyMember>();
    members.forEach((mem) => memberMap.set(mem.id, mem));

    if (m) {
      const f = getFatherOfMember(m, members, memberMap);
      const mo = getMotherOfMember(m, members, memberMap);

      setEditingMember(m);
      setMemberFormData({ 
        ...m,
        fatherID: m.fatherID || f?.id || '',
        motherID: m.motherID || mo?.id || '',
        gender: getGenderCode(m.gender),
        privacy: 'family',
      });
      setSelectedSpouseIds(getMemberSpouseIds(m, members));
    } else {
      setEditingMember(null);
      setSelectedSpouseIds([]);
      setMemberFormData({
        id: `M${Date.now().toString().slice(-4)}`,
        name: '',
        gender: 'L',
        birthDate: '',
        deathDate: '',
        birthPlace: '',
        address: '',
        phone: '',
        parentID: '',
        fatherID: '',
        motherID: '',
        spouseID: '',
        privacy: 'family',
        bio: '',
        photoURL: '',
      });
    }
    setPhotoFile(null);
    setIsMemberModalOpen(true);
  };

  // Directly open Edit Member Modal if requested from MemberProfileModal or Directory
  useEffect(() => {
    if (initialEditMember) {
      setActiveTab('members');
      handleOpenMemberModal(initialEditMember);
      if (onClearInitialEditMember) {
        onClearInitialEditMember();
      }
    }
  }, [initialEditMember]);

  // Directly open Edit Event Modal if requested from EventsView
  useEffect(() => {
    if (initialEditEvent) {
      setActiveTab('events');
      setEditingEvent(initialEditEvent);
      setEventFormData({
        namaAcara: initialEditEvent.namaAcara || '',
        tanggal: initialEditEvent.tanggal || '',
        tempat: initialEditEvent.tempat || '',
        deskripsi: initialEditEvent.deskripsi || '',
      });
      setIsEventModalOpen(true);
      if (onClearInitialEditEvent) {
        onClearInitialEditEvent();
      }
    }
  }, [initialEditEvent]);

  // Sync activeTab when initialTab changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Save Member
  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberFormData.name?.trim()) return;

    setIsSavingMember(true);
    try {
      let finalPhotoURL = memberFormData.photoURL || '';
      const targetId = editingMember ? editingMember.id : memberFormData.id || `M${Date.now().toString().slice(-4)}`;

      if (photoFile) {
        finalPhotoURL = await uploadMemberPhoto(targetId, photoFile);
      }

      const fatherId = memberFormData.fatherID?.trim() || null;
      const motherId = memberFormData.motherID?.trim() || null;

      let combinedParentID = memberFormData.parentID;
      if (fatherId) {
        combinedParentID = fatherId;
      } else if (motherId) {
        combinedParentID = motherId;
      }

      const payload = {
        ...memberFormData,
        id: targetId,
        photoURL: finalPhotoURL,
        gender: getGenderCode(memberFormData.gender),
        privacy: 'family',
        fatherID: fatherId,
        motherID: motherId,
        parentID: combinedParentID || null,
        spouseID: selectedSpouseIds.length > 0 ? selectedSpouseIds.join(', ') : null,
        spouseIDs: selectedSpouseIds,
      } as FamilyMember;

      if (editingMember) {
        await updateMember(editingMember.id, payload);
        setStatusMessage({ type: 'success', text: `Data anggota "${payload.name}" berhasil diperbarui.` });
      } else {
        await addMember(payload);
        setStatusMessage({ type: 'success', text: `Anggota baru "${payload.name}" berhasil ditambahkan.` });
      }

      setIsMemberModalOpen(false);
      onRefreshData();
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menyimpan anggota.' });
    } finally {
      setIsSavingMember(false);
    }
  };

  // Delete Member Confirmation Handlers
  const handleConfirmDeleteMember = async () => {
    if (!memberToDelete) return;
    setIsDeletingMember(true);
    try {
      await deleteMember(memberToDelete.id);
      setStatusMessage({ 
        type: 'success', 
        text: `Anggota "${memberToDelete.name}" berhasil dihapus dari sistem silsilah.` 
      });
      setMemberToDelete(null);
      onRefreshData();
    } catch (err: unknown) {
      setStatusMessage({ 
        type: 'error', 
        text: err instanceof Error ? err.message : 'Gagal menghapus anggota.' 
      });
    } finally {
      setIsDeletingMember(false);
    }
  };

  // Delete Event Confirmation Handler
  const handleConfirmDeleteEvent = async () => {
    if (!eventToDelete) return;
    setIsDeletingEvent(true);
    try {
      await deleteEvent(eventToDelete.id);
      setStatusMessage({
        type: 'success',
        text: `Acara "${eventToDelete.namaAcara}" berhasil dihapus.`,
      });
      setEventToDelete(null);
      onRefreshData();
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menghapus acara.',
      });
    } finally {
      setIsDeletingEvent(false);
    }
  };

  // Delete User Confirmation Handler
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    const cleanEmail = (userToDelete.email || '').trim().toLowerCase();
    const fallbackUid = cleanEmail ? `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}` : '';

    // Safeguard: Prevent deleting the primary admin account
    if (cleanEmail === 'soebahri82@gmail.com') {
      setStatusMessage({
        type: 'error',
        text: 'Akun Administrator Utama dilindungi dan tidak dapat dihapus.',
      });
      setUserToDelete(null);
      return;
    }

    setIsDeletingUser(true);
    try {
      // 1. Delete from Firestore primary UID and fallback UID
      try {
        await deleteDoc(doc(db, 'users', userToDelete.uid));
      } catch (err) {
        console.warn('Firestore primary user delete note:', err);
      }
      if (fallbackUid && fallbackUid !== userToDelete.uid) {
        try {
          await deleteDoc(doc(db, 'users', fallbackUid));
        } catch (err) {
          console.warn('Firestore fallback user delete note:', err);
        }
      }

      // 2. Remove from localStorage 'baninali_registered_users'
      try {
        const localListStr = localStorage.getItem('baninali_registered_users');
        if (localListStr) {
          const localList: UserProfile[] = JSON.parse(localListStr);
          const filtered = localList.filter(
            (u) =>
              u.uid !== userToDelete.uid &&
              (cleanEmail ? u.email?.toLowerCase().trim() !== cleanEmail : true)
          );
          localStorage.setItem('baninali_registered_users', JSON.stringify(filtered));
        }
      } catch (e) {}

      // 3. Update React state immediately
      setUsersList((prev) =>
        prev.filter(
          (u) =>
            u.uid !== userToDelete.uid &&
            (cleanEmail ? u.email?.toLowerCase().trim() !== cleanEmail : true)
        )
      );

      setStatusMessage({
        type: 'success',
        text: `Akun pengguna "${userToDelete.displayName || userToDelete.email}" berhasil dihapus.`,
      });
      setUserToDelete(null);
    } catch (err: unknown) {
      console.warn('Error deleting user account:', err);
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menghapus akun pengguna.',
      });
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Save Event
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventFormData.namaAcara || !eventFormData.tanggal || !eventFormData.tempat) return;

    try {
      if (editingEvent) {
        await updateEvent(editingEvent.id, eventFormData);
        setStatusMessage({ type: 'success', text: `Acara "${eventFormData.namaAcara}" berhasil diperbarui.` });
      } else {
        await addEvent({
          id: `E${Date.now().toString().slice(-4)}`,
          namaAcara: eventFormData.namaAcara,
          tanggal: eventFormData.tanggal,
          tempat: eventFormData.tempat,
          deskripsi: eventFormData.deskripsi || '',
        });
        setStatusMessage({ type: 'success', text: `Acara "${eventFormData.namaAcara}" berhasil dibuat.` });
      }
      setIsEventModalOpen(false);
      onRefreshData();
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menyimpan acara.' });
    }
  };

  // Toggle User Role
  const handleToggleUserRole = async (user: UserProfile) => {
    const nextRole = user.role === 'admin' ? 'member' : 'admin';
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        role: nextRole,
        updatedAt: new Date().toISOString(),
      });
      setStatusMessage({ type: 'success', text: `Peran ${user.email} diubah menjadi ${nextRole}.` });
      loadUsers();
    } catch (err: unknown) {
      setStatusMessage({ type: 'error', text: 'Gagal mengubah peran pengguna.' });
    }
  };

  // Aktifkan pendaftaran akun oleh admin
  const handleApproveUser = async (targetUser: UserProfile) => {
    const now = new Date().toISOString();
    const adminIdentifier = currentAdminProfile?.email || 'Admin';
    const cleanEmail = (targetUser.email || '').trim().toLowerCase();
    const fallbackUid = cleanEmail ? `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}` : '';

    // Update state & cache lokal terlebih dahulu (optimistic update)
    try {
      const localListStr = localStorage.getItem('baninali_registered_users');
      let localList: UserProfile[] = localListStr ? JSON.parse(localListStr) : [];
      const idx = localList.findIndex((u) => u.uid === targetUser.uid || (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail));
      if (idx >= 0) {
        localList[idx].activationStatus = 'active';
        localList[idx].active = true;
        localList[idx].decisionAt = now;
        localList[idx].decidedBy = adminIdentifier;
        localList[idx].updatedAt = now;
      } else {
        localList.push({
          ...targetUser,
          activationStatus: 'active',
          active: true,
          decisionAt: now,
          decidedBy: adminIdentifier,
          updatedAt: now,
        });
      }
      localStorage.setItem('baninali_registered_users', JSON.stringify(localList));
      setUsersList((prev) =>
        prev.map((u) =>
          u.uid === targetUser.uid || (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail)
            ? { ...u, activationStatus: 'active', active: true, decisionAt: now, decidedBy: adminIdentifier }
            : u
        )
      );
    } catch (e) {}

    try {
      // Simpan ke Firestore dengan merge: true ke primary UID & fallback UID
      const updateData = {
        activationStatus: 'active',
        active: true,
        decisionAt: now,
        decidedBy: adminIdentifier,
        updatedAt: now,
      };
      await setDoc(doc(db, 'users', targetUser.uid), updateData, { merge: true });
      if (fallbackUid && fallbackUid !== targetUser.uid) {
        await setDoc(doc(db, 'users', fallbackUid), updateData, { merge: true });
      }

      setStatusMessage({ 
        type: 'success', 
        text: `Akun "${targetUser.displayName || targetUser.email}" berhasil diaktifkan. Anggota kini dapat login.` 
      });
    } catch (err: unknown) {
      console.warn('Approve user Firestore notice:', err);
      // Status message tetap sukses karena sudah aktif di cache
      setStatusMessage({ 
        type: 'success', 
        text: `Akun "${targetUser.displayName || targetUser.email}" diaktifkan (tersimpan di sistem).` 
      });
    }
  };

  // Tolak pendaftaran akun oleh admin
  const handleRejectUser = async (targetUser: UserProfile) => {
    const now = new Date().toISOString();
    const adminIdentifier = currentAdminProfile?.email || 'Admin';
    const cleanEmail = (targetUser.email || '').trim().toLowerCase();
    const fallbackUid = cleanEmail ? `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}` : '';

    // Update state & cache lokal terlebih dahulu
    try {
      const localListStr = localStorage.getItem('baninali_registered_users');
      let localList: UserProfile[] = localListStr ? JSON.parse(localListStr) : [];
      const idx = localList.findIndex((u) => u.uid === targetUser.uid || (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail));
      if (idx >= 0) {
        localList[idx].activationStatus = 'rejected';
        localList[idx].active = false;
        localList[idx].decisionAt = now;
        localList[idx].decidedBy = adminIdentifier;
        localList[idx].updatedAt = now;
        localStorage.setItem('baninali_registered_users', JSON.stringify(localList));
      }
      setUsersList((prev) =>
        prev.map((u) =>
          u.uid === targetUser.uid || (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail)
            ? { ...u, activationStatus: 'rejected', active: false, decisionAt: now, decidedBy: adminIdentifier }
            : u
        )
      );
    } catch (e) {}

    try {
      const updateData = {
        activationStatus: 'rejected',
        active: false,
        decisionAt: now,
        decidedBy: adminIdentifier,
        updatedAt: now,
      };
      await setDoc(doc(db, 'users', targetUser.uid), updateData, { merge: true });
      if (fallbackUid && fallbackUid !== targetUser.uid) {
        await setDoc(doc(db, 'users', fallbackUid), updateData, { merge: true });
      }

      setStatusMessage({ 
        type: 'success', 
        text: `Pendaftaran "${targetUser.displayName || targetUser.email}" telah ditolak.` 
      });
    } catch (err: unknown) {
      console.warn('Reject user notice:', err);
      setStatusMessage({ 
        type: 'success', 
        text: `Pendaftaran "${targetUser.displayName || targetUser.email}" ditolak.` 
      });
    }
  };

  // Ubah status keaktifan akun (Nonaktifkan / Aktifkan Kembali)
  const handleToggleUserActivation = async (targetUser: UserProfile) => {
    const isCurrentlyActive = targetUser.activationStatus === 'active' || targetUser.active;
    const nextStatus = isCurrentlyActive ? 'disabled' : 'active';
    const now = new Date().toISOString();
    const cleanEmail = (targetUser.email || '').trim().toLowerCase();
    const fallbackUid = cleanEmail ? `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}` : '';

    try {
      const localListStr = localStorage.getItem('baninali_registered_users');
      let localList: UserProfile[] = localListStr ? JSON.parse(localListStr) : [];
      const idx = localList.findIndex((u) => u.uid === targetUser.uid || (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail));
      if (idx >= 0) {
        localList[idx].activationStatus = nextStatus;
        localList[idx].active = nextStatus === 'active';
        localList[idx].updatedAt = now;
        localStorage.setItem('baninali_registered_users', JSON.stringify(localList));
      }
      setUsersList((prev) =>
        prev.map((u) =>
          u.uid === targetUser.uid || (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail)
            ? { ...u, activationStatus: nextStatus, active: nextStatus === 'active' }
            : u
        )
      );
    } catch (e) {}

    try {
      const updateData = {
        activationStatus: nextStatus,
        active: nextStatus === 'active',
        updatedAt: now,
      };
      await setDoc(doc(db, 'users', targetUser.uid), updateData, { merge: true });
      if (fallbackUid && fallbackUid !== targetUser.uid) {
        await setDoc(doc(db, 'users', fallbackUid), updateData, { merge: true });
      }
      setStatusMessage({ 
        type: 'success', 
        text: `Status akun ${targetUser.email} diubah menjadi ${nextStatus === 'active' ? 'Aktif' : 'Dinonaktifkan'}.` 
      });
    } catch (err: unknown) {
      setStatusMessage({ 
        type: 'success', 
        text: `Status akun ${targetUser.email} diubah menjadi ${nextStatus === 'active' ? 'Aktif' : 'Dinonaktifkan'}.` 
      });
    }
  };

  // Link User to Member ID
  const handleLinkUserMember = async (uid: string, memberId: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        linkedMemberID: memberId || null,
        updatedAt: new Date().toISOString(),
      });
      setStatusMessage({ type: 'success', text: `Akun berhasil dihubungkan dengan ID anggota ${memberId}.` });
      loadUsers();
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Gagal menghubungkan akun.' });
    }
  };

  // Export JSON
  const handleExportJSON = () => {
    const backupData = {
      exportedAt: new Date().toISOString(),
      members,
      events,
      users: usersList.map(({ ...safeUser }) => safeUser),
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BaniNali_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export CSV Members
  const handleExportCSV = () => {
    const headers = [
      'ID', 'Name', 'BirthDate', 'DeathDate', 'Gender', 'PhotoURL',
      'ParentID', 'SpouseID', 'Bio', 'BirthPlace', 'Address', 'Phone', 'Privacy'
    ];
    const rows = members.map((m) => [
      m.id,
      `"${(m.name || '').replace(/"/g, '""')}"`,
      m.birthDate || '',
      m.deathDate || '',
      m.gender || '',
      `"${(m.photoURL || '').replace(/"/g, '""')}"`,
      m.parentID || '',
      m.spouseID || '',
      `"${(m.bio || '').replace(/"/g, '""')}"`,
      `"${(m.birthPlace || '').replace(/"/g, '""')}"`,
      `"${(m.address || '').replace(/"/g, '""')}"`,
      `"${(m.phone || '').replace(/"/g, '""')}"`,
      m.privacy || 'family'
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BaniNali_Members_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON / CSV handler
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          const membersToImport = Array.isArray(parsed) ? parsed : parsed.members;
          if (Array.isArray(membersToImport)) {
            for (const m of membersToImport) {
              if (m.name && m.id) {
                await addMember({
                  ...m,
                  gender: getGenderCode(m.gender),
                  privacy: 'family',
                });
              }
            }
            setStatusMessage({ type: 'success', text: `Berhasil mengimpor ${membersToImport.length} anggota dari JSON.` });
            onRefreshData();
          }
        } else if (file.name.endsWith('.csv')) {
          // Simple CSV parser
          const lines = text.split('\n').filter((l) => l.trim().length > 0);
          if (lines.length > 1) {
            let importedCount = 0;
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
              if (cols[1]) {
                const member: Partial<FamilyMember> = {
                  id: cols[0] || `M${Date.now() + i}`,
                  name: cols[1],
                  birthDate: cols[2] || '',
                  deathDate: cols[3] || '',
                  gender: getGenderCode(cols[4]),
                  photoURL: cols[5] || '',
                  parentID: cols[6] || null,
                  spouseID: cols[7] || null,
                  bio: cols[8] || '',
                  birthPlace: cols[9] || '',
                  address: cols[10] || '',
                  phone: cols[11] || '',
                  privacy: 'family',
                };
                await addMember(member as FamilyMember);
                importedCount++;
              }
            }
            setStatusMessage({ type: 'success', text: `Berhasil mengimpor ${importedCount} anggota dari file CSV.` });
            onRefreshData();
          }
        }
      } catch (err: unknown) {
        setStatusMessage({ type: 'error', text: 'Format file tidak valid atau gagal dibaca.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-stone-900 text-white p-6 sm:p-8 rounded-2xl border border-stone-800 shadow-md">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <ShieldCheck className="w-4 h-4" />
          <span>Panel Administrasi Utama</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold font-serif-heritage">
          Pengelolaan Silsilah & Data Keluarga
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-stone-300 max-w-xl">
          Kelola data anggota trah, jadwal acara silaturahmi, akun pengguna terdaftar, 
          serta backup dan migrasi data dari format Google Sheets lama.
        </p>

        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs font-medium flex items-center justify-between ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-200'
                : 'bg-red-950/80 border border-red-700 text-red-200'
            }`}
          >
            <span>{statusMessage.text}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-stone-400 hover:text-white"
            >
              &times;
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-xs flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-xl transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'members'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Data Anggota ({members.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-xl transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'events'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Acara ({events.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-xl transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'users'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Pengguna &amp; Persetujuan</span>
          {usersList.filter((u) => u.role !== 'admin' && u.activationStatus !== 'active' && u.activationStatus !== 'rejected' && u.activationStatus !== 'disabled').length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-stone-950 animate-pulse">
              {usersList.filter((u) => u.role !== 'admin' && u.activationStatus !== 'active' && u.activationStatus !== 'rejected' && u.activationStatus !== 'disabled').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('migration')}
          className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-xl transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'migration'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Migrasi & Cadangan</span>
        </button>
      </div>

      {/* Tab Content: MEMBERS */}
      {activeTab === 'members' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Daftar & Sunting Anggota
              </h3>
              <p className="text-xs text-stone-500">
                Menyimpan identitas, relasi parentID, spouseID, dan privasi
              </p>
            </div>
            <button
              onClick={() => handleOpenMemberModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Anggota</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-700">
              <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider text-[11px] border-b border-stone-200">
                <tr>
                  <th className="py-3 px-3">ID</th>
                  <th className="py-3 px-3">Nama</th>
                  <th className="py-3 px-3">Gender</th>
                  <th className="py-3 px-3">Parent ID</th>
                  <th className="py-3 px-3">Spouse ID</th>
                  <th className="py-3 px-3">Privasi</th>
                  <th className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {members.map((m) => {
                  const mSpouseIds = getMemberSpouseIds(m, members);
                  const mSpouses = getMemberSpouses(m, members);
                  return (
                    <tr key={m.id} className="hover:bg-stone-50">
                      <td className="py-2.5 px-3 font-mono text-stone-500">{m.id}</td>
                      <td className="py-2.5 px-3 font-semibold text-stone-900">{m.name}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          isMale(m.gender)
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            : 'bg-amber-50 text-amber-900 border-amber-300'
                        }`}>
                          {getGenderDisplay(m.gender)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-stone-500">{m.parentID || '-'}</td>
                      <td className="py-2.5 px-3 text-stone-600">
                        {mSpouses.length === 0 ? (
                          <span className="text-stone-400 font-mono">-</span>
                        ) : mSpouses.length === 1 ? (
                          <span className="text-stone-800">{mSpouses[0].name}</span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-amber-800 text-[10px] bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 block w-fit">
                              {mSpouses.length} Pasangan
                            </span>
                            <span className="text-[11px] text-stone-700 block truncate max-w-[180px]">
                              {mSpouses.map((s) => s.name).join(', ')}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-stone-700 bg-stone-100 px-2 py-0.5 rounded text-[11px] border border-stone-200">
                          family
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1">
                        <button
                          onClick={() => handleOpenMemberModal(m)}
                          className="p-1 text-stone-600 hover:text-emerald-800 cursor-pointer"
                          title="Sunting"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setMemberToDelete(m)}
                          className="p-1 text-red-600 hover:text-red-800 cursor-pointer"
                          title="Hapus Anggota"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: EVENTS */}
      {activeTab === 'events' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Kelola Jadwal & Acara Keluarga
              </h3>
              <p className="text-xs text-stone-500">
                Agenda silaturahmi yang muncul pada Dashboard dan Halaman Acara
              </p>
            </div>
            <button
              onClick={() => {
                setEditingEvent(null);
                setEventFormData({ namaAcara: '', tanggal: '', tempat: '', deskripsi: '' });
                setIsEventModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Acara</span>
            </button>
          </div>

          <div className="space-y-3">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="p-4 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-between gap-4"
              >
                <div>
                  <h4 className="font-semibold text-stone-900 text-sm">{ev.namaAcara}</h4>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {ev.tanggal} · {ev.tempat}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingEvent(ev);
                      setEventFormData(ev);
                      setIsEventModalOpen(true);
                    }}
                    className="p-1.5 text-stone-600 hover:text-emerald-800 cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEventToDelete(ev)}
                    className="p-1.5 text-red-600 hover:text-red-800 cursor-pointer"
                    title="Hapus Acara"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content: USERS */}
      {/* Tab Content: USERS (Persetujuan & Manajemen Pengguna) */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Header Panel */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-stone-900 font-serif-heritage flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-800" />
                <span>Persetujuan &amp; Manajemen Pengguna</span>
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Verifikasi pendaftaran anggota baru, setujui/tolak permohonan akses silsilah, serta kelola hak akses (role).
              </p>
            </div>
            <button
              type="button"
              onClick={loadUsers}
              disabled={loadingUsers}
              className="self-start sm:self-auto px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold flex items-center gap-2 border border-stone-300 transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
              <span>Segarkan Data</span>
            </button>
          </div>

          {loadingUsers ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-xs text-stone-500 flex flex-col items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-emerald-800 border-t-amber-400 rounded-full animate-spin" />
              <span>Memuat data pendaftar &amp; pengguna...</span>
            </div>
          ) : (
            <>
              {/* BAGIAN 1: Pendaftar Menunggu Aktivasi (Persetujuan Admin) */}
              {(() => {
                const pendingList = usersList.filter((u) => {
                  if (u.role === 'admin') return false;
                  if (u.activationStatus === 'active') return false;
                  if (u.activationStatus === 'rejected') return false;
                  if (u.activationStatus === 'disabled') return false;
                  return true;
                });

                return (
                  <div className="bg-white rounded-2xl border-2 border-amber-300/80 shadow-xs overflow-hidden">
                    <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50 via-amber-100/60 to-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold text-xs shadow-xs">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-amber-950 font-serif-heritage">
                            Pendaftar Menunggu Persetujuan ({pendingList.length})
                          </h4>
                          <p className="text-[11px] text-amber-800">
                            Pendaftar akun baru dengan status <em>"Menunggu aktivasi"</em> yang memerlukan persetujuan admin.
                          </p>
                        </div>
                      </div>

                      {pendingList.length > 0 && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-stone-950 shadow-2xs">
                          Perlu Tindakan
                        </span>
                      )}
                    </div>

                    {pendingList.length === 0 ? (
                      <div className="p-8 text-center text-xs text-stone-500 flex flex-col items-center justify-center gap-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                        <span className="font-medium text-stone-700">Semua pendaftaran telah ditinjau</span>
                        <p className="text-[11px] text-stone-400">Tidak ada pendaftar baru yang menunggu persetujuan admin saat ini.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-stone-700">
                          <thead className="bg-stone-50 text-stone-600 uppercase tracking-wider text-[10.5px] border-b border-stone-200">
                            <tr>
                              <th className="py-3 px-4">Nama Lengkap</th>
                              <th className="py-3 px-4">Alamat Email</th>
                              <th className="py-3 px-4">Waktu Pendaftaran</th>
                              <th className="py-3 px-4">Status Awal</th>
                              <th className="py-3 px-4 text-right">Keputusan Admin</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100/70 bg-amber-50/20">
                            {pendingList.map((u) => (
                              <tr key={u.uid} className="hover:bg-amber-50/50 transition-colors">
                                <td className="py-3.5 px-4 font-semibold text-stone-900">
                                  {u.displayName || 'Tanpa Nama'}
                                </td>
                                <td className="py-3.5 px-4 font-mono text-[11px] text-stone-600">
                                  {u.email}
                                </td>
                                <td className="py-3.5 px-4 text-stone-500">
                                  {u.registeredAt || u.createdAt
                                    ? new Date(u.registeredAt || u.createdAt).toLocaleDateString('id-ID', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : '-'}
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-amber-100 text-amber-900 border border-amber-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                                    Menunggu aktivasi
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <div className="inline-flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleApproveUser(u)}
                                      className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                                      title="Setujui pendaftaran dan aktifkan akun anggota"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Aktifkan</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRejectUser(u)}
                                      className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-700 border border-red-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                                      title="Tolak pendaftaran akun"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      <span>Tolak</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* BAGIAN 2: Daftar Seluruh Akun Pengguna Terdaftar */}
              <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 sm:p-6 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-stone-900 font-serif-heritage">
                    Daftar Seluruh Akun Pengguna ({usersList.length})
                  </h4>
                  <p className="text-xs text-stone-500">
                    Kelola peran (admin/member), tautkan profil ke silsilah (linkedMemberID), dan atur keaktifan akun.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-stone-700">
                    <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider text-[10.5px] border-b border-stone-200">
                      <tr>
                        <th className="py-3 px-3">Pengguna &amp; Email</th>
                        <th className="py-3 px-3">Status Aktivasi</th>
                        <th className="py-3 px-3">Peran (Role)</th>
                        <th className="py-3 px-3">Tautan Silsilah (linkedMemberID)</th>
                        <th className="py-3 px-3 text-right">Aksi Manajemen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {usersList.map((u) => {
                        const status = u.activationStatus || (u.role === 'admin' ? 'active' : (u.active ? 'active' : 'pending'));
                        return (
                          <tr key={u.uid} className="hover:bg-stone-50/80 transition-colors">
                            <td className="py-3 px-3">
                              <div className="font-semibold text-stone-900">{u.displayName || 'Tanpa Nama'}</div>
                              <div className="text-[10.5px] text-stone-400 font-mono">{u.email}</div>
                              {u.decisionAt && (
                                <div className="text-[9.5px] text-stone-400 mt-0.5">
                                  Keputusan: {new Date(u.decisionAt).toLocaleDateString('id-ID')} ({u.decidedBy || 'Admin'})
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {status === 'active' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                  Aktif
                                </span>
                              )}
                              {status === 'pending' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-amber-100 text-amber-900 border border-amber-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  Menunggu aktivasi
                                </span>
                              )}
                              {status === 'rejected' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-red-100 text-red-900 border border-red-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                                  Ditolak
                                </span>
                              )}
                              {status === 'disabled' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-stone-200 text-stone-800 border border-stone-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
                                  Dinonaktifkan
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                  u.role === 'admin'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-stone-100 text-stone-800 border border-stone-200'
                                }`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <select
                                value={u.linkedMemberID || ''}
                                onChange={(e) => handleLinkUserMember(u.uid, e.target.value)}
                                className="text-xs p-1.5 bg-stone-50 border border-stone-200 rounded-lg max-w-[210px] text-stone-800"
                              >
                                <option value="">-- Belum Ditautkan --</option>
                                {members.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.id}: {m.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleUserRole(u)}
                                  className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded text-[11px] font-medium border border-stone-300 cursor-pointer transition-colors"
                                  title="Ganti peran antara Admin dan Member"
                                >
                                  {u.role === 'admin' ? 'Jadikan Member' : 'Jadikan Admin'}
                                </button>
                                {status === 'active' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleUserActivation(u)}
                                    className="px-2 py-1 bg-white hover:bg-stone-100 text-stone-700 rounded text-[11px] font-medium border border-stone-300 cursor-pointer"
                                    title="Nonaktifkan akses akun pengguna"
                                  >
                                    Nonaktifkan
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleApproveUser(u)}
                                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-[11px] font-medium border border-emerald-300 cursor-pointer"
                                    title="Aktifkan kembali akun ini"
                                  >
                                    Aktifkan
                                  </button>
                                )}

                                {/* Tombol / Icon Hapus Akun Pengguna */}
                                {u.email?.toLowerCase().trim() === 'soebahri82@gmail.com' ? (
                                  <button
                                    type="button"
                                    disabled
                                    className="p-1.5 text-stone-300 bg-stone-50 rounded border border-stone-200 cursor-not-allowed opacity-50"
                                    title="Akun Admin Utama dilindungi dan tidak dapat dihapus"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setUserToDelete(u)}
                                    className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 rounded border border-red-200 hover:border-red-300 transition-colors cursor-pointer"
                                    title={`Hapus akun pengguna ${u.displayName || u.email}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab Content: MIGRATION & BACKUP */}
      {activeTab === 'migration' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Migrasi Data Lama & Ekspor Cadangan
            </h3>
            <p className="text-xs text-stone-500">
              Kompatibel penuh dengan struktur spreadsheet aplikasi lama Bani Nali (ParentID, SpouseID, LinkedMemberID).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Box 1: Ekspor Data (Backup) */}
            <div className="p-5 rounded-xl border border-stone-200 bg-stone-50 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-stone-900 font-semibold text-sm">
                  <Download className="w-4 h-4 text-emerald-800" />
                  <span>Ekspor Data (Backup)</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Unduh seluruh data anggota silsilah dan acara dalam format standar tanpa menyertakan kredensial pengguna.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex-1 py-2 px-3 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Ekspor CSV (Sheets)
                </button>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="flex-1 py-2 px-3 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Ekspor JSON
                </button>
              </div>
            </div>

            {/* Box 2: Impor CSV / JSON */}
            <div className="p-5 rounded-xl border border-stone-200 bg-stone-50 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-stone-900 font-semibold text-sm">
                  <Upload className="w-4 h-4 text-emerald-800" />
                  <span>Impor File CSV / JSON</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Pilih file CSV atau JSON hasil ekspor Google Sheets. Kolom yang dibaca: 
                  <code className="text-[11px] block mt-1 bg-stone-200/60 p-1.5 rounded font-mono text-stone-700 break-words">ID, Name, BirthDate, DeathDate, Gender, PhotoURL, ParentID, SpouseID, Bio, BirthPlace, Address, Phone, Privacy</code>
                </p>
              </div>
              <div className="pt-2">
                <input
                  type="file"
                  accept=".csv, .json"
                  onChange={handleImportFile}
                  className="block w-full text-xs text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-800 file:text-white hover:file:bg-emerald-900 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Member Form Modal */}
      {isMemberModalOpen && (
        <div 
          onClick={() => setIsMemberModalOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 md:p-6 bg-stone-900/60 backdrop-blur-xs overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-2xl overflow-hidden my-2 sm:my-6 relative shrink-0"
          >
            <div className="p-5 bg-stone-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">
                {editingMember ? 'Sunting Data Anggota' : 'Tambah Anggota Baru'}
              </h3>
              <button
                onClick={() => setIsMemberModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">ID Anggota</label>
                  <input
                    type="text"
                    value={memberFormData.id || ''}
                    onChange={(e) => setMemberFormData({ ...memberFormData, id: e.target.value })}
                    required
                    className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    value={memberFormData.name || ''}
                    onChange={(e) => setMemberFormData({ ...memberFormData, name: e.target.value })}
                    required
                    placeholder="contoh: K.H. Nali bin Abdullah"
                    className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Jenis Kelamin (Database: L / P)</label>
                  <select
                    value={getGenderCode(memberFormData.gender)}
                    onChange={(e) => setMemberFormData({ ...memberFormData, gender: e.target.value as any })}
                    className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 font-medium"
                  >
                    <option value="L">L = Laki-laki</option>
                    <option value="P">P = Perempuan</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Tingkat Privasi (Database: family)</label>
                  <select
                    value="family"
                    disabled
                    className="w-full p-2 bg-stone-100 border border-stone-300 rounded-lg text-stone-700 font-semibold cursor-not-allowed"
                  >
                    <option value="family">family (Keluarga Besar Bani Nali)</option>
                  </select>
                  <span className="text-[10px] text-stone-500 mt-1 block">
                    Seluruh data anggota disetel ke tingkat privasi keluarga (family).
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Tanggal Lahir</label>
                  <input
                    type="date"
                    value={memberFormData.birthDate || ''}
                    onChange={(e) => setMemberFormData({ ...memberFormData, birthDate: e.target.value })}
                    className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Tanggal Wafat (Opsional)</label>
                  <input
                    type="date"
                    value={memberFormData.deathDate || ''}
                    onChange={(e) => setMemberFormData({ ...memberFormData, deathDate: e.target.value })}
                    className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Tempat Lahir</label>
                  <input
                    type="text"
                    value={memberFormData.birthPlace || ''}
                    onChange={(e) => setMemberFormData({ ...memberFormData, birthPlace: e.target.value })}
                    placeholder="contoh: Pasuruan, Jawa Timur"
                    className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Nomor Telepon / WhatsApp</label>
                  <input
                    type="text"
                    value={memberFormData.phone || ''}
                    onChange={(e) => setMemberFormData({ ...memberFormData, phone: e.target.value })}
                    placeholder="08123456789"
                    className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                  />
                </div>

                {/* Ayah Kandung (Paternal / Garis Trah) */}
                <div>
                  <label className="block font-semibold text-stone-700 mb-1 flex items-center justify-between">
                    <span>👨 Nama Ayah (Ayah Kandung / Garis Trah)</span>
                    <span className="text-[10px] text-stone-400 font-normal">Paternal</span>
                  </label>
                  <select
                    value={memberFormData.fatherID || memberFormData.parentID || ''}
                    onChange={(e) => {
                      const selectedFatherId = e.target.value;
                      const updated: any = { 
                        ...memberFormData, 
                        fatherID: selectedFatherId,
                        parentID: selectedFatherId || memberFormData.motherID || ''
                      };
                      // Smart suggestion: jika ayah memiliki pasangan tunggal dan ibu belum terisi, otomatis sarankan ibu
                      if (selectedFatherId && !memberFormData.motherID) {
                        const fMember = members.find((m) => m.id === selectedFatherId);
                        if (fMember) {
                          const spouses = getMemberSpouseIds(fMember, members);
                          if (spouses.length === 1) {
                            updated.motherID = spouses[0];
                          }
                        }
                      }
                      setMemberFormData(updated);
                    }}
                    className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 text-xs"
                  >
                    <option value="">-- Tidak ada / Sesepuh Utama --</option>
                    {members
                      .filter((m) => m.id !== memberFormData.id && isMale(m.gender))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.id}{m.birthDate ? ` · Thn ${m.birthDate.split('-')[0]}` : ''})
                        </option>
                      ))}
                    <optgroup label="Anggota Lainnya">
                      {members
                        .filter((m) => m.id !== memberFormData.id && !isMale(m.gender))
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.id})
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>

                {/* Ibu Kandung (Maternal / Garis Ibu) */}
                <div>
                  <label className="block font-semibold text-stone-700 mb-1 flex items-center justify-between">
                    <span>👩 Nama Ibu (Ibu Kandung / Pasangan)</span>
                    <span className="text-[10px] text-stone-400 font-normal">Maternal</span>
                  </label>
                  <select
                    value={memberFormData.motherID || ''}
                    onChange={(e) => {
                      const selectedMotherId = e.target.value;
                      setMemberFormData({ 
                        ...memberFormData, 
                        motherID: selectedMotherId,
                        parentID: memberFormData.fatherID || selectedMotherId || memberFormData.parentID || ''
                      });
                    }}
                    className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900 text-xs"
                  >
                    <option value="">-- Tidak ada / Belum Terdata --</option>
                    {members
                      .filter((m) => m.id !== memberFormData.id && isFemale(m.gender))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.id}{m.birthDate ? ` · Thn ${m.birthDate.split('-')[0]}` : ''})
                        </option>
                      ))}
                    <optgroup label="Anggota Lainnya">
                      {members
                        .filter((m) => m.id !== memberFormData.id && !isFemale(m.gender))
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.id})
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>

                <div className="sm:col-span-2 p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block font-semibold text-stone-800">
                      Pasangan (Mendukung 1 atau Lebih Pasangan)
                    </label>
                    <span className="text-[10px] text-stone-500">
                      Misal: Istri pertama wafat, lalu menikah lagi
                    </span>
                  </div>

                  {/* List of currently selected spouses */}
                  {selectedSpouseIds.length > 0 ? (
                    <div className="space-y-1.5 mb-2.5">
                      {selectedSpouseIds.map((sId, idx) => {
                        const targetMember = members.find((m) => m.id === sId);
                        return (
                          <div
                            key={sId}
                            className="flex items-center justify-between p-2 bg-white rounded-lg border border-stone-200 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] border border-amber-200">
                                Pasangan #{idx + 1}
                              </span>
                              <span className="font-medium text-stone-900">
                                {targetMember ? targetMember.name : sId}
                              </span>
                              {targetMember?.deathDate && (
                                <span className="text-[10px] text-stone-500 bg-stone-100 px-1 rounded">
                                  Almarhum/ah
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSpouseIds(selectedSpouseIds.filter((id) => id !== sId));
                              }}
                              className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 text-xs font-semibold cursor-pointer"
                            >
                              Hapus Pasangan
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-stone-400 italic mb-2">
                      Belum ada pasangan yang ditambahkan.
                    </p>
                  )}

                  {/* Dropdown to add another spouse */}
                  <div className="flex items-center gap-2">
                    <select
                      id="addSpouseSelect"
                      defaultValue=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && !selectedSpouseIds.includes(val)) {
                          setSelectedSpouseIds([...selectedSpouseIds, val]);
                        }
                        e.target.value = '';
                      }}
                      className="flex-1 p-2 bg-white border border-stone-300 rounded-lg text-stone-900 text-xs"
                    >
                      <option value="">+ Tambah Pasangan dari Daftar Anggota...</option>
                      {members
                        .filter(
                          (m) =>
                            m.id !== memberFormData.id &&
                            !selectedSpouseIds.includes(m.id)
                        )
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.gender} {m.birthDate ? `· Thn ${m.birthDate.split('-')[0]}` : ''})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="text-xs">
                <label className="block font-semibold text-stone-700 mb-1">Alamat Domisili</label>
                <input
                  type="text"
                  value={memberFormData.address || ''}
                  onChange={(e) => setMemberFormData({ ...memberFormData, address: e.target.value })}
                  placeholder="Jl. Dharmawangsa No. 24, Surabaya"
                  className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                />
              </div>

              <div className="text-xs">
                <label className="block font-semibold text-stone-700 mb-1">Biografi Singkat</label>
                <textarea
                  rows={3}
                  value={memberFormData.bio || ''}
                  onChange={(e) => setMemberFormData({ ...memberFormData, bio: e.target.value })}
                  placeholder="Catatan kehidupan, profesi, peran dalam keluarga..."
                  className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                />
              </div>

              <div className="text-xs">
                <label className="block font-semibold text-stone-700 mb-1">Foto Anggota (Upload File atau URL)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-stone-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-stone-200 file:text-stone-800 hover:file:bg-stone-300 mb-1"
                />
                <input
                  type="text"
                  value={memberFormData.photoURL || ''}
                  onChange={(e) => setMemberFormData({ ...memberFormData, photoURL: e.target.value })}
                  placeholder="Atau tautan URL foto langsung (https://...)"
                  className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingMember}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isSavingMember ? 'Menyimpan...' : 'Simpan Data Anggota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Form Modal */}
      {isEventModalOpen && (
        <div 
          onClick={() => setIsEventModalOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 md:p-6 bg-stone-900/60 backdrop-blur-xs overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-lg overflow-hidden my-2 sm:my-6 relative shrink-0"
          >
            <div className="p-5 bg-stone-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">
                {editingEvent ? 'Sunting Acara' : 'Tambah Acara Silaturahmi'}
              </h3>
              <button
                onClick={() => setIsEventModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Nama Acara *</label>
                <input
                  type="text"
                  value={eventFormData.namaAcara || ''}
                  onChange={(e) => setEventFormData({ ...eventFormData, namaAcara: e.target.value })}
                  required
                  placeholder="Halal Bihalal & Haul Akbar"
                  className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Waktu & Tanggal *</label>
                <input
                  type="datetime-local"
                  value={eventFormData.tanggal || ''}
                  onChange={(e) => setEventFormData({ ...eventFormData, tanggal: e.target.value })}
                  required
                  className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Tempat / Lokasi *</label>
                <input
                  type="text"
                  value={eventFormData.tempat || ''}
                  onChange={(e) => setEventFormData({ ...eventFormData, tempat: e.target.value })}
                  required
                  placeholder="Gedung Graha Kencana, Surabaya"
                  className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Rincian Deskripsi</label>
                <textarea
                  rows={3}
                  value={eventFormData.deskripsi || ''}
                  onChange={(e) => setEventFormData({ ...eventFormData, deskripsi: e.target.value })}
                  placeholder="Agenda dan informasi bagi anggota keluarga..."
                  className="w-full p-2 bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Simpan Acara
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Delete Event Confirmation Modal */}
      {eventToDelete && (
        <div 
          onClick={() => !isDeletingEvent && setEventToDelete(null)}
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
                  Konfirmasi Hapus Acara
                </h3>
                <p className="text-sm font-medium text-stone-700 leading-relaxed">
                  Apakah yakin akan menghapus acara <span className="font-bold text-red-700">&quot;{eventToDelete.namaAcara}&quot;</span>?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeletingEvent}
                  onClick={() => setEventToDelete(null)}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isDeletingEvent}
                  onClick={handleConfirmDeleteEvent}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isDeletingEvent ? 'Menghapus...' : 'Ya, Hapus Acara'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div 
          onClick={() => !isDeletingUser && setUserToDelete(null)}
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
                  Konfirmasi Hapus Akun Pengguna
                </h3>
                <p className="text-sm font-medium text-stone-700 leading-relaxed">
                  Apakah yakin ingin menghapus akun <span className="font-bold text-red-700 underline underline-offset-2">&quot;{userToDelete.displayName || userToDelete.email}&quot;</span>?
                </p>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-left text-xs text-stone-600 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-stone-400">Email:</span>
                  <span className="font-mono font-semibold text-stone-800">{userToDelete.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-400">Peran:</span>
                  <span className="font-semibold text-stone-800 uppercase">{userToDelete.role}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-stone-400">Status:</span>
                  <span className="font-semibold text-stone-800 capitalize">
                    {userToDelete.activationStatus === 'active' || userToDelete.active
                      ? 'Aktif'
                      : userToDelete.activationStatus === 'disabled'
                      ? 'Dinonaktifkan'
                      : userToDelete.activationStatus === 'rejected'
                      ? 'Ditolak'
                      : 'Menunggu aktivasi'}
                  </span>
                </div>
                <div className="pt-2 border-t border-stone-200 text-[11px] text-red-600 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Akun ini akan dihapus permanen dari sistem. Pengguna tidak akan dapat login lagi menggunakan akun ini.</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeletingUser}
                  onClick={() => setUserToDelete(null)}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isDeletingUser}
                  onClick={handleConfirmDeleteUser}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isDeletingUser ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Ya, Hapus Akun</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
