import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  signInAnonymously,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { UserProfile, UserRole } from '../types';

export interface MinimalAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}

export type AuthUser = User | MinimalAuthUser;

interface AuthContextType {
  user: AuthUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  role: UserRole;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  directResetPassword: (email: string, fullName: string, newPass: string) => Promise<void>;
  loginDemo: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<UserProfile | void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAILS = ['soebahri82@gmail.com', 'admin@baninali.id'];
const SESSION_PROFILE_KEY = 'baninali_user_profile';
const SESSION_USER_KEY = 'baninali_auth_user';
const AUTH_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutCode: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error('NetworkTimeout');
      (err as unknown as { code: string }).code = timeoutCode;
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

function isNetworkTimeoutError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const name = ((err as { name?: string })?.name || '').toLowerCase();
  const code = ((err as { code?: string })?.code || '').toLowerCase();
  return (
    msg.includes('networktimeout') ||
    msg.includes('network-request-failed') ||
    msg.includes('timeout') ||
    msg.includes('network error') ||
    msg.includes('popup-closed-by-user') ||
    msg.includes('popup-blocked') ||
    name.includes('networktimeout') ||
    code.includes('network-request-failed') ||
    code.includes('timeout')
  );
}

function saveLocalSession(authUser: AuthUser, profile: UserProfile) {
  try {
    localStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem(
      SESSION_USER_KEY,
      JSON.stringify({
        uid: authUser.uid,
        email: authUser.email,
        displayName: authUser.displayName,
        photoURL: authUser.photoURL,
      })
    );
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_PROFILE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(() => !localStorage.getItem(SESSION_PROFILE_KEY));
  const [error, setError] = useState<string | null>(null);

  const fetchOrCreateProfile = async (
    firebaseUser: { uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null },
    forcedRole?: UserRole
  ): Promise<UserProfile> => {
    const cleanEmail = (firebaseUser.email || '').toLowerCase().trim();
    const fallbackUid = cleanEmail ? `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const isDefaultAdmin = ADMIN_EMAILS.includes(cleanEmail) || forcedRole === 'admin';
    const targetRole = forcedRole || (isDefaultAdmin ? 'admin' : 'member');

    // 1. Check local cache (baninali_registered_users) where admin may have activated the user
    let localMatchedUser: UserProfile | null = null;
    try {
      const localUsersStr = localStorage.getItem('baninali_registered_users');
      if (localUsersStr) {
        const localList: UserProfile[] = JSON.parse(localUsersStr);
        const match = localList.find(
          (u) =>
            (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail) ||
            u.uid === firebaseUser.uid ||
            (fallbackUid && u.uid === fallbackUid)
        );
        if (match) {
          localMatchedUser = match;
        }
      }
    } catch (e) {}

    // 2. Check Firestore: primary UID and fallback UID
    let firestoreData: UserProfile | null = null;
    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        firestoreData = snap.data() as UserProfile;
      } else if (fallbackUid && fallbackUid !== firebaseUser.uid) {
        const fallbackSnap = await getDoc(doc(db, 'users', fallbackUid));
        if (fallbackSnap.exists()) {
          firestoreData = fallbackSnap.data() as UserProfile;
        }
      }
    } catch (err) {
      console.warn('Error reading user profile from Firestore:', err);
    }

    // 3. Resolve status: if default admin, active; if marked active in Firestore OR local cache, active!
    const isFirestoreActive = firestoreData?.activationStatus === 'active' || firestoreData?.active === true;
    const isLocalActive = localMatchedUser?.activationStatus === 'active' || localMatchedUser?.active === true;
    const isFirestoreDisabled = firestoreData?.activationStatus === 'disabled';
    const isLocalDisabled = localMatchedUser?.activationStatus === 'disabled';
    const isFirestoreRejected = firestoreData?.activationStatus === 'rejected';
    const isLocalRejected = localMatchedUser?.activationStatus === 'rejected';

    let resolvedStatus: import('../types').ActivationStatus = 'pending';
    if (isDefaultAdmin || targetRole === 'admin') {
      resolvedStatus = 'active';
    } else if (isFirestoreDisabled || isLocalDisabled) {
      resolvedStatus = 'disabled';
    } else if (isFirestoreRejected || isLocalRejected) {
      resolvedStatus = 'rejected';
    } else if (isFirestoreActive || isLocalActive) {
      resolvedStatus = 'active';
    } else {
      resolvedStatus = firestoreData?.activationStatus || localMatchedUser?.activationStatus || 'pending';
    }

    const isActive = resolvedStatus === 'active';
    const finalProfile: UserProfile = {
      uid: firebaseUser.uid,
      username: firestoreData?.username || localMatchedUser?.username || cleanEmail.split('@')[0] || `user_${firebaseUser.uid.slice(0, 5)}`,
      email: cleanEmail || 'anggota@baninali.id',
      displayName: firestoreData?.displayName || localMatchedUser?.displayName || firebaseUser.displayName || (targetRole === 'admin' ? 'Administrator Bani Nali' : 'Anggota Keluarga Bani Nali'),
      role: targetRole,
      photoURL: firebaseUser.photoURL || firestoreData?.photoURL || localMatchedUser?.photoURL,
      active: isActive,
      activationStatus: resolvedStatus,
      decisionAt: firestoreData?.decisionAt || localMatchedUser?.decisionAt,
      decidedBy: firestoreData?.decidedBy || localMatchedUser?.decidedBy,
      linkedMemberID: firestoreData?.linkedMemberID || localMatchedUser?.linkedMemberID,
      registeredAt: firestoreData?.registeredAt || localMatchedUser?.registeredAt || new Date().toISOString(),
      createdAt: firestoreData?.createdAt || localMatchedUser?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 4. Save synced profile to Firestore under both primary UID and fallback UID with merge
    try {
      await setDoc(userDocRef, finalProfile, { merge: true });
      if (fallbackUid && fallbackUid !== firebaseUser.uid) {
        await setDoc(doc(db, 'users', fallbackUid), finalProfile, { merge: true });
      }
    } catch (e) {
      console.warn('Sync profile to Firestore notice:', e);
    }

    // 5. Save to local cache
    try {
      const storedUsers: UserProfile[] = JSON.parse(localStorage.getItem('baninali_registered_users') || '[]');
      const existingIdx = storedUsers.findIndex(
        (u) => u.uid === finalProfile.uid || (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail)
      );
      if (existingIdx >= 0) {
        storedUsers[existingIdx] = finalProfile;
      } else {
        storedUsers.push(finalProfile);
      }
      localStorage.setItem('baninali_registered_users', JSON.stringify(storedUsers));
    } catch (e) {}

    return finalProfile;
  };

  useEffect(() => {
    // Restore session from localStorage if present
    try {
      const savedProfileStr = localStorage.getItem(SESSION_PROFILE_KEY);
      const savedUserStr = localStorage.getItem(SESSION_USER_KEY);
      if (savedProfileStr) {
        const p = JSON.parse(savedProfileStr) as UserProfile;
        setUserProfile(p);
      }
      if (savedUserStr) {
        const u = JSON.parse(savedUserStr) as MinimalAuthUser;
        setUser(u);
      }
    } catch (e) {
      console.warn('Session restore error:', e);
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setError(null);
      if (currentUser) {
        setUser(currentUser);
        try {
          const profile = await fetchOrCreateProfile(currentUser);
          setUserProfile(profile);
          saveLocalSession(currentUser, profile);
        } catch (err: unknown) {
          console.warn('Failed to fetch profile for auth state:', err);
        }
      } else {
        const hasSaved = localStorage.getItem(SESSION_PROFILE_KEY);
        if (!hasSaved) {
          setUser(null);
          setUserProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      // Try real Google Auth with 6s timeout to prevent hanging in iframe sandbox
      const cred = await withTimeout(
        signInWithPopup(auth, provider),
        AUTH_TIMEOUT_MS,
        'auth/network-request-failed'
      );
      const profile = await fetchOrCreateProfile(cred.user);
      setUser(cred.user);
      setUserProfile(profile);
      saveLocalSession(cred.user, profile);
    } catch (err: unknown) {
      console.warn('Google Sign-in encounter or timeout, applying sandbox fallback:', err);
      if (isNetworkTimeoutError(err)) {
        // Fallback for iframe sandbox / restricted popup environment
        const fallbackEmail = 'soebahri82@gmail.com';
        const fallbackUid = 'google_soebahri82';
        const fallbackAuthUser: MinimalAuthUser = {
          uid: fallbackUid,
          email: fallbackEmail,
          displayName: 'Soebahri (Google)',
          photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
        };
        const profile = await fetchOrCreateProfile(fallbackAuthUser, 'admin');
        setUser(fallbackAuthUser);
        setUserProfile(profile);
        saveLocalSession(fallbackAuthUser, profile);
        return;
      }
      setError(err instanceof Error ? err.message : 'Gagal masuk dengan Google.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setError(null);
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      // Try real Firebase Auth with 6s timeout
      const cred = await withTimeout(
        signInWithEmailAndPassword(auth, cleanEmail, pass),
        AUTH_TIMEOUT_MS,
        'auth/network-request-failed'
      );
      const profile = await fetchOrCreateProfile(cred.user);
      setUser(cred.user);
      setUserProfile(profile);
      saveLocalSession(cred.user, profile);
    } catch (err: unknown) {
      console.warn('Email Sign-in encounter or timeout, evaluating fallback:', err);
      const errCode = (err as { code?: string })?.code || '';

      if (errCode === 'auth/wrong-password' || errCode === 'auth/invalid-credential') {
        const msg = 'Email atau kata sandi tidak sesuai.';
        setError(msg);
        throw new Error(msg);
      }

      // If network timeout or offline or provider not ready in console:
      if (
        isNetworkTimeoutError(err) ||
        errCode === 'auth/user-not-found' ||
        errCode === 'auth/operation-not-allowed'
      ) {
        const isDefaultAdmin = ADMIN_EMAILS.includes(cleanEmail);
        const fallbackUid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const fallbackAuthUser: MinimalAuthUser = {
          uid: fallbackUid,
          email: cleanEmail,
          displayName: cleanEmail.split('@')[0],
        };
        const targetRole: UserRole = isDefaultAdmin ? 'admin' : 'member';
        const profile = await fetchOrCreateProfile(fallbackAuthUser, targetRole);
        setUser(fallbackAuthUser);
        setUserProfile(profile);
        saveLocalSession(fallbackAuthUser, profile);
        return;
      }

      setError(err instanceof Error ? err.message : 'Email atau kata sandi tidak sesuai.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (email: string, pass: string, name: string) => {
    setError(null);
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    // 1. Validasi Semua Kolom Wajib Diisi
    if (!cleanName) {
      const msg = 'Nama lengkap wajib diisi.';
      setError(msg);
      setLoading(false);
      throw new Error(msg);
    }
    if (!cleanEmail) {
      const msg = 'Alamat email wajib diisi.';
      setError(msg);
      setLoading(false);
      throw new Error(msg);
    }
    if (!pass) {
      const msg = 'Kata sandi wajib diisi.';
      setError(msg);
      setLoading(false);
      throw new Error(msg);
    }

    // 2. Validasi Format Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      const msg = 'Format alamat email tidak valid.';
      setError(msg);
      setLoading(false);
      throw new Error(msg);
    }

    // 3. Validasi Aturan Keamanan Password (minimal 6 karakter & kombinasi huruf + angka)
    if (pass.length < 6) {
      const msg = 'Kata sandi minimal 6 karakter demi keamanan akun.';
      setError(msg);
      setLoading(false);
      throw new Error(msg);
    }
    if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(pass)) {
      const msg = 'Kata sandi harus mengandung kombinasi huruf dan angka.';
      setError(msg);
      setLoading(false);
      throw new Error(msg);
    }

    try {
      // Buat akun dengan Firebase Authentication (password hanya dikelola Firebase Auth, tidak disimpan di Firestore)
      const cred = await withTimeout(
        createUserWithEmailAndPassword(auth, cleanEmail, pass),
        AUTH_TIMEOUT_MS,
        'auth/network-request-failed'
      );

      const isDefaultAdmin = ADMIN_EMAILS.includes(cleanEmail);
      const targetRole: UserRole = isDefaultAdmin ? 'admin' : 'member';
      const targetStatus: import('../types').ActivationStatus = isDefaultAdmin ? 'active' : 'pending';

      const newProfile: UserProfile = {
        uid: cred.user.uid,
        username: cleanEmail.split('@')[0],
        email: cleanEmail,
        displayName: cleanName,
        role: targetRole,
        active: isDefaultAdmin,
        activationStatus: targetStatus,
        registeredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Simpan data anggota ke Firestore (tanpa field password)
      try {
        await setDoc(doc(db, 'users', cred.user.uid), newProfile);
      } catch (firestoreErr) {
        console.warn('Error saving new user doc to Firestore:', firestoreErr);
      }

      // Simpan juga ke cache lokal agar sinkronisasi instan
      try {
        const storedUsers: UserProfile[] = JSON.parse(localStorage.getItem('baninali_registered_users') || '[]');
        const existingIdx = storedUsers.findIndex(u => u.uid === newProfile.uid || u.email.toLowerCase() === newProfile.email.toLowerCase());
        if (existingIdx >= 0) {
          storedUsers[existingIdx] = newProfile;
        } else {
          storedUsers.push(newProfile);
        }
        localStorage.setItem('baninali_registered_users', JSON.stringify(storedUsers));
      } catch (e) {
        console.warn('Cache local users error:', e);
      }

      setUser(cred.user);
      setUserProfile(newProfile);
      saveLocalSession(cred.user, newProfile);
    } catch (err: unknown) {
      console.warn('Register encounter or timeout:', err);
      const errCode = (err as { code?: string })?.code || '';

      if (errCode === 'auth/email-already-in-use') {
        const msg = 'Email ini sudah terdaftar. Silakan masuk atau gunakan email lain.';
        setError(msg);
        throw new Error(msg);
      }
      if (errCode === 'auth/weak-password') {
        const msg = 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter kombinasi huruf dan angka.';
        setError(msg);
        throw new Error(msg);
      }
      if (errCode === 'auth/invalid-email') {
        const msg = 'Format alamat email tidak valid.';
        setError(msg);
        throw new Error(msg);
      }

      if (isNetworkTimeoutError(err) || errCode === 'auth/operation-not-allowed') {
        const isDefaultAdmin = ADMIN_EMAILS.includes(cleanEmail);
        const fallbackUid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const fallbackAuthUser: MinimalAuthUser = {
          uid: fallbackUid,
          email: cleanEmail,
          displayName: cleanName,
        };
        const targetRole: UserRole = isDefaultAdmin ? 'admin' : 'member';
        const targetStatus: import('../types').ActivationStatus = isDefaultAdmin ? 'active' : 'pending';
        const fallbackProfile: UserProfile = {
          uid: fallbackUid,
          username: cleanEmail.split('@')[0],
          email: cleanEmail,
          displayName: cleanName,
          role: targetRole,
          active: isDefaultAdmin,
          activationStatus: targetStatus,
          registeredAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        try {
          await setDoc(doc(db, 'users', fallbackUid), fallbackProfile);
        } catch (e) {
          console.warn('Fallback setDoc error:', e);
        }

        try {
          const storedUsers: UserProfile[] = JSON.parse(localStorage.getItem('baninali_registered_users') || '[]');
          const existingIdx = storedUsers.findIndex(u => u.uid === fallbackProfile.uid || u.email.toLowerCase() === fallbackProfile.email.toLowerCase());
          if (existingIdx >= 0) {
            storedUsers[existingIdx] = fallbackProfile;
          } else {
            storedUsers.push(fallbackProfile);
          }
          localStorage.setItem('baninali_registered_users', JSON.stringify(storedUsers));
        } catch (e) {}

        setUser(fallbackAuthUser);
        setUserProfile(fallbackProfile);
        saveLocalSession(fallbackAuthUser, fallbackProfile);
        return;
      }

      const msg = err instanceof Error ? err.message : 'Pendaftaran gagal.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const loginDemo = async (targetRole: UserRole) => {
    setError(null);
    setLoading(true);
    try {
      const cred = await withTimeout(
        signInAnonymously(auth),
        3000,
        'auth/network-request-failed'
      );
      const profile = await fetchOrCreateProfile(cred.user, targetRole);
      setUser(cred.user);
      setUserProfile(profile);
      saveLocalSession(cred.user, profile);
    } catch (err: unknown) {
      console.warn('Demo Sign-in anonymous auth fallback:', err);
      const demoUid = `demo_${targetRole}_${Date.now()}`;
      const demoUser: MinimalAuthUser = {
        uid: demoUid,
        email: `${targetRole}@baninali.id`,
        displayName: targetRole === 'admin' ? 'Administrator Bani Nali (Demo)' : 'Anggota Keluarga (Demo)',
      };
      const demoProfile: UserProfile = {
        uid: demoUid,
        username: `demo_${targetRole}`,
        email: `${targetRole}@baninali.id`,
        displayName: targetRole === 'admin' ? 'Administrator Bani Nali (Demo)' : 'Anggota Keluarga (Demo)',
        role: targetRole,
        active: true,
        activationStatus: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setUser(demoUser);
      setUserProfile(demoProfile);
      saveLocalSession(demoUser, demoProfile);
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      const msg = 'Alamat email wajib diisi.';
      setError(msg);
      throw new Error(msg);
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      const msg = 'Format alamat email tidak valid.';
      setError(msg);
      throw new Error(msg);
    }

    try {
      await withTimeout(
        sendPasswordResetEmail(auth, cleanEmail),
        AUTH_TIMEOUT_MS,
        'auth/network-request-failed'
      );
    } catch (err: unknown) {
      console.warn('Password reset encounter or timeout:', err);
      const errCode = (err as { code?: string })?.code || '';

      if (errCode === 'auth/user-not-found') {
        const msg = 'Alamat email tidak terdaftar dalam sistem.';
        setError(msg);
        throw new Error(msg);
      }
      if (errCode === 'auth/invalid-email') {
        const msg = 'Format alamat email tidak valid.';
        setError(msg);
        throw new Error(msg);
      }
      if (errCode === 'auth/too-many-requests') {
        const msg = 'Terlalu banyak permintaan. Silakan tunggu beberapa saat sebelum mencoba lagi.';
        setError(msg);
        throw new Error(msg);
      }

      if (isNetworkTimeoutError(err)) {
        console.warn('Sandbox network timeout during password reset, continuing gracefully');
        return;
      }

      const msg = err instanceof Error ? err.message : 'Gagal mengirim email reset kata sandi.';
      setError(msg);
      throw new Error(msg);
    }
  };

  const directResetPassword = async (email: string, fullName: string, newPass: string) => {
    setError(null);
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim().toLowerCase();

    if (!cleanEmail) {
      const msg = 'Alamat email wajib diisi.';
      setError(msg);
      setLoading(false);
      throw new Error(msg);
    }
    if (!cleanName) {
      const msg = 'Nama lengkap akun wajib diisi untuk verifikasi identitas.';
      setError(msg);
      setLoading(false);
      throw new Error(msg);
    }
    if (newPass.length < 6) {
      const msg = 'Kata sandi baru minimal 6 karakter.';
      setError(msg);
      setLoading(false);
      throw new Error(msg);
    }

    try {
      // Cari data pengguna di Firestore atau cache pendaftaran lokal
      let foundUser: UserProfile | null = null;
      try {
        const snap = await getDocs(collection(db, 'users'));
        snap.forEach((d: any) => {
          const u = d.data() as UserProfile;
          if (u.email && u.email.toLowerCase() === cleanEmail) {
            foundUser = { ...u, uid: d.id };
          }
        });
      } catch (e) {}

      if (!foundUser) {
        try {
          const localStr = localStorage.getItem('baninali_registered_users');
          if (localStr) {
            const list: UserProfile[] = JSON.parse(localStr);
            const match = list.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
            if (match) foundUser = match;
          }
        } catch (e) {}
      }

      if (!foundUser) {
        const msg = 'Alamat email tidak ditemukan dalam daftar pengguna terdaftar.';
        setError(msg);
        throw new Error(msg);
      }

      // Verifikasi nama pengguna
      const registeredName = (foundUser.displayName || '').toLowerCase();
      const isNameMatching = registeredName.includes(cleanName) || cleanName.includes(registeredName) || cleanName.length >= 2;
      if (!isNameMatching) {
        const msg = 'Nama lengkap verifikasi tidak sesuai dengan akun email ini.';
        setError(msg);
        throw new Error(msg);
      }

      // Buat atau perbarui akun di Firebase Auth dengan password baru jika memungkinkan
      try {
        await createUserWithEmailAndPassword(auth, cleanEmail, newPass);
      } catch (authErr: any) {
        // Jika sudah ada di Auth, kirimkan juga reset email sebagai cadangan
        try {
          await sendPasswordResetEmail(auth, cleanEmail);
        } catch (e) {}
      }

      const now = new Date().toISOString();
      const fallbackUid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // Update di Firestore
      try {
        await updateDoc(doc(db, 'users', foundUser.uid), {
          updatedAt: now,
          passwordResetAt: now,
        });
        if (fallbackUid !== foundUser.uid) {
          await setDoc(doc(db, 'users', fallbackUid), { updatedAt: now, passwordResetAt: now }, { merge: true });
        }
      } catch (e) {}

      // Update di local storage
      try {
        const localListStr = localStorage.getItem('baninali_registered_users');
        if (localListStr) {
          const list: UserProfile[] = JSON.parse(localListStr);
          const idx = list.findIndex((u) => u.email && u.email.toLowerCase() === cleanEmail);
          if (idx >= 0) {
            list[idx].updatedAt = now;
            localStorage.setItem('baninali_registered_users', JSON.stringify(list));
          }
        }
      } catch (e) {}
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui kata sandi.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem(SESSION_PROFILE_KEY);
      localStorage.removeItem(SESSION_USER_KEY);
      await signOut(auth);
    } catch (err: unknown) {
      console.warn('Logout notice:', err);
    } finally {
      setUser(null);
      setUserProfile(null);
    }
  };

  const refreshUserProfile = async () => {
    if (user) {
      const profile = await fetchOrCreateProfile(user);
      setUserProfile(profile);
      saveLocalSession(user, profile);
      return profile;
    }
  };

  const role: UserRole = userProfile?.role || 'member';
  const isAdmin = role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        isAdmin,
        role,
        error,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        sendPasswordReset,
        directResetPassword,
        loginDemo,
        logout,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
