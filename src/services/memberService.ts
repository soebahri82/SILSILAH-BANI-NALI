import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase/config';
import { FamilyMember, PrivacyLevel } from '../types';
import { getGenderCode } from '../utils/genderUtils';

const MEMBERS_COLLECTION = 'members';

// Initial Heritage Dataset for Bani Nali (Standardized: L/P & privacy 'family')
export const INITIAL_BANI_NALI_MEMBERS: FamilyMember[] = [
  // Generasi 1 (Pondasi Trah)
  {
    id: 'M01',
    name: 'K.H. Nali bin Abdullah',
    gender: 'L',
    birthDate: '1910-04-12',
    deathDate: '1982-08-15',
    birthPlace: 'Pasuruan, Jawa Timur',
    address: 'Jl. Pesantren No. 1, Pasuruan',
    phone: '',
    parentID: null,
    spouseID: 'M02',
    privacy: 'family',
    bio: 'Pendiri dan sesepuh agung trah Bani Nali. Dikenal gigih mendidik keluarga dalam ilmu agama, keteladanan budi pekerti, dan perajut silaturahmi.',
    photoURL: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M02',
    name: 'Hj. Fatimah binti Sholeh',
    gender: 'P',
    birthDate: '1915-09-20',
    deathDate: '1988-12-04',
    birthPlace: 'Pasuruan, Jawa Timur',
    address: 'Jl. Pesantren No. 1, Pasuruan',
    phone: '',
    parentID: null,
    spouseID: 'M01',
    privacy: 'family',
    bio: 'Istri tercinta K.H. Nali. Sosok ibu yang penuh welas asih dan menjadi tiang doa keberkahan anak cucu.',
    photoURL: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Generasi 2 (Anak-anak)
  {
    id: 'M03',
    name: 'Drs. H. Ahmad Fauzan Nali',
    gender: 'L',
    birthDate: '1938-03-10',
    deathDate: '2012-06-21',
    birthPlace: 'Pasuruan, Jawa Timur',
    address: 'Jl. Dharmawangsa No. 24, Surabaya',
    phone: '08123456701',
    parentID: 'M01',
    spouseID: 'M04',
    privacy: 'family',
    bio: 'Putra sulung K.H. Nali. Pendidik dan birokrat yang merintis cabang keluarga di Surabaya.',
    photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M04',
    name: 'Hj. Nur Azizah',
    gender: 'P',
    birthDate: '1942-11-15',
    deathDate: '',
    birthPlace: 'Jombang, Jawa Timur',
    address: 'Jl. Dharmawangsa No. 24, Surabaya',
    phone: '08123456702',
    parentID: null,
    spouseID: 'M03',
    privacy: 'family',
    bio: 'Istri H. Ahmad Fauzan. Tokoh penggerak arisan dan pengajian keluarga besar Bani Nali Surabaya.',
    photoURL: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M05',
    name: 'Hj. Siti Mariam Nali',
    gender: 'P',
    birthDate: '1942-07-08',
    deathDate: '',
    birthPlace: 'Pasuruan, Jawa Timur',
    address: 'Jl. Ahmad Yani No. 12, Sidoarjo',
    phone: '08123456703',
    parentID: 'M01',
    spouseID: 'M06',
    privacy: 'family',
    bio: 'Putri kedua K.H. Nali. Dikenal dermawan dan selalu memfasilitasi pertemuan tahunan keluarga.',
    photoURL: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M06',
    name: 'H. Mochammad Ridwan',
    gender: 'L',
    birthDate: '1939-01-14',
    deathDate: '2018-04-19',
    birthPlace: 'Surabaya, Jawa Timur',
    address: 'Jl. Ahmad Yani No. 12, Sidoarjo',
    phone: '',
    parentID: null,
    spouseID: 'M05',
    privacy: 'family',
    bio: 'Suami Hj. Siti Mariam. Pengusaha dan pelindung keluarga yang bijaksana.',
    photoURL: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M07',
    name: 'H. Abdul Wahid Nali',
    gender: 'L',
    birthDate: '1946-10-25',
    deathDate: '',
    birthPlace: 'Pasuruan, Jawa Timur',
    address: 'Jl. Veteran No. 8, Gresik',
    phone: '08123456704',
    parentID: 'M01',
    spouseID: 'M08',
    privacy: 'family',
    bio: 'Putra ketiga K.H. Nali. Mengembangkan cabang keluarga di Gresik dan pelestari manuskrip trah.',
    photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M08',
    name: 'Hj. Khadijah',
    gender: 'P',
    birthDate: '1949-05-18',
    deathDate: '',
    birthPlace: 'Gresik, Jawa Timur',
    address: 'Jl. Veteran No. 8, Gresik',
    phone: '08123456705',
    parentID: null,
    spouseID: 'M07',
    privacy: 'family',
    bio: 'Istri H. Abdul Wahid. Aktif dalam kegiatan sosial dan kemasyarakatan.',
    photoURL: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Generasi 2 - Cabang H. Samsu Nali (Kasus 2 Pasangan: Kiri & Kanan)
  {
    id: 'M23',
    name: 'H. Samsu Nali',
    gender: 'L',
    birthDate: '1948-09-12',
    deathDate: '',
    birthPlace: 'Pasuruan, Jawa Timur',
    address: 'Jl. Kutai No. 18, Surabaya',
    phone: '08123456790',
    parentID: 'M01',
    spouseID: 'M24, M25',
    spouseIDs: ['M24', 'M25'],
    privacy: 'family',
    bio: 'Putra K.H. Nali. Mempunyai dua pasangan: Istri pertama Hj. Ani Komaria (meninggal dunia 2014), dan Istri kedua Dhesy Rahma.',
    photoURL: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M24',
    name: 'Hj. Ani Komaria',
    gender: 'P',
    birthDate: '1952-04-10',
    deathDate: '2014-06-18',
    birthPlace: 'Bangkalan, Madura',
    address: 'Jl. Kutai No. 18, Surabaya',
    phone: '',
    parentID: null,
    spouseID: 'M23',
    spouseIDs: ['M23'],
    privacy: 'family',
    bio: 'Istri pertama H. Samsu Nali (Almarhumah). Menikah pertama kali dan melahirkan 3 anak (Rahmat, Nur Laili, Dimas).',
    photoURL: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M25',
    name: 'Dhesy Rahma, S.Pd.',
    gender: 'P',
    birthDate: '1965-08-22',
    deathDate: '',
    birthPlace: 'Malang, Jawa Timur',
    address: 'Jl. Kutai No. 18, Surabaya',
    phone: '08123456791',
    parentID: null,
    spouseID: 'M23',
    spouseIDs: ['M23'],
    privacy: 'family',
    bio: 'Istri kedua H. Samsu Nali setelah Hj. Ani Komaria wafat. Melahirkan 2 anak (Muhammad Althaf, Syaqila Rahma).',
    photoURL: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Generasi 3 (Cucu - Cabang Fauzan)
  {
    id: 'M09',
    name: 'Dr. Ir. Muhammad Thohir Nali, M.T.',
    gender: 'L',
    birthDate: '1968-08-17',
    deathDate: '',
    birthPlace: 'Surabaya, Jawa Timur',
    address: 'Kebayoran Baru, Jakarta Selatan',
    phone: '08119876541',
    parentID: 'M03',
    spouseID: 'M10',
    privacy: 'family',
    bio: 'Cucu pertama dari jalur H. Ahmad Fauzan. Akademisi dan praktisi teknologi di Jakarta.',
    photoURL: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M10',
    name: 'dr. Dian Permata, Sp.A.',
    gender: 'P',
    birthDate: '1972-03-24',
    deathDate: '',
    birthPlace: 'Malang, Jawa Timur',
    address: 'Kebayoran Baru, Jakarta Selatan',
    phone: '08119876542',
    parentID: null,
    spouseID: 'M09',
    privacy: 'family',
    bio: 'Dokter spesialis anak. Istri dr. Muhammad Thohir.',
    photoURL: 'https://images.unsplash.com/photo-1594824813589-9a25b16955a8?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M11',
    name: 'Aisyah Nali, S.E., Ak.',
    gender: 'P',
    birthDate: '1973-12-05',
    deathDate: '',
    birthPlace: 'Surabaya, Jawa Timur',
    address: 'Rungkut Asri, Surabaya',
    phone: '08119876543',
    parentID: 'M03',
    spouseID: 'M12',
    privacy: 'family',
    bio: 'Putri kedua H. Ahmad Fauzan. Akuntan publik dan bendahara paguyuban Bani Nali.',
    photoURL: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M12',
    name: 'Hendro Prasetyo, M.M.',
    gender: 'L',
    birthDate: '1970-06-11',
    deathDate: '',
    birthPlace: 'Sidoarjo, Jawa Timur',
    address: 'Rungkut Asri, Surabaya',
    phone: '08119876544',
    parentID: null,
    spouseID: 'M11',
    privacy: 'family',
    bio: 'Suami Aisyah Nali. Profesional di bidang logistik.',
    photoURL: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Generasi 3 (Cucu - Cabang Siti Mariam)
  {
    id: 'M13',
    name: 'Fajar Rahman Ridwan, S.T.',
    gender: 'L',
    birthDate: '1970-04-02',
    deathDate: '',
    birthPlace: 'Surabaya, Jawa Timur',
    address: 'Jl. Merbabu No. 15, Malang',
    phone: '08119876545',
    parentID: 'M05',
    spouseID: 'M14',
    privacy: 'family',
    bio: 'Putra Hj. Siti Mariam. Menetap di Malang dan mengelola usaha agribisnis.',
    photoURL: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M14',
    name: 'Lestari Wulandari, S.Pd.',
    gender: 'P',
    birthDate: '1974-09-19',
    deathDate: '',
    birthPlace: 'Solo, Jawa Tengah',
    address: 'Jl. Merbabu No. 15, Malang',
    phone: '08119876546',
    parentID: null,
    spouseID: 'M13',
    privacy: 'family',
    bio: 'Pendidik dan istri Fajar Rahman Ridwan.',
    photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M15',
    name: 'Zahra Nur Ridwan, M.Psi.',
    gender: 'P',
    birthDate: '1976-11-28',
    deathDate: '',
    birthPlace: 'Surabaya, Jawa Timur',
    address: 'Darmo Permai, Surabaya',
    phone: '08119876547',
    parentID: 'M05',
    spouseID: null,
    privacy: 'family',
    bio: 'Putri kedua Hj. Siti Mariam. Psikolog anak dan pengamat perkembangan remaja.',
    photoURL: 'https://images.unsplash.com/photo-1548142813-c348350df52b?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Generasi 3 (Cucu - Cabang Abdul Wahid)
  {
    id: 'M16',
    name: 'Haris Nali, S.Kom.',
    gender: 'L',
    birthDate: '1978-02-14',
    deathDate: '',
    birthPlace: 'Gresik, Jawa Timur',
    address: 'Gresik Kota Baru, Gresik',
    phone: '08119876548',
    parentID: 'M07',
    spouseID: 'M17',
    privacy: 'family',
    bio: 'Putra H. Abdul Wahid. Koordinator digital dan inisiator digitalisasi silsilah Bani Nali.',
    photoURL: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M17',
    name: 'Rina Kusuma Dewi',
    gender: 'P',
    birthDate: '1981-08-30',
    deathDate: '',
    birthPlace: 'Tuban, Jawa Timur',
    address: 'Gresik Kota Baru, Gresik',
    phone: '08119876549',
    parentID: null,
    spouseID: 'M16',
    privacy: 'family',
    bio: 'Istri Haris Nali. Desainer grafis dan pemerhati seni budaya.',
    photoURL: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Generasi 3 (Cucu - Anak-anak H. Samsu Nali Urut Tanggal Lahir)
  {
    id: 'M26',
    name: 'Rahmat Hidayat Nali, S.E.',
    gender: 'L',
    birthDate: '1975-02-14',
    deathDate: '',
    birthPlace: 'Surabaya, Jawa Timur',
    address: 'Wonokromo, Surabaya',
    phone: '08139988111',
    parentID: 'M23',
    spouseID: null,
    privacy: 'family',
    bio: 'Putra pertama H. Samsu Nali dan Hj. Ani Komaria.',
    photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M27',
    name: 'Nur Laili Nali, S.Farm.',
    gender: 'P',
    birthDate: '1978-06-19',
    deathDate: '',
    birthPlace: 'Surabaya, Jawa Timur',
    address: 'Ketintang, Surabaya',
    phone: '08139988222',
    parentID: 'M23',
    spouseID: null,
    privacy: 'family',
    bio: 'Putri kedua H. Samsu Nali dan Hj. Ani Komaria. Apoteker di RS Surabaya.',
    photoURL: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M28',
    name: 'Dimas Prasetyo Nali, S.T.',
    gender: 'L',
    birthDate: '1982-11-25',
    deathDate: '',
    birthPlace: 'Surabaya, Jawa Timur',
    address: 'Rungkut, Surabaya',
    phone: '08139988333',
    parentID: 'M23',
    spouseID: null,
    privacy: 'family',
    bio: 'Putra ketiga H. Samsu Nali dan Hj. Ani Komaria.',
    photoURL: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M29',
    name: 'Muhammad Althaf Nali',
    gender: 'L',
    birthDate: '2016-09-05',
    deathDate: '',
    birthPlace: 'Surabaya, Jawa Timur',
    address: 'Jl. Kutai No. 18, Surabaya',
    phone: '',
    parentID: 'M23',
    spouseID: null,
    privacy: 'family',
    bio: 'Putra H. Samsu Nali dari pernikahannya dengan Dhesy Rahma.',
    photoURL: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M30',
    name: 'Syaqila Rahma Nali',
    gender: 'P',
    birthDate: '2019-03-14',
    deathDate: '',
    birthPlace: 'Surabaya, Jawa Timur',
    address: 'Jl. Kutai No. 18, Surabaya',
    phone: '',
    parentID: 'M23',
    spouseID: null,
    privacy: 'family',
    bio: 'Putri bungsu H. Samsu Nali dari pernikahannya dengan Dhesy Rahma.',
    photoURL: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // Generasi 4 (Cicit)
  {
    id: 'M18',
    name: 'Zidan Rayhan Nali',
    gender: 'L',
    birthDate: '2000-01-19',
    deathDate: '',
    birthPlace: 'Jakarta',
    address: 'Kebayoran Baru, Jakarta Selatan',
    phone: '08129990001',
    parentID: 'M09',
    spouseID: null,
    privacy: 'family',
    bio: 'Cicit K.H. Nali dari garis Dr. Ir. Muhammad Thohir. Mahasiswa pascasarjana ilmu komputer.',
    photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M19',
    name: 'Nadia Safira Nali',
    gender: 'P',
    birthDate: '2004-05-12',
    deathDate: '',
    birthPlace: 'Jakarta',
    address: 'Kebayoran Baru, Jakarta Selatan',
    phone: '08129990002',
    parentID: 'M09',
    spouseID: null,
    privacy: 'family',
    bio: 'Putri Dr. Muhammad Thohir. Mahasiswi kedokteran.',
    photoURL: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M20',
    name: 'Alif Danendra',
    gender: 'L',
    birthDate: '2002-09-08',
    deathDate: '',
    birthPlace: 'Surabaya, Jawa Timur',
    address: 'Rungkut Asri, Surabaya',
    phone: '08129990003',
    parentID: 'M11',
    spouseID: null,
    privacy: 'family',
    bio: 'Putra Aisyah Nali. Mahasiswa teknik arsitektur ITS.',
    photoURL: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M21',
    name: 'Salma Humaira Ridwan',
    gender: 'P',
    birthDate: '2006-03-27',
    deathDate: '',
    birthPlace: 'Malang, Jawa Timur',
    address: 'Jl. Merbabu No. 15, Malang',
    phone: '08129990004',
    parentID: 'M13',
    spouseID: null,
    privacy: 'family',
    bio: 'Putri Fajar Rahman Ridwan.',
    photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'M22',
    name: 'Farhan Nali',
    gender: 'L',
    birthDate: '2012-10-10',
    deathDate: '',
    birthPlace: 'Gresik, Jawa Timur',
    address: 'Gresik Kota Baru, Gresik',
    phone: '',
    parentID: 'M16',
    spouseID: null,
    privacy: 'family',
    bio: 'Putra Haris Nali. Generasi keempat trah Bani Nali.',
    photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Subscribe to real-time members collection
export function subscribeMembers(
  onData: (members: FamilyMember[]) => void,
  onError: (err: Error) => void
) {
  try {
    const q = query(collection(db, MEMBERS_COLLECTION), orderBy('name', 'asc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: FamilyMember[] = [];
        snapshot.forEach((doc) => {
          list.push({ ...doc.data(), id: doc.id } as FamilyMember);
        });
        onData(list);
      },
      (error) => {
        console.error('Error fetching members onSnapshot:', error);
        handleFirestoreError(error, OperationType.GET, MEMBERS_COLLECTION);
        onError(error);
      }
    );
  } catch (error: unknown) {
    handleFirestoreError(error, OperationType.GET, MEMBERS_COLLECTION);
  }
}

// Get all members one-shot
export async function getMembers(): Promise<FamilyMember[]> {
  try {
    const snap = await getDocs(collection(db, MEMBERS_COLLECTION));
    const list: FamilyMember[] = [];
    snap.forEach((doc) => {
      list.push({ ...doc.data(), id: doc.id } as FamilyMember);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, MEMBERS_COLLECTION);
  }
}

// Get member by ID
export async function getMemberById(id: string): Promise<FamilyMember | null> {
  const path = `${MEMBERS_COLLECTION}/${id}`;
  try {
    const snap = await getDoc(doc(db, MEMBERS_COLLECTION, id));
    if (snap.exists()) {
      return { ...snap.data(), id: snap.id } as FamilyMember;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// Add member with standardized L/P and 'family' privacy
export async function addMember(member: Omit<FamilyMember, 'createdAt' | 'updatedAt'>): Promise<string> {
  const id = member.id || `M${Date.now()}`;
  const path = `${MEMBERS_COLLECTION}/${id}`;
  const now = new Date().toISOString();
  const data: FamilyMember = {
    ...member,
    id,
    gender: getGenderCode(member.gender),
    privacy: 'family',
    createdAt: now,
    updatedAt: now,
  };
  try {
    await setDoc(doc(db, MEMBERS_COLLECTION, id), data);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// Update member with standardized L/P and 'family' privacy
export async function updateMember(id: string, updates: Partial<FamilyMember>): Promise<void> {
  const path = `${MEMBERS_COLLECTION}/${id}`;
  const data: Record<string, any> = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  if (updates.gender !== undefined) {
    data.gender = getGenderCode(updates.gender);
  }
  // Standardize privacy to family
  data.privacy = 'family';

  try {
    await updateDoc(doc(db, MEMBERS_COLLECTION, id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Delete member
export async function deleteMember(id: string): Promise<void> {
  const path = `${MEMBERS_COLLECTION}/${id}`;
  try {
    await deleteDoc(doc(db, MEMBERS_COLLECTION, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Upload photo to Firebase Storage with error resilience
export async function uploadMemberPhoto(memberId: string, file: File): Promise<string> {
  try {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const storagePath = `members/${memberId}/${Date.now()}.${fileExt}`;
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  } catch (error) {
    console.warn('Storage upload encountered limitation, converting to local preview URL fallback:', error);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }
}

// Batch Seed Initial Bani Nali Genealogy Dataset
export async function seedInitialBaniNali(): Promise<number> {
  const batch = writeBatch(db);
  INITIAL_BANI_NALI_MEMBERS.forEach((m) => {
    const docRef = doc(db, MEMBERS_COLLECTION, m.id);
    batch.set(docRef, m);
  });
  try {
    await batch.commit();
    return INITIAL_BANI_NALI_MEMBERS.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, MEMBERS_COLLECTION);
  }
}

// Standarisasi Database Langsung di Firestore (L = Laki-laki, P = Perempuan, Privasi = family)
export async function standardizeDatabaseRecords(): Promise<number> {
  try {
    const snap = await getDocs(collection(db, MEMBERS_COLLECTION));
    const batch = writeBatch(db);
    let count = 0;
    snap.forEach((d) => {
      const data = d.data() as FamilyMember;
      const stdGender = getGenderCode(data.gender);
      const stdPrivacy: PrivacyLevel = 'family';
      if (data.gender !== stdGender || data.privacy !== stdPrivacy) {
        batch.update(doc(db, MEMBERS_COLLECTION, d.id), {
          gender: stdGender,
          privacy: stdPrivacy,
          updatedAt: new Date().toISOString(),
        });
        count++;
      }
    });
    if (count > 0) {
      await batch.commit();
    }
    return count;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, MEMBERS_COLLECTION);
  }
}
