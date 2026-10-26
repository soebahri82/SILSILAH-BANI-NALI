import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { FamilyEvent } from '../types';

const EVENTS_COLLECTION = 'events';

export const INITIAL_BANI_NALI_EVENTS: FamilyEvent[] = [
  {
    id: 'E01',
    namaAcara: 'Halal Bihalal & Temu Akbar Trah Bani Nali 1448 H',
    tanggal: '2026-11-20T09:00',
    tempat: 'Gedung Pertemuan Graha Kencana, Surabaya',
    deskripsi: 'Silaturahmi akbar tahunan seluruh keturunan Bani Nali. Agenda meliputi pembacaan tahlil & doa arwah leluhur, pengenalan generasi muda, dan pembaruan buku silsilah keluarga.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'E02',
    namaAcara: 'Haul K.H. Nali & Hj. Fatimah ke-44',
    tanggal: '2026-12-15T18:30',
    tempat: 'Kediaman Utama Pesantren, Pasuruan, Jawa Timur',
    deskripsi: 'Peringatan haul pendiri keluarga besar Bani Nali dirangkai dengan khataman Al-Qur’an serta santunan anak yatim bersama masyarakat sekitar.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'E03',
    namaAcara: 'Arisan & Silaturahmi Triwulan Cabang Jabodetabek',
    tanggal: '2027-01-17T10:00',
    tempat: 'Kediaman Dr. Muhammad Thohir, Kebayoran Baru, Jakarta',
    deskripsi: 'Pertemuan rutin tiga bulanan keluarga Bani Nali wilayah Jakarta, Bogor, Depok, Tangerang, dan Bekasi guna mempererat ukhuwah para perantau.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function subscribeEvents(
  onData: (events: FamilyEvent[]) => void,
  onError: (err: Error) => void
) {
  try {
    const q = query(collection(db, EVENTS_COLLECTION), orderBy('tanggal', 'asc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: FamilyEvent[] = [];
        snapshot.forEach((doc) => {
          list.push({ ...doc.data(), id: doc.id } as FamilyEvent);
        });
        onData(list);
      },
      (error) => {
        console.error('Error in subscribeEvents:', error);
        handleFirestoreError(error, OperationType.GET, EVENTS_COLLECTION);
        onError(error);
      }
    );
  } catch (error: unknown) {
    handleFirestoreError(error, OperationType.GET, EVENTS_COLLECTION);
  }
}

export async function getEvents(): Promise<FamilyEvent[]> {
  try {
    const snap = await getDocs(collection(db, EVENTS_COLLECTION));
    const list: FamilyEvent[] = [];
    snap.forEach((doc) => {
      list.push({ ...doc.data(), id: doc.id } as FamilyEvent);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, EVENTS_COLLECTION);
  }
}

export async function addEvent(event: Omit<FamilyEvent, 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = event.id || `E${Date.now()}`;
  const path = `${EVENTS_COLLECTION}/${id}`;
  const now = new Date().toISOString();
  const data: FamilyEvent = {
    ...event,
    id,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await setDoc(doc(db, EVENTS_COLLECTION, id), data);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateEvent(id: string, updates: Partial<FamilyEvent>): Promise<void> {
  const path = `${EVENTS_COLLECTION}/${id}`;
  const data = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  try {
    await updateDoc(doc(db, EVENTS_COLLECTION, id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteEvent(id: string): Promise<void> {
  const path = `${EVENTS_COLLECTION}/${id}`;
  try {
    await deleteDoc(doc(db, EVENTS_COLLECTION, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedInitialEvents(): Promise<number> {
  const batch = writeBatch(db);
  INITIAL_BANI_NALI_EVENTS.forEach((e) => {
    const docRef = doc(db, EVENTS_COLLECTION, e.id);
    batch.set(docRef, e);
  });
  try {
    await batch.commit();
    return INITIAL_BANI_NALI_EVENTS.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, EVENTS_COLLECTION);
  }
}
