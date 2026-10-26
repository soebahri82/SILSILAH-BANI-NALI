import { Gender } from '../types';

export function isMale(gender?: Gender | string | null): boolean {
  if (!gender) return false;
  const g = gender.trim();
  return g === 'L' || g.toLowerCase() === 'laki-laki' || g.toLowerCase() === 'pria';
}

export function isFemale(gender?: Gender | string | null): boolean {
  if (!gender) return false;
  const g = gender.trim();
  return g === 'P' || g.toLowerCase() === 'perempuan' || g.toLowerCase() === 'wanita';
}

export function getGenderCode(gender?: Gender | string | null): 'L' | 'P' {
  return isFemale(gender) ? 'P' : 'L';
}

export function getGenderLabel(gender?: Gender | string | null): 'Laki-laki' | 'Perempuan' {
  return isFemale(gender) ? 'Perempuan' : 'Laki-laki';
}

export function getGenderDisplay(gender?: Gender | string | null): string {
  if (isFemale(gender)) {
    return 'P (Perempuan)';
  }
  return 'L (Laki-laki)';
}
