import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

interface HuHistogramEditorProps {
  histogramData?: number[]; // 100 bins from -1024 to +3071 HU
  minHu: number;
  maxHu: number;
  onChangeHuRange: (min: number, max: number) => void;
  onApplyMask?: () => void;
  actionButtonLabel?: string;
}

const HIST_MIN = -1024;
const HIST_MAX = 3071;
const HIST_RANGE = HIST_MAX - HIST_MIN;

const PRESETS = [
  { label: 'Bone', min: 226, max: 3071 },
  { label: 'Spongiosa', min: 150, max: 700 },
  { label: 'Soft Tissue', min: -100, max: 200 },
];

export const HuHistogramEditor: React.FC<HuHistogramEditorProps> = ({
  histogramData,
  minHu,
  maxHu,
  onChangeHuRange,
  onApplyMask,
  actionButtonLabel = 'Create Mask from Threshold',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingHandle, setDraggingHandle] = useState<'min' | 'max' | null>(null);

  // Draft text inputs
  const [minInput, setMinInput] = useState<string>(minHu.toString());
  const [maxInput, setMaxInput] = useState<string>(maxHu.toString());

  useEffect(() => {
    setMinInput(minHu.toString());
  }, [minHu]);

  useEffect(() => {
    setMaxInput(maxHu.toString());
  }, [maxHu]);

  // Compute normalized logarithmic points for SVG area
  const svgPath = useMemo(() => {
    const bins = histogramData && histogramData.length > 0
      ? histogramData
      : Array.from({ length: 100 }, (_, i) => Math.max(1, Math.sin((i / 100) * Math.PI) * 1000));

    const maxCount = Math.max(...bins, 1);
    const logMax = Math.log10(maxCount + 1);

    const width = 280;
    const height = 90;

    const points = bins.map((c, i) => {
      const x = (i / (bins.length - 1)) * width;
      const logVal = Math.log10(c + 1);
      const normH = logVal / logMax;
      const y = height - normH * (height - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return `M 0,${height} L ` + points.join(' L ') + ` L ${width},${height} Z`;
  }, [histogramData]);

  const huToPercent = (hu: number) => {
    return Math.max(0, Math.min(100, ((hu - HIST_MIN) / HIST_RANGE) * 100));
  };

  const percentToHu = (pct: number) => {
    return Math.round(HIST_MIN + (pct / 100) * HIST_RANGE);
  };

  const handlePointerDown = (handle: 'min' | 'max') => (e: React.PointerEvent) => {
    e.preventDefault();
    setDraggingHandle(handle);
  };

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingHandle || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.clientX;
      const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const targetHu = percentToHu(pct);

      if (draggingHandle === 'min') {
        const newMin = Math.min(targetHu, maxHu - 10);
        onChangeHuRange(newMin, maxHu);
      } else {
        const newMax = Math.max(targetHu, minHu + 10);
        onChangeHuRange(minHu, newMax);
      }
    },
    [draggingHandle, minHu, maxHu, onChangeHuRange]
  );

  const handlePointerUp = useCallback(() => {
    setDraggingHandle(null);
  }, []);

  useEffect(() => {
    if (draggingHandle) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [draggingHandle, handlePointerMove, handlePointerUp]);

  const commitMinInput = () => {
    const val = parseInt(minInput, 10);
    if (!isNaN(val)) {
      const clamped = Math.max(HIST_MIN, Math.min(maxHu - 10, val));
      onChangeHuRange(clamped, maxHu);
      setMinInput(clamped.toString());
    } else {
      setMinInput(minHu.toString());
    }
  };

  const commitMaxInput = () => {
    const val = parseInt(maxInput, 10);
    if (!isNaN(val)) {
      const clamped = Math.min(HIST_MAX, Math.max(minHu + 10, val));
      onChangeHuRange(minHu, clamped);
      setMaxInput(clamped.toString());
    } else {
      setMaxInput(maxHu.toString());
    }
  };

  const minPct = huToPercent(minHu);
  const maxPct = huToPercent(maxHu);

  return (
    <div className="w-full flex flex-col gap-3 p-3 bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      {/* Header & Tissue Presets */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Threshold Range
        </span>
        <div className="flex items-center gap-1">
          {PRESETS.map((p) => {
            const isSelected = minHu === p.min && maxHu === p.max;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onChangeHuRange(p.min, p.max)}
                className={`tactile-rubber px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                  isSelected
                    ? 'bg-[#0284C7] text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Histogram Area */}
      <div
        ref={containerRef}
        className="relative w-full h-[95px] bg-slate-950 rounded-lg overflow-hidden border border-slate-800 select-none cursor-ew-resize"
      >
        <svg viewBox="0 0 280 90" preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <linearGradient id="huSkyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#0284C7" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          {/* Base muted distribution curve */}
          <path d={svgPath} fill="rgba(100, 116, 139, 0.25)" />
        </svg>

        {/* Active Sky-Blue Highlight Box */}
        <div
          style={{
            left: `${minPct}%`,
            width: `${Math.max(0, maxPct - minPct)}%`,
          }}
          className="absolute inset-y-0 bg-gradient-to-r from-sky-500/25 via-sky-400/35 to-sky-500/25 border-y border-sky-400/40 pointer-events-none"
        />

        {/* Draggable Min Line & Pill */}
        <div
          style={{ left: `${minPct}%` }}
          onPointerDown={handlePointerDown('min')}
          className="absolute inset-y-0 -translate-x-1/2 w-4 flex flex-col items-center justify-between cursor-ew-resize z-20 group"
        >
          <div className="w-[2px] h-full bg-[#38BDF8] shadow-sm shadow-sky-400" />
          <div className="absolute top-1 bg-[#0284C7] text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-md pointer-events-none whitespace-nowrap">
            {minHu}
          </div>
        </div>

        {/* Draggable Max Line & Pill */}
        <div
          style={{ left: `${maxPct}%` }}
          onPointerDown={handlePointerDown('max')}
          className="absolute inset-y-0 -translate-x-1/2 w-4 flex flex-col items-center justify-between cursor-ew-resize z-20 group"
        >
          <div className="w-[2px] h-full bg-[#38BDF8] shadow-sm shadow-sky-400" />
          <div className="absolute top-1 bg-[#0284C7] text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-md pointer-events-none whitespace-nowrap">
            {maxHu}
          </div>
        </div>

        {/* Axis labels */}
        <div className="absolute bottom-0.5 left-1 text-[9px] text-slate-500 font-medium pointer-events-none">
          -1024
        </div>
        <div className="absolute bottom-0.5 right-1 text-[9px] text-slate-500 font-medium pointer-events-none">
          +3071 HU
        </div>
      </div>

      {/* Numeric Direct Input Fields */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-semibold text-slate-500">Min</span>
          <input
            type="number"
            value={minInput}
            onChange={(e) => setMinInput(e.target.value)}
            onBlur={commitMinInput}
            onKeyDown={(e) => e.key === 'Enter' && commitMinInput()}
            className="w-full bg-transparent text-right font-bold text-xs text-slate-900 dark:text-slate-100 outline-none tabular-nums"
          />
          <span className="text-[10px] font-semibold text-slate-400">HU</span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-semibold text-slate-500">Max</span>
          <input
            type="number"
            value={maxInput}
            onChange={(e) => setMaxInput(e.target.value)}
            onBlur={commitMaxInput}
            onKeyDown={(e) => e.key === 'Enter' && commitMaxInput()}
            className="w-full bg-transparent text-right font-bold text-xs text-slate-900 dark:text-slate-100 outline-none tabular-nums"
          />
          <span className="text-[10px] font-semibold text-slate-400">HU</span>
        </div>
      </div>

      {/* Action Button */}
      {onApplyMask && (
        <button
          type="button"
          onClick={onApplyMask}
          className="tactile-rubber w-full py-2 rounded-xl text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 shadow-md shadow-sky-600/25 transition-all cursor-pointer"
        >
          {actionButtonLabel}
        </button>
      )}
    </div>
  );
};
