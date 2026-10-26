import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Volume3DData, MaskLayer, CadToolType, SeedPoint } from '../../types';

interface Viewport2DProps {
  plane: 'coronal' | 'axial' | 'sagittal';
  volumeData: Volume3DData | null;
  sliceIndex: number;
  onSliceChange: (newIndex: number) => void;
  crosshair: [number, number, number]; // [vx, vy, vz]
  onCrosshairChange: (newCrosshair: [number, number, number]) => void;
  activeTool: CadToolType;
  windowCenter: number;
  windowWidth: number;
  onWindowChange: (wc: number, ww: number) => void;
  rotationDeg: number;
  flipH: boolean;
  flipV: boolean;
  isInverted: boolean;
  masks: MaskLayer[];
  seedPoints: SeedPoint[];
  onSliceClickVoxel?: (voxel: [number, number, number], hu: number) => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
}

export const Viewport2D: React.FC<Viewport2DProps> = ({
  plane,
  volumeData,
  sliceIndex,
  onSliceChange,
  crosshair,
  onCrosshairChange,
  activeTool,
  windowCenter,
  windowWidth,
  onWindowChange,
  rotationDeg,
  flipH,
  flipV,
  isInverted,
  masks,
  seedPoints,
  onSliceClickVoxel,
  isMaximized,
  onToggleMaximize,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Pan and zoom states
  const [zoom, setZoom] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Measurement points
  const [distancePoints, setDistancePoints] = useState<[number, number][]>([]);
  const [anglePoints, setAnglePoints] = useState<[number, number][]>([]);
  const [cobbPoints, setCobbPoints] = useState<[number, number][]>([]);

  // Orientation themes
  const theme = useMemo(() => {
    switch (plane) {
      case 'coronal':
        return { label: 'Coronal', color: '#8B5CF6', borderClass: 'border-purple-600/60' };
      case 'axial':
        return { label: 'Axial', color: '#06B6D4', borderClass: 'border-cyan-500/60' };
      case 'sagittal':
        return { label: 'Sagittal', color: '#F59E0B', borderClass: 'border-amber-500/60' };
    }
  }, [plane]);

  // Volume dimensions & slice range
  const { totalSlices, sliceWidth, sliceHeight, spacingX, spacingY } = useMemo(() => {
    if (!volumeData) {
      return { totalSlices: 1, sliceWidth: 512, sliceHeight: 512, spacingX: 1, spacingY: 1 };
    }
    const [w, h, d] = volumeData.header.dims;
    const [sx, sy, sz] = volumeData.header.spacing;

    if (plane === 'axial') {
      return { totalSlices: d, sliceWidth: w, sliceHeight: h, spacingX: sx, spacingY: sy };
    } else if (plane === 'coronal') {
      return { totalSlices: h, sliceWidth: w, sliceHeight: d, spacingX: sx, spacingY: sz };
    } else {
      // Sagittal
      return { totalSlices: w, sliceWidth: h, sliceHeight: d, spacingX: sy, spacingY: sz };
    }
  }, [volumeData, plane]);

  // Stable references for native non-passive wheel listener
  const sliceIndexRef = useRef(sliceIndex);
  sliceIndexRef.current = sliceIndex;
  const totalSlicesRef = useRef(totalSlices);
  totalSlicesRef.current = totalSlices;
  const onSliceChangeRef = useRef(onSliceChange);
  onSliceChangeRef.current = onSliceChange;

  // Wheel scrubbing with non-passive listener to prevent scroll without passive violation errors
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const factor = e.deltaY < 0 ? 1.08 : 0.92;
        setZoom((z) => Math.max(0.2, Math.min(6.0, z * factor)));
      } else {
        const step = e.deltaY > 0 ? 1 : -1;
        const next = Math.max(0, Math.min(totalSlicesRef.current - 1, sliceIndexRef.current + step));
        onSliceChangeRef.current(next);
      }
    };

    el.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheelNative);
    };
  }, []);

  // Physical millimeter coordinate mapping
  const physicalWidthMm = sliceWidth * spacingX;
  const physicalHeightMm = sliceHeight * spacingY;

  // Render 2D slice on canvas
  const renderSlice = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !volumeData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const [w, h, d] = volumeData.header.dims;
    const vol = volumeData.data;

    canvas.width = sliceWidth;
    canvas.height = sliceHeight;

    const imgData = ctx.createImageData(sliceWidth, sliceHeight);
    const pixels = imgData.data;

    const lutMin = windowCenter - windowWidth / 2;
    const lutMax = windowCenter + windowWidth / 2;
    const lutRange = Math.max(1, lutMax - lutMin);

    const safeSlice = Math.max(0, Math.min(totalSlices - 1, sliceIndex));

    for (let py = 0; py < sliceHeight; py++) {
      for (let px = 0; px < sliceWidth; px++) {
        let voxelVal = 0;
        let vx = 0, vy = 0, vz = 0;

        if (plane === 'axial') {
          vx = px;
          vy = py;
          vz = safeSlice;
        } else if (plane === 'coronal') {
          vx = px;
          vy = safeSlice;
          vz = sliceHeight - 1 - py; // invert Y for standard anatomic Coronal orientation
        } else {
          // Sagittal
          vx = safeSlice;
          vy = px;
          vz = sliceHeight - 1 - py;
        }

        const volIdx = vz * (w * h) + vy * w + vx;
        if (volIdx >= 0 && volIdx < vol.length) {
          voxelVal = vol[volIdx];
        }

        // Grayscale Window/Level mapping
        let norm = (voxelVal - lutMin) / lutRange;
        norm = Math.max(0, Math.min(1, norm));
        let gray = Math.round(norm * 255);
        if (isInverted) gray = 255 - gray;

        const pIdx = (py * sliceWidth + px) * 4;
        pixels[pIdx] = gray;
        pixels[pIdx + 1] = gray;
        pixels[pIdx + 2] = gray;
        pixels[pIdx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [volumeData, plane, sliceIndex, totalSlices, sliceWidth, sliceHeight, windowCenter, windowWidth, isInverted]);

  useEffect(() => {
    renderSlice();
  }, [renderSlice]);

  // Screen to voxel coordinate converter
  const screenToVoxel = (screenX: number, screenY: number): [number, number, number] | null => {
    const canvas = canvasRef.current;
    if (!canvas || !volumeData) return null;
    const rect = canvas.getBoundingClientRect();

    const normX = (screenX - rect.left) / rect.width;
    const normY = (screenY - rect.top) / rect.height;

    const px = Math.round(normX * sliceWidth);
    const py = Math.round(normY * sliceHeight);

    const [w, h, d] = volumeData.header.dims;
    const safeSlice = Math.max(0, Math.min(totalSlices - 1, sliceIndex));

    if (plane === 'axial') {
      return [
        Math.max(0, Math.min(w - 1, px)),
        Math.max(0, Math.min(h - 1, py)),
        safeSlice,
      ];
    } else if (plane === 'coronal') {
      return [
        Math.max(0, Math.min(w - 1, px)),
        safeSlice,
        Math.max(0, Math.min(d - 1, sliceHeight - 1 - py)),
      ];
    } else {
      // Sagittal
      return [
        safeSlice,
        Math.max(0, Math.min(h - 1, px)),
        Math.max(0, Math.min(d - 1, sliceHeight - 1 - py)),
      ];
    }
  };

  // Mouse interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    const voxel = screenToVoxel(e.clientX, e.clientY);
    if (!voxel || !volumeData) return;

    const [vx, vy, vz] = voxel;
    const [w, h] = volumeData.header.dims;
    const hu = volumeData.data[vz * (w * h) + vy * w + vx] || 0;

    if (activeTool === 'crosshair') {
      onCrosshairChange(voxel);
    } else if (activeTool === 'distance') {
      setDistancePoints((prev) => (prev.length >= 2 ? [[vx, vy]] : [...prev, [vx, vy]]));
    } else if (activeTool === 'angle') {
      setAnglePoints((prev) => (prev.length >= 3 ? [[vx, vy]] : [...prev, [vx, vy]]));
    } else if (activeTool === 'cobb') {
      setCobbPoints((prev) => (prev.length >= 4 ? [[vx, vy]] : [...prev, [vx, vy]]));
    }

    if (onSliceClickVoxel) {
      onSliceClickVoxel(voxel, hu);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    if (activeTool === 'pan') {
      setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    } else if (activeTool === 'zoom') {
      const factor = dy < 0 ? 1.02 : 0.98;
      setZoom((z) => Math.max(0.2, Math.min(6.0, z * factor)));
    } else if (activeTool === 'window') {
      const nextWW = Math.max(1, windowWidth + dx * 2);
      const nextWC = windowCenter - dy * 2;
      onWindowChange(nextWC, nextWW);
    } else if (activeTool === 'crosshair') {
      const voxel = screenToVoxel(e.clientX, e.clientY);
      if (voxel) onCrosshairChange(voxel);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Crosshair screen position
  const crosshairScreen = useMemo(() => {
    if (!volumeData) return { x: 50, y: 50 };
    const [vx, vy, vz] = crosshair;
    const [w, h, d] = volumeData.header.dims;

    if (plane === 'axial') {
      return {
        x: (vx / Math.max(1, w)) * 100,
        y: (vy / Math.max(1, h)) * 100,
      };
    } else if (plane === 'coronal') {
      return {
        x: (vx / Math.max(1, w)) * 100,
        y: ((d - 1 - vz) / Math.max(1, d)) * 100,
      };
    } else {
      return {
        x: (vy / Math.max(1, h)) * 100,
        y: ((d - 1 - vz) / Math.max(1, d)) * 100,
      };
    }
  }, [crosshair, volumeData, plane]);

  // Current slice physical thickness display
  const currentMmPosition = useMemo(() => {
    if (!volumeData) return '0.00 mm';
    const [sx, sy, sz] = volumeData.header.spacing;
    let pos = 0;
    if (plane === 'axial') pos = sliceIndex * sz;
    else if (plane === 'coronal') pos = sliceIndex * sy;
    else pos = sliceIndex * sx;
    return `${pos.toFixed(2)} mm`;
  }, [volumeData, plane, sliceIndex]);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative w-full h-full bg-[#000000] overflow-hidden select-none border ${theme.borderClass} flex items-center justify-center`}
    >
      {/* Top Left Orientation Badge */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-2 pointer-events-none">
        <span
          style={{ color: theme.color }}
          className="font-bold text-xs tracking-wide uppercase bg-black/60 px-2 py-0.5 rounded border border-white/10"
        >
          {theme.label}
        </span>
        <span className="text-[11px] font-semibold text-white/70 bg-black/50 px-1.5 py-0.5 rounded">
          {sliceIndex + 1} / {totalSlices}
        </span>
      </div>

      {/* Top Right Maximize Toggle */}
      <button
        type="button"
        onClick={onToggleMaximize}
        className="absolute top-2 right-2 z-20 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white/80 hover:text-white border border-white/10 tactile-rubber cursor-pointer"
        title={isMaximized ? 'Restore Quadrant' : 'Maximize Quadrant'}
      >
        {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
      </button>

      {/* Bottom Right Physical MM Position */}
      <div className="absolute bottom-2 right-2 z-20 text-[11px] font-semibold text-sky-400 bg-black/60 px-2 py-0.5 rounded border border-sky-500/20 pointer-events-none">
        {currentMmPosition}
      </div>

      {/* Canvas Viewport with 0.78 Zoom Buffer for Zero Clipping */}
      <div
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom * 0.78}) rotate(${rotationDeg}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
          aspectRatio: `${physicalWidthMm} / ${physicalHeightMm}`,
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        }}
        className="relative max-w-[90%] max-h-[90%] flex items-center justify-center shadow-2xl"
      >
        <canvas ref={canvasRef} className="w-full h-full object-contain pointer-events-none" />

        {/* 1px Continuous Synchronized Crosshair Lines */}
        {activeTool === 'crosshair' && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Vertical crosshair */}
            <div
              style={{ left: `${crosshairScreen.x}%`, backgroundColor: theme.color }}
              className="absolute top-0 bottom-0 w-[1px] opacity-75 shadow-[0_0_4px_rgba(255,255,255,0.4)]"
            />
            {/* Horizontal crosshair */}
            <div
              style={{ top: `${crosshairScreen.y}%`, backgroundColor: theme.color }}
              className="absolute left-0 right-0 h-[1px] opacity-75 shadow-[0_0_4px_rgba(255,255,255,0.4)]"
            />
          </div>
        )}

        {/* Seed Point Overlay Badges */}
        {seedPoints.map((sp) => {
          const [sx, sy, sz] = sp.voxel;
          const [w, h, d] = volumeData?.header.dims || [512, 512, 1];
          let onThisSlice = false;
          let screenX = 0, screenY = 0;

          if (plane === 'axial') {
            onThisSlice = sz === sliceIndex;
            screenX = (sx / w) * 100;
            screenY = (sy / h) * 100;
          } else if (plane === 'coronal') {
            onThisSlice = sy === sliceIndex;
            screenX = (sx / w) * 100;
            screenY = ((d - 1 - sz) / d) * 100;
          } else {
            onThisSlice = sx === sliceIndex;
            screenX = (sy / h) * 100;
            screenY = ((d - 1 - sz) / d) * 100;
          }

          if (!onThisSlice) return null;

          const isNeed = sp.type === 'need';
          return (
            <div
              key={sp.id}
              style={{ left: `${screenX}%`, top: `${screenY}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center border-2 pointer-events-none shadow-md ${
                isNeed
                  ? 'bg-emerald-500 border-white text-white'
                  : 'bg-black border-red-500 text-red-500'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isNeed ? 'bg-white' : 'bg-red-500'}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
