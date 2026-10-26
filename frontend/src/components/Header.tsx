import React, { useMemo } from 'react';
import {
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  ChevronUp,
  ChevronDown,
  Activity,
  Layers,
  Box,
  Cpu,
  Printer,
  Sparkles,
  Sliders,
  User,
} from 'lucide-react';
import { ModuleType, TrackType } from '../types';

interface HeaderProps {
  activeModule: ModuleType;
  onSelectModule: (m: ModuleType) => void;
  activeTrack: TrackType;
  onSelectTrack: (t: TrackType) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const MODULES: { id: ModuleType; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'Account', label: 'Account', icon: User },
  { id: 'Datum', label: 'Datum', icon: Layers },
  { id: 'Rados', label: 'Rados', icon: Activity },
  { id: 'Design', label: 'Design', icon: Box },
  { id: 'FEA', label: 'FEA', icon: Cpu },
  { id: 'Slicer', label: 'Slicer', icon: Sliders },
  { id: 'Print Factory', label: 'Print Factory', icon: Printer },
  { id: 'I 5.0', label: 'I 5.0', icon: Sparkles },
];

export const Header: React.FC<HeaderProps> = ({
  activeModule,
  onSelectModule,
  activeTrack,
  onSelectTrack,
  isDarkMode,
  onToggleTheme,
  isFullscreen,
  onToggleFullscreen,
  isCollapsed,
  onToggleCollapse,
}) => {
  const activeIndex = useMemo(
    () => MODULES.findIndex((m) => m.id === activeModule),
    [activeModule]
  );

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={onToggleCollapse}
        className="fixed top-2 right-2 z-50 p-2 rounded-xl bg-white/90 dark:bg-[#111827]/90 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-xl backdrop-blur-md tactile-rubber flex items-center gap-1.5 text-xs font-semibold"
        title="Restore Header"
      >
        <div className="w-5 h-5 rounded-md bg-[#0284C7] text-white flex items-center justify-center font-bold text-[10px]">
          MD
        </div>
        <span>MEDAM</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>
    );
  }

  return (
    <header className="relative w-full h-[58px] px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#090D16] z-40 shrink-0 select-none">
      {/* Left: Branding & Track Switcher */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#0284C7] flex items-center justify-center text-white font-extrabold text-sm shadow-md shadow-sky-500/20">
            MD
          </div>
          <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
            MEDAM
          </span>
        </div>

        {/* Track Switcher */}
        <div className="flex items-center bg-slate-200/70 dark:bg-slate-800/60 p-1 rounded-xl gap-0.5 border border-slate-300/40 dark:border-slate-700/40">
          {(['Medical', 'Industrial', 'Creative'] as TrackType[]).map((track) => {
            const isActive = activeTrack === track;
            return (
              <button
                key={track}
                type="button"
                onClick={() => onSelectTrack(track)}
                className={`tactile-rubber px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#0284C7] text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {track}
              </button>
            );
          })}
        </div>
      </div>

      {/* Center: Rotary Cylinder Flowbar */}
      <div className="relative flex items-center justify-center overflow-hidden h-full max-w-2xl px-6">
        <div className="flex items-center gap-1.5" style={{ perspective: '800px' }}>
          {MODULES.map((mod, idx) => {
            const isActive = mod.id === activeModule;
            const offset = idx - activeIndex;
            const distance = Math.abs(offset);

            // Compute 3D cylinder arc rotation angle and depth
            const rotY = offset * 14; // degrees
            const transZ = -distance * 28; // px
            const opacity = Math.max(0.35, 1 - distance * 0.18);
            const scale = isActive ? 1.05 : Math.max(0.85, 1 - distance * 0.05);

            const Icon = mod.icon;

            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => onSelectModule(mod.id)}
                style={{
                  transform: `rotateY(${rotY}deg) translateZ(${transZ}px) scale(${scale})`,
                  opacity,
                  transition: 'all 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
                  transformStyle: 'preserve-3d',
                }}
                className={`tactile-rubber relative px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'text-[#0284C7] dark:text-[#38BDF8] bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#0284C7] dark:text-[#38BDF8]' : 'text-slate-400'}`} />
                <span>{mod.label}</span>
                {isActive && (
                  <span className="absolute -bottom-[9px] left-3 right-3 h-[2.5px] bg-[#0284C7] dark:bg-[#38BDF8] rounded-full shadow-sm shadow-sky-500/50" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Utility icon buttons (rendered once only) */}
      <div className="flex items-center gap-1.5">
        {/* Theme Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="tactile-rubber p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800/70 border border-transparent hover:border-slate-300 dark:hover:border-slate-700"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Fullscreen F11 */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen (F11)' : 'Fullscreen Application Mode (F11)'}
          className="tactile-rubber p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800/70 border border-transparent hover:border-slate-300 dark:hover:border-slate-700"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Collapse Header */}
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Collapse Header to Maximise Viewport"
          className="tactile-rubber p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800/70 border border-transparent hover:border-slate-300 dark:hover:border-slate-700"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
