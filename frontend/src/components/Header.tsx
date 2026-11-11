import React from 'react';
import {
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { ModuleType, TrackType } from '../types';
import { Flowbar } from './Flowbar';

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
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl neu-primary flex items-center justify-center text-white font-extrabold text-sm shadow-md shadow-sky-500/25">
            MD
          </div>
          <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
            MEDAM
          </span>
        </div>

        {/* 100% Neumorphic Track Switcher */}
        <div className="flex items-center neu-pressed p-1 rounded-2xl gap-1">
          {(['Medical', 'Industrial', 'Creative'] as TrackType[]).map((track) => {
            const isActive = activeTrack === track;
            return (
              <button
                key={track}
                type="button"
                onClick={() => onSelectTrack(track)}
                className={`tactile-rubber px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'neu-primary text-white shadow-sm'
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
      <Flowbar activeModule={activeModule} onSelectModule={onSelectModule} />

      {/* Right: Utility icon buttons with 100% Neumorphic Origin UI buttons */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="tactile-rubber neu-btn p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Fullscreen F11 */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen (F11)' : 'Fullscreen Application Mode (F11)'}
          className="tactile-rubber neu-btn p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4 text-sky-400" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Collapse Header */}
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Collapse Header to Maximise Viewport"
          className="tactile-rubber neu-btn p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
