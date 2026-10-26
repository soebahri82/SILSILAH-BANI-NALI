import React, { useState, useMemo, useRef } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Search, 
  Users, 
  ChevronDown, 
  ChevronRight, 
  Heart, 
  AlertTriangle, 
  Calendar,
  Sparkles,
  LayoutGrid,
  Printer
} from 'lucide-react';
import { FamilyMember } from '../../types';
import { 
  getMemberSpouses, 
  sortMembersByBirthDate,
  getChildParentSpouseInfo 
} from '../../utils/familyTreeUtils';
import { isMale, isFemale, getGenderCode, getGenderDisplay } from '../../utils/genderUtils';
import { D3FamilyTreeViewer } from './D3FamilyTreeViewer';
import { PrintExportFamilyTreeModal } from './PrintExportFamilyTreeModal';

export { D3FamilyTreeViewer, PrintExportFamilyTreeModal };

interface FamilyTreeViewerProps {
  members: FamilyMember[];
  onSelectMember: (member: FamilyMember) => void;
  highlightedMemberId?: string | null;
}

interface TreeNode {
  member: FamilyMember;
  spouses: FamilyMember[];
  children: TreeNode[];
  level: number;
}

export const FamilyTreeViewer: React.FC<FamilyTreeViewerProps> = ({
  members,
  onSelectMember,
  highlightedMemberId,
}) => {
  const [viewMode, setViewMode] = useState<'d3' | 'classic'>('d3');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Map members for fast lookup
  const memberMap = useMemo(() => {
    const map = new Map<string, FamilyMember>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  // Validation report: detect orphans, missing parents
  const validationReport = useMemo(() => {
    const missingParents: string[] = [];

    members.forEach((m) => {
      if (m.parentID && !memberMap.has(m.parentID)) {
        missingParents.push(m.name);
      }
    });

    return {
      missingParents,
      hasIssues: missingParents.length > 0,
    };
  }, [members, memberMap]);

  // Build tree hierarchy dynamically from parentID and spouseID
  // Strictly sorted by birthDate chronologically
  const treeRoots = useMemo(() => {
    const processedSpouseSet = new Set<string>();
    const visitedInHierarchy = new Set<string>();

    const buildSubtree = (member: FamilyMember, currentLevel: number): TreeNode => {
      visitedInHierarchy.add(member.id);

      // Find all spouses of this member (e.g. 1 or multiple spouses)
      const spouses = getMemberSpouses(member, members);
      spouses.forEach((s) => {
        processedSpouseSet.add(s.id);
      });

      // Gather all potential parent IDs associated with this unit
      const parentIdSet = new Set<string>([member.id, ...spouses.map((s) => s.id)]);

      // Find children where parentID matches member or any of the spouses
      const rawChildren: FamilyMember[] = [];
      members.forEach((candidate) => {
        if (!candidate.parentID) return;
        const pIds = candidate.parentID.split(/[,;]+/).map((p) => p.trim());
        const isChild = pIds.some((id) => parentIdSet.has(id));

        if (isChild && !visitedInHierarchy.has(candidate.id)) {
          rawChildren.push(candidate);
        }
      });

      // **ATURAN UTAMA**: Susunan anak/silsilah diurutkan menurut TANGGAL LAHIR secara kronologis
      const sortedChildren = sortMembersByBirthDate(rawChildren, true);

      const childrenNodes: TreeNode[] = sortedChildren.map((child) =>
        buildSubtree(child, currentLevel + 1)
      );

      return {
        member,
        spouses,
        children: childrenNodes,
        level: currentLevel,
      };
    };

    // 1. Identify spouses of descendants (mantu/in-laws who marry someone whose parent is in the tree)
    // They must NEVER be treated as tree roots because their entry point to the tree is via their spouse.
    const spouseOfDescendantSet = new Set<string>();
    members.forEach((m) => {
      const hasParentInTree = !!(m.parentID && memberMap.has(m.parentID));
      if (hasParentInTree) {
        const spouses = getMemberSpouses(m, members);
        spouses.forEach((s) => spouseOfDescendantSet.add(s.id));
      }
    });

    // 2. Filter potential roots: members who have no parent in the tree AND are not spouses of descendants
    const potentialRoots = members.filter((m) => {
      const hasParentInTree = !!(m.parentID && memberMap.has(m.parentID));
      if (hasParentInTree) return false;
      if (spouseOfDescendantSet.has(m.id)) return false;
      return true;
    });

    // 3. Among root couples where neither has parents in tree (e.g. Mbah Nali & Mbah Martiah), pick primary
    const pairedSpouseSet = new Set<string>();
    const sortedCandidates = [...potentialRoots].sort((a, b) => {
      // Prioritize members who are referenced as parent of children in dataset
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

    return rootsToBuild.map((root) => buildSubtree(root, 1));
  }, [members, memberMap]);

  // Handle Pan & Drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.node-card')) {
      return;
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.15, 2.0));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.15, 0.4));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const toggleCollapse = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  // Helper to extract birth/death years
  const getYearsText = (member: FamilyMember) => {
    const bYear = member.birthDate ? member.birthDate.split('-')[0] : '';
    const dYear = member.deathDate ? member.deathDate.split('-')[0] : '';

    if (member.deathDate) {
      return `${bYear || '?'} – ${dYear} (Alm.)`;
    }
    return bYear ? `Lahir: ${bYear}` : '';
  };

  // Render a Single Member Node Card
  const renderMemberCard = (
    member: FamilyMember,
    isSpouse = false,
    spouseTitle?: string,
    childOrder?: number,
    childParentInfo?: {
      spouseLabel?: string;
      sideText?: 'Kiri' | 'Kanan' | 'Tunggal';
    },
    isCenterPrimary = false,
    hasTwoSpouses = false
  ) => {
    const isHighlighted =
      highlightedMemberId === member.id ||
      (searchQuery.trim().length > 1 &&
        member.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const isDeceased = !!member.deathDate;
    const male = isMale(member.gender);
    const genderCode = getGenderCode(member.gender);

    return (
      <div
        key={member.id}
        onClick={(e) => {
          e.stopPropagation();
          onSelectMember(member);
        }}
        className={`node-card group relative cursor-pointer select-none rounded-xl p-3 sm:p-3.5 transition-all duration-200 w-52 sm:w-56 border ${
          isHighlighted
            ? 'bg-amber-50 border-amber-500 shadow-md ring-2 ring-amber-400'
            : isDeceased
            ? 'bg-stone-50/95 border-stone-300 hover:border-emerald-700 shadow-xs hover:shadow-md'
            : 'bg-white border-stone-200 hover:border-emerald-700 shadow-xs hover:shadow-md'
        }`}
      >
        {/* Gender Accent Top Line */}
        <div
          className={`h-1 absolute top-0 inset-x-3 rounded-full ${
            isHighlighted
              ? 'bg-amber-500'
              : male
              ? 'bg-emerald-700'
              : 'bg-amber-600'
          }`}
        />

        <div className="flex items-start gap-2.5 mt-1">
          {/* Avatar / Photo */}
          <div className="relative shrink-0">
            {member.photoURL ? (
              <img
                src={member.photoURL}
                alt={member.name}
                className="w-10 h-10 rounded-full object-cover border border-stone-200"
              />
            ) : (
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                  male
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}
              >
                {member.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            {isSpouse && (
              <div
                className="absolute -bottom-1 -right-1 bg-amber-500 text-white p-0.5 rounded-full shadow-xs"
                title={spouseTitle || 'Pasangan'}
              >
                <Heart className="w-2.5 h-2.5 fill-current" />
              </div>
            )}
          </div>

          {/* Member Info */}
          <div className="min-w-0 flex-1">
            {/* Positional Badge & Role */}
            {hasTwoSpouses && isCenterPrimary ? (
              <div className="text-[10px] font-bold text-emerald-950 bg-emerald-100/90 px-2 py-0.5 rounded-md w-fit mb-1 border border-emerald-300 shadow-2xs">
                {male ? 'Suami' : 'Istri'} / Trah Utama
              </div>
            ) : spouseTitle ? (
              <div className="text-[10px] font-bold text-amber-950 bg-amber-100/90 px-2 py-0.5 rounded-md w-fit mb-1 border border-amber-300 shadow-2xs">
                {spouseTitle} {isDeceased ? '(Alm.)' : ''}
              </div>
            ) : childOrder ? (
              <div className="space-y-0.5 mb-1">
                <div className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded w-fit border border-emerald-200">
                  Anak ke-{childOrder}
                </div>
                {childParentInfo?.spouseLabel && (
                  <div className="text-[9px] font-semibold text-amber-900 bg-amber-50 px-1.5 py-0.2 rounded w-fit border border-amber-200 truncate max-w-[190px]">
                    Ibu: {childParentInfo.spouseLabel}
                  </div>
                )}
              </div>
            ) : null}

            <h4 className="text-xs sm:text-sm font-semibold text-stone-900 truncate group-hover:text-emerald-900">
              {member.name}
            </h4>
            
            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] sm:text-xs text-stone-500">
              <span className={`font-bold px-1 py-0.2 rounded text-[10px] ${
                male ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
              }`}>
                {genderCode} ({male ? 'Laki-laki' : 'Perempuan'})
              </span>
              {isDeceased && (
                <>
                  <span>·</span>
                  <span className="text-stone-600 font-medium bg-stone-200/80 px-1 rounded text-[10px]">
                    Wafat
                  </span>
                </>
              )}
            </div>

            <p className="text-[10px] text-stone-500 mt-0.5 truncate flex items-center gap-1">
              {member.birthDate && <Calendar className="w-2.5 h-2.5 text-stone-400" />}
              <span>{getYearsText(member) || (member.birthPlace ? member.birthPlace : 'Bani Nali')}</span>
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Recursive Tree Node Renderer
  // Khusus apabila mempunyai 2 pasangan: taruh pasangan 1 di KIRI, anggota di TENGAH, pasangan 2 di KANAN
  const renderTreeNode = (
    node: TreeNode,
    childOrder?: number,
    childParentInfo?: {
      spouseLabel?: string;
      sideText?: 'Kiri' | 'Kanan' | 'Tunggal';
    }
  ) => {
    const isCollapsed = collapsedNodes[node.member.id];
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.member.id} className="flex flex-col items-center">
        {/* Node Group Layout */}
        {node.spouses.length === 2 ? (
          /* Kasus Tepat 2 Pasangan: Pasangan 1 - Anggota Utama - Pasangan 2 */
          <div className="relative pt-6 pb-2.5 px-3 rounded-3xl bg-stone-50/80 border border-stone-200/80 shadow-xs flex flex-col items-center">
            {/* Header Keterangan di bagian atas container */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-100 text-amber-950 border border-amber-300 px-3.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-xs whitespace-nowrap z-10">
              <Heart className="w-3 h-3 fill-amber-500 text-amber-600" />
              <span className="text-amber-900">2 Pasangan Sah</span>
            </div>

            {/* Deretan Kartu: Pasangan 1 - Anggota Utama - Pasangan 2 */}
            <div className="flex items-center justify-center gap-1 sm:gap-2">
              {/* Pasangan ke-1 */}
              <div className="relative">
                {renderMemberCard(
                  node.spouses[0],
                  true,
                  `${isFemale(node.spouses[0].gender) ? 'Istri' : 'Suami'} ke-1 · Pernikahan Pertama`
                )}
              </div>

              {/* Jembatan Penghubung Pernikahan Pertama */}
              <div className="flex flex-col items-center justify-center px-1 shrink-0 relative">
                <div className="w-6 sm:w-10 h-0.5 bg-amber-400" />
                <div 
                  className="flex items-center gap-0.5 text-[9px] font-bold text-amber-900 bg-amber-100 rounded-full px-1.5 py-0.5 border border-amber-300 shadow-xs -my-2.5 z-10 whitespace-nowrap"
                  title="Pernikahan Pertama"
                >
                  <Heart className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                  <span>#1</span>
                </div>
              </div>

              {/* Anggota Utama */}
              <div className="relative">
                {renderMemberCard(node.member, false, undefined, childOrder, childParentInfo, true, true)}
              </div>

              {/* Jembatan Penghubung Pernikahan Kedua */}
              <div className="flex flex-col items-center justify-center px-1 shrink-0 relative">
                <div className="w-6 sm:w-10 h-0.5 bg-amber-400" />
                <div 
                  className="flex items-center gap-0.5 text-[9px] font-bold text-amber-900 bg-amber-100 rounded-full px-1.5 py-0.5 border border-amber-300 shadow-xs -my-2.5 z-10 whitespace-nowrap"
                  title="Pernikahan Kedua"
                >
                  <Heart className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                  <span>#2</span>
                </div>
              </div>

              {/* Pasangan ke-2 */}
              <div className="relative">
                {renderMemberCard(
                  node.spouses[1],
                  true,
                  `${isFemale(node.spouses[1].gender) ? 'Istri' : 'Suami'} ke-2 · Pernikahan Kedua`
                )}
              </div>
            </div>

            {/* Collapse/Expand Toggle Button (Centered right under node.member) */}
            {hasChildren && (
              <button
                onClick={(e) => toggleCollapse(node.member.id, e)}
                className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-emerald-900 text-white flex items-center gap-1 text-[10px] font-semibold hover:bg-emerald-950 shadow-md border-2 border-white cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
                title={isCollapsed ? `Buka silsilah (${node.children.length} anak)` : 'Tutup cabang'}
              >
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>{isCollapsed ? `Buka (${node.children.length} Anak)` : `${node.children.length} Anak`}</span>
              </button>
            )}
          </div>
        ) : node.spouses.length === 1 ? (
          /* Kasus 1 Pasangan: Anggota Utama - Pasangan */
          <div className="relative pt-6 pb-2.5 px-3 rounded-3xl bg-stone-50/60 border border-stone-200/60 shadow-xs flex flex-col items-center">
            {/* Header Keterangan di bagian atas container */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-50 text-amber-900 border border-amber-200 px-3 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-xs whitespace-nowrap z-10">
              <Heart className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
              <span>Pasangan Sah: Suami & Istri</span>
            </div>

            <div className="flex items-center justify-center gap-1 sm:gap-2">
              <div className="relative">
                {renderMemberCard(node.member, false, undefined, childOrder, childParentInfo, true, false)}
              </div>

              <div className="flex flex-col items-center justify-center px-1 shrink-0 relative">
                <div className="w-6 sm:w-10 h-0.5 bg-amber-400" />
                <div 
                  className="flex items-center gap-0.5 text-[9px] font-semibold text-amber-900 bg-amber-100 rounded-full px-2 py-0.5 border border-amber-300 shadow-xs -my-2.5 z-10 whitespace-nowrap"
                  title="Pasangan Sah"
                >
                  <Heart className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                  <span>Pasangan</span>
                </div>
              </div>

              <div className="relative">
                {renderMemberCard(
                  node.spouses[0],
                  true,
                  `${isFemale(node.spouses[0].gender) ? 'Istri' : 'Suami'}`
                )}
              </div>
            </div>

            {/* Collapse/Expand Toggle Button */}
            {hasChildren && (
              <button
                onClick={(e) => toggleCollapse(node.member.id, e)}
                className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-emerald-900 text-white flex items-center gap-1 text-[10px] font-semibold hover:bg-emerald-950 shadow-md border-2 border-white cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
                title={isCollapsed ? `Buka silsilah (${node.children.length} anak)` : 'Tutup cabang'}
              >
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>{isCollapsed ? `Buka (${node.children.length} Anak)` : `${node.children.length} Anak`}</span>
              </button>
            )}
          </div>
        ) : (
          /* Kasus Belum Ada Pasangan atau Pasangan > 2 */
          <div className="flex flex-wrap items-center justify-center gap-2 relative p-2.5 rounded-2xl bg-stone-50/40 border border-stone-200/40 shadow-xs">
            {renderMemberCard(node.member, false, undefined, childOrder, childParentInfo)}

            {node.spouses.map((spouse, idx) => {
              const isWife = isFemale(spouse.gender);
              const spouseTitle = `${isWife ? 'Istri' : 'Suami'} ke-${idx + 1}`;
              return (
                <React.Fragment key={spouse.id}>
                  <div 
                    className="flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 rounded-full px-2 py-1 border border-amber-200 shadow-xs"
                    title={spouseTitle}
                  >
                    <Heart className="w-3 h-3 fill-amber-500 text-amber-600" />
                    <span>#{idx + 1}</span>
                  </div>
                  {renderMemberCard(spouse, true, spouseTitle)}
                </React.Fragment>
              );
            })}

            {/* Collapse/Expand Toggle Button */}
            {hasChildren && (
              <button
                onClick={(e) => toggleCollapse(node.member.id, e)}
                className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-emerald-900 text-white flex items-center gap-1 text-[10px] font-semibold hover:bg-emerald-950 shadow-md border-2 border-white cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
                title={isCollapsed ? `Buka silsilah (${node.children.length} anak)` : 'Tutup cabang'}
              >
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>{isCollapsed ? `Buka (${node.children.length} Anak)` : `${node.children.length} Anak`}</span>
              </button>
            )}
          </div>
        )}

        {/* Children Subtree Branch (Ordered strictly by birthDate) */}
        {hasChildren && !isCollapsed && (
          <div className="mt-8 flex flex-col items-center">
            {/* Vertical connector line from parent */}
            <div className="w-0.5 h-6 bg-stone-300" />

            {/* Horizontal branch bar and children */}
            <div className="flex items-start gap-8 relative pt-4">
              {/* Horizontal top line connecting children */}
              {node.children.length > 1 && (
                <div
                  className="absolute top-0 inset-x-20 h-0.5 bg-stone-300"
                  style={{
                    left: `calc(50% / ${node.children.length})`,
                    right: `calc(50% / ${node.children.length})`,
                  }}
                />
              )}

              {/* Render Children (Oldest at Left to Youngest at Right, with mother source) */}
              {node.children.map((childNode, idx) => {
                const childSpouseInfo = getChildParentSpouseInfo(
                  childNode.member,
                  node.member,
                  node.spouses
                );
                return (
                  <div key={childNode.member.id} className="flex flex-col items-center relative">
                    {/* Vertical drop line to child */}
                    <div className="w-0.5 h-4 bg-stone-300 absolute -top-4" />
                    {renderTreeNode(childNode, idx + 1, childSpouseInfo)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* View Mode Selector Tabs */}
      <div className="bg-white p-2.5 rounded-2xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl border border-stone-200">
          <button
            onClick={() => setViewMode('d3')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'd3'
                ? 'bg-emerald-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pohon Silsilah D3 (Hierarkis)</span>
          </button>
          <button
            onClick={() => setViewMode('classic')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'classic'
                ? 'bg-emerald-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Bagan Kartu Bertingkat</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-stone-500 font-medium px-2 hidden sm:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>{viewMode === 'd3' ? 'Mode Visual D3-Tree (SVG Interaktif)' : 'Mode Kartu Responsif'}</span>
          </div>

          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer hover:shadow-md"
            title="Cetak Silsilah Jadi PDF & PNG Berbingkai Vintage"
          >
            <Printer className="w-3.5 h-3.5 text-amber-200" />
            <span className="font-serif">Cetak Silsilah (PDF / PNG)</span>
          </button>
        </div>
      </div>

      {viewMode === 'd3' ? (
        <D3FamilyTreeViewer
          members={members}
          onSelectMember={onSelectMember}
          highlightedMemberId={highlightedMemberId}
        />
      ) : (
        <div className="flex flex-col h-full bg-stone-100 rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
          {/* Top Toolbar */}
          <div className="p-3 sm:p-4 bg-white border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
            {/* Search inside Tree */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari anggota di pohon silsilah..."
                className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-800 text-stone-900"
              />
            </div>

            {/* Controls: Zoom, Pan reset, Fit */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleZoomIn}
                className="p-1.5 sm:p-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
                title="Perbesar (Zoom In)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-1.5 sm:p-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
                title="Perkecil (Zoom Out)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleReset}
                className="p-1.5 sm:p-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
                title="Atur Ulang Tampilan"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <span className="text-xs text-stone-500 font-medium px-2 py-1 bg-stone-50 rounded border border-stone-200">
                {Math.round(zoom * 100)}%
              </span>
            </div>
          </div>

          {/* Validation Warning Alert (if any anomaly found) */}
          {validationReport.hasIssues && (
            <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Pemberitahuan Data: Terdapat {validationReport.missingParents.length} relasi parent yang belum terdaftar. Pohon silsilah tetap ditampilkan aman tanpa blank screen.
              </span>
            </div>
          )}

          {/* Interactive Canvas */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing p-6 min-h-[580px] h-[calc(100vh-230px)] max-h-[860px] ${
              isDragging ? 'select-none' : ''
            }`}
          >
            {treeRoots.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-stone-500">
                <Users className="w-12 h-12 text-stone-300 mb-3" />
                <h3 className="text-base font-semibold text-stone-800">
                  Belum Ada Silsilah Terdaftar
                </h3>
                <p className="text-xs text-stone-500 max-w-sm mt-1">
                  Data anggota keluarga belum tersedia di database Firestore. Tambahkan anggota pertama di Panel Admin atau gunakan fitur muat data silsilah Bani Nali.
                </p>
              </div>
            ) : (
              <div
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'top center',
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                }}
                className="inline-flex flex-col items-center gap-12 w-full pt-4 pb-36"
              >
                {treeRoots.map((root) => (
                  <div key={root.member.id} className="w-full flex justify-center">
                    {renderTreeNode(root)}
                  </div>
                ))}
              </div>
            )}

            {/* Legend Overlay at Bottom-Left */}
            <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-stone-200 text-[11px] text-stone-600 shadow-xs flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-700" />
                <span>L (Laki-laki)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                <span>P (Perempuan)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Heart className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span>2 Pasangan Sah</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-stone-300" />
                <span>Almarhum / Almarhumah</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-800 font-bold">1 &rarr; 2 &rarr; 3</span>
                <span>Urut Tanggal Lahir</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cetak Silsilah Jadi PDF dan PNG Berbingkai Vintage */}
      <PrintExportFamilyTreeModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        members={members}
      />
    </div>
  );
};
