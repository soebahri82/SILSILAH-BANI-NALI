import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import {
  X,
  Printer,
  Download,
  FileText,
  Image as ImageIcon,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Calendar,
  Heart,
  GitBranch,
  Layers,
  Loader2,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FamilyMember } from '../../types';
import {
  getMemberSpouses,
  sortMembersByBirthDate,
  getChildParentSpouseInfo
} from '../../utils/familyTreeUtils';
import { isMale, isFemale, getGenderCode } from '../../utils/genderUtils';

interface PrintExportFamilyTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: FamilyMember[];
}

type PaperSize = 'a4' | 'a3' | 'a2' | 'fit';
type VintageTheme = 'gold-vintage' | 'royal-heritage' | 'antique-parchment';
type Resolution = '1x' | '2x' | '3x';
type LinkStyle = 'curved' | 'orthogonal';

interface D3PosterNodeData {
  id: string;
  member: FamilyMember;
  spouses: FamilyMember[];
  children?: D3PosterNodeData[];
  level: number;
  isVirtualRoot?: boolean;
}

export const PrintExportFamilyTreeModal: React.FC<PrintExportFamilyTreeModalProps> = ({
  isOpen,
  onClose,
  members,
}) => {
  // Export Settings
  const [paperSize, setPaperSize] = useState<PaperSize>('a3');
  const [vintageTheme, setVintageTheme] = useState<VintageTheme>('gold-vintage');
  const [resolution, setResolution] = useState<Resolution>('2x');
  const [linkStyle, setLinkStyle] = useState<LinkStyle>('curved');
  const [includePhotos, setIncludePhotos] = useState<boolean>(true);
  const [includeDates, setIncludeDates] = useState<boolean>(true);
  const [includeSpouses, setIncludeSpouses] = useState<boolean>(true);
  const [includeOfficialSeal, setIncludeOfficialSeal] = useState<boolean>(true);
  const [includeLegend, setIncludeLegend] = useState<boolean>(true);

  // Status & UI
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgressText, setExportProgressText] = useState<string>('');
  const [previewZoom, setPreviewZoom] = useState<number>(0.65);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Cache for preloaded base64 photos to prevent canvas tainting
  const [photoDataUrls, setPhotoDataUrls] = useState<Record<string, string>>({});

  const printContentRef = useRef<HTMLDivElement>(null);

  // Map for fast lookup
  const memberMap = useMemo(() => {
    const map = new Map<string, FamilyMember>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  // Preload and convert all member photos to base64 Data URLs so html2canvas NEVER taints the canvas
  useEffect(() => {
    if (!isOpen || members.length === 0) return;

    let isCancelled = false;

    const convertUrlToBase64 = async (url: string): Promise<string | null> => {
      if (!url) return null;
      if (url.startsWith('data:image/')) return url;

      // Method 1: Fetch with blob
      try {
        const response = await fetch(url, { mode: 'cors' });
        if (response.ok) {
          const blob = await response.blob();
          return new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === 'string') resolve(reader.result);
              else resolve(null);
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        }
      } catch {
        // Fallback to Image element
      }

      // Method 2: Image object with crossOrigin
      try {
        return await new Promise<string | null>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          const sep = url.includes('?') ? '&' : '?';
          img.src = `${url}${sep}_cb=${Date.now()}`;
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || 100;
              canvas.height = img.naturalHeight || 100;
              const ctx = canvas.getContext('2d');
              if (!ctx) return resolve(null);
              ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/jpeg', 0.9));
            } catch {
              resolve(null);
            }
          };
          img.onerror = () => resolve(null);
        });
      } catch {
        return null;
      }
    };

    const loadAllPhotos = async () => {
      const results: Record<string, string> = {};
      const membersWithPhotos = members.filter((m) => !!m.photoURL);

      await Promise.all(
        membersWithPhotos.map(async (m) => {
          if (!m.photoURL) return;
          const dataUrl = await convertUrlToBase64(m.photoURL);
          if (dataUrl && !isCancelled) {
            results[m.id] = dataUrl;
          }
        })
      );

      if (!isCancelled) {
        setPhotoDataUrls((prev) => ({ ...prev, ...results }));
      }
    };

    loadAllPhotos();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, members]);

  // Adjust preview zoom automatically when modal opens
  useEffect(() => {
    if (isOpen) {
      if (window.innerWidth < 768) {
        setPreviewZoom(0.35);
      } else if (window.innerWidth < 1200) {
        setPreviewZoom(0.5);
      } else {
        setPreviewZoom(0.65);
      }
    }
  }, [isOpen]);

  // Build recursive tree hierarchy data strictly sorted by birthdate (identical to D3FamilyTreeViewer)
  const rawHierarchy = useMemo<D3PosterNodeData>(() => {
    const processedSpouseSet = new Set<string>();
    const visitedSet = new Set<string>();

    const buildNode = (member: FamilyMember, level: number): D3PosterNodeData => {
      visitedSet.add(member.id);
      const spouses = includeSpouses ? getMemberSpouses(member, members) : [];
      spouses.forEach((s) => processedSpouseSet.add(s.id));

      const parentIdSet = new Set<string>([member.id, ...spouses.map((s) => s.id)]);

      // Find children
      const rawChildren: FamilyMember[] = [];
      members.forEach((candidate) => {
        if (!candidate.parentID) return;
        const pIds = candidate.parentID.split(/[,;]+/).map((p) => p.trim());
        const isChild = pIds.some((id) => parentIdSet.has(id));
        if (isChild && !visitedSet.has(candidate.id)) {
          rawChildren.push(candidate);
        }
      });

      // Sort children chronologically by birthdate (oldest to youngest)
      const sortedChildren = sortMembersByBirthDate(rawChildren, true);

      const childrenNodes: D3PosterNodeData[] = sortedChildren.map((child) =>
        buildNode(child, level + 1)
      );

      return {
        id: member.id,
        member,
        spouses,
        children: childrenNodes.length > 0 ? childrenNodes : undefined,
        level,
      };
    };

    // Filter spouses of descendants so they are not treated as roots
    const spouseOfDescendantSet = new Set<string>();
    members.forEach((m) => {
      const hasParentInTree = !!(m.parentID && memberMap.has(m.parentID));
      if (hasParentInTree) {
        const spouses = getMemberSpouses(m, members);
        spouses.forEach((s) => spouseOfDescendantSet.add(s.id));
      }
    });

    // Root candidates: members who have no parent in dataset and are not spouses of descendants
    const potentialRoots = members.filter((m) => {
      const hasParentInTree = !!(m.parentID && memberMap.has(m.parentID));
      if (hasParentInTree) return false;
      if (spouseOfDescendantSet.has(m.id)) return false;
      return true;
    });

    // Pick primary root couples
    const pairedSpouseSet = new Set<string>();
    const sortedCandidates = [...potentialRoots].sort((a, b) => {
      const aChildCount = members.filter((m) => m.parentID?.includes(a.id)).length;
      const bChildCount = members.filter((m) => m.parentID?.includes(b.id)).length;
      if (aChildCount !== bChildCount) return bChildCount - aChildCount;
      if (a.lineageStatus === 'trah' && b.lineageStatus !== 'trah') return -1;
      if (b.lineageStatus === 'trah' && a.lineageStatus !== 'trah') return 1;
      if (a.gender === 'L' && b.gender !== 'L') return -1;
      if (b.gender === 'L' && a.gender !== 'L') return 1;
      return (a.birthDate || '').localeCompare(b.birthDate || '');
    });

    const finalRoots: FamilyMember[] = [];
    sortedCandidates.forEach((cand) => {
      if (pairedSpouseSet.has(cand.id)) return;
      finalRoots.push(cand);
      const spouses = getMemberSpouses(cand, members);
      spouses.forEach((s) => pairedSpouseSet.add(s.id));
    });

    const rootsToBuild =
      finalRoots.length > 0
        ? finalRoots
        : potentialRoots.length > 0
        ? potentialRoots
        : members.slice(0, 1);

    const rootNodes = rootsToBuild.map((r) => buildNode(r, 1));

    return {
      id: '__virtual_root__',
      member: {
        id: '__virtual__',
        name: 'Root',
        gender: 'L',
        privacy: 'family',
      },
      spouses: [],
      children: rootNodes,
      level: 0,
      isVirtualRoot: true,
    };
  }, [members, memberMap, includeSpouses]);

  // Compute node card dimensions
  const getNodeDimensions = useCallback((data: D3PosterNodeData) => {
    if (data.isVirtualRoot) return { width: 0, height: 0 };
    const numSpouses = data.spouses.length;
    if (numSpouses >= 2) {
      // 2 Spouses: Left (200px) + bridge (35px) + Center (200px) + bridge (35px) + Right (200px)
      return { width: 670, height: 135 };
    } else if (numSpouses === 1) {
      // 1 Spouse: Primary (200px) + bridge (35px) + Spouse (200px)
      return { width: 435, height: 125 };
    }
    // Single member
    return { width: 200, height: 110 };
  }, []);

  // Compute D3 Tree Layout for Poster
  const d3TreeLayout = useMemo(() => {
    if (!rawHierarchy.children || rawHierarchy.children.length === 0) {
      return null;
    }

    const hierarchyRoot = d3.hierarchy<D3PosterNodeData>(rawHierarchy);

    // Tree layout with generous spacing between branches
    const treeLayout = d3
      .tree<D3PosterNodeData>()
      .nodeSize([310, 240])
      .separation((a, b) => {
        const dimA = getNodeDimensions(a.data);
        const dimB = getNodeDimensions(b.data);
        const neededSpan = (dimA.width + dimB.width) / 2 + 50;
        const factor = Math.max(1, neededSpan / 310);
        return a.parent === b.parent ? factor : factor + 0.35;
      });

    const root = treeLayout(hierarchyRoot);

    // Collect raw nodes (exclude virtual root)
    const rawNodes: Array<{
      id: string;
      x: number;
      y: number;
      data: D3PosterNodeData;
      width: number;
      height: number;
      childOrder?: number;
      motherName?: string;
    }> = [];

    root.descendants().forEach((d) => {
      if (d.data.isVirtualRoot) return;
      const dim = getNodeDimensions(d.data);

      // Determine child order and mother name
      let childOrder: number | undefined;
      let motherName: string | undefined;

      if (d.parent && !d.parent.data.isVirtualRoot && d.parent.children) {
        childOrder = d.parent.children.indexOf(d) + 1;
        const childInfo = getChildParentSpouseInfo(
          d.data.member,
          d.parent.data.member,
          d.parent.data.spouses
        );
        motherName = childInfo.spouseLabel;
      }

      rawNodes.push({
        id: d.data.id,
        x: d.x ?? 0,
        y: d.y ?? 0,
        data: d.data,
        width: dim.width,
        height: dim.height,
        childOrder,
        motherName,
      });
    });

    if (rawNodes.length === 0) return null;

    // Find bounding box
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    rawNodes.forEach((n) => {
      minX = Math.min(minX, n.x - n.width / 2);
      maxX = Math.max(maxX, n.x + n.width / 2);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y + n.height);
    });

    const paddingX = 60;
    const paddingY = 40;
    const offsetX = -minX + paddingX;
    const offsetY = -minY + paddingY;

    const totalWidth = Math.max(1150, maxX - minX + paddingX * 2);
    const totalHeight = maxY - minY + paddingY * 2;

    // Normalized positioned nodes
    const positionedNodes = rawNodes.map((n) => ({
      ...n,
      normX: n.x + offsetX,
      normY: n.y + offsetY,
      left: n.x + offsetX - n.width / 2,
      top: n.y + offsetY,
    }));

    // Normalized links
    const positionedLinks: Array<{
      id: string;
      sx: number;
      sy: number;
      tx: number;
      ty: number;
      pathD: string;
    }> = [];

    root.links().forEach((link) => {
      if (link.source.data.isVirtualRoot) return;
      const sDim = getNodeDimensions(link.source.data);

      const sx = (link.source.x ?? 0) + offsetX;
      const sy = (link.source.y ?? 0) + offsetY + sDim.height;
      const tx = (link.target.x ?? 0) + offsetX;
      const ty = (link.target.y ?? 0) + offsetY;

      let pathD = '';
      if (linkStyle === 'curved') {
        const my = (sy + ty) / 2;
        pathD = `M ${sx} ${sy} C ${sx} ${my}, ${tx} ${my}, ${tx} ${ty}`;
      } else {
        const my = sy + (ty - sy) / 2;
        pathD = `M ${sx} ${sy} L ${sx} ${my} L ${tx} ${my} L ${tx} ${ty}`;
      }

      positionedLinks.push({
        id: `${link.source.data.id}->${link.target.data.id}`,
        sx,
        sy,
        tx,
        ty,
        pathD,
      });
    });

    return {
      nodes: positionedNodes,
      links: positionedLinks,
      totalWidth,
      totalHeight,
    };
  }, [rawHierarchy, getNodeDimensions, linkStyle]);

  // Format years text
  const getYearsDisplay = (member: FamilyMember) => {
    const bYear = member.birthDate ? member.birthDate.split('-')[0] : '';
    const dYear = member.deathDate ? member.deathDate.split('-')[0] : '';
    if (member.deathDate) {
      return `${bYear || '?'} – ${dYear} (Wafat)`;
    }
    return bYear ? `Lahir: ${bYear}` : '';
  };

  // Generate safe SVG Avatar Data URL
  const getFallbackAvatar = (name: string, gender: string) => {
    const male = isMale(gender);
    const initial = (name || '?').trim().slice(0, 2).toUpperCase();
    const bg = male ? '#064e3b' : '#881337';
    const text = male ? '#ecfdf5' : '#fff1f2';
    const stroke = male ? '#10b981' : '#f43f5e';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="48" fill="${bg}" stroke="${stroke}" stroke-width="3"/>
      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" stroke-dasharray="3 3"/>
      <text x="50" y="58" font-family="serif" font-size="30" font-weight="bold" fill="${text}" text-anchor="middle" dominant-baseline="middle">${initial}</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  // Render individual member card inside D3 Tree Layout
  const renderD3MemberCard = (
    member: FamilyMember,
    options: {
      isPrimary?: boolean;
      isSpouse?: boolean;
      spouseOrder?: number;
      level?: number;
      childOrder?: number;
      motherInfo?: string;
    } = {}
  ) => {
    const male = isMale(member.gender);
    const isDeceased = !!member.deathDate;
    const genderCode = getGenderCode(member.gender);
    const isTrah = member.lineageStatus === 'trah' || options.isPrimary;

    // Resolve photo source: preloaded Base64 -> member.photoURL -> vector SVG fallback
    const photoSrc =
      photoDataUrls[member.id] ||
      (member.photoURL && member.photoURL.startsWith('data:') ? member.photoURL : null) ||
      (member.photoURL && !member.photoURL.includes('cors_error') ? member.photoURL : null) ||
      getFallbackAvatar(member.name, member.gender);

    return (
      <div
        key={member.id}
        className="w-[200px] rounded-xl p-2.5 border text-center relative flex flex-col items-center select-none"
        style={{
          backgroundColor: isTrah ? '#FFFDF9' : '#FAF6EC',
          borderColor: isTrah ? '#B45309' : '#D6D3D1',
          boxShadow: '0 2px 4px rgba(120, 53, 15, 0.08)',
        }}
      >
        {/* Top Accent Strip */}
        <div
          className="h-1 w-20 absolute top-0 rounded-full"
          style={{
            backgroundColor: options.isSpouse ? '#D97706' : male ? '#047857' : '#BE123C',
          }}
        />

        {/* Role or Child Order Badge */}
        {options.childOrder ? (
          <div
            className="text-[8.5px] font-bold px-2 py-0.2 rounded-full mb-1 border"
            style={{
              backgroundColor: '#FEF3C7',
              color: '#451A03',
              borderColor: '#FCD34D',
            }}
          >
            Anak ke-{options.childOrder}
            {options.motherInfo && ` · Ibu: ${options.motherInfo.split(' ')[0]}`}
          </div>
        ) : options.isSpouse ? (
          <div
            className="text-[8.5px] font-semibold px-2 py-0.2 rounded-full mb-1 border"
            style={{
              backgroundColor: '#E7E5E4',
              color: '#44403C',
              borderColor: '#D6D3D1',
            }}
          >
            {isFemale(member.gender) ? 'Istri' : 'Suami'}
            {options.spouseOrder && options.spouseOrder > 1 ? ` ke-${options.spouseOrder}` : ''}
          </div>
        ) : options.level === 1 ? (
          <div
            className="text-[8.5px] font-bold px-2.5 py-0.2 rounded-full mb-1 border"
            style={{
              backgroundColor: '#FDE68A',
              color: '#451A03',
              borderColor: '#F59E0B',
            }}
          >
            Pondasi Trah Bani Nali
          </div>
        ) : null}

        {/* Photo Display */}
        <div className="mt-0.5 mb-1.5 flex justify-center">
          {includePhotos ? (
            <img
              src={photoSrc}
              alt={member.name}
              className="w-10 h-10 rounded-full object-cover border-2 shadow-2xs"
              style={{
                borderColor: '#B45309',
              }}
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-serif font-bold text-xs border"
              style={{
                backgroundColor: male ? '#ECFDF5' : '#FFFBEB',
                color: male ? '#065F46' : '#78350F',
                borderColor: '#B45309',
              }}
            >
              {member.name.charAt(0)}
            </div>
          )}
        </div>

        {/* Member Full Name */}
        <h4 className="text-[11px] font-bold font-serif leading-tight line-clamp-2 px-1" style={{ color: '#1C1917' }}>
          {member.name}
        </h4>

        {/* Gender Badge & Status */}
        <div className="flex items-center justify-center gap-1.5 mt-1 text-[8.5px]">
          <span
            className="font-semibold px-1.5 py-0.2 rounded text-[8px]"
            style={{
              backgroundColor: male ? '#D1FAE5' : '#FFE4E6',
              color: male ? '#065F46' : '#9F1239',
            }}
          >
            {genderCode === 'L' ? 'Laki-laki' : 'Perempuan'}
          </span>
          {isDeceased && (
            <span
              className="px-1 py-0.2 rounded text-[8px] font-medium"
              style={{
                backgroundColor: '#E7E5E4',
                color: '#44403C',
              }}
            >
              Alm.
            </span>
          )}
        </div>

        {/* Birth - Death Dates */}
        {includeDates && (
          <p className="text-[8px] mt-1 font-mono tracking-tight" style={{ color: '#57534E' }}>
            {getYearsDisplay(member) || member.birthPlace || 'Bani Nali'}
          </p>
        )}
      </div>
    );
  };

  // Convert any CSS color string (oklch, oklab, color-mix, hex, rgb) to safe sRGB for html2canvas
  const toSafeRgb = (colorStr: string, fallback = 'rgba(0, 0, 0, 0)'): string => {
    if (!colorStr || colorStr === 'transparent' || colorStr === 'inherit' || colorStr === 'none') {
      return 'rgba(0, 0, 0, 0)';
    }
    // Already safe standard hex or standard rgb/rgba without oklch/lab
    if (
      (/^#[0-9a-f]{3,8}$/i.test(colorStr) ||
        /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/i.test(colorStr)) &&
      !colorStr.includes('oklch') &&
      !colorStr.includes('oklab') &&
      !colorStr.includes('color(') &&
      !colorStr.includes('color-mix')
    ) {
      return colorStr;
    }

    try {
      const c = document.createElement('canvas');
      c.width = 1;
      c.height = 1;
      const ctx = c.getContext('2d');
      if (!ctx) return fallback;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000000';
      ctx.fillStyle = colorStr;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return `rgba(${r}, ${g}, ${b}, ${Number((a / 255).toFixed(3))})`;
    } catch {
      return fallback;
    }
  };

  // Helper to sanitize any CSS value string containing modern color functions (oklch, oklab, color-mix)
  const sanitizeCssValue = (val: string): string => {
    if (!val || typeof val !== 'string') return val;
    if (
      !val.includes('oklch') &&
      !val.includes('oklab') &&
      !val.includes('color(') &&
      !val.includes('color-mix')
    ) {
      return val;
    }

    // Gradients with modern color spaces crash html2canvas parser
    if (
      val.includes('gradient') &&
      (val.includes('okl') || val.includes('color-mix') || val.includes('in oklab'))
    ) {
      return 'none';
    }

    return val
      .replace(/oklch\([^)]+\)/gi, (m) => toSafeRgb(m))
      .replace(/oklab\([^)]+\)/gi, (m) => toSafeRgb(m))
      .replace(/color-mix\([^)]+\)/gi, (m) => toSafeRgb(m))
      .replace(/color\([^)]+\)/gi, (m) => toSafeRgb(m));
  };

  // Patch getComputedStyle of a window so that ALL color and style queries return valid sRGB
  const patchWinComputedStyle = (targetWin: Window) => {
    if (!targetWin || typeof targetWin.getComputedStyle !== 'function') return () => {};
    const orig = targetWin.getComputedStyle;
    try {
      targetWin.getComputedStyle = function (
        elt: Element,
        pseudoElt?: string | null
      ): CSSStyleDeclaration {
        if (!elt) {
          return {} as CSSStyleDeclaration;
        }
        try {
          const real = orig.call(targetWin, elt, pseudoElt);
          if (!real) return real;
          return new Proxy(real, {
            get(t, prop) {
              try {
                const v = (t as unknown as Record<string | symbol, unknown>)[prop];
                if (typeof v === 'function') {
                  if (prop === 'getPropertyValue') {
                    return (p: string) => sanitizeCssValue(t.getPropertyValue(p));
                  }
                  return v.bind(t);
                }
                if (typeof v === 'string') {
                  return sanitizeCssValue(v);
                }
                return v;
              } catch {
                return (t as unknown as Record<string | symbol, unknown>)[prop];
              }
            },
          }) as unknown as CSSStyleDeclaration;
        } catch {
          return orig.call(targetWin, elt, pseudoElt);
        }
      };
    } catch {
      // Ignore if window cannot be modified
    }
    return () => {
      try {
        targetWin.getComputedStyle = orig;
      } catch {
        // Ignore restoration error
      }
    };
  };

  // Generate canvas from poster element with clean DOM state and onclone color sanitization
  const generatePosterCanvas = async (scaleMultiplier: number): Promise<HTMLCanvasElement | null> => {
    if (!printContentRef.current) return null;
    const targetElement = printContentRef.current;

    setExportProgressText('Mempersiapkan struktur silsilah D3 berbingkai...');

    // Save previous transform and reset for pristine capture
    const originalTransform = targetElement.style.transform;
    const originalTransformOrigin = targetElement.style.transformOrigin;
    targetElement.style.transform = 'none';
    targetElement.style.transformOrigin = 'top left';

    // Patch main window getComputedStyle during capture to intercept any oklch color query
    const unpatchMain = patchWinComputedStyle(window);

    // Brief delay to allow browser layout reflow
    await new Promise((r) => setTimeout(r, 150));

    setExportProgressText('Merender grafis berbingkai resolusi tinggi...');
    try {
      const canvas = await html2canvas(targetElement, {
        scale: scaleMultiplier,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#FAF6EE',
        logging: false,
        imageTimeout: 15000,
        windowWidth: targetElement.scrollWidth + 80,
        windowHeight: targetElement.scrollHeight + 80,
        onclone: (clonedDoc) => {
          // 1. Patch the cloned iframe window getComputedStyle
          if (clonedDoc.defaultView) {
            patchWinComputedStyle(clonedDoc.defaultView);
          }

          // 2. Ensure poster is unscaled in cloned doc
          const poster = clonedDoc.getElementById('printable-vintage-poster');
          if (poster) {
            poster.style.transform = 'none';
          }

          // 3. Ensure body and html in cloned document have safe background
          if (clonedDoc.body) {
            clonedDoc.body.style.backgroundColor = '#FAF6EE';
            clonedDoc.body.style.color = '#1C1917';
          }
          if (clonedDoc.documentElement) {
            clonedDoc.documentElement.style.backgroundColor = '#FAF6EE';
          }
        },
      });

      // Restore original preview transform
      targetElement.style.transform = originalTransform;
      targetElement.style.transformOrigin = originalTransformOrigin;
      return canvas;
    } catch (err) {
      console.error('Failed generating canvas:', err);
      targetElement.style.transform = originalTransform;
      targetElement.style.transformOrigin = originalTransformOrigin;
      throw err;
    } finally {
      unpatchMain();
    }
  };

  // Export to PNG (Automatic save to device)
  const handleExportPNG = async () => {
    try {
      setIsExporting(true);
      setSuccessMessage('');
      setErrorMessage('');
      const scaleNum = resolution === '3x' ? 2.5 : resolution === '2x' ? 2 : 1.25;
      const canvas = await generatePosterCanvas(scaleNum);
      if (!canvas) throw new Error('Kanvas silsilah gagal dibentuk.');

      setExportProgressText('Menyimpan berkas PNG ke media perangkat...');

      const fileName = `Silsilah_Keluarga_Bani_Nali_Lamongan_${new Date().toISOString().slice(0, 10)}.png`;

      // Trigger automatic save to device using Blob
      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (!blob) {
            // Fallback via data URL
            const imageUri = canvas.toDataURL('image/png', 1.0);
            const downloadLink = document.createElement('a');
            downloadLink.href = imageUri;
            downloadLink.download = fileName;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            setSuccessMessage('Berkas gambar PNG berhasil disimpan!');
            setIsExporting(false);
            setExportProgressText('');
            return;
          }

          const blobUrl = URL.createObjectURL(blob);
          const downloadLink = document.createElement('a');
          downloadLink.href = blobUrl;
          downloadLink.download = fileName;
          document.body.appendChild(downloadLink);
          downloadLink.click();

          setTimeout(() => {
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(blobUrl);
            setSuccessMessage('Berkas gambar PNG berhasil disimpan otomatis!');
            setIsExporting(false);
            setExportProgressText('');
          }, 1000);
        }, 'image/png');
      } else {
        const imageUri = canvas.toDataURL('image/png', 1.0);
        const downloadLink = document.createElement('a');
        downloadLink.href = imageUri;
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        setSuccessMessage('Berkas gambar PNG berhasil disimpan!');
        setIsExporting(false);
        setExportProgressText('');
      }
    } catch (error) {
      console.error('Export PNG failed:', error);
      setErrorMessage('Gagal mengekspor berkas PNG. Silakan coba kembali dengan resolusi standar.');
      setIsExporting(false);
      setExportProgressText('');
    }
  };

  // Export to PDF (Automatic save to device)
  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      setSuccessMessage('');
      setErrorMessage('');
      const scaleNum = resolution === '3x' ? 2 : resolution === '2x' ? 1.75 : 1.25;
      const canvas = await generatePosterCanvas(scaleNum);
      if (!canvas) throw new Error('Kanvas silsilah gagal dibentuk.');

      setExportProgressText('Menyusun halaman PDF proporsional...');

      // PDF dimensions in mm (Landscape)
      let pdfWidth = 420; // A3 default width
      let pdfHeight = 297; // A3 default height
      let formatArg: string | [number, number] = 'a3';

      if (paperSize === 'a4') {
        pdfWidth = 297;
        pdfHeight = 210;
        formatArg = 'a4';
      } else if (paperSize === 'a2') {
        pdfWidth = 594;
        pdfHeight = 420;
        formatArg = 'a2';
      } else if (paperSize === 'fit') {
        const aspect = canvas.width / canvas.height;
        pdfHeight = 350;
        pdfWidth = pdfHeight * aspect;
        formatArg = [pdfWidth, pdfHeight];
      }

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: formatArg,
      });

      const margin = 8; // 8mm margin
      const availWidth = pdfWidth - margin * 2;
      const availHeight = pdfHeight - margin * 2;

      const imgAspect = canvas.width / canvas.height;
      const pageAspect = availWidth / availHeight;

      let drawW = availWidth;
      let drawH = availHeight;
      let posX = margin;
      let posY = margin;

      if (imgAspect > pageAspect) {
        drawW = availWidth;
        drawH = availWidth / imgAspect;
        posY = margin + (availHeight - drawH) / 2;
      } else {
        drawH = availHeight;
        drawW = availHeight * imgAspect;
        posX = margin + (availWidth - drawW) / 2;
      }

      setExportProgressText('Menyimpan dokumen PDF ke media...');
      const imgData = canvas.toDataURL('image/jpeg', 0.96);
      pdf.addImage(imgData, 'JPEG', posX, posY, drawW, drawH, undefined, 'FAST');
      pdf.save(`Silsilah_Keluarga_Bani_Nali_Lamongan_${paperSize.toUpperCase()}.pdf`);

      setSuccessMessage('Dokumen PDF berhasil disimpan!');
      setTimeout(() => {
        setIsExporting(false);
        setExportProgressText('');
      }, 1000);
    } catch (error) {
      console.error('Export PDF failed:', error);
      setErrorMessage('Gagal mengekspor PDF. Silakan coba kembali.');
      setIsExporting(false);
      setExportProgressText('');
    }
  };

  // Direct Browser Print (Isolated hidden iframe with clean styles)
  const handleDirectPrint = () => {
    if (!printContentRef.current) return;
    const printElement = printContentRef.current;

    // Create isolated hidden iframe to avoid CSS conflicts and modal scaling
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    // Collect all stylesheets from head
    const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((el) => el.outerHTML)
      .join('\n');

    const clonedContent = printElement.cloneNode(true) as HTMLElement;
    clonedContent.style.transform = 'none';
    clonedContent.style.margin = '0 auto';

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Silsilah Keluarga Bani Nali Lamongan</title>
          ${styleTags}
          <style>
            @page {
              size: landscape;
              margin: 6mm;
            }
            body {
              margin: 0;
              padding: 4mm;
              background-color: #FAF6EE !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              display: flex;
              justify-content: center;
              align-items: flex-start;
            }
          </style>
        </head>
        <body>
          ${clonedContent.outerHTML}
        </body>
      </html>
    `);
    doc.close();

    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 3000);
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-950/80 backdrop-blur-xs overflow-hidden">
      {/* Print Stylesheet injection for fallback */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden !important;
            }
            #printable-vintage-poster, #printable-vintage-poster * {
              visibility: visible !important;
            }
            #printable-vintage-poster {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 6mm !important;
              box-shadow: none !important;
              border: 4px solid #78350f !important;
              background-color: #FAF6EE !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @page {
              size: landscape;
              margin: 5mm;
            }
          }
        `}
      </style>

      {/* Main Modal Card */}
      <div className="bg-white w-full max-w-7xl h-[96vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Modal Header */}
        <div className="px-5 py-3.5 bg-stone-900 text-stone-100 flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-serif tracking-wide text-white flex items-center gap-2">
                <span>Cetak & Unduh Silsilah Keluarga (PDF & PNG)</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-sans px-2 py-0.5 rounded-full border border-amber-500/30">
                  Format Pohon Silsilah D3 Berbingkai Vintage
                </span>
              </h2>
              <p className="text-xs text-stone-400">
                Pohon silsilah hierarkis D3 berbingkai vintage dengan judul proporsional Bani Nali Lamongan.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
            title="Tutup Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Options Bar */}
        <div className="p-3 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          {/* Format Settings Controls */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Paper Size */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-stone-300 shadow-2xs">
              <span className="font-semibold text-stone-700">Kertas PDF:</span>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                className="bg-transparent font-medium text-stone-900 focus:outline-none cursor-pointer"
              >
                <option value="a3">A3 Landscape (Rekomendasi Poster)</option>
                <option value="a4">A4 Landscape (Standar Dokumen)</option>
                <option value="a2">A2 Poster Besar (Pigura Dinding)</option>
                <option value="fit">Otomatis / Proporsional Penuh</option>
              </select>
            </div>

            {/* Vintage Frame Style */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-stone-300 shadow-2xs">
              <span className="font-semibold text-stone-700">Bingkai Vintage:</span>
              <select
                value={vintageTheme}
                onChange={(e) => setVintageTheme(e.target.value as VintageTheme)}
                className="bg-transparent font-medium text-stone-900 focus:outline-none cursor-pointer"
              >
                <option value="gold-vintage">Vintage Emas Klasik Keraton</option>
                <option value="royal-heritage">Warisan Mulia (Sepia & Bronze)</option>
                <option value="antique-parchment">Perkamen Antik Tradisional</option>
              </select>
            </div>

            {/* Link Style Switcher */}
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-stone-300 shadow-2xs">
              <span className="font-semibold text-stone-700">Garis:</span>
              <button
                onClick={() => setLinkStyle('curved')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  linkStyle === 'curved'
                    ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Garis Lengkung D3 (Bezier)"
              >
                <GitBranch className="w-3 h-3" />
                <span>Lengkung</span>
              </button>
              <button
                onClick={() => setLinkStyle('orthogonal')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  linkStyle === 'orthogonal'
                    ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="Garis Sudut Siku (Orthogonal)"
              >
                <Layers className="w-3 h-3" />
                <span>Siku</span>
              </button>
            </div>

            {/* Resolution */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-stone-300 shadow-2xs">
              <span className="font-semibold text-stone-700">Resolusi:</span>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as Resolution)}
                className="bg-transparent font-medium text-stone-900 focus:outline-none cursor-pointer"
              >
                <option value="2x">Tinggi (2x HD)</option>
                <option value="3x">Ultra HD (3x Tajam Maksimal)</option>
                <option value="1x">Standar (1x Cepat)</option>
              </select>
            </div>

            {/* Toggles */}
            <label className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-stone-300 shadow-2xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includePhotos}
                onChange={(e) => setIncludePhotos(e.target.checked)}
                className="rounded text-amber-700 focus:ring-amber-600"
              />
              <span className="text-stone-700 font-medium">Foto Anggota</span>
            </label>

            <label className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-stone-300 shadow-2xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeDates}
                onChange={(e) => setIncludeDates(e.target.checked)}
                className="rounded text-amber-700 focus:ring-amber-600"
              />
              <span className="text-stone-700 font-medium">Tahun Lahir/Wafat</span>
            </label>

            <label className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-stone-300 shadow-2xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeSpouses}
                onChange={(e) => setIncludeSpouses(e.target.checked)}
                className="rounded text-amber-700 focus:ring-amber-600"
              />
              <span className="text-stone-700 font-medium">Pasangan & Mantu</span>
            </label>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Direct Print Button */}
            <button
              onClick={handleDirectPrint}
              disabled={isExporting}
              className="px-3 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Cetak langsung menggunakan dialog printer browser"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Langsung</span>
            </button>

            {/* Download PNG Button */}
            <button
              onClick={handleExportPNG}
              disabled={isExporting}
              className="px-3.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ImageIcon className="w-4 h-4" />
              )}
              <span>Unduh PNG</span>
            </button>

            {/* Download PDF Button */}
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="px-4 py-1.5 rounded-lg bg-emerald-900 hover:bg-emerald-950 text-white font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span>Unduh PDF</span>
            </button>
          </div>
        </div>

        {/* Status / Success / Progress Notice */}
        {isExporting && (
          <div className="bg-amber-50/95 border-b border-amber-200 px-4 py-2 flex items-center justify-center gap-2.5 text-xs text-amber-900 font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
            <span>{exportProgressText || 'Sedang memproses poster silsilah keluarga...'}</span>
          </div>
        )}
        {successMessage && !isExporting && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center justify-center gap-2 text-xs text-emerald-900 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && !isExporting && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-center gap-2 text-xs text-rose-900 font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-700" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Main Preview Work Area */}
        <div className="flex-1 bg-stone-200/90 overflow-auto p-4 sm:p-8 flex flex-col items-center relative">
          {/* Zoom controls for interactive preview */}
          <div className="sticky top-2 right-2 self-end z-30 bg-white/95 backdrop-blur-xs p-1.5 rounded-xl shadow-md border border-stone-300 flex items-center gap-1 text-xs">
            <button
              onClick={() => setPreviewZoom((z) => Math.max(0.2, z - 0.1))}
              className="p-1 rounded hover:bg-stone-100 text-stone-700 cursor-pointer"
              title="Perkecil Preview"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="font-semibold text-stone-700 px-1 w-12 text-center">
              {Math.round(previewZoom * 100)}%
            </span>
            <button
              onClick={() => setPreviewZoom((z) => Math.min(1.5, z + 0.1))}
              className="p-1 rounded hover:bg-stone-100 text-stone-700 cursor-pointer"
              title="Perbesar Preview"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPreviewZoom(0.65)}
              className="p-1 rounded hover:bg-stone-100 text-stone-700 ml-1 cursor-pointer"
              title="Reset Zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* THE VINTAGE POSTER (Target of HTML2Canvas, PDF and Print) */}
          <div
            id="printable-vintage-poster"
            ref={printContentRef}
            style={{
              transform: `scale(${previewZoom})`,
              transformOrigin: 'top center',
              transition: isExporting ? 'none' : 'transform 0.15s ease-out',
            }}
            className="bg-[#FAF6EE] text-stone-900 shadow-2xl relative transition-all my-2 select-none"
          >
            {/* VINTAGE OUTER FRAME (BINGKAI VINTAGE) */}
            <div
              className={`p-6 sm:p-10 relative ${
                vintageTheme === 'gold-vintage'
                  ? 'border-[10px] border-[#78350F]'
                  : vintageTheme === 'royal-heritage'
                  ? 'border-[12px] border-[#451A03]'
                  : 'border-[8px] border-[#854D0E]'
              }`}
              style={{
                boxShadow: 'inset 0 0 25px rgba(120, 53, 15, 0.15)',
                minWidth: d3TreeLayout ? `${Math.max(1150, d3TreeLayout.totalWidth + 120)}px` : '1150px',
              }}
            >
              {/* Inner Decorative Double Gold Border */}
              <div className="border-2 border-[#B45309] p-3 sm:p-5 relative">
                <div className="border border-[#D97706]/60 p-6 sm:p-8 relative bg-[#FAF6EE]">
                  {/* VINTAGE CORNER ORNAMENTS (4 SUDUT UKIRAN VINTAGE) */}
                  {/* Top Left Corner */}
                  <div className="absolute -top-3.5 -left-3.5 w-12 h-12 text-[#92400E] pointer-events-none select-none">
                    <svg viewBox="0 0 100 100" fill="currentColor" className="w-full h-full opacity-90">
                      <path d="M0,0 L40,0 C30,10 20,25 20,40 C10,30 5,15 0,0 Z M0,0 L0,40 C10,30 25,20 40,20 C30,10 15,5 0,0 Z" />
                      <circle cx="28" cy="28" r="8" fill="none" stroke="currentColor" strokeWidth="3" />
                      <circle cx="28" cy="28" r="3" />
                      <path d="M0,50 C25,45 45,25 50,0 C35,20 20,35 0,50 Z" />
                    </svg>
                  </div>

                  {/* Top Right Corner */}
                  <div className="absolute -top-3.5 -right-3.5 w-12 h-12 text-[#92400E] pointer-events-none select-none rotate-90">
                    <svg viewBox="0 0 100 100" fill="currentColor" className="w-full h-full opacity-90">
                      <path d="M0,0 L40,0 C30,10 20,25 20,40 C10,30 5,15 0,0 Z M0,0 L0,40 C10,30 25,20 40,20 C30,10 15,5 0,0 Z" />
                      <circle cx="28" cy="28" r="8" fill="none" stroke="currentColor" strokeWidth="3" />
                      <circle cx="28" cy="28" r="3" />
                      <path d="M0,50 C25,45 45,25 50,0 C35,20 20,35 0,50 Z" />
                    </svg>
                  </div>

                  {/* Bottom Left Corner */}
                  <div className="absolute -bottom-3.5 -left-3.5 w-12 h-12 text-[#92400E] pointer-events-none select-none -rotate-90">
                    <svg viewBox="0 0 100 100" fill="currentColor" className="w-full h-full opacity-90">
                      <path d="M0,0 L40,0 C30,10 20,25 20,40 C10,30 5,15 0,0 Z M0,0 L0,40 C10,30 25,20 40,20 C30,10 15,5 0,0 Z" />
                      <circle cx="28" cy="28" r="8" fill="none" stroke="currentColor" strokeWidth="3" />
                      <circle cx="28" cy="28" r="3" />
                      <path d="M0,50 C25,45 45,25 50,0 C35,20 20,35 0,50 Z" />
                    </svg>
                  </div>

                  {/* Bottom Right Corner */}
                  <div className="absolute -bottom-3.5 -right-3.5 w-12 h-12 text-[#92400E] pointer-events-none select-none rotate-180">
                    <svg viewBox="0 0 100 100" fill="currentColor" className="w-full h-full opacity-90">
                      <path d="M0,0 L40,0 C30,10 20,25 20,40 C10,30 5,15 0,0 Z M0,0 L0,40 C10,30 25,20 40,20 C30,10 15,5 0,0 Z" />
                      <circle cx="28" cy="28" r="8" fill="none" stroke="currentColor" strokeWidth="3" />
                      <circle cx="28" cy="28" r="3" />
                      <path d="M0,50 C25,45 45,25 50,0 C35,20 20,35 0,50 Z" />
                    </svg>
                  </div>

                  {/* HEADER DI DALAM BINGKAI: JUDUL YANG PROPORSIONAL */}
                  <div className="flex flex-col items-center justify-center text-center pb-8 border-b-2 border-amber-900/30 mb-8 relative">
                    {/* Top Decorative Filigree Crest / Fleur-de-lis */}
                    <div className="flex items-center gap-3 mb-2" style={{ color: '#92400E' }}>
                      <div className="w-16 h-0.5" style={{ backgroundColor: '#92400E', opacity: 0.6 }} />
                      <span className="text-xl">⚜</span>
                      <span className="text-xs tracking-widest uppercase font-serif font-semibold" style={{ color: '#78350F' }}>
                        Nasab & Silaturahmi Trah Agung
                      </span>
                      <span className="text-xl">⚜</span>
                      <div className="w-16 h-0.5" style={{ backgroundColor: '#92400E', opacity: 0.6 }} />
                    </div>

                    {/* JUDUL RESMI YANG PROPORSIONAL SESUAI PERMINTAAN */}
                    <h1
                      className="text-2xl sm:text-3xl md:text-4xl font-black font-serif tracking-wider uppercase relative"
                      style={{
                        color: '#2B1704',
                        letterSpacing: '0.08em',
                        textShadow: '1px 1px 2px rgba(120, 53, 15, 0.15)',
                      }}
                    >
                      SILSILAH KELUARGA BANI NALI LAMONGAN
                    </h1>

                    {/* Subjudul & Keterangan Asal Usul */}
                    <p className="text-xs sm:text-sm font-serif italic mt-1.5 max-w-2xl" style={{ color: '#44403C' }}>
                      Bagan Silsilah Kekerabatan, Garis Keturunan, dan Hubungan Perkawinan Keluarga Besar
                      Bani Nali — Lamongan, Jawa Timur
                    </p>

                    {/* Classical Ornate Divider Bar */}
                    <div className="flex items-center justify-center gap-2 mt-3" style={{ color: '#92400E' }}>
                      <div className="w-24 h-px" style={{ backgroundColor: '#92400E', opacity: 0.4 }} />
                      <span className="text-xs">✦</span>
                      <div className="w-6 h-px" style={{ backgroundColor: '#92400E', opacity: 0.4 }} />
                      <span className="text-xs font-serif font-bold px-2" style={{ color: '#451A03' }}>
                        Dokumen Nasab Resmi
                      </span>
                      <div className="w-6 h-px" style={{ backgroundColor: '#92400E', opacity: 0.4 }} />
                      <span className="text-xs">✦</span>
                      <div className="w-24 h-px" style={{ backgroundColor: '#92400E', opacity: 0.4 }} />
                    </div>
                  </div>

                  {/* FULL SILSILAH TREE WORKSPACE: D3 HIERARCHICAL FORMAT */}
                  <div className="w-full flex flex-col items-center justify-center py-4 px-2 min-h-[450px]">
                    {!d3TreeLayout || d3TreeLayout.nodes.length === 0 ? (
                      <div className="text-center p-8 font-serif" style={{ color: '#78716C' }}>
                        Belum ada data anggota keluarga yang dapat ditampilkan dalam bagan silsilah D3.
                      </div>
                    ) : (
                      <div
                        className="relative mx-auto"
                        style={{
                          width: `${d3TreeLayout.totalWidth}px`,
                          height: `${d3TreeLayout.totalHeight}px`,
                        }}
                      >
                        {/* SVG Layer: Links / Connector Lines */}
                        <svg
                          className="absolute inset-0 pointer-events-none"
                          width={d3TreeLayout.totalWidth}
                          height={d3TreeLayout.totalHeight}
                          style={{
                            width: `${d3TreeLayout.totalWidth}px`,
                            height: `${d3TreeLayout.totalHeight}px`,
                          }}
                        >
                          {d3TreeLayout.links.map((link) => (
                            <path
                              key={link.id}
                              d={link.pathD}
                              fill="none"
                              stroke="#92400E"
                              strokeWidth={2.5}
                              strokeLinecap="round"
                              opacity={0.85}
                            />
                          ))}
                        </svg>

                        {/* HTML Nodes Layer: Exact D3 Coordinates */}
                        {d3TreeLayout.nodes.map((node) => {
                          const data = node.data;
                          const spouses = data.spouses;

                          return (
                            <div
                              key={node.id}
                              className="absolute flex flex-col items-center"
                              style={{
                                left: `${node.left}px`,
                                top: `${node.top}px`,
                                width: `${node.width}px`,
                                height: `${node.height}px`,
                              }}
                            >
                              {/* Case 1: Exactly 2 Spouses (Spouse 1 - Center Member - Spouse 2) */}
                              {spouses.length === 2 ? (
                                <div
                                  className="relative pt-5 pb-2 px-2.5 rounded-2xl border flex flex-col items-center"
                                  style={{
                                    backgroundColor: '#FFFDF8',
                                    borderColor: '#B45309',
                                    boxShadow: '0 2px 4px rgba(120, 53, 15, 0.08)',
                                  }}
                                >
                                  {/* Top Badge */}
                                  <div
                                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[8.5px] font-bold flex items-center gap-1 border whitespace-nowrap z-10"
                                    style={{
                                      backgroundColor: '#FEF3C7',
                                      color: '#451A03',
                                      borderColor: '#FCD34D',
                                    }}
                                  >
                                    <Heart className="w-2.5 h-2.5 fill-amber-600 text-amber-700" />
                                    <span>2 Pasangan Sah</span>
                                  </div>

                                  <div className="flex items-center justify-center gap-1.5">
                                    {/* Spouse 1 */}
                                    {renderD3MemberCard(spouses[0], {
                                      isSpouse: true,
                                      spouseOrder: 1,
                                    })}

                                    {/* Gold Marriage Bridge #1 */}
                                    <div className="flex flex-col items-center justify-center px-0.5 shrink-0">
                                      <div className="w-5 h-0.5" style={{ backgroundColor: '#B45309' }} />
                                      <div
                                        className="p-0.5 rounded-full border -my-1 text-[8px] font-bold"
                                        style={{
                                          backgroundColor: '#FEF3C7',
                                          borderColor: '#FCD34D',
                                          color: '#78350F',
                                        }}
                                      >
                                        <Heart className="w-2.5 h-2.5 fill-amber-600 text-amber-700" />
                                      </div>
                                    </div>

                                    {/* Center Member */}
                                    {renderD3MemberCard(data.member, {
                                      isPrimary: true,
                                      level: data.level,
                                      childOrder: node.childOrder,
                                      motherInfo: node.motherName,
                                    })}

                                    {/* Gold Marriage Bridge #2 */}
                                    <div className="flex flex-col items-center justify-center px-0.5 shrink-0">
                                      <div className="w-5 h-0.5" style={{ backgroundColor: '#B45309' }} />
                                      <div
                                        className="p-0.5 rounded-full border -my-1 text-[8px] font-bold"
                                        style={{
                                          backgroundColor: '#FEF3C7',
                                          borderColor: '#FCD34D',
                                          color: '#78350F',
                                        }}
                                      >
                                        <Heart className="w-2.5 h-2.5 fill-amber-600 text-amber-700" />
                                      </div>
                                    </div>

                                    {/* Spouse 2 */}
                                    {renderD3MemberCard(spouses[1], {
                                      isSpouse: true,
                                      spouseOrder: 2,
                                    })}
                                  </div>
                                </div>
                              ) : spouses.length === 1 ? (
                                /* Case 2: 1 Spouse (Primary Member - Spouse) */
                                <div
                                  className="relative pt-5 pb-2 px-2.5 rounded-2xl border flex flex-col items-center"
                                  style={{
                                    backgroundColor: '#FFFDF8',
                                    borderColor: '#B45309',
                                    boxShadow: '0 2px 4px rgba(120, 53, 15, 0.08)',
                                  }}
                                >
                                  {/* Top Badge */}
                                  <div
                                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[8.5px] font-bold flex items-center gap-1 border whitespace-nowrap z-10"
                                    style={{
                                      backgroundColor: '#FEF3C7',
                                      color: '#451A03',
                                      borderColor: '#FCD34D',
                                    }}
                                  >
                                    <Heart className="w-2.5 h-2.5 fill-amber-600 text-amber-700" />
                                    <span>Pasangan Sah: Suami & Istri</span>
                                  </div>

                                  <div className="flex items-center justify-center gap-1.5">
                                    {/* Primary Member */}
                                    {renderD3MemberCard(data.member, {
                                      isPrimary: true,
                                      level: data.level,
                                      childOrder: node.childOrder,
                                      motherInfo: node.motherName,
                                    })}

                                    {/* Gold Marriage Bridge */}
                                    <div className="flex flex-col items-center justify-center px-0.5 shrink-0">
                                      <div className="w-5 h-0.5" style={{ backgroundColor: '#B45309' }} />
                                      <div
                                        className="p-0.5 rounded-full border -my-1 text-[8px] font-bold"
                                        style={{
                                          backgroundColor: '#FEF3C7',
                                          borderColor: '#FCD34D',
                                          color: '#78350F',
                                        }}
                                      >
                                        <Heart className="w-2.5 h-2.5 fill-amber-600 text-amber-700" />
                                      </div>
                                    </div>

                                    {/* Spouse */}
                                    {renderD3MemberCard(spouses[0], {
                                      isSpouse: true,
                                      spouseOrder: 1,
                                    })}
                                  </div>
                                </div>
                              ) : (
                                /* Case 3: Single Member */
                                <div className="relative p-1 rounded-2xl flex flex-col items-center">
                                  {renderD3MemberCard(data.member, {
                                    isPrimary: true,
                                    level: data.level,
                                    childOrder: node.childOrder,
                                    motherInfo: node.motherName,
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* VINTAGE FOOTER: LEGENDA & STEMPEL RESMI BANI NALI */}
                  <div className="mt-12 pt-6 border-t-2 border-amber-900/30 flex flex-wrap items-end justify-between gap-6 text-stone-700 text-xs">
                    {/* Left: Legenda Silsilah */}
                    {includeLegend && (
                      <div className="p-3 rounded-lg bg-[#FAF6EE] border border-amber-900/30 max-w-md">
                        <h5 className="font-serif font-bold text-stone-900 text-[11px] mb-1.5 flex items-center gap-1">
                          <span>✦</span>
                          <span>Keterangan & Legenda Bagan Silsilah:</span>
                        </h5>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px]">
                          <div className="flex items-center gap-1.5">
                            <span className="w-3 h-2 rounded-xs bg-[#FFFDF8] border border-amber-900/50" />
                            <span>Keturunan Langsung (Trah)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-3 h-2 rounded-xs bg-[#FAF6EC] border border-stone-300" />
                            <span>Pasangan / Mantu</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Heart className="w-2.5 h-2.5 fill-amber-600 text-amber-700" />
                            <span>Ikatan Pernikahan Sah</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-700" />
                            <span>Laki-laki (L) / Perempuan (P)</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Center: Catatan Silaturahmi */}
                    <div className="text-center flex flex-col items-center max-w-xs">
                      <p className="text-[10px] font-serif italic text-stone-700">
                        "Menjaga dan merajut tali silaturahmi, memelihara marwah keluarga, dan meneruskan
                        amal jariyah leluhur."
                      </p>
                      <p className="text-[9px] font-mono text-stone-500 mt-1">
                        Dicetak pada: {new Date().toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>

                    {/* Right: Cap Segel Trah Bani Nali Resmi */}
                    {includeOfficialSeal && (
                      <div className="flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full border-2 border-dashed border-amber-900/60 p-1 flex items-center justify-center relative">
                          <div className="w-full h-full rounded-full border border-amber-900/80 flex flex-col items-center justify-center text-center p-1 bg-amber-50/50">
                            <span className="text-[7.5px] font-serif font-black tracking-wider text-amber-950 uppercase">
                              CAP NASAB RESMI
                            </span>
                            <span className="text-[9px] font-serif font-black text-amber-900">
                              BANI NALI
                            </span>
                            <span className="text-[6.5px] tracking-tight text-amber-800 uppercase">
                              LAMONGAN
                            </span>
                            <span className="text-[8px] text-amber-700 mt-0.5">✦ ✦ ✦</span>
                          </div>
                        </div>
                        <span className="text-[8px] font-serif font-semibold text-stone-600 mt-1">
                          Otentikasi Arsip Silsilah
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer Info */}
        <div className="px-5 py-2.5 bg-stone-100 border-t border-stone-200 text-stone-500 text-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-700" />
            <span>
              Format pohon hierarkis D3 siap dicetak langsung atau diunduh ke ukuran kertas besar (A3 / A2 Poster) untuk dibingkai pigura di rumah.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 font-medium transition-colors cursor-pointer text-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
