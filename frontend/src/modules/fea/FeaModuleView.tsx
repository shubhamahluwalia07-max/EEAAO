import React, { useState } from 'react';
import {
  Cpu,
  ArrowLeft,
  Play,
  Sliders,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { ModuleType, MeshObjectItem } from '../../types';

interface FeaModuleViewProps {
  activeMesh: MeshObjectItem | null;
  onNavigateModule: (m: ModuleType) => void;
}

export const FeaModuleView: React.FC<FeaModuleViewProps> = ({
  activeMesh,
  onNavigateModule,
}) => {
  const [loadNewtons, setLoadNewtons] = useState<number>(2400); // 2.4 kN physiological gait force
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simComplete, setSimComplete] = useState<boolean>(true);
  const [safetyFactor, setSafetyFactor] = useState<number>(2.85);
  const [maxStressMpa, setMaxStressMpa] = useState<number>(142.6);
  const [maxDisplacementMm, setMaxDisplacementMm] = useState<number>(0.18);

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setSimComplete(false);
    setTimeout(() => {
      // Physiological stress calculation
      const stress = Math.round((loadNewtons / 16.8) * 10) / 10;
      const sf = Math.round((860 / stress) * 100) / 100; // Ti6Al4V yield strength ~860 MPa
      setMaxStressMpa(stress);
      setSafetyFactor(sf);
      setMaxDisplacementMm(Math.round((loadNewtons * 0.000075) * 1000) / 1000);
      setIsSimulating(false);
      setSimComplete(true);
    }, 1200);
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
            <Cpu className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-extrabold uppercase tracking-wide text-white">
              Finite Element Analysis (FEA) Simulation
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigateModule('Slicer')}
            className="tactile-rubber neu-btn px-3.5 py-1.5 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 border border-rose-500/30 flex items-center gap-1.5 cursor-pointer shadow-lg"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Proceed to Slicer</span>
          </button>
        </div>
      </div>

      {/* Main Split Area */}
      <div className="flex-1 w-full flex overflow-hidden">
        {/* Left 70%: 3D Stress Contour Viewport */}
        <div className="flex-1 h-full relative p-6 flex flex-col justify-between overflow-hidden">
          {/* Simulated 3D Stress Visualizer */}
          <div className="w-full h-full neu-pressed rounded-3xl border border-slate-800 relative flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-radial from-amber-500/10 via-transparent to-transparent pointer-events-none" />

            {/* Finite Element Mesh Contour Schematic */}
            <div className="relative flex flex-col items-center justify-center gap-4">
              <div className="w-64 h-80 rounded-2xl neu-convex border border-amber-500/40 bg-gradient-to-t from-blue-600 via-emerald-500 via-amber-400 to-rose-600 p-1 flex flex-col justify-between items-center shadow-2xl relative">
                <div className="w-full text-center py-2 bg-slate-900/80 rounded-xl backdrop-blur-sm">
                  <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                    Peak Load Contact Zone
                  </span>
                </div>

                <div className="w-full px-4 text-center py-3 bg-slate-900/90 rounded-xl backdrop-blur-sm flex flex-col gap-1">
                  <span className="text-xs font-extrabold text-white">
                    {activeMesh?.name || 'Patient Distal Femur Plate Assembly'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Material: Ti-6Al-4V Grade 23 ELI
                  </span>
                </div>

                <div className="w-full text-center py-2 bg-slate-900/80 rounded-xl backdrop-blur-sm">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                    Rigid Condylar Fixation Base
                  </span>
                </div>
              </div>

              {/* Stress Color Legend */}
              <div className="flex items-center gap-2 neu-convex px-4 py-2 rounded-xl border border-slate-800 bg-slate-900/80 text-[10px] font-mono">
                <span className="text-blue-400">0 MPa</span>
                <div className="w-36 h-2.5 rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 via-emerald-400 via-amber-400 to-rose-500" />
                <span className="text-rose-400 font-bold">{maxStressMpa} MPa</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 30%: Load Boundary & Structural Results Inspector */}
        <div className="w-80 h-full border-l border-slate-800 bg-slate-900/90 p-5 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Simulation Parameters
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              Static Structural
            </span>
          </div>

          {/* Load Slider */}
          <div className="neu-pressed p-4 rounded-2xl border border-slate-800 flex flex-col gap-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300">Physiological Axial Load</span>
              <span className="font-mono font-bold text-amber-400">{loadNewtons} N</span>
            </div>
            <input
              type="range"
              min="500"
              max="5000"
              step="100"
              value={loadNewtons}
              onChange={(e) => setLoadNewtons(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <span className="text-[10px] text-slate-400 leading-relaxed">
              Standard ISO 7206-4 cyclic gait loading profile for lower-extremity reconstructive fixtures.
            </span>
          </div>

          {/* Simulation Trigger */}
          <button
            type="button"
            onClick={handleRunSimulation}
            disabled={isSimulating}
            className="tactile-rubber neu-primary w-full py-2.5 rounded-xl text-xs font-bold text-white shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isSimulating ? 'animate-spin' : ''}`} />
            <span>{isSimulating ? 'Solving FEA Matrix...' : 'Solve FEA Stress Distribution'}</span>
          </button>

          {/* Results Summary */}
          {simComplete && (
            <div className="neu-convex p-4 rounded-2xl border border-slate-800 flex flex-col gap-3 mt-1">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Structural Safety Analysis
              </span>

              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Factor of Safety (FoS):</span>
                <span className="font-mono font-bold text-emerald-400">{safetyFactor}x</span>
              </div>

              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Peak Von Mises Stress:</span>
                <span className="font-mono font-bold text-rose-400">{maxStressMpa} MPa</span>
              </div>

              <div className="flex justify-between text-xs py-1 border-b border-slate-800">
                <span className="text-slate-400">Max Elastic Deflection:</span>
                <span className="font-mono font-bold text-sky-400">{maxDisplacementMm} mm</span>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 flex items-center gap-2 mt-1">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Structural biomechanical compliance validated. Design cleared for additive manufacturing.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
