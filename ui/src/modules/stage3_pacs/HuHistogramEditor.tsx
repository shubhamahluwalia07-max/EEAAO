import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';

interface HuHistogramEditorProps {
  minHu: number;
  maxHu: number;
  onChange: (min: number, max: number) => void;
  voxels?: Int16Array | null;
  applyToAllMasks?: boolean;
  onToggleApplyToAll?: () => void;
  showPresets?: boolean;
  className?: string;
}

const HIST_MIN_HU = -1024;
const HIST_MAX_HU = 3071;
const HIST_RANGE = HIST_MAX_HU - HIST_MIN_HU; // 4095
const BIN_COUNT = 120;

export const HuHistogramEditor: React.FC<HuHistogramEditorProps> = ({
  minHu,
  maxHu,
  onChange,
  voxels,
  applyToAllMasks = false,
  onToggleApplyToAll,
  showPresets = true,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(270);
  const height = 90;

  // Local drafts for editable numeric inputs (enforced on Enter or blur)
  const [minDraft, setMinDraft] = useState<string>(String(minHu));
  const [maxDraft, setMaxDraft] = useState<string>(String(maxHu));

  useEffect(() => {
    setMinDraft(String(minHu));
  }, [minHu]);

  useEffect(() => {
    setMaxDraft(String(maxHu));
  }, [maxHu]);

  // Observe container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateW = () => {
      const w = el.clientWidth || 270;
      setContainerWidth(w);
    };
    updateW();
    const obs = new ResizeObserver(updateW);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Compute logarithmic density curve bins
  const binCounts = useMemo(() => {
    const bins = new Float32Array(BIN_COUNT);
    if (voxels && voxels.length > 0) {
      // Fast stride sampling
      const step = Math.max(1, Math.floor(voxels.length / 40000));
      for (let i = 0; i < voxels.length; i += step) {
        const hu = voxels[i];
        if (hu >= HIST_MIN_HU && hu <= HIST_MAX_HU) {
          const binIdx = Math.min(
            BIN_COUNT - 1,
            Math.max(0, Math.floor(((hu - HIST_MIN_HU) / HIST_RANGE) * BIN_COUNT))
          );
          bins[binIdx]++;
        }
      }
    } else {
      // Anatomical synthetic CT distribution curve (Air, Fat, Soft Tissue, Cancellous, Cortical)
      for (let b = 0; b < BIN_COUNT; b++) {
        const hu = HIST_MIN_HU + (b / BIN_COUNT) * HIST_RANGE;
        const air = Math.exp(-Math.pow((hu - -1000) / 40, 2)) * 1200;
        const fat = Math.exp(-Math.pow((hu - -100) / 35, 2)) * 400;
        const soft = Math.exp(-Math.pow((hu - 40) / 45, 2)) * 850;
        const spong = Math.exp(-Math.pow((hu - 250) / 80, 2)) * 320;
        const bone = Math.exp(-Math.pow((hu - 1000) / 300, 2)) * 520;
        bins[b] = air + fat + soft + spong + bone + 10;
      }
    }

    // Apply log scale normalization
    let maxVal = 1;
    for (let b = 0; b < BIN_COUNT; b++) {
      bins[b] = Math.log1p(bins[b]);
      if (bins[b] > maxVal) maxVal = bins[b];
    }
    for (let b = 0; b < BIN_COUNT; b++) {
      bins[b] = bins[b] / maxVal;
    }
    return bins;
  }, [voxels]);

  // Coordinate conversion helpers
  const huToX = useCallback(
    (hu: number) => {
      const clamped = Math.max(HIST_MIN_HU, Math.min(HIST_MAX_HU, hu));
      return ((clamped - HIST_MIN_HU) / HIST_RANGE) * containerWidth;
    },
    [containerWidth]
  );

  const xToHu = useCallback(
    (x: number) => {
      const norm = Math.max(0, Math.min(1, x / containerWidth));
      return Math.round(HIST_MIN_HU + norm * HIST_RANGE);
    },
    [containerWidth]
  );

  // SVG Path generator
  const fullPathD = useMemo(() => {
    if (containerWidth <= 0) return '';
    let d = `M 0 ${height}`;
    for (let b = 0; b < BIN_COUNT; b++) {
      const x = (b / (BIN_COUNT - 1)) * containerWidth;
      const y = height - binCounts[b] * (height - 8);
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    d += ` L ${containerWidth} ${height} Z`;
    return d;
  }, [binCounts, containerWidth, height]);

  // Draggable handle states
  const [draggingHandle, setDraggingHandle] = useState<'min' | 'max' | null>(null);

  const minX = huToX(minHu);
  const maxX = huToX(maxHu);

  const handleMouseDownHandle = (handle: 'min' | 'max') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingHandle(handle);
  };

  useEffect(() => {
    if (!draggingHandle) return;

    const handleMouseMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const newHu = xToHu(clickX);

      if (draggingHandle === 'min') {
        const clampedMin = Math.min(maxHu - 10, Math.max(HIST_MIN_HU, newHu));
        onChange(clampedMin, maxHu);
      } else if (draggingHandle === 'max') {
        const clampedMax = Math.max(minHu + 10, Math.min(HIST_MAX_HU, newHu));
        onChange(minHu, clampedMax);
      }
    };

    const handleMouseUp = () => {
      setDraggingHandle(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingHandle, minHu, maxHu, onChange, xToHu]);

  // Commit numeric inputs on Enter or blur
  const commitMinInput = () => {
    const parsed = parseInt(minDraft, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(HIST_MIN_HU, Math.min(maxHu - 10, parsed));
      onChange(clamped, maxHu);
      setMinDraft(String(clamped));
    } else {
      setMinDraft(String(minHu));
    }
  };

  const commitMaxInput = () => {
    const parsed = parseInt(maxDraft, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.min(HIST_MAX_HU, Math.max(minHu + 10, parsed));
      onChange(minHu, clamped);
      setMaxDraft(String(clamped));
    } else {
      setMaxDraft(String(maxHu));
    }
  };

  // Fixed tick marks as requested in Section 4: -1024, -500, 0, 500, 1000, 1500, 2000, 3071
  const ticks = [
    { hu: -1024, label: '-1024' },
    { hu: -500, label: '-500' },
    { hu: 0, label: '0' },
    { hu: 500, label: '500' },
    { hu: 1000, label: '1k' },
    { hu: 1500, label: '1.5k' },
    { hu: 2000, label: '2k' },
    { hu: 3071, label: '3071' },
  ];

  return (
    <div className={`flex flex-col gap-2.5 font-sans select-none ${className}`}>
      {/* SVG Histogram Graphic Container */}
      <div
        ref={containerRef}
        className="relative w-full h-[115px] bg-slate-900/90 dark:bg-[#0B132B] rounded-xl border border-slate-700/60 p-1.5 overflow-hidden shadow-inner"
      >
        <svg
          width={containerWidth}
          height={height}
          className="overflow-visible block"
          style={{ width: `${containerWidth}px`, height: `${height}px` }}
        >
          <defs>
            {/* Smooth sky-blue vertical gradient for active range */}
            <linearGradient id="hu-blue-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#0284C7" stopOpacity="0.95" />
            </linearGradient>

            {/* Clipping rectangle for active selection [minX, maxX] */}
            <clipPath id="active-range-clip">
              <rect x={minX} y="0" width={Math.max(0, maxX - minX)} height={height} />
            </clipPath>

            {/* Clipping rectangle for excluded lower region [< minX] */}
            <clipPath id="lower-excluded-clip">
              <rect x="0" y="0" width={Math.max(0, minX)} height={height} />
            </clipPath>

            {/* Clipping rectangle for excluded upper region [> maxX] */}
            <clipPath id="upper-excluded-clip">
              <rect x={maxX} y="0" width={Math.max(0, containerWidth - maxX)} height={height} />
            </clipPath>
          </defs>

          {/* Background gridlines for 0 HU and 1000 HU */}
          <line
            x1={huToX(0)}
            y1="0"
            x2={huToX(0)}
            y2={height}
            stroke="rgba(255, 255, 255, 0.12)"
            strokeDasharray="2 2"
          />
          <line
            x1={huToX(1000)}
            y1="0"
            x2={huToX(1000)}
            y2={height}
            stroke="rgba(255, 255, 255, 0.12)"
            strokeDasharray="2 2"
          />

          {/* 1. Muted translucent grey for excluded lower region */}
          <path d={fullPathD} fill="rgba(148, 163, 184, 0.35)" clipPath="url(#lower-excluded-clip)" />

          {/* 2. Active selected range filled in smooth sky-blue vertical gradient */}
          <path d={fullPathD} fill="url(#hu-blue-grad)" clipPath="url(#active-range-clip)" />

          {/* 3. Muted translucent grey for excluded upper region */}
          <path d={fullPathD} fill="rgba(148, 163, 184, 0.35)" clipPath="url(#upper-excluded-clip)" />

          {/* Baseline curve contour stroke */}
          <path
            d={fullPathD}
            fill="none"
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="1.2"
          />

          {/* Draggable Vertical Boundary Handle: Min HU */}
          <line
            x1={minX}
            y1="0"
            x2={minX}
            y2={height}
            stroke="#38BDF8"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle
            cx={minX}
            cy="10"
            r="6"
            fill="#0284C7"
            stroke="#FFFFFF"
            strokeWidth="2"
            className="cursor-ew-resize hover:scale-125 transition-transform"
            onMouseDown={handleMouseDownHandle('min')}
          />

          {/* Draggable Vertical Boundary Handle: Max HU */}
          <line
            x1={maxX}
            y1="0"
            x2={maxX}
            y2={height}
            stroke="#38BDF8"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle
            cx={maxX}
            cy="10"
            r="6"
            fill="#0284C7"
            stroke="#FFFFFF"
            strokeWidth="2"
            className="cursor-ew-resize hover:scale-125 transition-transform"
            onMouseDown={handleMouseDownHandle('max')}
          />
        </svg>

        {/* Floating Numeric Callout Pills directly beneath handles */}
        <div
          className="absolute bottom-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0284C7] text-white shadow-md pointer-events-none -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${Math.max(20, Math.min(containerWidth - 20, minX))}px` }}
        >
          {minHu}
        </div>
        <div
          className="absolute bottom-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0284C7] text-white shadow-md pointer-events-none -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${Math.max(20, Math.min(containerWidth - 20, maxX))}px` }}
        >
          {maxHu}
        </div>
      </div>

      {/* Ticks axis */}
      <div className="flex justify-between px-1 text-[9px] font-semibold text-slate-400">
        {ticks.map((t) => (
          <span key={t.hu} className="tabular-nums">
            {t.label}
          </span>
        ))}
      </div>

      {/* Paired Numeric Step Inputs (Min / Max HU with Enter enforcement) */}
      <div className="grid grid-cols-2 gap-2 pt-0.5">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#151D2C] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#1E293B]">
          <span className="text-[11px] font-semibold text-slate-500">Min</span>
          <input
            type="number"
            min={HIST_MIN_HU}
            max={HIST_MAX_HU}
            step={10}
            value={minDraft}
            onChange={(e) => setMinDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitMinInput();
              }
            }}
            onBlur={commitMinInput}
            className="w-full bg-transparent text-right font-bold text-xs text-slate-900 dark:text-slate-100 outline-none tabular-nums"
          />
          <span className="text-[10px] font-semibold text-slate-400">HU</span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#151D2C] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#1E293B]">
          <span className="text-[11px] font-semibold text-slate-500">Max</span>
          <input
            type="number"
            min={HIST_MIN_HU}
            max={HIST_MAX_HU}
            step={10}
            value={maxDraft}
            onChange={(e) => setMaxDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitMaxInput();
              }
            }}
            onBlur={commitMaxInput}
            className="w-full bg-transparent text-right font-bold text-xs text-slate-900 dark:text-slate-100 outline-none tabular-nums"
          />
          <span className="text-[10px] font-semibold text-slate-400">HU</span>
        </div>
      </div>

      {/* Quick Presets Pills */}
      {showPresets && (
        <div className="flex items-center gap-1 pt-0.5">
          {[
            { name: 'Bone', min: 400, max: 3000 },
            { name: 'Spongiosa', min: 150, max: 400 },
            { name: 'Soft Tissue', min: -100, max: 100 },
          ].map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => onChange(preset.min, preset.max)}
              className={`flex-1 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer border ${
                minHu === preset.min && maxHu === preset.max
                  ? 'bg-[#0284C7] text-white border-[#0284C7] shadow-xs'
                  : 'bg-white dark:bg-[#151D2C] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#1E293B] hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      )}

      {/* Apply settings to all masks checkbox */}
      {onToggleApplyToAll && (
        <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-slate-600 dark:text-slate-300 font-medium">
          <input
            type="checkbox"
            checked={applyToAllMasks}
            onChange={onToggleApplyToAll}
            className="w-3.5 h-3.5 rounded text-[#0284C7] accent-[#0284C7]"
          />
          <span>Apply settings to all masks</span>
        </label>
      )}
    </div>
  );
};

export default HuHistogramEditor;
