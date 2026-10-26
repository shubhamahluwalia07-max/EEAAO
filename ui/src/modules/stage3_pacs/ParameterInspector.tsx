import React from 'react';
import {
  CLINICAL_PRESETS,
  Measurement,
  SlabMode,
  WindowPreset,
  SegmentationMask,
  TISSUE_PRESETS,
  TissuePreset,
  SegmentToolMode,
  BoneSeedPoint,
} from './types';
import { MprVolume } from './mprEngine';

interface ParameterInspectorProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  volume: MprVolume | null;
  windowCenter: number;
  windowWidth: number;
  onChangeWindow: (center: number, width: number) => void;
  slabMode: SlabMode;
  onChangeSlabMode: (mode: SlabMode) => void;
  slabThicknessMm: number;
  onChangeSlabThickness: (thickness: number) => void;
  measurements: Measurement[];
  onRemoveMeasurement: (id: string) => void;
  onClearMeasurements: () => void;
  cineFps: number;
  onChangeCineFps: (fps: number) => void;
  isCinePlaying: boolean;
  onToggleCine: () => void;
  // 3D Direct Volume Controls
  is3DActive: boolean;
  onToggle3DActive: (active: boolean) => void;
  huThreshold: number;
  onChangeHuThreshold: (val: number) => void;
  colorMode: number;
  onChangeColorMode: (val: number) => void;
  filterTable: boolean;
  onToggleFilterTable: () => void;
  // Segmentation Mode Props
  isSegmentMode: boolean;
  activeSegmentTool: SegmentToolMode;
  onSelectSegmentTool: (tool: SegmentToolMode) => void;
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
  onExportStl: () => void;
  is3DSurfaceBuilt?: boolean;
  // Region Grow Controls
  regionGrowSeedsCount: number;
  onUndoLastRegionGrowSeed: () => void;
  // Smart Brush Controls
  brushRadiusMm: number;
  onChangeBrushRadius: (r: number) => void;
  brushMode: 'paint' | 'erase';
  onChangeBrushMode: (m: 'paint' | 'erase') => void;
  brush3D: boolean;
  onToggleBrush3D: () => void;
  // Lasso Controls
  lassoThroughVolume: boolean;
  onToggleLassoThroughVolume: () => void;
  // Morphology Controls
  morphologyRadiusMm: number;
  onChangeMorphologyRadius: (r: number) => void;
  onApplyMorphology: (op: 'dilate' | 'erode' | 'close' | 'fill') => void;
  onKeepLargestIsland: () => void;
  // 3-Step Bone Wizard Controls
  boneWizardStep: 1 | 2 | 3;
  onChangeBoneWizardStep: (step: 1 | 2 | 3) => void;
  boneSeeds: BoneSeedPoint[];
  onDeleteBoneSeed: (id: string) => void;
  boneWizardMode: 'unified' | 'separate';
  onChangeBoneWizardMode: (m: 'unified' | 'separate') => void;
  corticalMinHu: number;
  onChangeCorticalMinHu: (v: number) => void;
  corticalMaxHu: number;
  onChangeCorticalMaxHu: (v: number) => void;
  trabecularMinHu: number;
  onChangeTrabecularMinHu: (v: number) => void;
  gapClosingDistanceMm: number;
  onChangeGapClosingDistance: (v: number) => void;
  fillInternalCavities: boolean;
  onToggleFillInternalCavities: () => void;
  onExecuteBoneSegmentation: () => void;
}

const COLOR_SWATCHES: { color: string; rgb: [number, number, number]; name: string }[] = [
  { color: '#06B6D4', rgb: [6, 182, 212], name: 'Cyan' },
  { color: '#10B981', rgb: [16, 185, 129], name: 'Emerald' },
  { color: '#8B5CF6', rgb: [139, 92, 246], name: 'Violet' },
  { color: '#F43F5E', rgb: [244, 63, 94], name: 'Coral Rose' },
  { color: '#F59E0B', rgb: [245, 158, 11], name: 'Amber Gold' },
  { color: '#3B82F6', rgb: [59, 130, 246], name: 'Cobalt' },
];

export const ParameterInspector: React.FC<ParameterInspectorProps> = ({
  isOpen,
  onToggleOpen,
  volume,
  windowCenter,
  windowWidth,
  onChangeWindow,
  slabMode,
  onChangeSlabMode,
  slabThicknessMm,
  onChangeSlabThickness,
  measurements,
  onRemoveMeasurement,
  onClearMeasurements,
  cineFps,
  onChangeCineFps,
  isCinePlaying,
  onToggleCine,
  is3DActive,
  onToggle3DActive,
  huThreshold,
  onChangeHuThreshold,
  colorMode,
  onChangeColorMode,
  filterTable,
  onToggleFilterTable,
  isSegmentMode,
  activeSegmentTool,
  onSelectSegmentTool,
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
  onExportStl,
  is3DSurfaceBuilt,
  regionGrowSeedsCount,
  onUndoLastRegionGrowSeed,
  brushRadiusMm,
  onChangeBrushRadius,
  brushMode,
  onChangeBrushMode,
  brush3D,
  onToggleBrush3D,
  lassoThroughVolume,
  onToggleLassoThroughVolume,
  morphologyRadiusMm,
  onChangeMorphologyRadius,
  onApplyMorphology,
  onKeepLargestIsland,
  boneWizardStep,
  onChangeBoneWizardStep,
  boneSeeds,
  onDeleteBoneSeed,
  boneWizardMode,
  onChangeBoneWizardMode,
  corticalMinHu,
  onChangeCorticalMinHu,
  corticalMaxHu,
  onChangeCorticalMaxHu,
  trabecularMinHu,
  onChangeTrabecularMinHu,
  gapClosingDistanceMm,
  onChangeGapClosingDistance,
  fillInternalCavities,
  onToggleFillInternalCavities,
  onExecuteBoneSegmentation,
}) => {
  const activeMask = masks.find((m) => m.id === activeMaskId) || masks[0];
  const selectedMasks = masks.filter((m) => m.selected);
  const allSelected = masks.length > 0 && selectedMasks.length === masks.length;

  return (
    <div className="relative flex select-none shrink-0 z-20">
      {/* Tactile Collapse/Expand Handle Tab on Inner Edge */}
      <button
        type="button"
        onClick={onToggleOpen}
        title={isOpen ? 'Collapse Inspector (])' : 'Expand Inspector (])'}
        className="absolute top-1/2 -translate-y-1/2 -left-3.5 z-30 w-3.5 h-12 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#1E293B] rounded-l-md shadow-sm flex items-center justify-center cursor-pointer text-[9px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        style={{ writingMode: 'vertical-lr' }}
      >
        {isOpen ? 'Hide' : 'Inspect'}
      </button>

      <aside
        className={`bg-white dark:bg-[#111827] border-l border-slate-200 dark:border-[#1E293B] flex flex-col h-full shadow-sm overflow-y-auto overflow-x-hidden font-sans transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? 'w-84' : 'w-0 border-l-0 py-0 px-0 opacity-0 pointer-events-none'
        }`}
      >
        {isSegmentMode ? (
          /* ======================================================== */
          /* EXCLUSIVE DEDICATED SEGMENTATION MANAGER WORKSPACE        */
          /* ======================================================== */
          <div className="flex flex-col h-full divide-y divide-slate-200 dark:divide-[#1E293B] animate-in fade-in duration-200">
            {/* Header */}
            <div className="p-3 bg-slate-50 dark:bg-[#111827] flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                Segmentation Manager
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/60 text-[#0284C7] dark:text-sky-300">
                Active
              </span>
            </div>

            {/* Section 1: Multi-Select Masks List */}
            <div className="p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onToggleSelectAllMasks}
                    className="text-[11px] font-semibold text-sky-700 dark:text-sky-400 hover:text-sky-900 cursor-pointer underline underline-offset-2"
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Masks ({masks.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onCreateMask}
                  className="tactile-rubber px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 transition-colors cursor-pointer shadow-xs"
                >
                  Create Mask
                </button>
              </div>

              {/* Batch Operations Bar when multiple masks are checked */}
              {selectedMasks.length >= 2 && (
                <div className="p-2 bg-sky-50 dark:bg-[#0c4a6e]/30 border border-sky-200 dark:border-sky-800 rounded-lg flex flex-col gap-1.5 animate-in fade-in duration-150">
                  <div className="text-[11px] font-semibold text-sky-900 dark:text-sky-200">
                    Batch Actions ({selectedMasks.length} Selected):
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={onMergeSelectedMasks}
                      className="tactile-rubber py-1 px-2 rounded text-[11px] font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-[#1E293B] border border-sky-300 dark:border-sky-700 hover:bg-sky-100/50 cursor-pointer text-center"
                    >
                      Merge Masks
                    </button>
                    <button
                      type="button"
                      onClick={onSubtractMasks}
                      className="tactile-rubber py-1 px-2 rounded text-[11px] font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-[#1E293B] border border-sky-300 dark:border-sky-700 hover:bg-sky-100/50 cursor-pointer text-center"
                    >
                      Subtract Masks
                    </button>
                    <button
                      type="button"
                      onClick={onBuild3DSurface}
                      className="tactile-rubber py-1 px-2 rounded text-[11px] font-medium text-white bg-[#0284C7] hover:bg-sky-700 cursor-pointer text-center col-span-2"
                    >
                      Build 3D Surface for Selected
                    </button>
                    <button
                      type="button"
                      onClick={onDeleteSelectedMasks}
                      className="tactile-rubber py-1 px-2 rounded text-[11px] font-medium text-red-600 dark:text-red-400 bg-white dark:bg-[#1E293B] border border-red-200 dark:border-red-800 hover:bg-red-50 cursor-pointer text-center col-span-2"
                    >
                      Delete Selected
                    </button>
                  </div>
                </div>
              )}

              {/* Mask Rows */}
              <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                {masks.map((mask) => {
                  const isSelected = mask.id === activeMaskId;

                  return (
                    <div
                      key={mask.id}
                      onClick={() => onSelectMask(mask.id)}
                      className={`p-2.5 rounded-xl border flex flex-col gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-50 dark:bg-[#1E293B] border-[#0284C7] shadow-sm'
                          : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={!!mask.selected}
                            onChange={() => onToggleSelectMask(mask.id)}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-[#0284C7] focus:ring-[#0284C7] cursor-pointer accent-[#0284C7]"
                          />
                          <input
                            type="text"
                            value={mask.name}
                            onChange={(e) =>
                              onUpdateMask(mask.id, { name: e.target.value })
                            }
                            className="text-xs font-semibold text-slate-900 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-[#0284C7] outline-none px-0.5 py-0.5 max-w-[120px] truncate"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateMask(mask.id, { visible: !mask.visible })
                            }
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                              mask.visible
                                ? 'bg-sky-100 dark:bg-sky-950/80 text-[#0284C7] dark:text-sky-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {mask.visible ? 'Visible' : 'Hidden'}
                          </button>

                          {masks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => onDeleteMask(mask.id)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Color Swatch Selector */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[10px] font-medium text-slate-500">Color:</span>
                        <div className="flex items-center gap-1.5">
                          {COLOR_SWATCHES.map((swatch) => {
                            const isCurrent = mask.color === swatch.color;
                            return (
                              <button
                                key={swatch.name}
                                type="button"
                                onClick={() =>
                                  onUpdateMask(mask.id, {
                                    color: swatch.color,
                                    rgb: swatch.rgb,
                                  })
                                }
                                title={swatch.name}
                                style={{ backgroundColor: swatch.color }}
                                className={`w-3.5 h-3.5 rounded-full transition-transform cursor-pointer ${
                                  isCurrent
                                    ? 'ring-2 ring-offset-1 ring-slate-800 scale-110'
                                    : 'opacity-70 hover:opacity-100'
                                }`}
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* Opacity Slider */}
                      <div className="flex items-center justify-between text-[10px] font-medium text-slate-600 pt-0.5" onClick={(e) => e.stopPropagation()}>
                        <span>Opacity:</span>
                        <div className="flex items-center gap-2 w-28">
                          <input
                            type="range"
                            min="0.1"
                            max="1.0"
                            step="0.05"
                            value={mask.opacity}
                            onChange={(e) =>
                              onUpdateMask(mask.id, {
                                opacity: Number(e.target.value),
                              })
                            }
                            className="w-full h-1 bg-slate-200 rounded appearance-none cursor-pointer accent-[#0284C7]"
                          />
                          <span className="w-6 text-right font-semibold">
                            {Math.round(mask.opacity * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Active Tool Parameters Panel */}

            {/* A. CT Bone Auto-Segment Guided 3-Step Wizard */}
            {activeSegmentTool === 'bone_auto_segment' && (
              <div className="p-3.5 flex flex-col gap-3 bg-sky-50/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    CT Bone Auto-Segment
                  </span>
                  <span className="text-[11px] font-semibold text-[#0284C7]">
                    Step {boneWizardStep} of 3
                  </span>
                </div>

                {/* Step 1: Bone Seed Selection */}
                {boneWizardStep === 1 && (
                  <div className="flex flex-col gap-2.5 animate-in fade-in duration-150">
                    <p className="text-[11px] text-slate-600">
                      Click target bone landmarks directly on the Axial, Coronal, or Sagittal slices.
                    </p>

                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Placed Seeds ({boneSeeds.length})</span>
                      <div className="flex items-center gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => onChangeBoneWizardMode('unified')}
                          className={`px-2 py-0.5 rounded cursor-pointer ${
                            boneWizardMode === 'unified'
                              ? 'bg-[#0284C7] text-white font-semibold'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          Unified Mask
                        </button>
                        <button
                          type="button"
                          onClick={() => onChangeBoneWizardMode('separate')}
                          className={`px-2 py-0.5 rounded cursor-pointer ${
                            boneWizardMode === 'separate'
                              ? 'bg-[#0284C7] text-white font-semibold'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          Separate
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                      {boneSeeds.length === 0 ? (
                        <div className="p-2 border border-dashed border-slate-300 rounded text-center text-[11px] text-slate-500">
                          No bone landmark seeds placed yet. Click on any slice to add seeds.
                        </div>
                      ) : (
                        boneSeeds.map((seed, i) => (
                          <div
                            key={seed.id}
                            className="p-1.5 bg-white border border-slate-200 rounded flex items-center justify-between text-[11px]"
                          >
                            <span className="font-semibold text-slate-800">
                              Seed #{i + 1}: Voxel ({seed.voxel[0]}, {seed.voxel[1]}, {seed.voxel[2]}) • {seed.hu > 0 ? `+${seed.hu}` : seed.hu} HU
                            </span>
                            <button
                              type="button"
                              onClick={() => onDeleteBoneSeed(seed.id)}
                              className="text-red-600 hover:text-red-800 font-semibold cursor-pointer px-1"
                            >
                              Delete
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={boneSeeds.length === 0}
                      onClick={() => onChangeBoneWizardStep(2)}
                      className="tactile-rubber w-full h-8 rounded-lg text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 disabled:opacity-50 cursor-pointer shadow-xs mt-1"
                    >
                      Next: Threshold Calibration
                    </button>
                  </div>
                )}

                {/* Step 2: Threshold Calibration */}
                {boneWizardStep === 2 && (
                  <div className="flex flex-col gap-2.5 animate-in fade-in duration-150">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">Cortical Seed Threshold</span>
                        <span className="text-slate-900 font-semibold">{corticalMinHu} to {corticalMaxHu} HU</span>
                      </div>
                      <input
                        type="range"
                        min="150"
                        max="800"
                        value={corticalMinHu}
                        onChange={(e) => onChangeCorticalMinHu(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-[#0284C7]"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">Trabecular Sensitivity</span>
                        <span className="text-slate-900 font-semibold">{trabecularMinHu} HU</span>
                      </div>
                      <input
                        type="range"
                        min="120"
                        max="300"
                        value={trabecularMinHu}
                        onChange={(e) => onChangeTrabecularMinHu(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-[#0284C7]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => onChangeBoneWizardStep(1)}
                        className="tactile-rubber h-8 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeBoneWizardStep(3)}
                        className="tactile-rubber h-8 rounded-lg text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 cursor-pointer shadow-xs"
                      >
                        Next: Gap Closing
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Gap Closing & Cavity Fill */}
                {boneWizardStep === 3 && (
                  <div className="flex flex-col gap-2.5 animate-in fade-in duration-150">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">Gap Closing Distance</span>
                        <span className="text-slate-900 font-semibold">{gapClosingDistanceMm.toFixed(1)} mm</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="10.0"
                        step="0.5"
                        value={gapClosingDistanceMm}
                        onChange={(e) => onChangeGapClosingDistance(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-[#0284C7]"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                      <span className="text-xs font-semibold text-slate-800">
                        Fill Internal Cavities
                      </span>
                      <input
                        type="checkbox"
                        checked={fillInternalCavities}
                        onChange={onToggleFillInternalCavities}
                        className="w-4 h-4 rounded text-[#0284C7] cursor-pointer accent-[#0284C7]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => onChangeBoneWizardStep(2)}
                        className="tactile-rubber h-8 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={onExecuteBoneSegmentation}
                        className="tactile-rubber h-8 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-xs"
                      >
                        Execute Bone
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* B. Region Grow Tool Panel */}
            {activeSegmentTool === 'region_grow' && (
              <div className="p-3.5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900">
                    Accumulative Region Grow
                  </span>
                  <span className="text-xs font-semibold text-[#0284C7]">
                    {regionGrowSeedsCount} Seeds Added
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Click on any bone or anatomical structure across any slice to accumulate connected voxels into the active mask.
                </p>
                <button
                  type="button"
                  disabled={regionGrowSeedsCount === 0}
                  onClick={onUndoLastRegionGrowSeed}
                  className="tactile-rubber w-full h-8 rounded-lg text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
                >
                  Undo Last Seed Click
                </button>
              </div>
            )}

            {/* C. Smart Brush 2D / 3D Panel */}
            {activeSegmentTool === 'brush' && (
              <div className="p-3.5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900">
                    Smart Brush Settings
                  </span>
                  <span className="text-xs font-semibold text-[#0284C7]">
                    {brushRadiusMm.toFixed(1)} mm
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-slate-500 font-medium">Brush Radius</span>
                  <input
                    type="range"
                    min="1.0"
                    max="30.0"
                    step="0.5"
                    value={brushRadiusMm}
                    onChange={(e) => onChangeBrushRadius(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-[#0284C7]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onChangeBrushMode('paint')}
                    className={`tactile-rubber py-1.5 rounded text-xs font-semibold cursor-pointer ${
                      brushMode === 'paint'
                        ? 'bg-[#0284C7] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Paint (Add)
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeBrushMode('erase')}
                    className={`tactile-rubber py-1.5 rounded text-xs font-semibold cursor-pointer ${
                      brushMode === 'erase'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Erase (Clear)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={onToggleBrush3D}
                    className={`tactile-rubber py-1.5 rounded text-xs font-semibold cursor-pointer ${
                      !brush3D
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    2D Current Slice
                  </button>
                  <button
                    type="button"
                    onClick={onToggleBrush3D}
                    className={`tactile-rubber py-1.5 rounded text-xs font-semibold cursor-pointer ${
                      brush3D
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    3D Spherical
                  </button>
                </div>
              </div>
            )}

            {/* D. Lasso Erase Panel */}
            {activeSegmentTool === 'lasso_erase' && (
              <div className="p-3.5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900">
                    Lasso Erase Scope
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Draw a closed freehand loop on any slice to clear all mask voxels inside the loop.
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={onToggleLassoThroughVolume}
                    className={`tactile-rubber py-1.5 rounded text-xs font-semibold cursor-pointer ${
                      !lassoThroughVolume
                        ? 'bg-[#0284C7] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Current Slice
                  </button>
                  <button
                    type="button"
                    onClick={onToggleLassoThroughVolume}
                    className={`tactile-rubber py-1.5 rounded text-xs font-semibold cursor-pointer ${
                      lassoThroughVolume
                        ? 'bg-[#0284C7] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Through Volume
                  </button>
                </div>
              </div>
            )}

            {/* E. Morphology Panel */}
            {activeSegmentTool === 'morphology' && (
              <div className="p-3.5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900">
                    3D Morphology Operations
                  </span>
                  <span className="text-xs font-semibold text-[#0284C7]">
                    {morphologyRadiusMm.toFixed(1)} mm
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-slate-500 font-medium">Operation Radius</span>
                  <input
                    type="range"
                    min="1.0"
                    max="8.0"
                    step="0.5"
                    value={morphologyRadiusMm}
                    onChange={(e) => onChangeMorphologyRadius(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-[#0284C7]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onApplyMorphology('dilate')}
                    className="tactile-rubber py-1.5 rounded text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                  >
                    3D Dilation
                  </button>
                  <button
                    type="button"
                    onClick={() => onApplyMorphology('erode')}
                    className="tactile-rubber py-1.5 rounded text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                  >
                    3D Erosion
                  </button>
                  <button
                    type="button"
                    onClick={() => onApplyMorphology('close')}
                    className="tactile-rubber py-1.5 rounded text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                  >
                    3D Close Gaps
                  </button>
                  <button
                    type="button"
                    onClick={() => onApplyMorphology('fill')}
                    className="tactile-rubber py-1.5 rounded text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                  >
                    Fill Cavities
                  </button>
                </div>
              </div>
            )}

            {/* F. Keep Largest Island Panel */}
            {activeSegmentTool === 'island' && (
              <div className="p-3.5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900">
                    Connected Component Filter
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Scans 3D 6-connected structures and removes all disconnected floating noise or speckles smaller than the main body.
                </p>
                <button
                  type="button"
                  onClick={onKeepLargestIsland}
                  className="tactile-rubber w-full h-9 rounded-lg text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 cursor-pointer shadow-xs"
                >
                  Execute Keep Largest Island
                </button>
              </div>
            )}

            {/* Threshold Mask HU Range (Always visible when activeMask selected) */}
            {activeMask && activeSegmentTool === 'threshold' && (
              <div className="p-3.5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">
                    Live HU Threshold Range
                  </span>
                  <span className="text-xs font-semibold text-[#0284C7]">
                    {activeMask.minHu} to {activeMask.maxHu} HU
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {TISSUE_PRESETS.map((preset: TissuePreset) => {
                    const isSelected =
                      activeMask.minHu === preset.minHu &&
                      activeMask.maxHu === preset.maxHu;

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          onUpdateMask(activeMask.id, {
                            minHu: preset.minHu,
                            maxHu: preset.maxHu,
                            activePreset: preset.id,
                          })
                        }
                        className={`tactile-rubber py-1.5 px-2 rounded-lg text-xs font-medium text-left truncate transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#0284C7] text-white font-semibold shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                        }`}
                      >
                        {preset.name}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Min Threshold</span>
                    <span className="font-semibold text-slate-800">
                      {activeMask.minHu} HU
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-1024"
                    max="2000"
                    value={activeMask.minHu}
                    onChange={(e) =>
                      onUpdateMask(activeMask.id, {
                        minHu: Math.min(Number(e.target.value), activeMask.maxHu - 1),
                      })
                    }
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Max Threshold</span>
                    <span className="font-semibold text-slate-800">
                      {activeMask.maxHu} HU
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-200"
                    max="3071"
                    value={activeMask.maxHu}
                    onChange={(e) =>
                      onUpdateMask(activeMask.id, {
                        maxHu: Math.max(Number(e.target.value), activeMask.minHu + 1),
                      })
                    }
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                  />
                </div>
              </div>
            )}

            {/* Bottom Actions: Build 3D Surface & Binary STL Export */}
            <div className="p-3.5 mt-auto flex flex-col gap-2 bg-slate-50/60 dark:bg-[#111827] border-t border-slate-200 dark:border-[#1E293B]">
              <button
                type="button"
                onClick={onBuild3DSurface}
                className="tactile-rubber w-full h-10 rounded-xl text-xs font-bold text-white bg-[#0284C7] hover:bg-sky-700 shadow-sm transition-all cursor-pointer flex items-center justify-center"
              >
                Build 3D Segment Surface
              </button>

              <button
                type="button"
                onClick={onExportStl}
                className="tactile-rubber w-full h-10 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm transition-all cursor-pointer flex items-center justify-center"
              >
                Export STL
              </button>


            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* STANDARD DIAGNOSTIC PACS VIEWING INSPECTOR PANELS        */
          /* ======================================================== */
          <div className="flex flex-col divide-y divide-slate-200 animate-in fade-in duration-200">
            {/* Inspector Section 1: Window Presets */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-900 tracking-tight">
                  Window Presets
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {windowWidth | 0} / {windowCenter | 0}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {CLINICAL_PRESETS.map((preset: WindowPreset) => {
                  const isSelected =
                    Math.abs(windowCenter - preset.center) < 5 &&
                    Math.abs(windowWidth - preset.width) < 10;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onChangeWindow(preset.center, preset.width)}
                      className={`tactile-rubber py-2 px-2.5 rounded text-xs font-medium text-left truncate cursor-pointer ${
                        isSelected ? 'tactile-rubber-active' : 'text-slate-800'
                      }`}
                      title={`Width: ${preset.width}, Level: ${preset.center}`}
                    >
                      {preset.name}
                    </button>
                  );
                })}
              </div>

              {/* Manual Interactive Sliders */}
              <div className="mt-4 flex flex-col gap-3">
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>Window Level (WL)</span>
                    <span className="font-semibold">{windowCenter | 0} HU</span>
                  </div>
                  <input
                    type="range"
                    min={volume ? volume.minHu : -1024}
                    max={volume ? volume.maxHu : 3071}
                    value={windowCenter}
                    onChange={(e) => onChangeWindow(Number(e.target.value), windowWidth)}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>Window Width (WW)</span>
                    <span className="font-semibold">{windowWidth | 0} HU</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max={volume ? volume.maxHu - volume.minHu : 4096}
                    value={windowWidth}
                    onChange={(e) => onChangeWindow(windowCenter, Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                  />
                </div>
              </div>
            </div>

            {/* Inspector Section 2: Slab Thick Slice Reconstruction */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-900 tracking-tight">
                  Slab Projection Mode
                </span>
                <span className="text-xs font-semibold text-[#0284C7]">
                  {slabMode === 'none' ? 'Thin Slice' : slabMode.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {(['none', 'mip', 'minip', 'average'] as SlabMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onChangeSlabMode(mode)}
                    className={`tactile-rubber py-1.5 px-2 rounded text-xs font-medium cursor-pointer ${
                      slabMode === mode ? 'tactile-rubber-active' : 'text-slate-800'
                    }`}
                  >
                    {mode === 'none'
                      ? 'Thin Slice'
                      : mode === 'mip'
                        ? 'MIP'
                        : mode === 'minip'
                          ? 'MinIP'
                          : 'Average'}
                  </button>
                ))}
              </div>

              {slabMode !== 'none' && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Slab Thickness</span>
                    <span className="font-semibold">{slabThicknessMm.toFixed(1)} mm</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="50.0"
                    step="0.5"
                    value={slabThicknessMm}
                    onChange={(e) => onChangeSlabThickness(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                  />
                </div>
              )}
            </div>

            {/* Inspector Section 3: Measurements Readout */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-900 tracking-tight">
                  Annotations & Metrics ({measurements.length})
                </span>
                {measurements.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearMeasurements}
                    className="text-[11px] text-red-600 hover:text-red-700 font-semibold cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {measurements.length === 0 ? (
                <div className="text-xs text-slate-600 py-3 text-center border border-dashed border-slate-200 rounded-lg">
                  No active measurements. Select Distance, Angle, Cobb Angle, or ROI from the left dock to annotate.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                  {measurements.map((m) => (
                    <div
                      key={m.id}
                      className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-800 capitalize">
                          {m.type === 'length' ? 'Distance' : m.type === 'roi' ? 'Elliptical ROI' : m.type === 'cobb' ? 'Cobb Angle' : 'Angle'}
                        </span>
                        <div className="text-[11px] text-slate-500 capitalize">
                          {m.plane} · Slice #{m.sliceIndex}
                        </div>
                        {m.stats && (
                          <div className="text-[10px] text-sky-700 font-semibold">
                            {m.stats.mean} ±{m.stats.stdDev} HU · {m.stats.areaMm2} mm²
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#0284C7]">
                          {m.type === 'length'
                            ? `${m.value.toFixed(1)} mm`
                            : m.type === 'roi'
                              ? `${m.value.toFixed(0)} HU`
                              : `${m.value.toFixed(1)}°`}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveMeasurement(m.id)}
                          className="text-slate-400 hover:text-red-600 text-sm font-bold cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Inspector Section 4: Cine Playback Controls */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-900 tracking-tight">
                  Cine Playback Loop
                </span>
                <span className="text-xs font-semibold text-slate-700">{cineFps} FPS</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleCine}
                  className={`tactile-rubber flex-1 py-1.5 rounded text-xs font-semibold cursor-pointer ${
                    isCinePlaying ? 'tactile-rubber-active' : 'text-slate-800'
                  }`}
                >
                  {isCinePlaying ? 'Pause Loop' : 'Play Loop'}
                </button>
              </div>
              <div className="mt-3 flex flex-col gap-1">
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={cineFps}
                  onChange={(e) => onChangeCineFps(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                />
              </div>
            </div>

            {/* Inspector Section 5: 3D Direct Volume Controls */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-900 tracking-tight">
                  3D Volume View (Quadrant 4)
                </span>
                <button
                  type="button"
                  onClick={() => onToggle3DActive(!is3DActive)}
                  className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer ${
                    is3DActive ? 'bg-sky-100 text-[#0284C7]' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {is3DActive ? 'Active' : 'Disabled'}
                </button>
              </div>

              {is3DActive && (
                <div className="flex flex-col gap-3 mt-3">
                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Iso-Surface Threshold</span>
                      <span className="font-semibold text-slate-900">{huThreshold} HU</span>
                    </div>
                    <input
                      type="range"
                      min="-200"
                      max="1500"
                      value={huThreshold}
                      onChange={(e) => onChangeHuThreshold(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                    />
                  </div>

                  <div>
                    <span className="text-xs text-slate-600 mb-1 block">Color Palette</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => onChangeColorMode(0)}
                        className={`tactile-rubber py-1 px-2 rounded text-xs font-medium cursor-pointer ${
                          colorMode === 0 ? 'tactile-rubber-active' : 'text-slate-800'
                        }`}
                      >
                        Bone Ivory
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeColorMode(1)}
                        className={`tactile-rubber py-1 px-2 rounded text-xs font-medium cursor-pointer ${
                          colorMode === 1 ? 'tactile-rubber-active' : 'text-slate-800'
                        }`}
                      >
                        Cortical Cobalt
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-700 font-medium">Scanner Table Filter</span>
                    <input
                      type="checkbox"
                      checked={filterTable}
                      onChange={onToggleFilterTable}
                      className="w-4 h-4 rounded text-[#0284C7] cursor-pointer accent-[#0284C7]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};
