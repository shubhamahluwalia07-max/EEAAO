import React, { useState, useEffect } from 'react';
import {
  SegmentationMask,
  SegmentToolMode,
  Calculated3DObject,
  QualityPreset,
  SeedKind,
  SeedPointEntry,
  BoneSeedPoint,
} from './types';
import {
  ToolIconButton,
  IconPlus,
  IconClose,
  IconEye,
  IconEyeOff,
  IconTrash,
  IconSendToDesign,
  IconExportStl,
  IconBuild3DSurface,
  IconThreshold,
  IconRegionGrow,
  IconSplitMask,
  IconEditMask,
  IconSmartBrush,
  IconLassoErase,
  IconMorphology,
} from './Icons';
import { HuHistogramEditor } from './HuHistogramEditor';

interface SegmentationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  // Masks state
  masks: SegmentationMask[];
  activeMaskId: string;
  onSelectMask: (id: string) => void;
  onCreateMask: () => void;
  onDeleteMask: (id: string) => void;
  onUpdateMask: (id: string, updates: Partial<SegmentationMask>) => void;
  onToggleSelectMask: (id: string) => void;
  onToggleSelectAllMasks: () => void;
  onMergeSelectedMasks: () => void;
  onSubtractMasks: () => void;
  onDeleteSelectedMasks: () => void;
  onBuild3DSurface: () => void;
  // 3D Objects state
  objects?: Calculated3DObject[];
  activeObjectId?: string;
  onSelectObject?: (id: string) => void;
  onDeleteObject?: (id: string) => void;
  onUpdateObject?: (id: string, updates: Partial<Calculated3DObject>) => void;
  onCalculate3DObject?: (
    sourceMaskIds: string[],
    preset: QualityPreset,
    options: {
      smooth: boolean;
      smoothIters: number;
      reduce: boolean;
      reducePercent: number;
      wrap: boolean;
      wrapMm: number;
    }
  ) => void;
  onExportStl: () => void;
  onSendToDesign?: () => void;
  is3DSurfaceBuilt?: boolean;
  activeSegmentTool: SegmentToolMode;
  onSelectSegmentTool: (tool: SegmentToolMode) => void;
  // Seed Segment State
  seedMode?: SeedKind;
  onChangeSeedMode?: (mode: SeedKind) => void;
  seedPoints?: SeedPointEntry[];
  onDeleteSeedPoint?: (id: string) => void;
  onClearSeedPoints?: () => void;
  seedThresholdHu?: number;
  onChangeSeedThresholdHu?: (hu: number) => void;
  sensitivity?: number;
  onChangeSensitivity?: (s: number) => void;
  seedSegmentStep?: 1 | 2 | 3;
  onChangeSeedSegmentStep?: (step: 1 | 2 | 3) => void;
  seedGapClosingMm?: number;
  onChangeSeedGapClosingMm?: (val: number) => void;
  seedFillCavities?: boolean;
  onToggleSeedFillCavities?: () => void;
  onApplySeedSegmentToMask?: () => void;
  // Region Grow
  regionGrowSeedsCount?: number;
  onUndoLastRegionGrowSeed?: () => void;
  // Brush
  brushRadiusMm?: number;
  onChangeBrushRadius?: (r: number) => void;
  brushMode?: 'paint' | 'erase';
  onChangeBrushMode?: (m: 'paint' | 'erase') => void;
  brush3D?: boolean;
  onToggleBrush3D?: () => void;
  brushConstrained?: boolean;
  onToggleBrushConstrained?: () => void;
  constrainedMinHu?: number;
  onChangeConstrainedMinHu?: (v: number) => void;
  constrainedMaxHu?: number;
  onChangeConstrainedMaxHu?: (v: number) => void;
  // Lasso
  lassoThroughVolume?: boolean;
  onToggleLassoThroughVolume?: () => void;
  // Morphology
  morphologyRadiusMm?: number;
  onChangeMorphologyRadius?: (r: number) => void;
  onApplyMorphology?: (op: 'dilate' | 'erode' | 'close' | 'fill') => void;
  onKeepLargestIsland?: () => void;
  // Split Mask
  splitMode?: 'boneA' | 'boneB';
  onChangeSplitMode?: (mode: 'boneA' | 'boneB') => void;
  seedsBoneACount?: number;
  seedsBoneBCount?: number;
  onExecuteSplitMask?: () => void;
  onClearSplitSeeds?: () => void;
}

const COLOR_SWATCHES = [
  { color: '#06B6D4', rgb: [6, 182, 212] as [number, number, number] },
  { color: '#10B981', rgb: [16, 185, 129] as [number, number, number] },
  { color: '#8B5CF6', rgb: [139, 92, 246] as [number, number, number] },
  { color: '#F43F5E', rgb: [244, 63, 94] as [number, number, number] },
  { color: '#F59E0B', rgb: [245, 158, 11] as [number, number, number] },
  { color: '#3B82F6', rgb: [59, 130, 246] as [number, number, number] },
];

export const SegmentationDrawer: React.FC<SegmentationDrawerProps> = ({
  isOpen,
  onClose,
  masks,
  activeMaskId,
  onSelectMask,
  onCreateMask,
  onDeleteMask,
  onUpdateMask,
  onToggleSelectMask,
  onToggleSelectAllMasks,
  onMergeSelectedMasks,
  onSubtractMasks,
  onDeleteSelectedMasks,
  onBuild3DSurface,
  objects = [],
  activeObjectId,
  onSelectObject,
  onDeleteObject,
  onUpdateObject,
  onCalculate3DObject,
  onExportStl,
  onSendToDesign,
  is3DSurfaceBuilt,
  activeSegmentTool,
  onSelectSegmentTool,
  seedMode = 'need',
  onChangeSeedMode,
  seedPoints = [],
  onDeleteSeedPoint,
  onClearSeedPoints,
  seedThresholdHu = 150,
  onChangeSeedThresholdHu,
  sensitivity = 60,
  onChangeSensitivity,
  seedSegmentStep = 1,
  onChangeSeedSegmentStep,
  seedGapClosingMm = 1.0,
  onChangeSeedGapClosingMm,
  seedFillCavities = true,
  onToggleSeedFillCavities,
  onApplySeedSegmentToMask,
  regionGrowSeedsCount = 0,
  onUndoLastRegionGrowSeed,
  brushRadiusMm = 5.0,
  onChangeBrushRadius,
  brushMode = 'paint',
  onChangeBrushMode,
  brush3D = false,
  onToggleBrush3D,
  brushConstrained = false,
  onToggleBrushConstrained,
  constrainedMinHu = 200,
  onChangeConstrainedMinHu,
  constrainedMaxHu = 2000,
  onChangeConstrainedMaxHu,
  lassoThroughVolume = false,
  onToggleLassoThroughVolume,
  morphologyRadiusMm = 2.0,
  onChangeMorphologyRadius,
  onApplyMorphology,
  onKeepLargestIsland,
  splitMode = 'boneA',
  onChangeSplitMode,
  seedsBoneACount = 0,
  seedsBoneBCount = 0,
  onExecuteSplitMask,
  onClearSplitSeeds,
}) => {
  if (!isOpen) return null;

  // Top Zone Tab switcher: 'masks' | 'objects'
  const [topTab, setTopTab] = useState<'masks' | 'objects'>('masks');

  // Calculate 3D Object options state
  const [calcSourceMaskIds, setCalcSourceMaskIds] = useState<string[]>(() =>
    masks.filter((m) => m.selected).map((m) => m.id)
  );
  const [calcQualityPreset, setCalcQualityPreset] = useState<QualityPreset>('Medium');
  const [enableSmooth, setEnableSmooth] = useState<boolean>(true);
  const [smoothIters, setSmoothIters] = useState<number>(10);
  const [enableReduce, setEnableReduce] = useState<boolean>(true);
  const [reducePercent, setReducePercent] = useState<number>(50);
  const [enableWrap, setEnableWrap] = useState<boolean>(false);
  const [wrapMm, setWrapMm] = useState<number>(0.5);

  const activeMask = masks.find((m) => m.id === activeMaskId) || masks[0];
  const selectedCount = masks.filter((m) => m.selected).length;

  // Update calc source masks if mask selection changes
  useEffect(() => {
    if (activeMask) {
      setCalcSourceMaskIds((prev) => {
        if (prev.length === 0) return [activeMask.id];
        return prev;
      });
    }
  }, [activeMask?.id]);

  return (
    <aside className="w-[310px] max-w-[310px] h-full bg-[#F8FAFC] dark:bg-[#111827] border-l border-slate-200 dark:border-[#1E293B] flex flex-col shrink-0 select-none font-sans z-30 shadow-md text-slate-900 dark:text-slate-100">
      {/* ==================================================================== */}
      {/* TOP ZONE (42% Height): MASKS & OBJECTS TABBED MANAGER                */}
      {/* ==================================================================== */}
      <div className="h-[42%] flex flex-col border-b border-slate-200 dark:border-[#1E293B] overflow-hidden shrink-0">
        {/* Top Header Switcher: Masks (N) | Objects (M) */}
        <div className="h-10 px-3 bg-white dark:bg-[#182234] border-b border-slate-200 dark:border-[#1E293B] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTopTab('masks')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                topTab === 'masks'
                  ? 'bg-[#0284C7] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Masks ({masks.length})
            </button>
            <button
              type="button"
              onClick={() => setTopTab('objects')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                topTab === 'objects'
                  ? 'bg-[#0284C7] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Objects ({objects.length})
            </button>
          </div>

          <div className="flex items-center gap-1">
            {topTab === 'masks' && (
              <ToolIconButton
                id="drawer-add-mask-btn"
                title="Add Mask"
                onClick={onCreateMask}
                tooltipSide="bottom"
                className="w-6 h-6 rounded-md bg-[#0284C7] text-white hover:bg-sky-700 shadow-xs"
              >
                <IconPlus size={13} />
              </ToolIconButton>
            )}
            <ToolIconButton
              id="drawer-close-btn"
              title="Close Drawer"
              onClick={onClose}
              tooltipSide="bottom"
              className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            >
              <IconClose size={13} />
            </ToolIconButton>
          </div>
        </div>

        {/* ---------------- MASKS TAB CONTENT ---------------- */}
        {topTab === 'masks' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Batch Selection Row */}
            <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#141C2E] border-b border-slate-200 dark:border-[#1E293B] flex items-center justify-between text-[11px] shrink-0">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400 font-medium">
                <input
                  type="checkbox"
                  checked={masks.length > 0 && masks.every((m) => m.selected)}
                  onChange={onToggleSelectAllMasks}
                  className="w-3.5 h-3.5 rounded text-[#0284C7] accent-[#0284C7]"
                />
                <span>Select All</span>
              </label>

              {selectedCount > 0 ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={selectedCount < 2}
                    onClick={onMergeSelectedMasks}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  >
                    Merge
                  </button>
                  <button
                    type="button"
                    disabled={selectedCount < 2}
                    onClick={onSubtractMasks}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white dark:bg-slate-800 disabled:opacity-40 cursor-pointer text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  >
                    Sub
                  </button>
                  <button
                    type="button"
                    onClick={onDeleteSelectedMasks}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white dark:bg-slate-800 text-red-600 hover:text-red-700 cursor-pointer border border-slate-200 dark:border-slate-700"
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <span className="text-slate-400 text-[10px]">{masks.length} layers</span>
              )}
            </div>

            {/* Scrollable Mask List */}
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
              {masks.map((m) => {
                const isActive = m.id === activeMaskId;

                return (
                  <div
                    key={m.id}
                    onClick={() => onSelectMask(m.id)}
                    className={`p-1.5 rounded-lg border flex items-center justify-between gap-1.5 cursor-pointer transition-all ${
                      isActive
                        ? 'bg-white dark:bg-[#182234] border-[#0284C7] shadow-xs'
                        : 'bg-white/60 dark:bg-[#182234]/60 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    {/* Left: Checkbox + Swatch + Name */}
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={!!m.selected}
                        onChange={(e) => {
                          e.stopPropagation();
                          onToggleSelectMask(m.id);
                        }}
                        className="w-3.5 h-3.5 rounded text-[#0284C7] accent-[#0284C7] shrink-0"
                      />

                      <div
                        style={{ backgroundColor: m.color }}
                        className="w-3 h-3 rounded-full shrink-0 border border-black/20"
                      />

                      <div className="flex flex-col min-w-0 flex-1">
                        <span
                          className={`text-xs truncate font-medium ${
                            isActive ? 'font-semibold text-[#0284C7]' : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {m.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">
                          {m.minHu}..{m.maxHu} HU
                        </span>
                      </div>
                    </div>

                    {/* Right: 2D Visibility + Delete */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        title={m.visible ? 'Hide on 2D Slices' : 'Show on 2D Slices'}
                        onClick={() => onUpdateMask(m.id, { visible: !m.visible })}
                        className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors ${
                          m.visible
                            ? 'text-[#0284C7] bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100'
                            : 'text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200'
                        }`}
                      >
                        {m.visible ? <IconEye size={13} /> : <IconEyeOff size={13} />}
                      </button>

                      <button
                        type="button"
                        title="Delete Mask"
                        onClick={() => onDeleteMask(m.id)}
                        className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer transition-colors"
                      >
                        <IconTrash size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mask Actions Footer */}
            <div className="p-2 border-t border-slate-200 dark:border-[#1E293B] bg-white dark:bg-[#182234] flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onBuild3DSurface}
                className="tactile-rubber flex-1 h-7 rounded-lg text-xs font-semibold bg-[#0284C7] hover:bg-sky-700 text-white flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              >
                <IconBuild3DSurface size={13} />
                <span>Build 3D from mask</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectSegmentTool('calculate_3d')}
                className="tactile-rubber px-2.5 h-7 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                Settings
              </button>
            </div>
          </div>
        ) : (
          /* ---------------- OBJECTS TAB CONTENT ---------------- */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Scrollable Objects List */}
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
              {objects.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-slate-400">
                  <IconBuild3DSurface size={24} className="opacity-40 mb-2" />
                  <span className="text-xs font-medium">No 3D objects calculated</span>
                  <span className="text-[10px] text-slate-500 mt-1">
                    Select a mask and click &quot;Build 3D from mask&quot; or &quot;Calculate 3D Object&quot;
                  </span>
                </div>
              ) : (
                objects.map((obj) => {
                  const isActive = obj.id === activeObjectId;

                  return (
                    <div
                      key={obj.id}
                      onClick={() => onSelectObject?.(obj.id)}
                      className={`p-2 rounded-lg border flex flex-col gap-1.5 cursor-pointer transition-all ${
                        isActive
                          ? 'bg-white dark:bg-[#182234] border-[#0284C7] shadow-xs'
                          : 'bg-white/60 dark:bg-[#182234]/60 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      {/* Row 1: Swatch + Name + 3D Visibility + Delete */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div
                            style={{ backgroundColor: obj.color }}
                            className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/20"
                          />
                          <span
                            className={`text-xs truncate font-medium ${
                              isActive ? 'font-semibold text-[#0284C7]' : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {obj.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            title={obj.visible ? 'Hide in 3D Viewport' : 'Show in 3D Viewport'}
                            onClick={() => onUpdateObject?.(obj.id, { visible: !obj.visible })}
                            className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors ${
                              obj.visible
                                ? 'text-[#0284C7] bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100'
                                : 'text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200'
                            }`}
                          >
                            {obj.visible ? <IconEye size={13} /> : <IconEyeOff size={13} />}
                          </button>

                          <button
                            type="button"
                            title="Delete 3D Object"
                            onClick={() => onDeleteObject?.(obj.id)}
                            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer transition-colors"
                          >
                            <IconTrash size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Row 2: Triangle Count Badge + 2D Contour Toggle */}
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50 px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                          {(obj.triangleCount / 1000).toFixed(1)}k tris ({obj.qualityPreset})
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateObject?.(obj.id, { showContour2D: !obj.showContour2D });
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                            obj.showContour2D
                              ? 'bg-[#0284C7] text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}
                        >
                          2D Contour
                        </button>
                      </div>

                      {/* Row 3: Opacity Slider */}
                      <div className="flex items-center gap-2 pt-0.5" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[10px] text-slate-400">Opacity</span>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={obj.opacity}
                          onChange={(e) =>
                            onUpdateObject?.(obj.id, { opacity: parseFloat(e.target.value) })
                          }
                          className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                        />
                        <span className="text-[10px] font-medium text-slate-500 w-7 text-right">
                          {Math.round(obj.opacity * 100)}%
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Objects Export Actions Footer */}
            <div className="p-2 border-t border-slate-200 dark:border-[#1E293B] bg-white dark:bg-[#182234] flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onExportStl}
                className="tactile-rubber flex-1 h-7 rounded-lg text-xs font-semibold bg-[#0284C7] hover:bg-sky-700 text-white flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              >
                <IconExportStl size={13} />
                <span>Export STL</span>
              </button>

              {onSendToDesign && (
                <button
                  type="button"
                  onClick={onSendToDesign}
                  className="tactile-rubber flex-1 h-7 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                >
                  <IconSendToDesign size={13} />
                  <span>Send to Design</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* BOTTOM ZONE (58% Height): ACTIVE TOOL OPERATIONS PANEL (SCROLLABLE)  */}
      {/* ==================================================================== */}
      <div className="h-[58%] flex-1 overflow-y-auto p-3 flex flex-col gap-3 bg-white/40 dark:bg-[#0F172A]/40">
        {/* Tool Title Bar */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0284C7]" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize">
              {activeSegmentTool.replace('_', ' ')}
            </span>
          </div>

          <span className="text-[10px] text-slate-400 font-sans">Docked Tool Settings</span>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* TOOL 1: SEED SEGMENT (3 COMPACT TABS: 1. Selection, 2. Threshold, 3. Finishing) */}
        {/* ------------------------------------------------------------------ */}
        {activeSegmentTool === 'seed_segment' && (
          <div className="flex flex-col gap-2.5">
            {/* 3 Compact Step Tabs */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg">
              {[
                { step: 1 as const, label: '1. Selection' },
                { step: 2 as const, label: '2. Threshold' },
                { step: 3 as const, label: '3. Finishing' },
              ].map((tab) => {
                const isActive = seedSegmentStep === tab.step;
                return (
                  <button
                    key={tab.step}
                    type="button"
                    onClick={() => onChangeSeedSegmentStep?.(tab.step)}
                    className={`flex-1 py-1 text-[11px] font-semibold rounded-md cursor-pointer transition-all ${
                      isActive
                        ? 'bg-white dark:bg-[#182234] text-[#0284C7] shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Step 1: Selection */}
            {seedSegmentStep === 1 && (
              <div className="flex flex-col gap-2.5">
                {/* Seed Point Selection Table */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-[#111827]">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 dark:bg-[#182234] text-slate-500 uppercase text-[9px] font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-1 px-2">NAME</th>
                        <th className="py-1 px-2">HU</th>
                        <th className="py-1 px-2">COORDS</th>
                        <th className="py-1 px-1 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {seedPoints.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-3 px-2 text-center text-slate-400 text-[10px]">
                            Click on DICOM slice to plant seeds
                          </td>
                        </tr>
                      ) : (
                        seedPoints.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-1 px-2 font-semibold">
                              <span
                                style={{
                                  color: s.kind === 'need' ? '#22C55E' : '#EF4444',
                                }}
                              >
                                {s.name}
                              </span>
                            </td>
                            <td className="py-1 px-2 text-slate-600 dark:text-slate-300">{s.hu}</td>
                            <td className="py-1 px-2 text-[10px] text-slate-400 font-mono">
                              {s.coordsMm[0].toFixed(0)}, {s.coordsMm[1].toFixed(0)}
                            </td>
                            <td className="py-1 px-1 text-right">
                              <button
                                type="button"
                                onClick={() => onDeleteSeedPoint?.(s.id)}
                                className="text-slate-400 hover:text-red-500 p-0.5 cursor-pointer"
                              >
                                <IconClose size={11} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mode Toggle Buttons: Need Seed (Green #22C55E) vs Not Need (Red #EF4444) */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChangeSeedMode?.('need')}
                    className={`tactile-rubber flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all border ${
                      seedMode === 'need'
                        ? 'border-[#22C55E] bg-[#22C55E]/10 text-[#22C55E] shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
                    <span style={{ color: '#22C55E' }}>Need Seed</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeSeedMode?.('not_need')}
                    className={`tactile-rubber flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all border ${
                      seedMode === 'not_need'
                        ? 'border-[#EF4444] bg-[#EF4444]/10 text-[#EF4444] shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                    <span style={{ color: '#EF4444' }}>Not Need</span>
                  </button>

                  {seedPoints.length > 0 && (
                    <button
                      type="button"
                      title="Clear All Seeds"
                      onClick={onClearSeedPoints}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 cursor-pointer"
                    >
                      <IconClose size={13} />
                    </button>
                  )}
                </div>

                {/* Sensitivity Slider (0 to 100) */}
                <div className="flex flex-col gap-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Sensitivity:</span>
                    <span className="font-bold text-[#0284C7]">{sensitivity} / 100</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sensitivity}
                    onChange={(e) => onChangeSensitivity?.(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                  />
                  <span className="text-[9px] text-slate-400 leading-tight">
                    Low stops at cortical bone; high expands across joint bridges
                  </span>
                </div>

                {/* Seed Threshold HU Slider */}
                <div className="flex flex-col gap-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Seed Threshold:</span>
                    <span className="font-bold text-[#0284C7]">{seedThresholdHu} HU</span>
                  </div>
                  <input
                    type="range"
                    min="-200"
                    max="1000"
                    step="10"
                    value={seedThresholdHu}
                    onChange={(e) => onChangeSeedThresholdHu?.(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Threshold (HuHistogramEditor) */}
            {seedSegmentStep === 2 && activeMask && (
              <div className="flex flex-col gap-2">
                <HuHistogramEditor
                  minHu={activeMask.minHu}
                  maxHu={activeMask.maxHu}
                  onChange={(min, max) => onUpdateMask(activeMask.id, { minHu: min, maxHu: max })}
                  applyToAllMasks={false}
                  showPresets={true}
                />
              </div>
            )}

            {/* Step 3: Finishing */}
            {seedSegmentStep === 3 && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Gap closing distance:</span>
                    <span className="font-bold text-[#0284C7]">{seedGapClosingMm.toFixed(1)} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5.0"
                    step="0.5"
                    value={seedGapClosingMm}
                    onChange={(e) => onChangeSeedGapClosingMm?.(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={seedFillCavities}
                    onChange={onToggleSeedFillCavities}
                    className="w-4 h-4 rounded text-[#0284C7] accent-[#0284C7]"
                  />
                  <span>Fill internal bone cavities</span>
                </label>

                <div className="pt-2 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={onApplySeedSegmentToMask}
                    className="tactile-rubber w-full py-2 rounded-lg text-xs font-bold text-white bg-[#0284C7] hover:bg-sky-700 shadow-xs cursor-pointer"
                  >
                    Apply to Active Mask
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectSegmentTool('calculate_3d')}
                    className="tactile-rubber w-full py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    Proceed to Calculate 3D Object →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TOOL 2: CALCULATE 3D OBJECT (QUALITY PRESETS & POST-PROCESSING)    */}
        {/* ------------------------------------------------------------------ */}
        {activeSegmentTool === 'calculate_3d' && (
          <div className="flex flex-col gap-3">
            {/* Source Mask Selection */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Source Masks
              </span>
              <div className="flex flex-col gap-1 max-h-24 overflow-y-auto p-1.5 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800">
                {masks.map((m) => {
                  const isChecked = calcSourceMaskIds.includes(m.id);
                  return (
                    <label key={m.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setCalcSourceMaskIds((prev) =>
                            isChecked ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                          );
                        }}
                        className="w-3.5 h-3.5 rounded text-[#0284C7] accent-[#0284C7]"
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: m.color }}
                      />
                      <span className="truncate">{m.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Quality Presets: Low | Medium | High | Optimal */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Quality Preset
              </span>
              <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                {(['Low', 'Medium', 'High', 'Optimal'] as QualityPreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCalcQualityPreset(preset)}
                    className={`py-1 rounded text-[11px] font-semibold cursor-pointer transition-all ${
                      calcQualityPreset === preset
                        ? 'bg-[#0284C7] text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <span className="text-[9px] text-slate-400">
                {calcQualityPreset === 'Low' && '2x2x2 downsampling + fast smoothing (instant preview)'}
                {calcQualityPreset === 'Medium' && '1x1x1 resolution + 6-pass Taubin smoothing + 50% QEM'}
                {calcQualityPreset === 'High' && '1x1x1 + sub-voxel interpolation + 10-pass Taubin + 20% QEM'}
                {calcQualityPreset === 'Optimal' && '1x1x1 + cavity sealing + 12-pass Taubin + manifold check'}
              </span>
            </div>

            {/* Post-Processing Inline Toggles */}
            <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-[11px]">
              <span className="font-bold text-slate-700 dark:text-slate-300">Post-Processing</span>

              {/* Smooth */}
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={enableSmooth}
                    onChange={(e) => setEnableSmooth(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-[#0284C7] accent-[#0284C7]"
                  />
                  <span>Smooth (passes)</span>
                </div>
                <input
                  type="number"
                  disabled={!enableSmooth}
                  min={1}
                  max={30}
                  value={smoothIters}
                  onChange={(e) => setSmoothIters(parseInt(e.target.value, 10) || 1)}
                  className="w-12 px-1 py-0.5 text-right rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40"
                />
              </label>

              {/* Reduce */}
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={enableReduce}
                    onChange={(e) => setEnableReduce(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-[#0284C7] accent-[#0284C7]"
                  />
                  <span>Reduce (target %)</span>
                </div>
                <input
                  type="number"
                  disabled={!enableReduce}
                  min={10}
                  max={90}
                  value={reducePercent}
                  onChange={(e) => setReducePercent(parseInt(e.target.value, 10) || 10)}
                  className="w-12 px-1 py-0.5 text-right rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40"
                />
              </label>

              {/* Wrap */}
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={enableWrap}
                    onChange={(e) => setEnableWrap(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-[#0284C7] accent-[#0284C7]"
                  />
                  <span>Wrap (gap mm)</span>
                </div>
                <input
                  type="number"
                  disabled={!enableWrap}
                  step={0.1}
                  min={0.1}
                  max={5.0}
                  value={wrapMm}
                  onChange={(e) => setWrapMm(parseFloat(e.target.value) || 0.5)}
                  className="w-12 px-1 py-0.5 text-right rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40"
                />
              </label>
            </div>

            {/* Calculate Button */}
            <button
              type="button"
              disabled={calcSourceMaskIds.length === 0}
              onClick={() => {
                onCalculate3DObject?.(calcSourceMaskIds, calcQualityPreset, {
                  smooth: enableSmooth,
                  smoothIters,
                  reduce: enableReduce,
                  reducePercent,
                  wrap: enableWrap,
                  wrapMm,
                });
                setTopTab('objects');
              }}
              className="tactile-rubber w-full py-2.5 rounded-lg text-xs font-bold text-white bg-[#0284C7] hover:bg-sky-700 shadow-sm cursor-pointer disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
            >
              <IconBuild3DSurface size={14} />
              <span>Calculate 3D Object</span>
            </button>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TOOL 3: STANDALONE THRESHOLD                                       */}
        {/* ------------------------------------------------------------------ */}
        {activeSegmentTool === 'threshold' && activeMask && (
          <div className="flex flex-col gap-2">
            <HuHistogramEditor
              minHu={activeMask.minHu}
              maxHu={activeMask.maxHu}
              onChange={(min, max) => onUpdateMask(activeMask.id, { minHu: min, maxHu: max })}
              applyToAllMasks={false}
              showPresets={true}
            />
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TOOL 4: REGION GROW                                                */}
        {/* ------------------------------------------------------------------ */}
        {activeSegmentTool === 'region_grow' && (
          <div className="flex flex-col gap-2.5">
            <div className="p-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs">
              <span className="font-semibold text-sky-800 dark:text-sky-300">
                Region Grow Active
              </span>
              <p className="text-[11px] text-sky-700 dark:text-sky-400 mt-1">
                Click on any 2D DICOM slice (Axial, Coronal, Sagittal) to grow an anatomical region.
              </p>
            </div>

            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-slate-500">Seeds planted:</span>
              <span className="font-bold text-[#0284C7]">{regionGrowSeedsCount}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={regionGrowSeedsCount === 0}
                onClick={onUndoLastRegionGrowSeed}
                className="tactile-rubber flex-1 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
              >
                Undo Last Seed
              </button>

              <button
                type="button"
                onClick={onBuild3DSurface}
                className="tactile-rubber flex-1 py-1.5 rounded-lg text-xs font-semibold bg-[#0284C7] text-white hover:bg-sky-700 cursor-pointer shadow-xs"
              >
                Build 3D from mask
              </button>
            </div>

            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-[10px] text-slate-500">
              ✓ Auto axial hole-fill and 1-voxel morphological closing active (prevents swiss-cheese holes).
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TOOL 5: SPLIT MASK                                                 */}
        {/* ------------------------------------------------------------------ */}
        {activeSegmentTool === 'split_mask' && (
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Competitive Split Seeds
            </span>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onChangeSplitMode?.('boneA')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                  splitMode === 'boneA'
                    ? 'border-[#0284C7] bg-sky-50 dark:bg-sky-950 text-[#0284C7]'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Bone A ({seedsBoneACount})
              </button>

              <button
                type="button"
                onClick={() => onChangeSplitMode?.('boneB')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                  splitMode === 'boneB'
                    ? 'border-[#EC4899] bg-pink-50 dark:bg-pink-950 text-[#EC4899]'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Bone B ({seedsBoneBCount})
              </button>
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                disabled={seedsBoneACount === 0 && seedsBoneBCount === 0}
                onClick={onClearSplitSeeds}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40"
              >
                Clear Seeds
              </button>

              <button
                type="button"
                disabled={seedsBoneACount === 0 || seedsBoneBCount === 0}
                onClick={onExecuteSplitMask}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-[#0284C7] text-white hover:bg-sky-700 disabled:opacity-40"
              >
                Split Mask
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TOOL 6: EDIT MASK / BRUSH / MORPHOLOGY                             */}
        {/* ------------------------------------------------------------------ */}
        {(activeSegmentTool === 'edit_mask' || activeSegmentTool === 'brush' || activeSegmentTool === 'lasso_erase') && (
          <div className="flex flex-col gap-2.5">
            {/* Brush Controls */}
            <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Brush Radius:</span>
                <span className="font-bold text-[#0284C7]">{brushRadiusMm} mm</span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                value={brushRadiusMm}
                onChange={(e) => onChangeBrushRadius?.(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
              />

              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => onChangeBrushMode?.('paint')}
                  className={`flex-1 py-1 rounded text-xs font-semibold border ${
                    brushMode === 'paint'
                      ? 'bg-[#0284C7] text-white border-[#0284C7]'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Paint
                </button>
                <button
                  type="button"
                  onClick={() => onChangeBrushMode?.('erase')}
                  className={`flex-1 py-1 rounded text-xs font-semibold border ${
                    brushMode === 'erase'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Erase
                </button>
              </div>

              <label className="flex items-center gap-1.5 text-[11px] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={brush3D}
                  onChange={onToggleBrush3D}
                  className="w-3.5 h-3.5 rounded text-[#0284C7] accent-[#0284C7]"
                />
                <span>3D Sphere Brush</span>
              </label>
            </div>

            {/* Morphology operations */}
            <div className="flex flex-col gap-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Morphology
              </span>
              <div className="grid grid-cols-2 gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => onApplyMorphology?.('dilate')}
                  className="py-1 rounded text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  Dilate
                </button>
                <button
                  type="button"
                  onClick={() => onApplyMorphology?.('erode')}
                  className="py-1 rounded text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  Erode
                </button>
                <button
                  type="button"
                  onClick={() => onApplyMorphology?.('close')}
                  className="py-1 rounded text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => onApplyMorphology?.('fill')}
                  className="py-1 rounded text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  Fill Cavities
                </button>
              </div>

              <button
                type="button"
                onClick={onKeepLargestIsland}
                className="mt-1 py-1 rounded text-[11px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0284C7]"
              >
                Keep Largest Island
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
