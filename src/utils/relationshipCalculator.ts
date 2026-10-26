import { FamilyMember, RelationshipResult } from '../types';
import { 
  getMemberSpouseIds, 
  getMemberSpouses, 
  getChildParentSpouseInfo 
} from './familyTreeUtils';
import { isMale, isFemale } from './genderUtils';

export interface ResolvedParent {
  parent: FamilyMember;
  isBiological: boolean;
  type: 'father' | 'mother';
}

/**
 * Mendapatkan seluruh orang tua dari seorang anak berdasarkan ketentuan ahli silsilah:
 * 1. Orang tua biologis langsung yang tercatat di field parentID (biasanya ayah/trah).
 * 2. Pasangan sah dari orang tua tersebut:
 *    - Jika memiliki 1 pasangan (misal: Mbah Nali & Mbah Martiah):
 *      Pasangan tersebut otomatis menjadi IBU KANDUNG atau AYAH KANDUNG (bukan sambung/tiri).
 *    - Jika memiliki lebih dari 1 pasangan (poligami / re-marriage):
 *      Dipilih pasangan yang melahirkan/menurunkan anak tersebut (berdasarkan info parentID, bio, atau kronologi tanggal).
 *      Pasangan lainnya berstatus orang tua sambung.
 */
export function getResolvedParents(
  child: FamilyMember,
  members: FamilyMember[],
  memberMap: Map<string, FamilyMember>
): ResolvedParent[] {
  const result: ResolvedParent[] = [];
  const addedIds = new Set<string>();

  // 1. Cek field eksplisit fatherID jika ada
  if (child.fatherID) {
    const f = memberMap.get(child.fatherID);
    if (f && !addedIds.has(f.id)) {
      addedIds.add(f.id);
      result.push({
        parent: f,
        isBiological: true,
        type: 'father',
      });
    }
  }

  // 2. Cek field eksplisit motherID jika ada
  if (child.motherID) {
    const m = memberMap.get(child.motherID);
    if (m && !addedIds.has(m.id)) {
      addedIds.add(m.id);
      result.push({
        parent: m,
        isBiological: true,
        type: 'mother',
      });
    }
  }

  // 3. Cek field parentID (bisa bernilai tunggal, koma, titik koma)
  if (child.parentID) {
    const rawParentIds = child.parentID
      .split(/[,;]+/)
      .map((p) => p.trim())
      .filter(Boolean);

    const directParents: FamilyMember[] = [];

    for (const pid of rawParentIds) {
      const p = memberMap.get(pid);
      if (p && !addedIds.has(p.id)) {
        addedIds.add(p.id);
        directParents.push(p);
        result.push({
          parent: p,
          isBiological: true,
          type: isMale(p.gender) ? 'father' : 'mother',
        });
      } else if (p && !directParents.some((dp) => dp.id === p.id)) {
        directParents.push(p);
      }
    }

    // 4. Hubungkan dengan pasangan sah dari orang tua langsung jika ayah/ibu belum lengkap
    for (const dp of directParents) {
      const spouses = getMemberSpouses(dp, members);
      if (spouses.length === 1) {
        // 1 pasangan sah -> Pasti orang tua kandung (Ibu Kandung / Ayah Kandung)
        const sp = spouses[0];
        if (!addedIds.has(sp.id)) {
          addedIds.add(sp.id);
          result.push({
            parent: sp,
            isBiological: true,
            type: isMale(sp.gender) ? 'father' : 'mother',
          });
        }
      } else if (spouses.length > 1) {
        // Lebih dari 1 pasangan -> Identifikasi pasangan mana yang melahirkan anak ini
        const info = getChildParentSpouseInfo(child, dp, spouses);
        const bioSpouse = info.spouse || spouses[0];

        for (const sp of spouses) {
          if (!addedIds.has(sp.id)) {
            addedIds.add(sp.id);
            const isBio = bioSpouse.id === sp.id;
            result.push({
              parent: sp,
              isBiological: isBio,
              type: isMale(sp.gender) ? 'father' : 'mother',
            });
          }
        }
      }
    }
  }

  return result;
}

/**
 * Helper untuk mengambil objek Ayah Kandung seorang anggota
 */
export function getFatherOfMember(
  child: FamilyMember,
  members: FamilyMember[],
  memberMap: Map<string, FamilyMember>
): FamilyMember | null {
  if (child.fatherID && memberMap.has(child.fatherID)) {
    return memberMap.get(child.fatherID)!;
  }
  const parents = getResolvedParents(child, members, memberMap);
  const father = parents.find((p) => p.type === 'father' && p.isBiological);
  return father ? father.parent : null;
}

/**
 * Helper untuk mengambil objek Ibu Kandung seorang anggota
 */
export function getMotherOfMember(
  child: FamilyMember,
  members: FamilyMember[],
  memberMap: Map<string, FamilyMember>
): FamilyMember | null {
  if (child.motherID && memberMap.has(child.motherID)) {
    return memberMap.get(child.motherID)!;
  }
  const parents = getResolvedParents(child, members, memberMap);
  const mother = parents.find((p) => p.type === 'mother' && p.isBiological);
  return mother ? mother.parent : null;
}

/**
 * Mendapatkan seluruh anak dari seorang anggota keluarga (baik sebagai ayah maupun ibu):
 * Mengembalikan objek anak beserta status kandung / sambung.
 */
export function getResolvedChildrenOf(
  parent: FamilyMember,
  members: FamilyMember[],
  memberMap: Map<string, FamilyMember>
): Array<{ child: FamilyMember; isBiological: boolean }> {
  const result: Array<{ child: FamilyMember; isBiological: boolean }> = [];
  const addedIds = new Set<string>();

  for (const m of members) {
    if (!m.parentID || m.id === parent.id) continue;
    const parents = getResolvedParents(m, members, memberMap);
    const match = parents.find((p) => p.parent.id === parent.id);
    if (match && !addedIds.has(m.id)) {
      addedIds.add(m.id);
      result.push({
        child: m,
        isBiological: match.isBiological,
      });
    }
  }

  return result;
}

interface AncestorNode {
  distance: number;
  path: Array<{ member: FamilyMember; relationToNext?: string }>;
}

/**
 * Melacak seluruh leluhur kandung (ancestors) secara rekursif (Ayah, Ibu, Kakek, Nenek, Buyut, dst.)
 */
function getBiologicalAncestors(
  startMember: FamilyMember,
  members: FamilyMember[],
  memberMap: Map<string, FamilyMember>
): Map<string, AncestorNode> {
  const ancestors = new Map<string, AncestorNode>();
  ancestors.set(startMember.id, {
    distance: 0,
    path: [{ member: startMember }],
  });

  const queue: Array<{ id: string; distance: number; path: Array<{ member: FamilyMember; relationToNext?: string }> }> = [
    { id: startMember.id, distance: 0, path: [{ member: startMember }] },
  ];
  const visited = new Set<string>([startMember.id]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const m = memberMap.get(current.id);
    if (!m) continue;

    const parents = getResolvedParents(m, members, memberMap).filter((p) => p.isBiological);
    for (const p of parents) {
      if (!visited.has(p.parent.id)) {
        visited.add(p.parent.id);
        const relToNext = p.type === 'father' ? 'anak kandung dari ayah' : 'anak kandung dari ibu';
        const newPath = [
          ...current.path.slice(0, -1),
          { member: m, relationToNext: relToNext },
          { member: p.parent },
        ];
        const newDist = current.distance + 1;
        ancestors.set(p.parent.id, {
          distance: newDist,
          path: newPath,
        });
        queue.push({
          id: p.parent.id,
          distance: newDist,
          path: newPath,
        });
      }
    }
  }

  return ancestors;
}

/**
 * Fungsi Utama: Menghitung hubungan kekerabatan antara Orang Pertama (A) dan Orang Kedua (B)
 * sesuai dengan kaidah ahli silsilah keluarga besar Bani Nali.
 */
export function calculateRelationship(
  personA: FamilyMember,
  personB: FamilyMember,
  members: FamilyMember[]
): RelationshipResult {
  if (personA.id === personB.id) {
    return {
      personA,
      personB,
      relationshipName: 'Diri Sendiri',
      relationshipType: 'self',
      description: 'Orang yang dipilih adalah individu yang sama.',
      path: [{ member: personA }],
    };
  }

  const memberMap = new Map<string, FamilyMember>();
  members.forEach((m) => memberMap.set(m.id, m));

  const isMaleB = isMale(personB.gender);
  const isFemaleB = isFemale(personB.gender);

  const spouseIdsA = getMemberSpouseIds(personA, members);
  const spouseIdsB = getMemberSpouseIds(personB, members);

  // =========================================================================
  // 1. CEK PASANGAN LANGSUNG (SUAMI / ISTRI)
  // =========================================================================
  if (spouseIdsA.includes(personB.id) || spouseIdsB.includes(personA.id)) {
    const spousesA = getMemberSpouses(personA, members);
    const spouseIdx = spousesA.findIndex((s) => s.id === personB.id);
    const orderText = spousesA.length > 1 && spouseIdx >= 0 ? ` ke-${spouseIdx + 1}` : '';
    const relName = `${isFemaleB ? 'Istri' : 'Suami'}${orderText}`;

    return {
      personA,
      personB,
      relationshipName: relName,
      relationshipType: 'direct',
      description: `${personB.name} adalah ${relName} sah dari ${personA.name}${
        personB.deathDate ? ' (Almarhum/Almarhumah)' : ''
      }.`,
      path: [
        { member: personA, relationToNext: `menikah dengan (${relName})` },
        { member: personB },
      ],
    };
  }

  // =========================================================================
  // 2. CEK HUBUNGAN ORANG TUA & ANAK (KANDUNG / SAMBUNG)
  //    Contoh: Hanafi adalah anak kandung dari Mbah Martiah (istri Mbah Nali)
  // =========================================================================
  const parentsOfB = getResolvedParents(personB, members, memberMap);
  const parentAMatch = parentsOfB.find((p) => p.parent.id === personA.id);

  if (parentAMatch) {
    const isBio = parentAMatch.isBiological;
    const relName = isBio
      ? isMaleB ? 'Anak Kandung Laki-laki' : 'Anak Kandung Perempuan'
      : isMaleB ? 'Anak Sambung Laki-laki' : 'Anak Sambung Perempuan';

    const parentTypeA = isMale(personA.gender) ? 'ayah' : 'ibu';
    const statusText = isBio ? `${parentTypeA} kandung` : `${parentTypeA} sambung`;

    return {
      personA,
      personB,
      relationshipName: relName,
      relationshipType: isBio ? 'direct' : 'inlaw',
      description: `${personB.name} adalah ${relName.toLowerCase()} dari ${personA.name} (${personA.name} adalah ${statusText}).`,
      path: [
        { member: personA, relationToNext: `${statusText} dari` },
        { member: personB },
      ],
    };
  }

  const parentsOfA = getResolvedParents(personA, members, memberMap);
  const parentBMatch = parentsOfA.find((p) => p.parent.id === personB.id);

  if (parentBMatch) {
    const isBio = parentBMatch.isBiological;
    const isFather = isMaleB;
    const relName = isBio
      ? isFather ? 'Ayah Kandung' : 'Ibu Kandung'
      : isFather ? 'Ayah Sambung' : 'Ibu Sambung';

    return {
      personA,
      personB,
      relationshipName: relName,
      relationshipType: isBio ? 'direct' : 'inlaw',
      description: `${personB.name} adalah ${relName.toLowerCase()} dari ${personA.name}.`,
      path: [
        { member: personA, relationToNext: isBio ? 'anak kandung dari' : 'anak sambung dari' },
        { member: personB },
      ],
    };
  }

  // =========================================================================
  // 3. CEK MENANTU & MERTUA
  //    Contoh: Hanik adalah menantu perempuan dari Mbah Martiah
  // =========================================================================
  // Apakah B adalah pasangan dari anak kandung A? (B adalah MENANTU dari A)
  const childrenOfA = getResolvedChildrenOf(personA, members, memberMap);
  for (const { child, isBiological } of childrenOfA) {
    const childSpouseIds = getMemberSpouseIds(child, members);
    if (childSpouseIds.includes(personB.id)) {
      const relName = isMaleB ? 'Menantu Laki-laki' : 'Menantu Perempuan';
      const childRelation = isBiological ? 'anak kandung' : 'anak sambung';
      const spouseWord = isMaleB ? 'suami' : 'istri';

      return {
        personA,
        personB,
        relationshipName: relName,
        relationshipType: 'inlaw',
        description: `${personB.name} adalah ${relName.toLowerCase()} dari ${personA.name} (${spouseWord} dari ${childRelation} ${child.name}).`,
        path: [
          { member: personA, relationToNext: `${isMale(personA.gender) ? 'ayah' : 'ibu'} dari` },
          { member: child, relationToNext: 'menikah dengan' },
          { member: personB },
        ],
      };
    }
  }

  // Apakah A adalah pasangan dari anak kandung B? (B adalah MERTUA dari A)
  const childrenOfB = getResolvedChildrenOf(personB, members, memberMap);
  for (const { child, isBiological } of childrenOfB) {
    const childSpouseIds = getMemberSpouseIds(child, members);
    if (childSpouseIds.includes(personA.id)) {
      const relName = isMaleB ? 'Ayah Mertua' : 'Ibu Mertua';
      const childRelation = isBiological ? 'anak kandung' : 'anak sambung';
      const spouseWord = isMale(personA.gender) ? 'suami' : 'istri';

      return {
        personA,
        personB,
        relationshipName: relName,
        relationshipType: 'inlaw',
        description: `${personB.name} adalah ${relName.toLowerCase()} dari ${personA.name} (orang tua dari ${child.name}, ${spouseWord} dari ${personA.name}).`,
        path: [
          { member: personA, relationToNext: 'menikah dengan' },
          { member: child, relationToNext: `anak dari (${childRelation})` },
          { member: personB },
        ],
      };
    }
  }

  // =========================================================================
  // 4. CEK BESAN (Orang tua dari menantu)
  // =========================================================================
  for (const { child: childA } of childrenOfA) {
    const childASpouseIds = getMemberSpouseIds(childA, members);
    for (const cSpouseId of childASpouseIds) {
      const childSpouse = memberMap.get(cSpouseId);
      if (childSpouse) {
        const parentsOfSpouse = getResolvedParents(childSpouse, members, memberMap);
        if (parentsOfSpouse.some((p) => p.parent.id === personB.id)) {
          return {
            personA,
            personB,
            relationshipName: 'Besan',
            relationshipType: 'inlaw',
            description: `${personB.name} adalah besan dari ${personA.name} (orang tua dari menantu ${childSpouse.name}, pasangan ${childA.name}).`,
            path: [
              { member: personA, relationToNext: 'orang tua dari' },
              { member: childA, relationToNext: 'menikah dengan' },
              { member: childSpouse, relationToNext: 'anak dari' },
              { member: personB },
            ],
          };
        }
      }
    }
  }

  // =========================================================================
  // 5. CEK LELUHUR & KETURUNAN BIOLOGIS (Kakek/Nenek, Cucu, Buyut, Cicit, dsb.)
  //    Contoh: Khudlori adalah cucu laki-laki dari Mbah Martiah dan Mbah Nali
  // =========================================================================
  const ancestorsA = getBiologicalAncestors(personA, members, memberMap);
  const ancestorsB = getBiologicalAncestors(personB, members, memberMap);

  // Kasus B adalah Leluhur Langsung dari A (Kakek, Nenek, Buyut, Canggah, Wareng, dst.)
  if (ancestorsA.has(personB.id)) {
    const node = ancestorsA.get(personB.id)!;
    const dist = node.distance;

    let relName = '';
    if (dist === 2) {
      relName = isMaleB ? 'Kakek' : 'Nenek';
    } else if (dist === 3) {
      relName = isMaleB ? 'Buyut Laki-laki' : 'Buyut Perempuan';
    } else if (dist === 4) {
      relName = isMaleB ? 'Canggah Laki-laki' : 'Canggah Perempuan';
    } else if (dist === 5) {
      relName = 'Wareng';
    } else if (dist === 6) {
      relName = 'Udheg-udheg';
    } else if (dist === 7) {
      relName = 'Gantung Siwur';
    } else {
      relName = `Leluhur (Generasi ke-${dist})`;
    }

    const intermediateParent = node.path[1]?.member;
    const desc = intermediateParent
      ? `${personB.name} adalah ${relName.toLowerCase()} dari ${personA.name} (jalur ${intermediateParent.name}).`
      : `${personB.name} adalah ${relName.toLowerCase()} dari ${personA.name}.`;

    return {
      personA,
      personB,
      relationshipName: relName,
      relationshipType: 'ancestor',
      description: desc,
      path: node.path,
      commonAncestor: personB,
    };
  }

  // Kasus A adalah Leluhur Langsung dari B (B adalah Cucu, Cicit, Piut, dst. dari A)
  // Contoh: Mbah Martiah -> Khudlori (Khudlori adalah Cucu Laki-laki dari Mbah Martiah)
  if (ancestorsB.has(personA.id)) {
    const node = ancestorsB.get(personA.id)!;
    const dist = node.distance;

    let relName = '';
    if (dist === 2) {
      relName = isMaleB ? 'Cucu Laki-laki' : 'Cucu Perempuan';
    } else if (dist === 3) {
      relName = isMaleB ? 'Cicit Laki-laki' : 'Cicit Perempuan';
    } else if (dist === 4) {
      relName = isMaleB ? 'Piut / Canggah Laki-laki' : 'Piut / Canggah Perempuan';
    } else if (dist === 5) {
      relName = 'Keturunan Generasi Wareng';
    } else if (dist === 6) {
      relName = 'Keturunan Generasi Udheg-udheg';
    } else if (dist === 7) {
      relName = 'Keturunan Generasi Gantung Siwur';
    } else {
      relName = `Keturunan (Generasi ke-${dist})`;
    }

    // Jalur dibalik dari A menuju B untuk kejelasan alur silsilah
    const reversedPath: Array<{ member: FamilyMember; relationToNext?: string }> = [];
    for (let i = node.path.length - 1; i >= 0; i--) {
      const curr = node.path[i].member;
      if (i > 0) {
        const next = node.path[i - 1].member;
        const parentType = isMale(curr.gender) ? 'ayah dari' : 'ibu dari';
        reversedPath.push({ member: curr, relationToNext: parentType });
      } else {
        reversedPath.push({ member: curr });
      }
    }

    const intermediateParent = node.path[1]?.member;
    const desc = intermediateParent
      ? `${personB.name} adalah ${relName.toLowerCase()} dari ${personA.name} (anak dari ${intermediateParent.name}).`
      : `${personB.name} adalah ${relName.toLowerCase()} dari ${personA.name}.`;

    return {
      personA,
      personB,
      relationshipName: relName,
      relationshipType: 'descendant',
      description: desc,
      path: reversedPath,
      commonAncestor: personA,
    };
  }

  // =========================================================================
  // 6. CEK LOWEST COMMON ANCESTOR (LCA) UNTUK SAUDARA, PAMAN/BIBI, KEPONAKAN, SEPUPU
  // =========================================================================
  let lcaId: string | null = null;
  let minSumDist = Infinity;

  ancestorsA.forEach((dataA, ancestorId) => {
    if (ancestorId !== personA.id && ancestorId !== personB.id && ancestorsB.has(ancestorId)) {
      const dataB = ancestorsB.get(ancestorId)!;
      const sumDist = dataA.distance + dataB.distance;
      if (sumDist < minSumDist) {
        minSumDist = sumDist;
        lcaId = ancestorId;
      }
    }
  });

  if (lcaId) {
    const lcaMember = memberMap.get(lcaId)!;
    const distA = ancestorsA.get(lcaId)!.distance;
    const distB = ancestorsB.get(lcaId)!.distance;

    // Rekonstruksi rantai silsilah melalui LCA
    const pathA = ancestorsA.get(lcaId)!.path; // A -> ... -> LCA
    const pathB = ancestorsB.get(lcaId)!.path; // B -> ... -> LCA

    const fullLcaPath: Array<{ member: FamilyMember; relationToNext?: string }> = [];
    for (let i = 0; i < pathA.length - 1; i++) {
      fullLcaPath.push({
        member: pathA[i].member,
        relationToNext: pathA[i].relationToNext || 'keturunan dari',
      });
    }
    // Dari LCA menurun ke B
    for (let i = pathB.length - 1; i >= 0; i--) {
      const curr = pathB[i].member;
      if (i > 0) {
        const next = pathB[i - 1].member;
        fullLcaPath.push({
          member: curr,
          relationToNext: isMale(curr.gender) ? 'ayah dari' : 'ibu dari',
        });
      } else {
        fullLcaPath.push({ member: curr });
      }
    }

    // --- 6.1. SAUDARA (distA = 1, distB = 1) ---
    if (distA === 1 && distB === 1) {
      const isOlder = (personB.birthDate || '9999') < (personA.birthDate || '9999');
      const bioParentsA = parentsOfA.filter((p) => p.isBiological).map((p) => p.parent.id);
      const bioParentsB = parentsOfB.filter((p) => p.isBiological).map((p) => p.parent.id);
      const sharedParents = bioParentsA.filter((id) => bioParentsB.includes(id));

      const isFullSibling = sharedParents.length >= 2;
      const siblingType = isFullSibling ? 'Kandung' : 'Seayah / Seibu';

      const label = isOlder
        ? isMaleB ? `Kakak Laki-laki (${siblingType})` : `Kakak Perempuan (${siblingType})`
        : isMaleB ? `Adik Laki-laki (${siblingType})` : `Adik Perempuan (${siblingType})`;

      return {
        personA,
        personB,
        relationshipName: label,
        relationshipType: 'sibling',
        description: `${personB.name} adalah saudara ${label.toLowerCase()} dari ${personA.name} melalui orang tua yang sama (${lcaMember.name}).`,
        path: fullLcaPath,
        commonAncestor: lcaMember,
      };
    }

    // --- 6.2. PAMAN / BIBI (distA = 2, distB = 1) ---
    // Orang tua A adalah saudara dari B
    if (distA === 2 && distB === 1) {
      const label = isMaleB ? 'Paman (Om / Pakde / Paklek)' : 'Bibi (Tante / Bude / Buklek)';
      const parentOfA = pathA[1]?.member;
      const descDetail = parentOfA
        ? `saudara dari ${isMale(parentOfA.gender) ? 'ayah' : 'ibu'} (${parentOfA.name})`
        : `saudara dari orang tua ${personA.name}`;

      return {
        personA,
        personB,
        relationshipName: label,
        relationshipType: 'direct',
        description: `${personB.name} adalah ${label} dari ${personA.name} (${descDetail}).`,
        path: fullLcaPath,
        commonAncestor: lcaMember,
      };
    }

    // --- 6.3. KEPONAKAN (distA = 1, distB = 2) ---
    // B adalah anak dari saudara A
    if (distA === 1 && distB === 2) {
      const label = isMaleB ? 'Keponakan Laki-laki' : 'Keponakan Perempuan';
      const parentOfB = pathB[1]?.member;
      const descDetail = parentOfB
        ? `anak dari saudara (${parentOfB.name})`
        : `anak dari saudara ${personA.name}`;

      return {
        personA,
        personB,
        relationshipName: label,
        relationshipType: 'direct',
        description: `${personB.name} adalah ${label.toLowerCase()} dari ${personA.name} (${descDetail}).`,
        path: fullLcaPath,
        commonAncestor: lcaMember,
      };
    }

    // --- 6.4. SEPUPU SATU KALI / MISANAN (distA = 2, distB = 2) ---
    // Berbagi Kakek / Nenek yang sama
    if (distA === 2 && distB === 2) {
      return {
        personA,
        personB,
        relationshipName: 'Sepupu Satu Kali (Misanan)',
        relationshipType: 'cousin',
        description: `${personB.name} adalah sepupu satu kali (misanan) dari ${personA.name}, berbagi kakek/nenek yang sama (${lcaMember.name}).`,
        path: fullLcaPath,
        commonAncestor: lcaMember,
      };
    }

    // --- 6.5. SEPUPU DUA KALI / MINDON (distA = 3, distB = 3) ---
    // Berbagi Buyut yang sama
    if (distA === 3 && distB === 3) {
      return {
        personA,
        personB,
        relationshipName: 'Sepupu Dua Kali (Mindon)',
        relationshipType: 'cousin',
        description: `${personB.name} adalah sepupu dua kali (mindon) dari ${personA.name}, berbagi buyut yang sama (${lcaMember.name}).`,
        path: fullLcaPath,
        commonAncestor: lcaMember,
      };
    }

    // --- 6.6. SEPUPU TIGA KALI (distA = 4, distB = 4) ---
    if (distA === 4 && distB === 4) {
      return {
        personA,
        personB,
        relationshipName: 'Sepupu Tiga Kali',
        relationshipType: 'cousin',
        description: `${personB.name} adalah sepupu tiga kali dari ${personA.name}, berbagi canggah yang sama (${lcaMember.name}).`,
        path: fullLcaPath,
        commonAncestor: lcaMember,
      };
    }

    // --- 6.7. PAMAN / BIBI TINGKAT DUA (distA = 3, distB = 2) ---
    // B adalah sepupu dari orang tua A (Paman/Bibi Misanan)
    if (distA === 3 && distB === 2) {
      const label = isMaleB ? 'Paman Misanan (Pakde/Paklek Sepupu)' : 'Bibi Misanan (Bude/Buklek Sepupu)';
      return {
        personA,
        personB,
        relationshipName: label,
        relationshipType: 'cousin',
        description: `${personB.name} adalah ${label.toLowerCase()} dari ${personA.name} (sepupu dari orang tua ${personA.name}).`,
        path: fullLcaPath,
        commonAncestor: lcaMember,
      };
    }

    // --- 6.8. KEPONAKAN TINGKAT DUA (distA = 2, distB = 3) ---
    // B adalah anak dari sepupu A (Keponakan Misanan)
    if (distA === 2 && distB === 3) {
      const label = isMaleB ? 'Keponakan Misanan Laki-laki' : 'Keponakan Misanan Perempuan';
      return {
        personA,
        personB,
        relationshipName: label,
        relationshipType: 'cousin',
        description: `${personB.name} adalah ${label.toLowerCase()} dari ${personA.name} (anak dari sepupu ${personA.name}).`,
        path: fullLcaPath,
        commonAncestor: lcaMember,
      };
    }
  }

  // =========================================================================
  // 7. CEK HUBUNGAN IPAR (SAUDARA IPAR)
  // =========================================================================
  // A. B adalah saudara kandung dari pasangan A
  for (const sId of spouseIdsA) {
    const spouseA = memberMap.get(sId);
    if (spouseA) {
      const parentsOfSpouse = getResolvedParents(spouseA, members, memberMap).filter((p) => p.isBiological);
      for (const p of parentsOfSpouse) {
        const siblingsOfSpouse = getResolvedChildrenOf(p.parent, members, memberMap).filter((c) => c.isBiological);
        if (siblingsOfSpouse.some((c) => c.child.id === personB.id && c.child.id !== spouseA.id)) {
          const relName = isMaleB ? 'Saudara Ipar Laki-laki' : 'Saudara Ipar Perempuan';
          return {
            personA,
            personB,
            relationshipName: relName,
            relationshipType: 'inlaw',
            description: `${personB.name} adalah ${relName.toLowerCase()} dari ${personA.name} (saudara dari pasangan ${spouseA.name}).`,
            path: [
              { member: personA, relationToNext: 'menikah dengan' },
              { member: spouseA, relationToNext: 'saudara kandung dari' },
              { member: personB },
            ],
          };
        }
      }
    }
  }

  // B. B adalah pasangan dari saudara kandung A
  for (const p of parentsOfA.filter((p) => p.isBiological)) {
    const siblingsOfA = getResolvedChildrenOf(p.parent, members, memberMap).filter((c) => c.isBiological);
    for (const { child: sibling } of siblingsOfA) {
      if (sibling.id === personA.id) continue;
      const siblingSpouseIds = getMemberSpouseIds(sibling, members);
      if (siblingSpouseIds.includes(personB.id)) {
        const relName = isMaleB ? 'Saudara Ipar Laki-laki' : 'Saudara Ipar Perempuan';
        return {
          personA,
          personB,
          relationshipName: relName,
          relationshipType: 'inlaw',
          description: `${personB.name} adalah ${relName.toLowerCase()} dari ${personA.name} (pasangan dari saudara ${sibling.name}).`,
          path: [
            { member: personA, relationToNext: 'saudara kandung dari' },
            { member: sibling, relationToNext: 'menikah dengan' },
            { member: personB },
          ],
        };
      }
    }
  }

  // =========================================================================
  // 8. CEK PAMAN / BIBI IPAR ATAU KEPONAKAN IPAR
  // =========================================================================
  // Pasangan dari Paman/Bibi Kandung (Paman/Bibi Ipar)
  if (lcaId) {
    const distA = ancestorsA.get(lcaId)?.distance;
    const distB = ancestorsB.get(lcaId)?.distance;
    // Jika tidak langsung, cek via pasangan
  }
  for (const p of parentsOfA.filter((p) => p.isBiological)) {
    const parentsOfParent = getResolvedParents(p.parent, members, memberMap).filter((gp) => gp.isBiological);
    for (const gp of parentsOfParent) {
      const siblingsOfParent = getResolvedChildrenOf(gp.parent, members, memberMap).filter((c) => c.isBiological);
      for (const { child: siblingParent } of siblingsOfParent) {
        if (siblingParent.id === p.parent.id) continue;
        const spIds = getMemberSpouseIds(siblingParent, members);
        if (spIds.includes(personB.id)) {
          const label = isMaleB ? 'Paman Ipar' : 'Bibi Ipar';
          return {
            personA,
            personB,
            relationshipName: label,
            relationshipType: 'inlaw',
            description: `${personB.name} adalah ${label.toLowerCase()} dari ${personA.name} (pasangan dari ${siblingParent.name}, saudara orang tua).`,
            path: [
              { member: personA, relationToNext: 'anak dari' },
              { member: p.parent, relationToNext: 'saudara dari' },
              { member: siblingParent, relationToNext: 'menikah dengan' },
              { member: personB },
            ],
          };
        }
      }
    }
  }

  // =========================================================================
  // 9. CEK CUCU MENANTU (Pasangan dari Cucu)
  // =========================================================================
  for (const { child } of childrenOfA) {
    const grandChildren = getResolvedChildrenOf(child, members, memberMap);
    for (const { child: grandChild } of grandChildren) {
      const gcSpouseIds = getMemberSpouseIds(grandChild, members);
      if (gcSpouseIds.includes(personB.id)) {
        return {
          personA,
          personB,
          relationshipName: isMaleB ? 'Cucu Menantu Laki-laki' : 'Cucu Menantu Perempuan',
          relationshipType: 'inlaw',
          description: `${personB.name} adalah cucu menantu dari ${personA.name} (pasangan dari cucu ${grandChild.name}).`,
          path: [
            { member: personA, relationToNext: 'kakek/nenek dari' },
            { member: grandChild, relationToNext: 'menikah dengan' },
            { member: personB },
          ],
        };
      }
    }
  }

  // =========================================================================
  // 10. FALLBACK: KERABAT KELUARGA BESAR
  // =========================================================================
  return {
    personA,
    personB,
    relationshipName: 'Kerabat Keluarga Besar',
    relationshipType: 'distant',
    description: `${personA.name} dan ${personB.name} terhubung dalam ikatan silaturahmi trah keluarga besar Bani Nali.`,
    path: [{ member: personA }, { member: personB }],
  };
}
