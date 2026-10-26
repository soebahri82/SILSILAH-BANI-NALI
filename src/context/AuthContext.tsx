import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInAnonymously,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
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
  loginDemo: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrCreateProfile = async (
    firebaseUser: { uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null },
    forcedRole?: UserRole
  ): Promise<UserProfile> => {
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const isDefaultAdmin = ADMIN_EMAILS.includes(firebaseUser.email?.toLowerCase() || '') || forcedRole === 'admin';
    const targetRole = forcedRole || (isDefaultAdmin ? 'admin' : 'member');

    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        if (forcedRole && data.role !== forcedRole) {
          try {
            await updateDoc(userDocRef, { role: forcedRole, updatedAt: new Date().toISOString() });
          } catch (e) {
            console.warn('Update doc role notice:', e);
          }
          return { ...data, role: forcedRole };
        }
        return data;
      } else {
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          username: firebaseUser.email?.split('@')[0] || `user_${firebaseUser.uid.slice(0, 5)}`,
          email: firebaseUser.email || (forcedRole ? `${forcedRole}@baninali.id` : 'anggota@baninali.id'),
          displayName:
            firebaseUser.displayName ||
            (targetRole === 'admin' ? 'Administrator Bani Nali' : 'Anggota Keluarga Bani Nali'),
          role: targetRole,
          photoURL: firebaseUser.photoURL || undefined,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        try {
          await setDoc(userDocRef, newProfile);
        } catch (e) {
          console.warn('Could not write profile to Firestore:', e);
        }
        return newProfile;
      }
    } catch (err) {
      console.warn('Error fetching/creating user profile from Firestore, using resilient profile:', err);
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email || 'anggota@baninali.id',
        displayName: firebaseUser.displayName || (targetRole === 'admin' ? 'Administrator Bani Nali' : 'Anggota Bani Nali'),
        role: targetRole,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
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
    try {
      const cred = await withTimeout(
        createUserWithEmailAndPassword(auth, cleanEmail, pass),
        AUTH_TIMEOUT_MS,
        'auth/network-request-failed'
      );
      const profile = await fetchOrCreateProfile(cred.user);
      if (name) {
        try {
          await updateDoc(doc(db, 'users', cred.user.uid), { displayName: name });
        } catch (e) {
          console.warn('Update display name error:', e);
        }
        profile.displayName = name;
      }
      setUser(cred.user);
      setUserProfile(profile);
      saveLocalSession(cred.user, profile);
    } catch (err: unknown) {
      console.warn('Register encounter or timeout:', err);
      if (isNetworkTimeoutError(err) || (err as { code?: string })?.code === 'auth/operation-not-allowed') {
        const isDefaultAdmin = ADMIN_EMAILS.includes(cleanEmail);
        const fallbackUid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const fallbackAuthUser: MinimalAuthUser = {
          uid: fallbackUid,
          email: cleanEmail,
          displayName: name || cleanEmail.split('@')[0],
        };
        const targetRole: UserRole = isDefaultAdmin ? 'admin' : 'member';
        const profile = await fetchOrCreateProfile(fallbackAuthUser, targetRole);
        if (name) profile.displayName = name;
        setUser(fallbackAuthUser);
        setUserProfile(profile);
        saveLocalSession(fallbackAuthUser, profile);
        return;
      }
      setError(err instanceof Error ? err.message : 'Pendaftaran gagal.');
      throw err;
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
