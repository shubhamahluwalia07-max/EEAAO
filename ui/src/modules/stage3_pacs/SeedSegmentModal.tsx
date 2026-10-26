import React, { useState, useEffect, useRef } from 'react';
import { MprVolume } from './mprEngine';
import { SegmentationMask, SeedPointEntry, SeedKind } from './types';
import { IconClose, IconTrash, IconPlus } from './Icons';
import { HuHistogramEditor } from './HuHistogramEditor';

interface SeedSegmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancel: () => void;
  volume: MprVolume | null;
  masks: SegmentationMask[];
  activeMaskId: string;
  onSelectMaskId: (id: string) => void;
  onCreateManualMask: () => void;
  seedMode: SeedKind;
  onChangeSeedMode: (mode: SeedKind) => void;
  seedPoints: SeedPointEntry[];
  onDeleteSeedPoint: (id: string) => void;
  onClearSeedPoints: () => void;
  sensitivity: number;
  onChangeSensitivity: (val: number) => void;
  seedThresholdHu: number;
  onChangeSeedThresholdHu: (val: number) => void;
  currentTab: 1 | 2 | 3;
  onChangeTab: (tab: 1 | 2 | 3) => void;
  gapClosingMm: number;
  onChangeGapClosingMm: (val: number) => void;
  fillCavities: boolean;
  onToggleFillCavities: () => void;
  previewOnSlices: boolean;
  onTogglePreviewOnSlices: () => void;
  onCalculate: () => void;
  onFinish: () => void;
  isCalculating: boolean;
  onUpdateMaskHu: (maskId: string, minHu: number, maxHu: number) => void;
}

export const SeedSegmentModal: React.FC<SeedSegmentModalProps> = ({
  isOpen,
  onClose,
  onCancel,
  volume,
  masks,
  activeMaskId,
  onSelectMaskId,
  onCreateManualMask,
  seedMode,
  onChangeSeedMode,
  seedPoints,
  onDeleteSeedPoint,
  onClearSeedPoints,
  sensitivity,
  onChangeSensitivity,
  seedThresholdHu,
  onChangeSeedThresholdHu,
  currentTab,
  onChangeTab,
  gapClosingMm,
  onChangeGapClosingMm,
  fillCavities,
  onToggleFillCavities,
  previewOnSlices,
  onTogglePreviewOnSlices,
  onCalculate,
  onFinish,
  isCalculating,
  onUpdateMaskHu,
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

  // Center modal initially on mount
  useEffect(() => {
    if (isOpen && modalPos === null) {
      const x = Math.max(20, Math.floor((window.innerWidth - 640) / 2));
      const y = Math.max(30, Math.floor((window.innerHeight - 560) / 2));
      setModalPos({ x, y });
    }
  }, [isOpen, modalPos]);

  // Window drag handlers
  const handleTitleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('select')) return;
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
        x: Math.max(10, Math.min(window.innerWidth - 300, dragRef.current.initX + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 150, dragRef.current.initY + dy)),
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

  const activeMask = masks.find((m) => m.id === activeMaskId) || null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none select-none font-sans">
      <div
        style={{
          position: 'absolute',
          left: modalPos ? `${modalPos.x}px` : 'calc(50% - 320px)',
          top: modalPos ? `${modalPos.y}px` : '60px',
        }}
        className="pointer-events-auto w-[640px] bg-[#0F172A] border border-[#1E293B] rounded-xl shadow-2xl flex flex-col text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Draggable Title Bar */}
        <div
          onMouseDown={handleTitleMouseDown}
          className="h-11 px-4 bg-[#111827] border-b border-[#1E293B] flex items-center justify-between cursor-move shrink-0"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0284C7]" />
            <span className="text-sm font-semibold text-white tracking-tight">
              Seed Segment
            </span>
            {activeMask && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: activeMask.color }}
                />
                <span className="text-slate-200 font-medium truncate max-w-[140px]">
                  {activeMask.name}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
            title="Cancel and Close"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* 3-Tab Horizontal Step Header */}
        <div className="flex items-center border-b border-[#1E293B] bg-[#0F172A] px-2 shrink-0">
          {[
            { step: 1 as const, label: '1. Selection' },
            { step: 2 as const, label: '2. Threshold' },
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

        {/* Modal Body */}
        <div className="p-4 flex-1 flex flex-col gap-3 min-h-[360px] max-h-[460px] overflow-y-auto bg-[#0F172A]">
          {/* ======================================================== */}
          {/* TAB 1: SEED SELECTION & MANUAL MASK ASSIGNMENT            */}
          {/* ======================================================== */}
          {currentTab === 1 && (
            <div className="flex flex-col gap-3.5">
              {/* Target Manual Mask Row */}
              <div className="p-2.5 rounded-lg bg-[#111827] border border-[#1E293B] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                    Target Mask:
                  </span>
                  {masks.length === 0 ? (
                    <span className="text-xs text-amber-400 font-medium">
                      No mask loaded. Click button to add manual mask.
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        value={activeMaskId}
                        onChange={(e) => onSelectMaskId(e.target.value)}
                        className="bg-slate-800 text-white text-xs rounded-md px-2.5 py-1 border border-slate-700 focus:outline-none focus:border-[#0284C7] cursor-pointer"
                      >
                        {masks.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      {activeMask && (
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/40"
                          style={{ backgroundColor: activeMask.color }}
                        />
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onCreateManualMask}
                  className="tactile-rubber px-3 py-1 rounded-md text-xs font-semibold bg-[#0284C7] hover:bg-sky-600 text-white flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 transition-all"
                >
                  <IconPlus size={13} />
                  <span>+ Add Manual Mask</span>
                </button>
              </div>

              {/* Seed Mode Placement Toggles: Need Seed vs Not Need */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">
                    Seed Placement Mode
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {activeMask ? 'Click on slice to plant seed' : 'Add manual mask first'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onChangeSeedMode('need')}
                    className={`tactile-rubber py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all border ${
                      seedMode === 'need'
                        ? 'border-[#10B981] bg-[#10B981] text-white shadow-md'
                        : 'border-[#10B981]/40 bg-[#10B981]/10 text-emerald-400 hover:bg-[#10B981]/20'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-white shrink-0" />
                    <span>Need Seed (Inclusion)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeSeedMode('not_need')}
                    className={`tactile-rubber py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all border ${
                      seedMode === 'not_need'
                        ? 'border-[#EF4444] bg-[#EF4444] text-white shadow-md'
                        : 'border-[#EF4444]/40 bg-[#EF4444]/10 text-rose-400 hover:bg-[#EF4444]/20'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-white shrink-0" />
                    <span>Not Need (Barrier)</span>
                  </button>
                </div>
              </div>

              {/* Planted Seeds Table */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">
                    Planted Seed Points ({seedPoints.length})
                  </span>
                  {seedPoints.length > 0 && (
                    <button
                      type="button"
                      onClick={onClearSeedPoints}
                      className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
                    >
                      Clear All Seeds
                    </button>
                  )}
                </div>

                <div className="border border-[#1E293B] rounded-lg overflow-hidden bg-[#111827]">
                  <div className="max-h-[140px] overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-[#182234] text-slate-400 uppercase text-[10px] font-semibold border-b border-[#1E293B] sticky top-0 z-10">
                        <tr>
                          <th className="py-1.5 px-3">KIND / NAME</th>
                          <th className="py-1.5 px-3">HU</th>
                          <th className="py-1.5 px-3">COORDINATES (MM)</th>
                          <th className="py-1.5 px-2 text-right">REMOVE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E293B]">
                        {seedPoints.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-5 text-center text-slate-500 text-xs italic">
                              {activeMask
                                ? 'No seeds planted yet. Click on any slice to plant Need or Not Need seeds.'
                                : 'Please create or select a manual mask first.'}
                            </td>
                          </tr>
                        ) : (
                          seedPoints.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-800/40">
                              <td className="py-1.5 px-3 flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: s.kind === 'need' ? '#10B981' : '#EF4444' }}
                                />
                                <span className="font-semibold text-slate-200">
                                  {s.name}
                                </span>
                              </td>
                              <td className="py-1.5 px-3 text-slate-300 font-mono">
                                {s.hu} HU
                              </td>
                              <td className="py-1.5 px-3 text-slate-400 font-mono text-[10px]">
                                {s.coordsMm[0].toFixed(1)}, {s.coordsMm[1].toFixed(1)}, {(s.coordsMm[2] ?? 0).toFixed(1)}
                              </td>
                              <td className="py-1.5 px-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => onDeleteSeedPoint(s.id)}
                                  className="text-slate-400 hover:text-rose-400 p-1 rounded-md transition-colors cursor-pointer"
                                  title="Delete Seed"
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
              </div>

              {/* Sliders: Sensitivity and Seed Threshold */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Sensitivity Slider */}
                <div className="flex flex-col gap-1 p-2 rounded-lg bg-[#111827] border border-[#1E293B]">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-300">Sensitivity:</span>
                    <span className="font-bold text-[#0284C7]">{sensitivity} / 100</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sensitivity}
                    onChange={(e) => onChangeSensitivity(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                  />
                  <span className="text-[9px] text-slate-400 leading-tight">
                    Low stops at cortical bone; high expands across joint bridges
                  </span>
                </div>

                {/* Seed Threshold HU Slider */}
                <div className="flex flex-col gap-1 p-2 rounded-lg bg-[#111827] border border-[#1E293B]">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-300">Seed Threshold:</span>
                    <span className="font-bold text-[#0284C7]">{seedThresholdHu} HU</span>
                  </div>
                  <input
                    type="range"
                    min="-200"
                    max="1000"
                    step="10"
                    value={seedThresholdHu}
                    onChange={(e) => onChangeSeedThresholdHu(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                  />
                  <span className="text-[9px] text-slate-400 leading-tight">
                    Minimum density seed required to initiate inclusion
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: THRESHOLD (HU HISTOGRAM EDITOR)                   */}
          {/* ======================================================== */}
          {currentTab === 2 && activeMask && (
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-slate-200">
                Density Threshold for {activeMask.name}
              </span>
              <HuHistogramEditor
                minHu={activeMask.minHu}
                maxHu={activeMask.maxHu}
                onChange={(min, max) => onUpdateMaskHu(activeMask.id, min, max)}
                applyToAllMasks={false}
                showPresets={true}
              />
            </div>
          )}

          {currentTab === 2 && !activeMask && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 gap-3">
              <IconLayers size={24} className="text-slate-500" />
              <span className="text-xs">No active mask. Please add a manual mask first.</span>
              <button
                type="button"
                onClick={onCreateManualMask}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0284C7] text-white"
              >
                + Add Manual Mask
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: FINISHING (GAP CLOSING & CAVITY FILLING)           */}
          {/* ======================================================== */}
          {currentTab === 3 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-[#111827] border border-[#1E293B]">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Gap closing distance:</span>
                  <span className="font-bold text-[#0284C7]">{gapClosingMm.toFixed(1)} mm</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5.0"
                  step="0.5"
                  value={gapClosingMm}
                  onChange={(e) => onChangeGapClosingMm(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                />
                <span className="text-[10px] text-slate-400">
                  Closes micro-gaps and hairline fractures during morphological closure.
                </span>
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-lg bg-[#111827] border border-[#1E293B] cursor-pointer text-xs font-medium text-slate-300">
                <input
                  type="checkbox"
                  checked={fillCavities}
                  onChange={onToggleFillCavities}
                  className="w-4 h-4 rounded text-[#0284C7] accent-[#0284C7]"
                />
                <span>Fill internal bone cavities and medullary canals</span>
              </label>
            </div>
          )}
        </div>

        {/* Persistent Bottom Control Strip Across All Three Tabs */}
        <div className="h-14 px-4 bg-[#111827] border-t border-[#1E293B] flex items-center justify-between shrink-0">
          {/* Left: Preview on the slices checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={previewOnSlices}
              onChange={onTogglePreviewOnSlices}
              className="w-4 h-4 rounded bg-[#1E293B] border-slate-700 text-[#0284C7] focus:ring-0 cursor-pointer accent-[#0284C7]"
            />
            <span className="text-xs font-medium text-slate-300">
              Preview on the slices
            </span>
          </label>

          {/* Right: Navigation, Actions, and Persistent Cancel */}
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
                  disabled={isCalculating || !activeMask}
                  className="tactile-rubber px-3.5 py-1.5 rounded-lg text-xs font-semibold text-sky-400 bg-sky-950/60 border border-sky-700 hover:bg-sky-900/60 cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isCalculating && (
                    <span className="w-3 h-3 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                  )}
                  <span>Calculate</span>
                </button>

                <button
                  type="button"
                  onClick={onFinish}
                  disabled={isCalculating || !activeMask}
                  className="tactile-rubber px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#0284C7] hover:bg-sky-600 text-white shadow-xs cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Finish
                </button>
              </>
            )}

            {/* Persistent Cancel Button Across All Tabs */}
            <button
              type="button"
              onClick={onCancel}
              className="tactile-rubber px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 cursor-pointer transition-all"
              title="Cancel and discard operation"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
