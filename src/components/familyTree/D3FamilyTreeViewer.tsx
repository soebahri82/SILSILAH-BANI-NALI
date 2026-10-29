import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Minimize2,
  Users, 
  Heart, 
  ChevronDown, 
  ChevronRight, 
  Calendar,
  Layers,
  GitBranch,
  Sparkles,
  Printer,
  Download
} from 'lucide-react';
import { FamilyMember } from '../../types';
import { 
  getMemberSpouses, 
  sortMembersByBirthDate, 
  getChildParentSpouseInfo 
} from '../../utils/familyTreeUtils';
import { isMale, isFemale, getGenderCode } from '../../utils/genderUtils';
import { PrintExportFamilyTreeModal } from './PrintExportFamilyTreeModal';

export interface D3FamilyTreeViewerProps {
  members: FamilyMember[];
  onSelectMember: (member: FamilyMember) => void;
  highlightedMemberId?: string | null;
}

export interface D3HierarchyNodeData {
  id: string;
  member: FamilyMember;
  spouses: FamilyMember[];
  children?: D3HierarchyNodeData[];
  level: number;
  isVirtualRoot?: boolean;
}

export const D3FamilyTreeViewer: React.FC<D3FamilyTreeViewerProps> = ({
  members,
  onSelectMember,
  highlightedMemberId,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);

  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const [linkStyle, setLinkStyle] = useState<'curved' | 'orthogonal'>('curved');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [canvasHeightMode, setCanvasHeightMode] = useState<'standard' | 'tall'>('standard');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Zoom behavior ref
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Quick lookup map
  const memberMap = useMemo(() => {
    const map = new Map<string, FamilyMember>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  // Build recursive tree hierarchy data strictly sorted by birthdate
  const rawHierarchy = useMemo(() => {
    const processedSpouseSet = new Set<string>();
    const visitedSet = new Set<string>();

    const buildNode = (member: FamilyMember, level: number): D3HierarchyNodeData => {
      visitedSet.add(member.id);
      const spouses = getMemberSpouses(member, members);
      spouses.forEach((s) => processedSpouseSet.add(s.id));

      const parentIdSet = new Set<string>([member.id, ...spouses.map((s) => s.id)]);

      // Find all children
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

      const childrenNodes: D3HierarchyNodeData[] = sortedChildren.map((child) =>
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

    const rootNodes = rootsToBuild.map((r) => buildNode(r, 1));

    // Wrap in virtual root if multiple or single for consistent d3 hierarchy
    const virtualRoot: D3HierarchyNodeData = {
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

    return virtualRoot;
  }, [members, memberMap]);

  // Compute node dimensions based on number of spouses
  const getNodeDimensions = useCallback((data: D3HierarchyNodeData) => {
    if (data.isVirtualRoot) return { width: 0, height: 0 };
    const numSpouses = data.spouses.length;
    if (numSpouses >= 2) {
      // 2 Spouses: Left (215px) + gap/bridge (40px) + Center (215px) + gap/bridge (40px) + Right (215px)
      return { width: 730, height: 135 };
    } else if (numSpouses === 1) {
      // 1 Spouse: Primary (215px) + gap/bridge (40px) + Spouse (215px)
      return { width: 475, height: 125 };
    }
    // Single member
    return { width: 220, height: 110 };
  }, []);

  // Compute D3 Tree Layout
  const layoutData = useMemo(() => {
    if (!rawHierarchy.children || rawHierarchy.children.length === 0) {
      return null;
    }

    // Clone hierarchy while taking into account collapsedMap
    const filterCollapsed = (node: D3HierarchyNodeData): D3HierarchyNodeData => {
      const isCollapsed = collapsedMap[node.id];
      return {
        ...node,
        children: isCollapsed || !node.children ? undefined : node.children.map(filterCollapsed),
      };
    };

    const activeTreeData = filterCollapsed(rawHierarchy);
    const hierarchyRoot = d3.hierarchy<D3HierarchyNodeData>(activeTreeData);

    // Dynamic horizontal separation based on spouse counts
    const treeLayout = d3
      .tree<D3HierarchyNodeData>()
      .nodeSize([320, 240])
      .separation((a, b) => {
        const dimA = getNodeDimensions(a.data);
        const dimB = getNodeDimensions(b.data);
        const neededSpan = (dimA.width + dimB.width) / 2 + 60;
        const factor = Math.max(1, neededSpan / 320);
        return a.parent === b.parent ? factor : factor + 0.35;
      });

    const root = treeLayout(hierarchyRoot);

    // Extract links (ignore link from virtual root to actual roots)
    const links: Array<{
      id: string;
      source: { x: number; y: number; width: number; height: number };
      target: { x: number; y: number; width: number; height: number };
      childMember: FamilyMember;
      parentMember: FamilyMember;
      spouses: FamilyMember[];
    }> = [];

    root.links().forEach((link) => {
      if (link.source.data.isVirtualRoot) return;
      const sDim = getNodeDimensions(link.source.data);
      const tDim = getNodeDimensions(link.target.data);

      links.push({
        id: `${link.source.data.id}->${link.target.data.id}`,
        source: {
          x: link.source.x ?? 0,
          y: link.source.y ?? 0,
          width: sDim.width,
          height: sDim.height,
        },
        target: {
          x: link.target.x ?? 0,
          y: link.target.y ?? 0,
          width: tDim.width,
          height: tDim.height,
        },
        childMember: link.target.data.member,
        parentMember: link.source.data.member,
        spouses: link.source.data.spouses,
      });
    });

    // Extract nodes (exclude virtual root)
    const nodes: Array<{
      id: string;
      x: number;
      y: number;
      data: D3HierarchyNodeData;
      width: number;
      height: number;
      totalChildrenCount: number;
    }> = [];

    root.descendants().forEach((d) => {
      if (d.data.isVirtualRoot) return;
      const dim = getNodeDimensions(d.data);

      // Find total original children count before collapsing
      const findOrigChildren = (id: string, curr: D3HierarchyNodeData): number => {
        if (curr.id === id) return curr.children ? curr.children.length : 0;
        if (curr.children) {
          for (const c of curr.children) {
            const res = findOrigChildren(id, c);
            if (res !== -1) return res;
          }
        }
        return -1;
      };

      const origCount = findOrigChildren(d.data.id, rawHierarchy);

      nodes.push({
        id: d.data.id,
        x: d.x ?? 0,
        y: d.y ?? 0,
        data: d.data,
        width: dim.width,
        height: dim.height,
        totalChildrenCount: Math.max(0, origCount),
      });
    });

    return { root, links, nodes };
  }, [rawHierarchy, collapsedMap, getNodeDimensions]);

  // Initialize D3 Zoom & Pan
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 2.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;

    // Initial center/fit if first load
    if (layoutData && layoutData.nodes.length > 0) {
      fitToView(0.9);
    }
  }, [layoutData]);

  // Fit to screen view function with generous padding
  const fitToView = useCallback(
    (scaleRatio = 0.85) => {
      if (!svgRef.current || !containerRef.current || !layoutData || layoutData.nodes.length === 0)
        return;

      const container = containerRef.current;
      const { clientWidth: width, clientHeight: height } = container;

      // Compute bounding box of all nodes
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      layoutData.nodes.forEach((n) => {
        minX = Math.min(minX, n.x - n.width / 2);
        maxX = Math.max(maxX, n.x + n.width / 2);
        minY = Math.min(minY, n.y);
        maxY = Math.max(maxY, n.y + n.height + 70);
      });

      const treeWidth = maxX - minX || 600;
      const treeHeight = maxY - minY || 400;

      // Ample padding so tree nodes, badges, and expand buttons never touch the edge or legend
      const topPadding = 35;
      const bottomPadding = 95; // Room for legend overlay and collapse/expand buttons
      const horizPadding = 70;

      const availWidth = Math.max(200, width - horizPadding);
      const availHeight = Math.max(200, height - topPadding - bottomPadding);

      const scale = Math.min(
        scaleRatio,
        Math.max(0.12, Math.min(availWidth / treeWidth, availHeight / treeHeight))
      );

      const centerX = (minX + maxX) / 2;
      const scaledTreeHeight = treeHeight * scale;

      // Vertically center if tree height is smaller than available height, else start cleanly at topPadding
      const verticalOffsetY =
        availHeight > scaledTreeHeight
          ? topPadding + (availHeight - scaledTreeHeight) / 2
          : topPadding;

      const transform = d3.zoomIdentity
        .translate(width / 2 - centerX * scale, verticalOffsetY - minY * scale)
        .scale(scale);

      const svg = d3.select(svgRef.current);
      if (zoomBehaviorRef.current) {
        svg.transition().duration(450).call(zoomBehaviorRef.current.transform, transform);
      }
    },
    [layoutData]
  );

  // Trigger fitToView when entering or exiting fullscreen or changing height mode
  useEffect(() => {
    const timer = setTimeout(() => {
      fitToView(0.85);
    }, 150);
    return () => clearTimeout(timer);
  }, [isFullscreen, canvasHeightMode, fitToView]);

  // Manual zoom controls
  const handleZoomIn = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.25);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.8);
  };

  const handleReset = () => {
    fitToView(0.85);
  };

  // Toggle Collapse on Node
  const toggleCollapse = (nodeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedMap((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  // Expand / Collapse all
  const handleExpandAll = () => setCollapsedMap({});
  const handleCollapseAll = () => {
    const newMap: Record<string, boolean> = {};
    if (layoutData) {
      layoutData.nodes.forEach((n) => {
        if (n.totalChildrenCount > 0 && n.data.level >= 2) {
          newMap[n.id] = true;
        }
      });
    }
    setCollapsedMap(newMap);
  };

  // Helper for years text
  const getYearsText = (member: FamilyMember) => {
    const bYear = member.birthDate ? member.birthDate.split('-')[0] : '';
    const dYear = member.deathDate ? member.deathDate.split('-')[0] : '';
    if (member.deathDate) {
      return `${bYear || '?'} – ${dYear} (Alm.)`;
    }
    return bYear ? `Lahir: ${bYear}` : '';
  };

  // Generate SVG link path
  const getLinkPath = (link: {
    source: { x: number; y: number; width: number; height: number };
    target: { x: number; y: number; width: number; height: number };
  }) => {
    const sx = link.source.x;
    const sy = link.source.y + link.source.height;
    const tx = link.target.x;
    const ty = link.target.y;

    if (linkStyle === 'curved') {
      const my = (sy + ty) / 2;
      return `M ${sx} ${sy} C ${sx} ${my}, ${tx} ${my}, ${tx} ${ty}`;
    } else {
      // Orthogonal stepped lines
      const my = sy + (ty - sy) / 2;
      return `M ${sx} ${sy} L ${sx} ${my} L ${tx} ${my} L ${tx} ${ty}`;
    }
  };

  // Render a single member card (used for central member, left spouse, right spouse)
  const renderCard = (
    member: FamilyMember,
    options: {
      isSpouse?: boolean;
      spouseLabel?: string;
      childOrder?: number;
      childParentLabel?: string;
      isCenterPrimary?: boolean;
    } = {}
  ) => {
    const isDeceased = !!member.deathDate;
    const male = isMale(member.gender);
    const genderCode = getGenderCode(member.gender);

    const isHighlight = highlightedMemberId === member.id;

    return (
      <div
        key={member.id}
        onClick={(e) => {
          e.stopPropagation();
          onSelectMember(member);
        }}
        className={`relative w-[215px] select-none rounded-xl p-3 border transition-all duration-200 cursor-pointer shadow-xs ${
          isHighlight
            ? 'bg-amber-50/95 border-amber-500 shadow-lg ring-2 ring-amber-400'
            : isDeceased
            ? 'bg-stone-50/95 border-stone-300 hover:border-emerald-700 hover:shadow-md'
            : 'bg-white border-stone-200 hover:border-emerald-700 hover:shadow-md'
        }`}
      >
        {/* Gender Accent Stripe */}
        <div
          className={`h-1 absolute top-0 inset-x-3 rounded-full ${
            isHighlight ? 'bg-amber-500' : male ? 'bg-emerald-700' : 'bg-amber-600'
          }`}
        />

        <div className="flex items-start gap-2.5 mt-0.5">
          {/* Photo / Avatar */}
          <div className="relative shrink-0">
            {member.photoURL ? (
              <img
                src={member.photoURL}
                alt={member.name}
                className="w-9 h-9 rounded-full object-cover border border-stone-200"
              />
            ) : (
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                  male
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}
              >
                {member.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            {options.isSpouse && (
              <div
                className="absolute -bottom-1 -right-1 bg-amber-500 text-white p-0.5 rounded-full shadow-2xs"
                title={options.spouseLabel || 'Pasangan'}
              >
                <Heart className="w-2.5 h-2.5 fill-current" />
              </div>
            )}
          </div>

          {/* Member Details */}
          <div className="min-w-0 flex-1">
            {/* Context Badge */}
            {options.isCenterPrimary ? (
              <div className="text-[9px] font-bold text-emerald-950 bg-emerald-100/90 px-1.5 py-0.2 rounded w-fit mb-0.5 border border-emerald-300 truncate">
                {male ? 'Suami' : 'Istri'} / Trah Utama
              </div>
            ) : options.spouseLabel ? (
              <div className="text-[9px] font-bold text-amber-950 bg-amber-100/90 px-1.5 py-0.2 rounded w-fit mb-0.5 border border-amber-300 truncate">
                {options.spouseLabel}
              </div>
            ) : options.childOrder ? (
              <div className="space-y-0.5 mb-0.5">
                <div className="text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded w-fit border border-emerald-200">
                  Anak ke-{options.childOrder}
                </div>
                {options.childParentLabel && (
                  <div className="text-[8.5px] font-semibold text-amber-900 bg-amber-50 px-1.5 py-0.2 rounded w-fit border border-amber-200 truncate max-w-[150px]">
                    Ibu: {options.childParentLabel}
                  </div>
                )}
              </div>
            ) : null}

            <h4
              className="text-xs font-semibold text-stone-900 truncate hover:text-emerald-800"
              title={member.name}
            >
              {member.name}
            </h4>

            {/* Gender Code Badge (L / P) & Deceased Badge */}
            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-stone-500">
              <span
                className={`font-bold px-1 py-0.2 rounded text-[9px] ${
                  male ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                }`}
              >
                {genderCode} ({male ? 'Laki-laki' : 'Perempuan'})
              </span>
              {isDeceased && (
                <span className="text-stone-600 font-medium bg-stone-200/80 px-1 rounded text-[9px]">
                  Wafat
                </span>
              )}
            </div>

            <p className="text-[9px] text-stone-500 mt-0.5 truncate flex items-center gap-1">
              {member.birthDate && <Calendar className="w-2.5 h-2.5 text-stone-400" />}
              <span>{getYearsText(member) || member.birthPlace || 'Bani Nali'}</span>
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`flex flex-col bg-stone-100 shadow-xs transition-all ${
        isFullscreen
          ? 'fixed inset-0 z-50 p-2 sm:p-4 bg-stone-100 h-screen w-screen'
          : canvasHeightMode === 'tall'
            ? 'h-[820px] xl:h-[900px] rounded-2xl border border-stone-200 overflow-hidden'
            : 'h-[620px] xl:h-[calc(100vh-230px)] min-h-[560px] max-h-[850px] rounded-2xl border border-stone-200 overflow-hidden'
      }`}
    >
      {/* Top D3 Toolbar */}
      <div className="p-3 sm:p-4 bg-white border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
        {/* Left Controls: Link Style Switcher & Branch Expansion */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Link Style Switcher */}
          <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs">
            <button
              onClick={() => setLinkStyle('curved')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                linkStyle === 'curved'
                  ? 'bg-white text-emerald-950 font-semibold shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Garis Lengkung (Bezier)"
            >
              <GitBranch className="w-3 h-3" />
              <span>Lengkung</span>
            </button>
            <button
              onClick={() => setLinkStyle('orthogonal')}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                linkStyle === 'orthogonal'
                  ? 'bg-white text-emerald-950 font-semibold shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Garis Sudut Siku (Orthogonal)"
            >
              <Layers className="w-3 h-3" />
              <span>Siku</span>
            </button>
          </div>

          {/* Expand/Collapse All */}
          <button
            onClick={handleExpandAll}
            className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium cursor-pointer transition-colors"
            title="Buka seluruh cabang silsilah"
          >
            Buka Semua
          </button>
          <button
            onClick={handleCollapseAll}
            className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium cursor-pointer transition-colors"
            title="Tutup generasi bawahan"
          >
            Tutup Cabang
          </button>
        </div>

        {/* Right Action Controls: Fit, In, Out, Reset, Height, Fullscreen, Print */}
        <div className="flex items-center flex-wrap gap-2">

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg border border-stone-200">
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded-md hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded-md hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 rounded-md hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
              title="Atur Ulang / Pusatkan (Reset View)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => fitToView(0.85)}
              className="p-1.5 rounded-md hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
              title="Paskan ke Layar (Fit Screen)"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          <span className="text-xs text-stone-600 font-semibold px-2 py-1 bg-stone-50 rounded-lg border border-stone-200">
            {Math.round(zoomLevel * 100)}%
          </span>

          {/* Canvas Height Mode Toggle */}
          <button
            onClick={() => {
              setCanvasHeightMode((prev) => (prev === 'standard' ? 'tall' : 'standard'));
            }}
            className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium cursor-pointer transition-colors hidden sm:flex items-center gap-1"
            title={
              canvasHeightMode === 'standard'
                ? 'Mode Kanvas Ekstra Luas (Tinggi tambahan)'
                : 'Mode Kanvas Standar (Proporsional terhadap layar)'
            }
          >
            <span>{canvasHeightMode === 'standard' ? 'Tinggi Ekstra' : 'Tinggi Standar'}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 ${
              isFullscreen
                ? 'bg-emerald-900 text-white shadow-xs'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
            title={isFullscreen ? 'Keluar Layar Penuh' : 'Mode Layar Penuh (Fullscreen)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Keluar' : 'Layar Penuh'}</span>
          </button>

          {/* Cetak & Unduh Silsilah (PDF & PNG) Berbingkai Vintage */}
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold cursor-pointer transition-all shadow-xs flex items-center gap-1.5 hover:shadow-md"
            title="Cetak Silsilah Jadi PDF & PNG Berbingkai Vintage"
          >
            <Printer className="w-4 h-4 text-amber-200" />
            <span className="font-serif font-bold tracking-wide">Cetak Silsilah (PDF / PNG)</span>
          </button>
        </div>
      </div>

      {/* Main Interactive D3 SVG Viewport */}
      <div
        ref={containerRef}
        className="flex-1 w-full relative overflow-hidden bg-stone-100/70"
      >
        {(!layoutData || layoutData.nodes.length === 0) ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-stone-500">
            <Users className="w-12 h-12 text-stone-300 mb-3" />
            <h3 className="text-base font-semibold text-stone-800">
              Belum Ada Data Silsilah untuk Bagan D3
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mt-1">
              Tambahkan data anggota keluarga di Panel Admin atau muat data awal Bani Nali.
            </p>
          </div>
        ) : (
          <svg
            ref={svgRef}
            className="w-full h-full cursor-grab active:cursor-grabbing select-none block"
            style={{ width: '100%', height: '100%' }}
          >
            {/* SVG Background Pattern */}
            <defs>
              <pattern
                id="d3-dot-grid"
                x="0"
                y="0"
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="2" cy="2" r="1" fill="#cbd5e1" opacity="0.4" />
              </pattern>
            </defs>

            <rect width="100%" height="100%" fill="url(#d3-dot-grid)" />

            {/* Transform Group controlled by d3.zoom */}
            <g ref={gRef}>
              {/* Connector Links */}
              <g className="d3-links">
                {layoutData.links.map((link) => (
                  <path
                    key={link.id}
                    d={getLinkPath(link)}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeLinecap="round"
                    className="transition-all duration-300 hover:stroke-emerald-700 hover:stroke-[3px]"
                  />
                ))}
              </g>

              {/* Hierarchy Nodes */}
              <g className="d3-nodes">
                {layoutData.nodes.map((node) => {
                  const data = node.data;
                  const isCollapsed = collapsedMap[node.id];
                  const hasChildren = node.totalChildrenCount > 0;
                  const spouses = data.spouses;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      className="d3-node-group"
                    >
                      {/* ForeignObject container allowing HTML + Tailwind card layout */}
                      <foreignObject
                        x={-node.width / 2}
                        y={0}
                        width={node.width}
                        height={node.height + 40}
                        className="overflow-visible"
                      >
                        <div className="w-full h-full flex flex-col items-center">
                          {/* Case 1: Exactly 2 Spouses (Spouse 1 - Center Member - Spouse 2) */}
                          {spouses.length === 2 ? (
                            <div className="relative pt-6 pb-2 px-3 rounded-2xl bg-stone-50/90 border border-stone-300/80 shadow-xs flex flex-col items-center">
                              {/* Header Label Pill */}
                              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-100 text-amber-950 border border-amber-300 px-3 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1.5 shadow-xs whitespace-nowrap z-10">
                                <Heart className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                                <span className="text-amber-900">2 Pasangan Sah</span>
                              </div>

                              {/* Row: Spouse 1 - Bridge - Center Member - Bridge - Spouse 2 */}
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Spouse 1 */}
                                <div className="relative">
                                  {renderCard(spouses[0], {
                                    isSpouse: true,
                                    spouseLabel: `${
                                      isFemale(spouses[0].gender) ? 'Istri' : 'Suami'
                                    } ke-1 · Pernikahan Pertama`,
                                  })}
                                </div>

                                {/* Bridge #1 */}
                                <div className="flex flex-col items-center justify-center px-0.5 shrink-0 relative">
                                  <div className="w-6 h-0.5 bg-amber-400" />
                                  <div
                                    className="flex items-center gap-0.5 text-[8.5px] font-bold text-amber-900 bg-amber-100 rounded-full px-1.5 py-0.5 border border-amber-300 shadow-2xs -my-2.5 z-10 whitespace-nowrap"
                                    title="Pernikahan Pertama"
                                  >
                                    <Heart className="w-2 h-2 fill-amber-500 text-amber-600" />
                                    <span>#1</span>
                                  </div>
                                </div>

                                {/* Center Primary Member */}
                                <div className="relative">
                                  {renderCard(data.member, {
                                    isCenterPrimary: true,
                                  })}
                                </div>

                                {/* Bridge #2 */}
                                <div className="flex flex-col items-center justify-center px-0.5 shrink-0 relative">
                                  <div className="w-6 h-0.5 bg-amber-400" />
                                  <div
                                    className="flex items-center gap-0.5 text-[8.5px] font-bold text-amber-900 bg-amber-100 rounded-full px-1.5 py-0.5 border border-amber-300 shadow-2xs -my-2.5 z-10 whitespace-nowrap"
                                    title="Pernikahan Kedua"
                                  >
                                    <Heart className="w-2 h-2 fill-amber-500 text-amber-600" />
                                    <span>#2</span>
                                  </div>
                                </div>

                                {/* Spouse 2 */}
                                <div className="relative">
                                  {renderCard(spouses[1], {
                                    isSpouse: true,
                                    spouseLabel: `${
                                      isFemale(spouses[1].gender) ? 'Istri' : 'Suami'
                                    } ke-2 · Pernikahan Kedua`,
                                  })}
                                </div>
                              </div>

                              {/* Collapse/Expand Child Count Button */}
                              {hasChildren && (
                                <button
                                  onClick={(e) => toggleCollapse(node.id, e)}
                                  className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-20 px-3 py-0.5 rounded-full bg-emerald-900 text-white flex items-center gap-1 text-[9.5px] font-semibold hover:bg-emerald-950 shadow-md border-2 border-white cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
                                  title={
                                    isCollapsed
                                      ? `Buka cabang (${node.totalChildrenCount} anak)`
                                      : 'Tutup cabang anak'
                                  }
                                >
                                  {isCollapsed ? (
                                    <ChevronRight className="w-3 h-3" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3" />
                                  )}
                                  <span>
                                    {isCollapsed
                                      ? `Buka (${node.totalChildrenCount} Anak)`
                                      : `${node.totalChildrenCount} Anak`}
                                  </span>
                                </button>
                              )}
                            </div>
                          ) : spouses.length === 1 ? (
                            /* Case 2: 1 Spouse (Member & Spouse) */
                            <div className="relative pt-6 pb-2 px-3 rounded-2xl bg-stone-50/70 border border-stone-300/70 shadow-xs flex flex-col items-center">
                              {/* Header Label Pill */}
                              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-50 text-amber-900 border border-amber-200 px-3 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1.5 shadow-xs whitespace-nowrap z-10">
                                <Heart className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                                <span>Pasangan Sah: Suami & Istri</span>
                              </div>

                              <div className="flex items-center justify-center gap-1.5">
                                {/* Primary Member */}
                                <div className="relative">{renderCard(data.member)}</div>

                                {/* Bridge */}
                                <div className="flex flex-col items-center justify-center px-0.5 shrink-0 relative">
                                  <div className="w-6 h-0.5 bg-amber-400" />
                                  <div
                                    className="flex items-center gap-0.5 text-[8.5px] font-bold text-amber-900 bg-amber-100 rounded-full px-1.5 py-0.5 border border-amber-300 shadow-2xs -my-2.5 z-10 whitespace-nowrap"
                                    title="Pasangan Sah"
                                  >
                                    <Heart className="w-2 h-2 fill-amber-500 text-amber-600" />
                                    <span>Pasangan</span>
                                  </div>
                                </div>

                                {/* Spouse */}
                                <div className="relative">
                                  {renderCard(spouses[0], {
                                    isSpouse: true,
                                    spouseLabel: `${
                                      isFemale(spouses[0].gender) ? 'Istri' : 'Suami'
                                    }`,
                                  })}
                                </div>
                              </div>

                              {/* Collapse/Expand Child Count Button */}
                              {hasChildren && (
                                <button
                                  onClick={(e) => toggleCollapse(node.id, e)}
                                  className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-20 px-3 py-0.5 rounded-full bg-emerald-900 text-white flex items-center gap-1 text-[9.5px] font-semibold hover:bg-emerald-950 shadow-md border-2 border-white cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
                                  title={
                                    isCollapsed
                                      ? `Buka cabang (${node.totalChildrenCount} anak)`
                                      : 'Tutup cabang anak'
                                  }
                                >
                                  {isCollapsed ? (
                                    <ChevronRight className="w-3 h-3" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3" />
                                  )}
                                  <span>
                                    {isCollapsed
                                      ? `Buka (${node.totalChildrenCount} Anak)`
                                      : `${node.totalChildrenCount} Anak`}
                                  </span>
                                </button>
                              )}
                            </div>
                          ) : (
                            /* Case 3: Single Member or >2 Spouses */
                            <div className="relative p-1.5 rounded-2xl bg-stone-50/50 border border-stone-200 shadow-xs flex flex-col items-center">
                              {renderCard(data.member)}

                              {/* Collapse/Expand Child Count Button */}
                              {hasChildren && (
                                <button
                                  onClick={(e) => toggleCollapse(node.id, e)}
                                  className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-20 px-3 py-0.5 rounded-full bg-emerald-900 text-white flex items-center gap-1 text-[9.5px] font-semibold hover:bg-emerald-950 shadow-md border-2 border-white cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
                                  title={
                                    isCollapsed
                                      ? `Buka cabang (${node.totalChildrenCount} anak)`
                                      : 'Tutup cabang anak'
                                  }
                                >
                                  {isCollapsed ? (
                                    <ChevronRight className="w-3 h-3" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3" />
                                  )}
                                  <span>
                                    {isCollapsed
                                      ? `Buka (${node.totalChildrenCount} Anak)`
                                      : `${node.totalChildrenCount} Anak`}
                                  </span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        )}

        {/* Legend Overlay at Bottom-Left */}
        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-stone-200 text-[11px] text-stone-600 shadow-sm flex flex-wrap items-center gap-3 pointer-events-auto z-10">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-700" />
            <span className="font-semibold text-stone-700">L (Laki-laki)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
            <span className="font-semibold text-stone-700">P (Perempuan)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Heart className="w-3 h-3 text-amber-500 fill-amber-500" />
            <span className="font-semibold text-stone-700">2 Pasangan Sah</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-stone-300" />
            <span>Almarhum (Alm.)</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
            <Sparkles className="w-3 h-3" />
            <span>D3 Tree Layout Hierarkis</span>
          </div>
        </div>
      </div>

      {/* Modal Cetak Silsilah Jadi PDF dan PNG Berbingkai Vintage */}
      <PrintExportFamilyTreeModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        members={members}
      />
    </div>
  );
};
