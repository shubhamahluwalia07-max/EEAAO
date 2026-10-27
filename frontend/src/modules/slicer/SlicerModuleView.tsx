import React, { useState } from 'react';
import {
  Sliders,
  ArrowLeft,
  Play,
  Printer,
  Layers,
  Clock,
  Weight,
  Sparkles,
  CheckCircle2,
  FileCode,
} from 'lucide-react';
import { ModuleType, MeshObjectItem } from '../../types';

interface SlicerModuleViewProps {
  activeMesh: MeshObjectItem | null;
  onNavigateModule: (m: ModuleType) => void;
}

export const SlicerModuleView: React.FC<SlicerModuleViewProps> = ({
  activeMesh,
  onNavigateModule,
}) => {
  const [layerHeightMm, setLayerHeightMm] = useState<number>(0.16);
  const [infillPercent, setInfillPercent] = useState<number>(100);
  const [activeLayer, setActiveLayer] = useState<number>(312);
  const [totalLayers, setTotalLayers] = useState<number>(625);
  const [isSlicing, setIsSlicing] = useState<boolean>(false);
  const [sliced, setSliced] = useState<boolean>(true);

  const handleSlice = () => {
    setIsSlicing(true);
    setSliced(false);
    setTimeout(() => {
      const computedLayers = Math.round(100 / layerHeightMm);
      setTotalLayers(computedLayers);
      setActiveLayer(Math.round(computedLayers / 2));
      setIsSlicing(false);
      setSliced(true);
    }, 1000);
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#090D16] text-[#F8FAFC]">
      {/* Top Action Bar */}
      <div className="w-full h-14 px-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigateModule('Design')}
            className="tactile-rubber neu-btn px-3 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Design</span>
          </button>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-extrabold uppercase tracking-wide text-white">
              Additive Slicing & Toolpath Engine
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigateModule('Print Factory')}
            className="tactile-rubber neu-btn px-3.5 py-1.5 rounded-xl text-xs font-bold text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 cursor-pointer shadow-lg"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Send to Print Factory</span>
          </button>
        </div>
      </div>

      {/* Main Slicing Workspace */}
      <div className="flex-1 w-full flex overflow-hidden">
        {/* Left 70%: 2D/3D Slicing Layer Preview */}
        <div className="flex-1 h-full p-6 flex flex-col justify-between overflow-hidden relative">
          <div className="w-full h-full neu-pressed rounded-3xl border border-slate-800 relative flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-radial from-rose-500/10 via-transparent to-transparent pointer-events-none" />

            {/* Sliced Layer Schematic */}
            <div className="relative flex flex-col items-center justify-center gap-4">
              <div className="w-72 h-72 rounded-3xl neu-convex border border-rose-500/30 bg-slate-950 p-4 flex flex-col items-center justify-center relative shadow-2xl">
                {/* Visualizer of G-code perimeter toolpath */}
                <div className="w-48 h-48 rounded-2xl border-2 border-rose-500 bg-rose-500/10 flex items-center justify-center relative overflow-hidden">
                  <div className="w-32 h-32 rounded-xl border border-dashed border-sky-400 bg-sky-500/10 flex items-center justify-center">
                    <span className="text-[10px] font-mono text-cyan-300">
                      Infill: Gyroid {infillPercent}%
                    </span>
                  </div>
                </div>

                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Layer {activeLayer} / {totalLayers}</span>
                  <span className="text-rose-400 font-bold">Z: {(activeLayer * layerHeightMm).toFixed(2)} mm</span>
                </div>
              </div>

              {/* Layer Scrubber */}
              <div className="w-96 flex items-center gap-3 neu-convex px-4 py-2 rounded-2xl border border-slate-800 bg-slate-900/80">
                <span className="text-xs text-slate-400">Layer:</span>
                <input
                  type="range"
                  min="1"
                  max={totalLayers}
                  value={activeLayer}
                  onChange={(e) => setActiveLayer(parseInt(e.target.value, 10))}
                  className="flex-1 accent-rose-500 cursor-pointer"
                />
                <span className="font-mono text-xs font-bold text-rose-400 w-12 text-right">
                  #{activeLayer}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 30%: Slicer Configuration & Print Estimates */}
        <div className="w-80 h-full border-l border-slate-800 bg-slate-900/90 p-5 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Toolpath Settings
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
              Titanium SLS / Resin
            </span>
          </div>

          {/* Layer Height Slider */}
          <div className="neu-pressed p-4 rounded-2xl border border-slate-800 flex flex-col gap-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300">Layer Thickness</span>
              <span className="font-mono font-bold text-rose-400">{layerHeightMm} mm</span>
            </div>
            <input
              type="range"
              min="0.08"
              max="0.28"
              step="0.02"
              value={layerHeightMm}
              onChange={(e) => setLayerHeightMm(parseFloat(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer"
            />
          </div>

          {/* Infill Density Slider */}
          <div className="neu-pressed p-4 rounded-2xl border border-slate-800 flex flex-col gap-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300">Cortical Infill Density</span>
              <span className="font-mono font-bold text-rose-400">{infillPercent}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              step="10"
              value={infillPercent}
              onChange={(e) => setInfillPercent(parseInt(e.target.value, 10))}
              className="w-full accent-rose-500 cursor-pointer"
            />
          </div>

          {/* Calculate Slices Button */}
          <button
            type="button"
            onClick={handleSlice}
            disabled={isSlicing}
            className="tactile-rubber neu-primary w-full py-2.5 rounded-xl text-xs font-bold text-white shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isSlicing ? 'animate-spin' : ''}`} />
            <span>{isSlicing ? 'Calculating Slices...' : 'Generate Slicing Toolpath'}</span>
          </button>

          {/* Print Estimates */}
          {sliced && (
            <div className="neu-convex p-4 rounded-2xl border border-slate-800 flex flex-col gap-3 mt-1">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Build Package Estimates
              </span>

              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Print Time:
                </span>
                <span className="font-mono font-bold text-emerald-400">3h 42m</span>
              </div>

              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400 flex items-center gap-1">
                  <Weight className="w-3.5 h-3.5 text-slate-500" />
                  Material Volume:
                </span>
                <span className="font-mono font-bold text-sky-400">48.2 cm³ (214g)</span>
              </div>

              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  Total Layers:
                </span>
                <span className="font-mono font-bold text-white">{totalLayers}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
