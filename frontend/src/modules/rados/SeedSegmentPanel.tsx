import React, { useState } from 'react';
import { Plus, Trash2, Check, RefreshCw } from 'lucide-react';
import { SeedSegmentBone, SeedPoint } from '../../types';
import { HuHistogramEditor } from './HuHistogramEditor';

interface SeedSegmentPanelProps {
  bones: SeedSegmentBone[];
  activeBoneId: string;
  onSelectBone: (id: string) => void;
  onAddBone: () => void;
  onDeleteBone: (id: string) => void;
  activeSeedMode: 'need' | 'not_need';
  onSetSeedMode: (mode: 'need' | 'not_need') => void;
  onUpdateBoneConfig: (boneId: string, updates: Partial<SeedSegmentBone>) => void;
  gapClosingPx: number;
  onChangeGapClosing: (px: number) => void;
  fillLongBones: boolean;
  onToggleFillLongBones: () => void;
  onCalculate: () => void;
  isCalculating: boolean;
  statusMessage?: string;
  histogramData?: number[];
}

export const SeedSegmentPanel: React.FC<SeedSegmentPanelProps> = ({
  bones,
  activeBoneId,
  onSelectBone,
  onAddBone,
  onDeleteBone,
  activeSeedMode,
  onSetSeedMode,
  onUpdateBoneConfig,
  gapClosingPx,
  onChangeGapClosing,
  fillLongBones,
  onToggleFillLongBones,
  onCalculate,
  isCalculating,
  statusMessage,
  histogramData,
}) => {
  const [activeTab, setActiveTab] = useState<'1. Selection' | '2. Threshold' | '3. Finishing'>('1. Selection');

  const currentBone = bones.find((b) => b.id === activeBoneId) || bones[0];

  const allSeeds: SeedPoint[] = currentBone
    ? [...currentBone.need_seeds, ...currentBone.not_need_seeds]
    : [];

  return (
    <div className="w-full flex flex-col gap-2.5 p-3 bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs select-none">
      {/* 3-Step Tab Switcher */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
        {(['1. Selection', '2. Threshold', '3. Finishing'] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`tactile-rubber flex-1 py-1.5 rounded-md font-semibold text-[11px] transition-all ${
                isActive
                  ? 'bg-white dark:bg-[#1E293B] text-[#0284C7] dark:text-[#38BDF8] shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Target Bones Header */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {bones.map((b) => {
            const isSel = b.id === activeBoneId;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onSelectBone(b.id)}
                className={`tactile-rubber px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isSel
                    ? 'bg-[#0284C7] text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div
                  style={{ backgroundColor: b.color }}
                  className="w-2 h-2 rounded-full border border-white/40"
                />
                <span>{b.name}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onAddBone}
            title="Add Bone"
            className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 tactile-rubber"
          >
            <Plus className="w-4 h-4" />
          </button>
          {bones.length > 1 && (
            <button
              type="button"
              onClick={() => onDeleteBone(activeBoneId)}
              title="Delete Active Bone"
              className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 tactile-rubber"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: 1. Selection */}
      {activeTab === '1. Selection' && currentBone && (
        <div className="flex flex-col gap-2.5">
          {/* Seed Points Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="grid grid-cols-3 bg-slate-100 dark:bg-slate-900 px-2 py-1 font-bold text-[10px] text-slate-500">
              <span>Seed Name</span>
              <span className="text-center">Intensity</span>
              <span className="text-right">Coords</span>
            </div>

            <div className="max-h-24 overflow-y-auto flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50">
              {allSeeds.length === 0 ? (
                <div className="p-3 text-center text-slate-400 text-[11px]">
                  Click on 2D slice to plant seed
                </div>
              ) : (
                allSeeds.map((sp) => (
                  <div key={sp.id} className="grid grid-cols-3 px-2 py-1 items-center text-[10px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          sp.type === 'need' ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      />
                      <span className="font-semibold truncate">{sp.name}</span>
                    </div>
                    <span className="text-center text-slate-500">{sp.hu} HU</span>
                    <span className="text-right text-slate-400 font-mono">
                      {sp.voxel[0]},{sp.voxel[1]},{sp.voxel[2]}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Seed Mode Selector Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSetSeedMode('need')}
              className={`tactile-rubber py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                activeSeedMode === 'need'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-[#22C55E] shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-[#22C55E]'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
              <span>Need Seed</span>
            </button>

            <button
              type="button"
              onClick={() => onSetSeedMode('not_need')}
              className={`tactile-rubber py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                activeSeedMode === 'not_need'
                  ? 'bg-red-50 dark:bg-red-950/40 border-red-500 text-[#EF4444] shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-[#EF4444]'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-[#EF4444]" />
              <span>Not Need</span>
            </button>
          </div>

          {/* Seed Threshold HU Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>Seed Threshold</span>
              <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                {currentBone.seed_threshold_hu} HU
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={600}
              step={10}
              value={currentBone.seed_threshold_hu}
              onChange={(e) =>
                onUpdateBoneConfig(currentBone.id, {
                  seed_threshold_hu: parseInt(e.target.value, 10),
                })
              }
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
            />
          </div>

          {/* Sensitivity Slider (0..100) */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>Sensitivity</span>
              <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                {currentBone.sensitivity} %
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={currentBone.sensitivity}
              onChange={(e) =>
                onUpdateBoneConfig(currentBone.id, {
                  sensitivity: parseInt(e.target.value, 10),
                })
              }
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
            />
          </div>
        </div>
      )}

      {/* TAB 2: 2. Threshold */}
      {activeTab === '2. Threshold' && currentBone && (
        <div className="flex flex-col gap-2">
          <HuHistogramEditor
            histogramData={histogramData}
            minHu={currentBone.min_hu}
            maxHu={currentBone.max_hu}
            onChangeHuRange={(min, max) =>
              onUpdateBoneConfig(currentBone.id, { min_hu: min, max_hu: max })
            }
          />
        </div>
      )}

      {/* TAB 3: 3. Finishing */}
      {activeTab === '3. Finishing' && (
        <div className="flex flex-col gap-3">
          {/* Gap Closing Distance */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              Gap Closing Distance
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={15}
                value={gapClosingPx}
                onChange={(e) => onChangeGapClosing(parseInt(e.target.value, 10) || 0)}
                className="w-12 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 text-right font-bold"
              />
              <span className="text-slate-400 font-semibold">px</span>
            </div>
          </div>

          {/* Fill Long Bones */}
          <label className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              Fill Long Bones (Medullary Cavity)
            </span>
            <input
              type="checkbox"
              checked={fillLongBones}
              onChange={onToggleFillLongBones}
              className="w-4 h-4 rounded text-[#0284C7] focus:ring-sky-500 accent-[#0284C7] cursor-pointer"
            />
          </label>

          {/* Status readout */}
          {statusMessage && (
            <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-900">
              {statusMessage}
            </div>
          )}

          {/* Calculate Button */}
          <button
            type="button"
            onClick={onCalculate}
            disabled={isCalculating}
            className="tactile-rubber w-full py-2.5 rounded-xl font-bold text-white bg-[#0284C7] hover:bg-sky-700 shadow-md shadow-sky-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isCalculating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Computing Watershed...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Calculate Bone Masks</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
