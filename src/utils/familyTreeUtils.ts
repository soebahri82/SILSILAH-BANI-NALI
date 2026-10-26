import { FamilyMember } from '../types';

/**
 * Mengambil seluruh ID pasangan dari seorang anggota keluarga,
 * mendukung pasangan tunggal, jamak (comma-separated atau array spouseIDs),
 * serta relasi timbal-balik (reciprocal spouse link).
 */
export function getMemberSpouseIds(
  member: FamilyMember,
  allMembers?: FamilyMember[]
): string[] {
  const ids = new Set<string>();

  // 1. Dari array spouseIDs jika ada
  if (Array.isArray(member.spouseIDs)) {
    member.spouseIDs.forEach((id) => {
      const clean = id?.trim();
      if (clean && clean !== member.id) ids.add(clean);
    });
  }

  // 2. Dari field spouseID (bisa bernilai tunggal atau comma/semicolon-separated)
  if (member.spouseID) {
    const rawParts = member.spouseID.split(/[,;]+/);
    rawParts.forEach((part) => {
      const clean = part.trim();
      if (clean && clean !== member.id) ids.add(clean);
    });
  }

  // 3. Relasi timbal-balik (jika anggota lain mencantumkan member.id sebagai pasangan)
  if (allMembers && Array.isArray(allMembers)) {
    allMembers.forEach((other) => {
      if (other.id === member.id) return;

      let isSpouse = false;
      if (Array.isArray(other.spouseIDs) && other.spouseIDs.includes(member.id)) {
        isSpouse = true;
      }
      if (other.spouseID) {
        const parts = other.spouseID.split(/[,;]+/).map((p) => p.trim());
        if (parts.includes(member.id)) {
          isSpouse = true;
        }
      }

      if (isSpouse) {
        ids.add(other.id);
      }
    });
  }

  return Array.from(ids);
}

/**
 * Mengambil daftar objek FamilyMember pasangan yang telah diurutkan.
 * Urutan: Pasangan terdahulu (misal almarhumah atau tanggal lahir lebih awal) ke pasangan berikutnya.
 */
export function getMemberSpouses(
  member: FamilyMember,
  allMembers: FamilyMember[]
): FamilyMember[] {
  const spouseIds = getMemberSpouseIds(member, allMembers);
  const memberMap = new Map<string, FamilyMember>();
  allMembers.forEach((m) => memberMap.set(m.id, m));

  const spouses: FamilyMember[] = [];
  spouseIds.forEach((id) => {
    const s = memberMap.get(id);
    if (s) spouses.push(s);
  });

  // Urutkan pasangan:
  // Pasangan yang telah wafat lebih dahulu atau tanggal lahir lebih tua ditempatkan sebagai pasangan awal
  return spouses.sort((a, b) => {
    // Jika salah satu wafat dan yang lain hidup, yang wafat biasanya pernikahan terdahulu
    if (a.deathDate && !b.deathDate) return -1;
    if (!a.deathDate && b.deathDate) return 1;

    // Urutkan berdasarkan tanggal lahir
    const dateA = a.birthDate || '9999-99-99';
    const dateB = b.birthDate || '9999-99-99';
    return dateA.localeCompare(dateB);
  });
}

/**
 * Mengurutkan daftar anggota keluarga berdasarkan tanggal lahir (anak tertua ke termuda).
 * Tanggal lahir kosong akan ditaruh di akhir urutan secara konsisten.
 */
export function sortMembersByBirthDate(
  members: FamilyMember[],
  ascending: boolean = true
): FamilyMember[] {
  return [...members].sort((a, b) => {
    const hasA = !!a.birthDate && a.birthDate.trim().length > 0;
    const hasB = !!b.birthDate && b.birthDate.trim().length > 0;

    if (!hasA && !hasB) return a.name.localeCompare(b.name);
    if (!hasA) return 1; // Taruh tanggal kosong di belakang
    if (!hasB) return -1;

    const cmp = a.birthDate!.localeCompare(b.birthDate!);
    return ascending ? cmp : -cmp;
  });
}

/**
 * Menemukan seluruh anak dari seorang anggota atau dari pasangan-pasangannya.
 * Seluruh anak diurutkan berdasarkan tanggal lahir secara kronologis.
 */
export function getChildrenOfMember(
  member: FamilyMember,
  allMembers: FamilyMember[]
): FamilyMember[] {
  const spouseIds = getMemberSpouseIds(member, allMembers);
  const parentIdSet = new Set<string>([member.id, ...spouseIds]);

  const children = allMembers.filter((m) => {
    if (!m.parentID) return false;
    // Dukung kemungkinan parentID jamak dipisah koma jika ada
    const pIds = m.parentID.split(/[,;]+/).map((p) => p.trim());
    return pIds.some((id) => parentIdSet.has(id));
  });

  return sortMembersByBirthDate(children, true);
}

/**
 * Menentukan informasi pasangan (misal: ibu kandung atau pernikahan ke berapa)
 * untuk seorang anak dalam relasi dengan orang tua yang memiliki multiple pasangan.
 */
export function getChildParentSpouseInfo(
  child: FamilyMember,
  parent: FamilyMember,
  spouses: FamilyMember[]
): {
  spouse?: FamilyMember;
  spouseIndex?: number;
  spouseLabel?: string;
  sideText?: 'Kiri' | 'Kanan' | 'Tunggal';
} {
  if (!spouses || spouses.length === 0) {
    return {};
  }

  // Jika hanya memiliki 1 pasangan
  if (spouses.length === 1) {
    return {
      spouse: spouses[0],
      spouseIndex: 0,
      spouseLabel: spouses[0].name,
      sideText: 'Kanan',
    };
  }

  // 1. Cek apakah parentID anak secara eksplisit mencantumkan ID pasangan
  if (child.parentID) {
    const pIds = child.parentID.split(/[,;]+/).map((p) => p.trim());
    for (let i = 0; i < spouses.length; i++) {
      if (pIds.includes(spouses[i].id)) {
        return {
          spouse: spouses[i],
          spouseIndex: i,
          spouseLabel: spouses[i].name,
          sideText: i === 0 ? 'Kiri' : 'Kanan',
        };
      }
    }
  }

  // 2. Cek apakah bio anak mencantumkan nama pasangan (misal: "dari Hj. Ani Komaria" atau "Dhesy Rahma")
  if (child.bio) {
    const lowerBio = child.bio.toLowerCase();
    for (let i = 0; i < spouses.length; i++) {
      const nameParts = spouses[i].name.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const matches = nameParts.some((part) => lowerBio.includes(part));
      if (matches) {
        return {
          spouse: spouses[i],
          spouseIndex: i,
          spouseLabel: spouses[i].name,
          sideText: i === 0 ? 'Kiri' : 'Kanan',
        };
      }
    }
  }

  // 3. Cek kronologis tahun kelahiran relatif terhadap tanggal wafat pasangan pertama
  if (child.birthDate && spouses.length >= 2) {
    const firstSpouse = spouses[0];
    if (firstSpouse.deathDate) {
      if (child.birthDate <= firstSpouse.deathDate) {
        return {
          spouse: firstSpouse,
          spouseIndex: 0,
          spouseLabel: firstSpouse.name,
          sideText: 'Kiri',
        };
      } else {
        const secondSpouse = spouses[1];
        return {
          spouse: secondSpouse,
          spouseIndex: 1,
          spouseLabel: secondSpouse.name,
          sideText: 'Kanan',
        };
      }
    }
  }

  return {};
}
