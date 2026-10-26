import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MprVolume } from './mprEngine';
import { IconClose, IconTrash, IconPlus, IconEye } from './Icons';

export interface BoneSeedItem {
  id: string;
  name: string; // "Seed point 1"
  voxel: [number, number, number];
  hu: number;
  worldMm: [number, number, number];
}

export interface BoneEntry {
  id: string;
  name: string;
  color: string;
  seeds: BoneSeedItem[];
  seedThresholdHu: number; // default 150
  sensitivity: number; // default 60
  minHu: number; // default 150
  maxHu: number; // default 2822
  gapClosingDistancePx: number; // default 2
  fillLongBones: boolean; // default true
  calculatedMask?: Uint8Array;
}

interface CtBoneSegmentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  volume: MprVolume | null;
  bones: BoneEntry[];
  onChangeBones: (bones: BoneEntry[]) => void;
  selectedBoneId: string;
  onSelectBoneId: (id: string) => void;
  currentTab: 1 | 2 | 3;
  onChangeTab: (tab: 1 | 2 | 3) => void;
  previewOnSlices: boolean;
  onTogglePreviewOnSlices: () => void;
  onCalculate: () => void;
  onFinish: () => void;
  calcStatus: string | null;
  isCalculating: boolean;
}

const BONE_PALETTE = [
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#3B82F6', // Blue
  '#14B8A6', // Teal
  '#E11D48', // Rose
];

export const CtBoneSegmentationModal: React.FC<CtBoneSegmentationModalProps> = ({
  isOpen,
  onClose,
  volume,
  bones,
  onChangeBones,
  selectedBoneId,
  onSelectBoneId,
  currentTab,
  onChangeTab,
  previewOnSlices,
  onTogglePreviewOnSlices,
  onCalculate,
  onFinish,
  calcStatus,
  isCalculating,
}) => {
  // Draggable window state
  const [modalPos, setModalPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ isDragging: boolean; startX: number; startY: number; initX: number; initY: number }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });

  // Apply settings to all masks checkboxes
  const [applyThresholdToAll, setApplyThresholdToAll] = useState<boolean>(true);
  const [applyFinishingToAll, setApplyFinishingToAll] = useState<boolean>(true);

  // Initialize centered modal position once mounted
  useEffect(() => {
    if (isOpen && modalPos === null) {
      const x = Math.max(20, Math.floor((window.innerWidth - 680) / 2));
      const y = Math.max(40, Math.floor((window.innerHeight - 560) / 2));
      setModalPos({ x, y });
    }
  }, [isOpen, modalPos]);

  // Window drag handlers
  const handleTitleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initX: modalPos?.x || 100,
      initY: modalPos?.y || 80,
    };

    const handleMouseMove = (moveEv: MouseEvent) => {
      if (!dragRef.current.isDragging) return;
      const dx = moveEv.clientX - dragRef.current.startX;
      const dy = moveEv.clientY - dragRef.current.startY;
      setModalPos({
        x: Math.max(10, Math.min(window.innerWidth - 400, dragRef.current.initX + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 200, dragRef.current.initY + dy)),
      });
    };

    const handleMouseUp = () => {
      dragRef.current.isDragging = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Selected bone entry
  const selectedBone = bones.find((b) => b.id === selectedBoneId) || bones[0];

  // Tab 2: Histogram computation from volume
  const HISTOGRAM_MIN = -1000;
  const HISTOGRAM_MAX = 2500;
  const NUM_BINS = 100;
  const BIN_WIDTH_HU = (HISTOGRAM_MAX - HISTOGRAM_MIN) / NUM_BINS;

  const histogramData = useMemo(() => {
    if (!volume || !volume.voxels) {
      // Return smooth synthetic bone curve if volume not yet loaded
      const dummy = new Float32Array(NUM_BINS);
      for (let i = 0; i < NUM_BINS; i++) {
        const hu = HISTOGRAM_MIN + i * BIN_WIDTH_HU;
        // Peak around air (-800), soft tissue (40), and bone (400-1200)
        let val = 0.05;
        if (hu >= -950 && hu <= -600) val += 0.8 * Math.exp(-Math.pow((hu + 800) / 100, 2));
        if (hu >= -100 && hu <= 150) val += 1.0 * Math.exp(-Math.pow((hu - 40) / 60, 2));
        if (hu >= 150 && hu <= 2000) val += 0.6 * Math.exp(-Math.pow((hu - 700) / 400, 2));
        dummy[i] = val;
      }
      return dummy;
    }

    const raw = volume.voxels;
    const bins = new Uint32Array(NUM_BINS);
    const step = Math.max(1, Math.floor(raw.length / 150000)); // Sample ~150k voxels for instant response
    let maxCount = 1;

    for (let i = 0; i < raw.length; i += step) {
      const hu = raw[i];
      if (hu >= HISTOGRAM_MIN && hu < HISTOGRAM_MAX) {
        const binIdx = Math.floor((hu - HISTOGRAM_MIN) / BIN_WIDTH_HU);
        if (binIdx >= 0 && binIdx < NUM_BINS) {
          bins[binIdx]++;
          if (bins[binIdx] > maxCount) maxCount = bins[binIdx];
        }
      }
    }

    const norm = new Float32Array(NUM_BINS);
    for (let i = 0; i < NUM_BINS; i++) {
      // Use log scale so low-frequency bone peaks remain prominent beside huge soft tissue/air peaks
      norm[i] = Math.log1p(bins[i]) / Math.log1p(maxCount);
    }
    return norm;
  }, [volume]);

  // Histogram cutoff dragging
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDraggingCutoff, setIsDraggingCutoff] = useState(false);

  const handleHistogramMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsDraggingCutoff(true);
    updateCutoffFromMouse(e.clientX);

    const handleMouseMove = (moveEv: MouseEvent) => {
      updateCutoffFromMouse(moveEv.clientX);
    };

    const handleMouseUp = () => {
      setIsDraggingCutoff(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const updateCutoffFromMouse = (clientX: number) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newMinHu = Math.round(HISTOGRAM_MIN + ratio * (HISTOGRAM_MAX - HISTOGRAM_MIN));
    handleMinHuChange(newMinHu);
  };

  // Bone management actions
  const handleAddBone = () => {
    const nextIdx = bones.length + 1;
    const color = BONE_PALETTE[(nextIdx - 1) % BONE_PALETTE.length];
    const newBone: BoneEntry = {
      id: 'bone_' + Date.now(),
      name: `Bone ${nextIdx}`,
      color,
      seeds: [],
      seedThresholdHu: 150,
      sensitivity: 60,
      minHu: 150,
      maxHu: volume?.maxHu || 2822,
      gapClosingDistancePx: 2,
      fillLongBones: true,
    };
    const updated = [...bones, newBone];
    onChangeBones(updated);
    onSelectBoneId(newBone.id);
  };

  const handleDeleteBone = (id: string) => {
    if (bones.length <= 1) return; // Keep at least one bone
    const updated = bones.filter((b) => b.id !== id);
    onChangeBones(updated);
    if (selectedBoneId === id) {
      onSelectBoneId(updated[0].id);
    }
  };

  const handleDeleteSeed = (seedId: string) => {
    if (!selectedBone) return;
    const updatedSeeds = selectedBone.seeds.filter((s) => s.id !== seedId);
    const updated = bones.map((b) => (b.id === selectedBone.id ? { ...b, seeds: updatedSeeds } : b));
    onChangeBones(updated);
  };

  // Parameter change handlers
  const handleSeedThresholdChange = (val: number) => {
    const clamped = Math.max(-3024, Math.min(3071, val));
    const updated = bones.map((b) => {
      if (applyThresholdToAll || b.id === selectedBone.id) {
        return { ...b, seedThresholdHu: clamped, minHu: clamped };
      }
      return b;
    });
    onChangeBones(updated);
  };

  const handleSensitivityChange = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    const updated = bones.map((b) => (b.id === selectedBone.id ? { ...b, sensitivity: clamped } : b));
    onChangeBones(updated);
  };

  const handleMinHuChange = (val: number) => {
    const clamped = Math.max(HISTOGRAM_MIN, Math.min(selectedBone.maxHu - 1, val));
    const updated = bones.map((b) => {
      if (applyThresholdToAll || b.id === selectedBone.id) {
        return { ...b, minHu: clamped, seedThresholdHu: clamped };
      }
      return b;
    });
    onChangeBones(updated);
  };

  const handleMaxHuChange = (val: number) => {
    const clamped = Math.max(selectedBone.minHu + 1, Math.min(HISTOGRAM_MAX, val));
    const updated = bones.map((b) => {
      if (applyThresholdToAll || b.id === selectedBone.id) {
        return { ...b, maxHu: clamped };
      }
      return b;
    });
    onChangeBones(updated);
  };

  const handleGapClosingChange = (val: number) => {
    const clamped = Math.max(0, Math.min(15, val));
    const updated = bones.map((b) => {
      if (applyFinishingToAll || b.id === selectedBone.id) {
        return { ...b, gapClosingDistancePx: clamped };
      }
      return b;
    });
    onChangeBones(updated);
  };

  const handleToggleFillLongBones = (val: boolean) => {
    const updated = bones.map((b) => {
      if (applyFinishingToAll || b.id === selectedBone.id) {
        return { ...b, fillLongBones: val };
      }
      return b;
    });
    onChangeBones(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none select-none font-sans">
      <div
        style={{
          position: 'absolute',
          left: modalPos ? `${modalPos.x}px` : 'calc(50% - 340px)',
          top: modalPos ? `${modalPos.y}px` : '100px',
        }}
        className="pointer-events-auto w-[680px] bg-[#0F172A] border border-[#1E293B] rounded-xl shadow-2xl flex flex-col text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Draggable Title Bar */}
        <div
          onMouseDown={handleTitleMouseDown}
          className="h-11 px-4 bg-[#111827] border-b border-[#1E293B] flex items-center justify-between cursor-move shrink-0"
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0284C7]" />
            <span className="text-sm font-semibold text-white tracking-tight">
              CT Bone Segmentation
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* 3-Tab Horizontal Step Header */}
        <div className="flex items-center border-b border-[#1E293B] bg-[#0F172A] px-2 shrink-0">
          {[
            { step: 1 as const, label: '1. Bone Selection' },
            { step: 2 as const, label: '2. Mask Threshold' },
            { step: 3 as const, label: '3. Finishing' },
          ].map((tab) => {
            const isActive = currentTab === tab.step;
            return (
              <button
                key={tab.step}
                type="button"
                onClick={() => onChangeTab(tab.step)}
                className={`relative px-5 py-2.5 text-xs font-semibold cursor-pointer transition-all ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0284C7] rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Two Persistent Columns Body */}
        <div className="flex flex-1 min-h-[360px] max-h-[460px] overflow-hidden">
          {/* Left Column: 170px width, NAME & Bone List */}
          <div className="w-[170px] border-r border-[#1E293B] bg-[#0B1120] flex flex-col justify-between shrink-0">
            {/* Header & Bone List */}
            <div className="flex flex-col flex-1 overflow-y-auto">
              <div className="px-3 py-2 text-[10px] font-bold text-slate-400 tracking-wider uppercase border-b border-[#1E293B]">
                NAME
              </div>
              <div className="flex flex-col p-1.5 gap-1">
                {bones.map((bone) => {
                  const isSelected = bone.id === selectedBoneId;
                  return (
                    <button
                      key={bone.id}
                      type="button"
                      onClick={() => onSelectBoneId(bone.id)}
                      className={`w-full px-2.5 py-2 rounded-lg flex items-center justify-between text-xs font-medium cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-sky-950/70 border border-sky-600/50 text-white shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: bone.color }}
                        />
                        <span className="truncate">{bone.name}</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 shrink-0 font-sans">
                        {bone.seeds.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Left: + Bone Button & Trash Button */}
            <div className="p-2 border-t border-[#1E293B] flex items-center gap-1.5 bg-[#0F172A]">
              <button
                type="button"
                onClick={handleAddBone}
                className="tactile-rubber flex-1 h-8 rounded-lg text-xs font-semibold bg-[#0284C7] hover:bg-sky-600 text-white flex items-center justify-center gap-1 shadow-xs cursor-pointer transition-all"
              >
                <IconPlus size={14} />
                <span>+ Bone</span>
              </button>

              <button
                type="button"
                disabled={bones.length <= 1}
                onClick={() => handleDeleteBone(selectedBoneId)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  bones.length <= 1
                    ? 'opacity-40 text-slate-600 cursor-not-allowed'
                    : 'text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 cursor-pointer'
                }`}
                title="Delete Selected Bone"
              >
                <IconTrash size={15} />
              </button>
            </div>
          </div>

          {/* Right Pane: Swappable Tab Content */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 bg-[#0F172A]">
            {/* ======================================================== */}
            {/* TAB 1: BONE SELECTION OPERATIONS                         */}
            {/* ======================================================== */}
            {currentTab === 1 && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-150">
                {/* Seed Point Selection Table */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-200 tracking-tight">
                    Seed Point Selection
                  </span>
                  <div className="border border-[#1E293B] rounded-lg overflow-hidden bg-[#111827]">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-[#182234] text-slate-400 uppercase text-[10px] font-semibold border-b border-[#1E293B]">
                        <tr>
                          <th className="py-2 px-3">NAME</th>
                          <th className="py-2 px-3">HU</th>
                          <th className="py-2 px-3">COORDINATES (MM)</th>
                          <th className="py-2 px-2 text-right"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E293B]">
                        {selectedBone.seeds.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-4 px-3 text-center text-slate-400 text-xs italic">
                              Click any bone on a 2D slice (Axial, Coronal, Sagittal) to place seed points.
                            </td>
                          </tr>
                        ) : (
                          selectedBone.seeds.map((seed) => (
                            <tr key={seed.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-2 px-3 font-medium text-slate-200">
                                {seed.name}
                              </td>
                              <td className="py-2 px-3 font-semibold text-sky-400">
                                {seed.hu | 0} HU
                              </td>
                              <td className="py-2 px-3 text-slate-300 font-sans">
                                [{seed.worldMm[0]}, {seed.worldMm[1]}, {seed.worldMm[2]}]
                              </td>
                              <td className="py-2 px-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSeed(seed.id)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer transition-colors"
                                  title="Remove seed"
                                >
                                  <IconClose size={13} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Settings for Selected Bone */}
                <div className="flex flex-col gap-3 pt-2 border-t border-[#1E293B]">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: selectedBone.color }}
                    />
                    <span className="text-xs font-semibold text-slate-200">
                      Settings for {selectedBone.name}
                    </span>
                  </div>

                  {/* Seed Threshold: -3024 to 3071 HU */}
                  <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-[#111827] border border-[#1E293B]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-300">
                        Seed Threshold
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={-3024}
                          max={3071}
                          value={selectedBone.seedThresholdHu}
                          onChange={(e) => handleSeedThresholdChange(Number(e.target.value))}
                          className="w-20 px-2 py-0.5 rounded bg-[#1E293B] border border-slate-700 text-xs font-semibold text-right text-sky-400 focus:outline-none focus:border-sky-500"
                        />
                        <span className="text-[11px] text-slate-400">HU</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={-1000}
                      max={2500}
                      value={selectedBone.seedThresholdHu}
                      onChange={(e) => handleSeedThresholdChange(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                    />
                  </div>

                  {/* Sensitivity: 0 to 100 */}
                  <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-[#111827] border border-[#1E293B]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-300">
                        Sensitivity
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={selectedBone.sensitivity}
                          onChange={(e) => handleSensitivityChange(Number(e.target.value))}
                          className="w-16 px-2 py-0.5 rounded bg-[#1E293B] border border-slate-700 text-xs font-semibold text-right text-sky-400 focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={selectedBone.sensitivity}
                      onChange={(e) => handleSensitivityChange(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 2: MASK THRESHOLD HISTOGRAM OPERATIONS               */}
            {/* ======================================================== */}
            {currentTab === 2 && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-150">
                <span className="text-xs font-bold text-slate-200 tracking-tight">
                  Hounsfield Unit Distribution (-1000 to +2500 HU)
                </span>

                {/* Interactive SVG Histogram Container */}
                <div className="relative p-3 rounded-xl bg-[#111827] border border-[#1E293B] flex flex-col gap-2">
                  <div className="h-32 w-full relative">
                    <svg
                      ref={svgRef}
                      viewBox="0 0 460 120"
                      preserveAspectRatio="none"
                      onMouseDown={handleHistogramMouseDown}
                      className="w-full h-full cursor-crosshair overflow-visible"
                    >
                      {/* Grid background reference lines */}
                      <line x1="0" y1="30" x2="460" y2="30" stroke="#1E293B" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1="0" y1="60" x2="460" y2="60" stroke="#1E293B" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1="0" y1="90" x2="460" y2="90" stroke="#1E293B" strokeWidth="1" strokeDasharray="3 3" />

                      {/* Histogram Bars */}
                      {Array.from({ length: NUM_BINS }).map((_, i) => {
                        const binHu = HISTOGRAM_MIN + i * BIN_WIDTH_HU;
                        const x = (i / NUM_BINS) * 460;
                        const w = Math.max(1, 460 / NUM_BINS - 0.5);
                        const h = (histogramData[i] || 0.05) * 105;
                        const y = 115 - h;
                        const isThresholded = binHu >= selectedBone.minHu && binHu <= selectedBone.maxHu;

                        return (
                          <rect
                            key={i}
                            x={x}
                            y={y}
                            width={w}
                            height={h}
                            fill={isThresholded ? '#06B6D4' : '#475569'}
                            rx={0.5}
                          />
                        );
                      })}

                      {/* Vertical Draggable Threshold Cutoff Line at Min HU */}
                      {(() => {
                        const cutoffRatio = Math.max(
                          0,
                          Math.min(1, (selectedBone.minHu - HISTOGRAM_MIN) / (HISTOGRAM_MAX - HISTOGRAM_MIN))
                        );
                        const cutoffX = cutoffRatio * 460;
                        return (
                          <g>
                            <line
                              x1={cutoffX}
                              y1={5}
                              x2={cutoffX}
                              y2={115}
                              stroke="#FFFFFF"
                              strokeWidth={2}
                              strokeDasharray="2 1"
                            />
                            {/* Drag handle */}
                            <polygon
                              points={`${cutoffX - 5},2 ${cutoffX + 5},2 ${cutoffX},10`}
                              fill="#FFFFFF"
                            />
                          </g>
                        );
                      })()}
                    </svg>
                  </div>

                  {/* Histogram Axis Markers */}
                  <div className="flex justify-between text-[10px] text-slate-400 font-sans px-1">
                    <span>-1000 HU</span>
                    <span>0 HU</span>
                    <span>+1000 HU</span>
                    <span>+2500 HU</span>
                  </div>
                </div>

                {/* Min HU & Max HU Numeric Input Boxes */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-[#111827] border border-[#1E293B]">
                    <span className="text-[11px] font-medium text-slate-400">Min HU</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={HISTOGRAM_MIN}
                        max={selectedBone.maxHu - 1}
                        value={selectedBone.minHu}
                        onChange={(e) => handleMinHuChange(Number(e.target.value))}
                        className="w-full px-2.5 py-1 rounded bg-[#1E293B] border border-slate-700 text-xs font-semibold text-sky-400 focus:outline-none focus:border-sky-500"
                      />
                      <span className="text-xs text-slate-400">HU</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-[#111827] border border-[#1E293B]">
                    <span className="text-[11px] font-medium text-slate-400">Max HU</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={selectedBone.minHu + 1}
                        max={HISTOGRAM_MAX}
                        value={selectedBone.maxHu}
                        onChange={(e) => handleMaxHuChange(Number(e.target.value))}
                        className="w-full px-2.5 py-1 rounded bg-[#1E293B] border border-slate-700 text-xs font-semibold text-sky-400 focus:outline-none focus:border-sky-500"
                      />
                      <span className="text-xs text-slate-400">HU</span>
                    </div>
                  </div>
                </div>

                {/* Apply Settings to All Masks Checkbox */}
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={applyThresholdToAll}
                    onChange={(e) => setApplyThresholdToAll(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#1E293B] border-slate-700 text-[#0284C7] focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-300">
                    Apply settings to all masks
                  </span>
                </label>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 3: FINISHING PARAMETERS AND EXECUTION               */}
            {/* ======================================================== */}
            {currentTab === 3 && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-150">
                <span className="text-xs font-bold text-slate-200 tracking-tight">
                  Finishing Parameters
                </span>

                {/* Clean Bordered Rows */}
                <div className="flex flex-col border border-[#1E293B] rounded-xl overflow-hidden divide-y divide-[#1E293B] bg-[#111827]">
                  {/* Row 1: Gap Closing Distance */}
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">
                      Gap Closing Distance
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={15}
                        value={selectedBone.gapClosingDistancePx}
                        onChange={(e) => handleGapClosingChange(Number(e.target.value))}
                        className="w-16 px-2.5 py-1 rounded bg-[#1E293B] border border-slate-700 text-xs font-semibold text-right text-sky-400 focus:outline-none focus:border-sky-500"
                      />
                      <span className="text-xs text-slate-400 font-medium">px</span>
                    </div>
                  </div>

                  {/* Row 2: Fill Long Bones */}
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">
                      Fill Long Bones
                    </span>
                    <input
                      type="checkbox"
                      checked={selectedBone.fillLongBones}
                      onChange={(e) => handleToggleFillLongBones(e.target.checked)}
                      className="w-4 h-4 rounded bg-[#1E293B] border-slate-700 text-[#0284C7] focus:ring-0 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Apply Settings to All Masks Checkbox */}
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={applyFinishingToAll}
                    onChange={(e) => setApplyFinishingToAll(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#1E293B] border-slate-700 text-[#0284C7] focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-300">
                    Apply settings to all masks
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Persistent Bottom Control Strip Across All Three Tabs */}
        <div className="h-14 px-4 bg-[#111827] border-t border-[#1E293B] flex items-center justify-between shrink-0">
          {/* Left: Preview on the slices checkbox without decorative eye icon */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={previewOnSlices}
              onChange={onTogglePreviewOnSlices}
              className="w-4 h-4 rounded bg-[#1E293B] border-slate-700 text-[#0284C7] focus:ring-0 cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-300">
              Preview on the slices
            </span>
          </label>

          {/* Right: Bottom-Right Navigation Buttons */}
          <div className="flex items-center gap-2">
            {currentTab === 1 && (
              <>
                <button
                  type="button"
                  disabled
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-800/40 cursor-not-allowed"
                >
                  &lt; Back
                </button>
                <button
                  type="button"
                  onClick={() => onChangeTab(2)}
                  className="tactile-rubber px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#0284C7] hover:bg-sky-600 text-white shadow-xs cursor-pointer transition-all"
                >
                  Next &gt;
                </button>
              </>
            )}

            {currentTab === 2 && (
              <>
                <button
                  type="button"
                  onClick={() => onChangeTab(1)}
                  className="tactile-rubber px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 cursor-pointer transition-all"
                >
                  &lt; Back
                </button>
                <button
                  type="button"
                  onClick={() => onChangeTab(3)}
                  className="tactile-rubber px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#0284C7] hover:bg-sky-600 text-white shadow-xs cursor-pointer transition-all"
                >
                  Next &gt;
                </button>
              </>
            )}

            {currentTab === 3 && (
              <>
                <button
                  type="button"
                  onClick={() => onChangeTab(2)}
                  className="tactile-rubber px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 cursor-pointer transition-all"
                >
                  &lt; Back
                </button>

                <button
                  type="button"
                  onClick={onCalculate}
                  disabled={isCalculating}
                  className="tactile-rubber px-3.5 py-1.5 rounded-lg text-xs font-semibold text-sky-400 bg-sky-950/60 border border-sky-700 hover:bg-sky-900/60 cursor-pointer transition-all flex items-center gap-1.5"
                >
                  {isCalculating && (
                    <span className="w-3 h-3 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                  )}
                  <span>Calculate</span>
                </button>

                <button
                  type="button"
                  onClick={onFinish}
                  disabled={isCalculating}
                  className="tactile-rubber px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#0284C7] hover:bg-sky-600 text-white shadow-xs cursor-pointer transition-all"
                >
                  Finish
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="tactile-rubber px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/40 hover:bg-slate-800 cursor-pointer transition-all"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
