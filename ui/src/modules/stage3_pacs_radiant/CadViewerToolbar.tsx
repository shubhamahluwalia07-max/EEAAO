import React, { useState, useRef, useEffect } from 'react';
import {
  ToolIconButton,
  IconClose,
  IconRotate90,
  IconFlipHorizontal,
  IconFlipVertical,
  IconInvertLut,
  IconResetView,
  IconCinePlay,
  IconCinePause,
  IconSlabMode,
  IconPresets,
  IconThreshold,
  IconRegionGrow,
  IconSmartBrush,
  IconLassoErase,
  IconBoneAutoSegment,
  IconSplitMask,
  IconEditMask,
  IconSmooth,
  IconReduce,
  IconWrap,
  IconExportStl,
  IconSendToDesign,
  IconBuild3DSurface,
  IconFullscreen,
  IconExitFullscreen,
  IconThemeToggle,
  IconCollapseHeader,
  IconChevronDown,
  IconChevronRight,
  IconSeriesSelector,
  IconStudyBrowser,
} from './Icons';
import { ToolMode, SlabMode, SegmentToolMode, SeriesCard } from './types';

interface CadViewerToolbarProps {
  series: SeriesCard;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  // Navigation & Windowing
  activeTool: ToolMode;
  onSelectTool: (tool: ToolMode) => void;
  onChangeWindow: (center: number, width: number) => void;
  slabMode: SlabMode;
  onChangeSlabMode: (mode: SlabMode) => void;
  slabThicknessMm: number;
  onChangeSlabThickness: (val: number) => void;
  onResetView: () => void;
  // Segmentation Mode
  isSegmentMode: boolean;
  onToggleSegmentMode: () => void;
  activeSegmentTool: SegmentToolMode;
  onSelectSegmentTool: (tool: SegmentToolMode) => void;
  onOpenCtBoneModal?: () => void;
  // Mask to 3D Pipeline actions
  onBuild3DSurface: () => void;
  onApplyTaubinSmooth?: (iterations: number, factor: number) => void;
  onApplyQemReduce?: (percent: number) => void;
  onApplyShrinkWrap?: (detailSizeMm: number, gapOffsetMm: number) => void;
  meshTriangleCount?: number;
  // Dual Export
  onExportStl: () => void;
  onSendToDesign?: () => void;
  // Series / Study actions
  onOpenSeriesModal?: () => void;
  onBackToSeries?: () => void;
  // Global actions
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const CadViewerToolbar: React.FC<CadViewerToolbarProps> = ({
  series,
  isCollapsed,
  onToggleCollapse,
  activeTool,
  onSelectTool,
  onChangeWindow,
  slabMode,
  onChangeSlabMode,
  slabThicknessMm,
  onChangeSlabThickness,
  onResetView,
  isSegmentMode,
  onToggleSegmentMode,
  activeSegmentTool,
  onSelectSegmentTool,
  onOpenCtBoneModal,
  onBuild3DSurface,
  onApplyTaubinSmooth,
  onApplyQemReduce,
  onApplyShrinkWrap,
  meshTriangleCount = 0,
  onExportStl,
  onSendToDesign,
  onOpenSeriesModal,
  onBackToSeries,
  theme,
  onToggleTheme,
  isFullscreen,
  onToggleFullscreen,
}) => {
  // Three clean top dropdown states: Segment, Mask to 3D, Export
  const [isSegMenuOpen, setIsSegMenuOpen] = useState(false);
  const [isMaskTo3DMenuOpen, setIsMaskTo3DMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // Sub-popovers for Mask to 3D parameters
  const [active3DPopover, setActive3DPopover] = useState<'smooth' | 'reduce' | 'wrap' | null>(null);

  // Smooth parameters
  const [smoothIterations, setSmoothIterations] = useState<number>(8);
  const [smoothFactor, setSmoothFactor] = useState<number>(1.0);

  // Reduce parameters
  const [reducePercentage, setReducePercentage] = useState<number>(50);

  // Wrap parameters
  const [wrapDetailMm, setWrapDetailMm] = useState<number>(1.0);
  const [wrapGapOffsetMm, setWrapGapOffsetMm] = useState<number>(0.5);

  const segMenuRef = useRef<HTMLDivElement>(null);
  const maskTo3DMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (segMenuRef.current && !segMenuRef.current.contains(target)) {
        setIsSegMenuOpen(false);
      }
      if (maskTo3DMenuRef.current && !maskTo3DMenuRef.current.contains(target)) {
        setIsMaskTo3DMenuOpen(false);
        setActive3DPopover(null);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full z-40 select-none font-sans shrink-0">
      {/* Top Single Studio CAD Toolbar Container */}
      <div
        className={`w-full bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-[#1E293B] shadow-xs px-3 transition-all duration-200 flex items-center justify-between ${
          isCollapsed ? 'h-0 max-h-0 py-0 overflow-hidden border-b-0 opacity-0 pointer-events-none' : 'h-12'
        }`}
      >
        {/* Left Side: Series & Study Switcher + Series Metadata Readout */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenSeriesModal && (
            <ToolIconButton
              id="cad-series-selector-btn"
              title="Series Selector"
              shortcut="M"
              onClick={onOpenSeriesModal}
              tooltipSide="bottom"
            >
              <IconSeriesSelector size={18} />
            </ToolIconButton>
          )}

          {onBackToSeries && (
            <ToolIconButton
              id="cad-study-browser-btn"
              title="Study Browser"
              onClick={onBackToSeries}
              tooltipSide="bottom"
            >
              <IconStudyBrowser size={18} />
            </ToolIconButton>
          )}

          <div className="h-5 w-[1px] bg-slate-200 dark:bg-[#1E293B] mx-1" />

          {/* Series Badge & Readout */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white bg-[#0284C7]">
              {series.modality}
            </span>
            <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[140px] md:max-w-[200px]">
              {series.series_description || `Series #${series.series_number}`}
            </span>
          </div>
        </div>

        {/* Center: Three Clean Dropdown Menu Triggers (Segment, Mask to 3D, Export) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* ======================================================== */}
          {/* TRIGGER 1: SEGMENT DROPDOWN                              */}
          {/* ======================================================== */}
          <div ref={segMenuRef} className="relative">
            <button
              id="menu-trigger-segment"
              type="button"
              onClick={() => {
                setIsSegMenuOpen((v) => !v);
                setIsMaskTo3DMenuOpen(false);
                setIsExportMenuOpen(false);
                setActive3DPopover(null);
              }}
              className={`tactile-rubber h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all ${
                isSegMenuOpen
                  ? 'bg-[#0284C7] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>Segment</span>
              <IconChevronDown
                size={12}
                className={`transition-transform duration-150 ${isSegMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Sleek Vertical Dropdown Menu (width 250px, dark slate #111827 / white #FFFFFF, 1px border, rounded-xl, shadow-2xl) */}
            {isSegMenuOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-[250px] bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                {/* Row 1: Threshold */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSegMenuOpen(false);
                    if (!isSegmentMode) onToggleSegmentMode();
                    onSelectSegmentTool('threshold');
                  }}
                  className="w-full px-3 py-2 rounded-lg flex items-center justify-between text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <IconThreshold size={18} className="text-[#0284C7]" />
                    <span>Threshold</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-sans shadow-xs">
                    T
                  </span>
                </button>

                {/* Row 2: Region grow (shortcut G) */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSegMenuOpen(false);
                    if (!isSegmentMode) onToggleSegmentMode();
                    onSelectSegmentTool('region_grow');
                  }}
                  className="w-full px-3 py-2 rounded-lg flex items-center justify-between text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <IconRegionGrow size={18} className="text-slate-500 dark:text-slate-400 group-hover:text-[#0284C7]" />
                    <span>Region grow</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-sans shadow-xs">
                    G
                  </span>
                </button>

                {/* Row 3: Split mask */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSegMenuOpen(false);
                    if (!isSegmentMode) onToggleSegmentMode();
                    onSelectSegmentTool('split_mask');
                  }}
                  className="w-full px-3 py-2 rounded-lg flex items-center justify-between text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <IconSplitMask size={18} className="text-slate-500 dark:text-slate-400 group-hover:text-[#0284C7]" />
                    <span>Split mask</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-sans shadow-xs">
                    S
                  </span>
                </button>

                {/* Row 4: Edit mask */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSegMenuOpen(false);
                    if (!isSegmentMode) onToggleSegmentMode();
                    onSelectSegmentTool('edit_mask');
                  }}
                  className="w-full px-3 py-2 rounded-lg flex items-center justify-between text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <IconEditMask size={18} className="text-slate-500 dark:text-slate-400 group-hover:text-[#0284C7]" />
                    <span>Edit mask</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-sans shadow-xs">
                    E
                  </span>
                </button>

                <div className="h-[1px] bg-slate-200 dark:bg-slate-800 my-1 mx-2" />

                {/* Row 5: Advanced Segment */}
                <div className="flex flex-col">
                  <div className="w-full px-3 py-1.5 rounded-lg flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white">
                    <div className="flex items-center gap-2.5">
                      <IconBoneAutoSegment size={18} className="text-[#0284C7]" />
                      <span>Advanced Segment</span>
                    </div>
                  </div>

                  {/* Sub-buttons: Seed Segment and AI Segment */}
                  <div className="pl-6 pr-1 pb-1 flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSegMenuOpen(false);
                        if (!isSegmentMode) onToggleSegmentMode();
                        onSelectSegmentTool('seed_segment');
                      }}
                      className="w-full px-2.5 py-1.5 rounded-md flex items-center justify-between text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-800 hover:text-[#0284C7] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0284C7]" />
                        <span>Seed Segment</span>
                      </div>
                      <span className="text-[10px] text-slate-400 group-hover:text-[#0284C7]">Active</span>
                    </button>

                    <button
                      type="button"
                      disabled
                      className="w-full px-2.5 py-1.5 rounded-md flex items-center justify-between text-xs font-medium text-slate-400 dark:text-slate-500 opacity-45 cursor-not-allowed select-none"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        <span>AI Segment</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* TRIGGER 2: MASK TO 3D DROPDOWN                           */}
          {/* ======================================================== */}
          <div ref={maskTo3DMenuRef} className="relative">
            <button
              id="menu-trigger-mask-to-3d"
              type="button"
              onClick={() => {
                setIsMaskTo3DMenuOpen((v) => !v);
                setIsSegMenuOpen(false);
                setIsExportMenuOpen(false);
                setActive3DPopover(null);
              }}
              className={`tactile-rubber h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all ${
                isMaskTo3DMenuOpen
                  ? 'bg-[#0284C7] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>Mask to 3D</span>
              <IconChevronDown
                size={12}
                className={`transition-transform duration-150 ${isMaskTo3DMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Mask to 3D Vertical Dropdown Menu (width 250px) */}
            {isMaskTo3DMenuOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-[250px] bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                {/* Build 3D from mask */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMaskTo3DMenuOpen(false);
                    onBuild3DSurface();
                  }}
                  className="w-full px-3 py-2 rounded-lg flex items-center justify-between text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <IconBuild3DSurface size={18} className="text-[#0284C7]" />
                    <span>Build 3D from mask</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-sans shadow-xs">
                    B
                  </span>
                </button>

                {/* Calculate 3D Object */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMaskTo3DMenuOpen(false);
                    if (!isSegmentMode) onToggleSegmentMode();
                    onSelectSegmentTool('calculate_3d');
                  }}
                  className="w-full px-3 py-2 rounded-lg flex items-center justify-between text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <IconBuild3DSurface size={18} className="text-[#0284C7]" />
                    <span>Calculate 3D Object</span>
                  </div>
                </button>

                <div className="h-[1px] bg-slate-200 dark:bg-slate-800 my-1 mx-2" />

                {/* Pipeline Step 1: Smooth */}
                <button
                  type="button"
                  onClick={() => setActive3DPopover((c) => (c === 'smooth' ? null : 'smooth'))}
                  className={`w-full px-3 py-2 rounded-lg flex items-center justify-between text-xs font-medium transition-colors cursor-pointer group ${
                    active3DPopover === 'smooth'
                      ? 'bg-[#0284C7] text-white'
                      : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <IconSmooth size={18} className={active3DPopover === 'smooth' ? 'text-white' : 'text-[#0284C7]'} />
                    <span>Smooth</span>
                  </div>
                  <IconChevronRight size={14} className={active3DPopover === 'smooth' ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />
                </button>

                {/* Pipeline Step 2: Reduce */}
                <button
                  type="button"
                  onClick={() => setActive3DPopover((c) => (c === 'reduce' ? null : 'reduce'))}
                  className={`w-full px-3 py-2 rounded-lg flex items-center justify-between text-xs font-medium transition-colors cursor-pointer group ${
                    active3DPopover === 'reduce'
                      ? 'bg-[#0284C7] text-white'
                      : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <IconReduce size={18} className={active3DPopover === 'reduce' ? 'text-white' : 'text-[#0284C7]'} />
                    <span>Reduce</span>
                  </div>
                  <IconChevronRight size={14} className={active3DPopover === 'reduce' ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />
                </button>

                {/* Pipeline Step 3: Wrap */}
                <button
                  type="button"
                  onClick={() => setActive3DPopover((c) => (c === 'wrap' ? null : 'wrap'))}
                  className={`w-full px-3 py-2 rounded-lg flex items-center justify-between text-xs font-medium transition-colors cursor-pointer group ${
                    active3DPopover === 'wrap'
                      ? 'bg-[#0284C7] text-white'
                      : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <IconWrap size={18} className={active3DPopover === 'wrap' ? 'text-white' : 'text-[#0284C7]'} />
                    <span>Wrap</span>
                  </div>
                  <IconChevronRight size={14} className={active3DPopover === 'wrap' ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />
                </button>
              </div>
            )}

            {/* Sub-Popover for Smooth (Volume-preserving Taubin smoothing) */}
            {isMaskTo3DMenuOpen && active3DPopover === 'smooth' && (
              <div className="absolute left-[258px] top-12 w-[240px] bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-2xl p-3 z-50 flex flex-col gap-2.5 animate-in fade-in slide-in-from-left-1 duration-150">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Taubin Surface Smoothing
                </span>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Iterations:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{smoothIterations} passes</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={smoothIterations}
                    onChange={(e) => setSmoothIterations(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Smoothing factor:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{smoothFactor.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.0"
                    step="0.1"
                    value={smoothFactor}
                    onChange={(e) => setSmoothFactor(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onApplyTaubinSmooth?.(smoothIterations, smoothFactor);
                    setIsMaskTo3DMenuOpen(false);
                    setActive3DPopover(null);
                  }}
                  className="tactile-rubber w-full py-1.5 mt-1 rounded-lg text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 shadow-xs cursor-pointer"
                >
                  Apply smooth
                </button>
              </div>
            )}

            {/* Sub-Popover for Reduce (Quadric Error Metric decimation) */}
            {isMaskTo3DMenuOpen && active3DPopover === 'reduce' && (
              <div className="absolute left-[258px] top-20 w-[240px] bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-2xl p-3 z-50 flex flex-col gap-2.5 animate-in fade-in slide-in-from-left-1 duration-150">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  QEM Triangle Decimation
                </span>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Current triangles:</span>
                  <span className="font-semibold text-[#0284C7]">{meshTriangleCount.toLocaleString()}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Target reduction:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{reducePercentage}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="95"
                    step="5"
                    value={reducePercentage}
                    onChange={(e) => setReducePercentage(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onApplyQemReduce?.(reducePercentage);
                    setIsMaskTo3DMenuOpen(false);
                    setActive3DPopover(null);
                  }}
                  className="tactile-rubber w-full py-1.5 mt-1 rounded-lg text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 shadow-xs cursor-pointer"
                >
                  Apply reduce
                </button>
              </div>
            )}

            {/* Sub-Popover for Wrap (3D shrink-wrap manifold sealing) */}
            {isMaskTo3DMenuOpen && active3DPopover === 'wrap' && (
              <div className="absolute left-[258px] top-28 w-[240px] bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-2xl p-3 z-50 flex flex-col gap-2.5 animate-in fade-in slide-in-from-left-1 duration-150">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Shrink-Wrap Manifold Sealing
                </span>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Detail size:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{wrapDetailMm.toFixed(1)} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="4.0"
                    step="0.2"
                    value={wrapDetailMm}
                    onChange={(e) => setWrapDetailMm(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Gap bridging offset:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{wrapGapOffsetMm.toFixed(1)} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.1"
                    value={wrapGapOffsetMm}
                    onChange={(e) => setWrapGapOffsetMm(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onApplyShrinkWrap?.(wrapDetailMm, wrapGapOffsetMm);
                    setIsMaskTo3DMenuOpen(false);
                    setActive3DPopover(null);
                  }}
                  className="tactile-rubber w-full py-1.5 mt-1 rounded-lg text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 shadow-xs cursor-pointer"
                >
                  Apply wrap
                </button>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* TRIGGER 3: EXPORT DROPDOWN                               */}
          {/* ======================================================== */}
          <div ref={exportMenuRef} className="relative">
            <button
              id="menu-trigger-export"
              type="button"
              onClick={() => {
                setIsExportMenuOpen((v) => !v);
                setIsSegMenuOpen(false);
                setIsMaskTo3DMenuOpen(false);
                setActive3DPopover(null);
              }}
              className={`tactile-rubber h-8 px-3 rounded-lg flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all ${
                isExportMenuOpen
                  ? 'bg-[#0284C7] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>Export</span>
              <IconChevronDown
                size={12}
                className={`transition-transform duration-150 ${isExportMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Export Vertical Dropdown Menu (width 250px) */}
            {isExportMenuOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-[250px] bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                {/* STL Export */}
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    onExportStl();
                  }}
                  className="w-full px-3 py-2 rounded-lg flex items-center justify-between text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <IconExportStl size={18} className="text-[#0284C7]" />
                    <span>STL</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-sans shadow-xs">
                    Ctrl+E
                  </span>
                </button>

                {/* Send to Design Studio */}
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    onSendToDesign?.();
                  }}
                  className="w-full px-3 py-2 rounded-lg flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white hover:bg-sky-50 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <IconSendToDesign size={18} className="text-[#0284C7]" />
                    <span>Send to Design</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-100 dark:bg-sky-950 text-[#0284C7] border border-sky-300 dark:border-sky-800 font-sans shadow-xs">
                    D
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right side spacer (theme/fullscreen/collapse rendered cleanly in main top Flowbar) */}
        <div className="flex items-center gap-1.5 shrink-0" />
      </div>

      {/* When Top Toolbar is collapsed: Sleek mini toggle button at top center */}
      {isCollapsed && (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-30">
          <ToolIconButton
            id="expand-cad-toolbar-btn"
            title="Expand Toolbar"
            shortcut="["
            onClick={onToggleCollapse}
            tooltipSide="bottom"
            className="w-7 h-7 rounded-full shadow-sm"
          >
            <IconChevronDown size={14} />
          </ToolIconButton>
        </div>
      )}
    </div>
  );
};
