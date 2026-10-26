import React, { useMemo } from 'react';
import {
  ToolIconButton,
  IconFullscreen,
  IconExitFullscreen,
  IconCollapseHeader,
  IconThemeToggle,
} from '../modules/stage3_pacs/Icons';

import { ModuleId, MEDAM_MODULES, medamStateBus, WorkflowTrack, WORKFLOW_TRACKS } from './stateBus';

export type { ModuleId };

const MODULES: ModuleId[] = MEDAM_MODULES;

interface FlowbarProps {
  activeModule?: ModuleId;
  onSelectModule?: (id: ModuleId) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isHeaderCollapsed?: boolean;
  onToggleCollapseHeader?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  activeTrack?: WorkflowTrack;
  onSelectTrack?: (track: WorkflowTrack) => void;
}

export const Flowbar: React.FC<FlowbarProps> = ({
  activeModule = 'Rados',
  onSelectModule,
  isFullscreen = false,
  onToggleFullscreen,
  isHeaderCollapsed = false,
  onToggleCollapseHeader,
  theme = 'light',
  onToggleTheme,
  activeTrack = 'medical',
  onSelectTrack,
}) => {
  const activeIndex = useMemo(() => MODULES.indexOf(activeModule), [activeModule]);

  // Circular distance helper (-4 to +4)
  const getCircularOffset = (index: number) => {
    let diff = index - activeIndex;
    const len = MODULES.length;
    if (diff > len / 2) diff -= len;
    if (diff < -len / 2) diff += len;
    return diff;
  };

  const handleModuleClick = (mod: ModuleId) => {
    onSelectModule?.(mod);
  };

  return (
    <header
      className={`relative w-full bg-origin-alabaster dark:bg-[#090D16] border-b border-origin-zinc dark:border-[#1E293B] flex items-center justify-between px-6 select-none shrink-0 z-30 shadow-sm transition-all duration-250 ease-in-out ${
        isHeaderCollapsed
          ? 'h-0 max-h-0 border-b-0 py-0 overflow-hidden opacity-0 pointer-events-none'
          : 'h-14 opacity-100'
      }`}
    >
      {/* Brand title & Workflow Track Pills */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[#0284C7] flex items-center justify-center font-bold text-white text-xs shadow-xs tracking-tight">
            MD
          </div>
          <span className="font-bold text-sm tracking-tight text-origin-slate dark:text-slate-100 leading-none">
            MEDAM
          </span>
        </div>

        {/* Workflow Track Selector: Medical, Industrial, Creative */}
        <div className="hidden lg:flex items-center bg-slate-100 dark:bg-[#151D2C] p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] font-semibold">
          {(['medical', 'industrial', 'creative'] as WorkflowTrack[]).map((tr) => (
            <button
              key={tr}
              type="button"
              onClick={() => {
                onSelectTrack?.(tr);
                medamStateBus.setTrack(tr);
              }}
              className={`px-2 py-0.5 rounded-md capitalize transition-all cursor-pointer ${
                activeTrack === tr
                  ? 'bg-white dark:bg-[#1E293B] text-[#0284C7] dark:text-sky-400 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tr}
            </button>
          ))}
        </div>
      </div>

      {/* Rotary Cylinder Flowbar */}
      <div className="relative flex items-center justify-center h-full max-w-2xl flex-1 mx-8 overflow-hidden">
        <div className="flex items-center justify-center gap-1 sm:gap-2">
          {MODULES.map((mod, idx) => {
            const offset = getCircularOffset(idx);
            const isCenter = offset === 0;
            const distance = Math.abs(offset);

            // 3D rotary cylinder visual calculation
            const scale = isCenter ? 1.05 : Math.max(0.72, 1 - distance * 0.12);
            const opacity = isCenter ? 1.0 : Math.max(0.35, 1 - distance * 0.28);
            const translateX = offset * 4;

            return (
              <button
                key={mod}
                type="button"
                onClick={() => handleModuleClick(mod)}
                style={{
                  transform: `translateX(${translateX}px) scale(${scale})`,
                  opacity,
                  transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease',
                }}
                className={`relative px-4 py-1.5 rounded text-xs sm:text-sm font-medium tracking-tight whitespace-nowrap outline-none transition-colors duration-150 ${
                  isCenter
                    ? 'text-origin-slate dark:text-slate-100 font-semibold text-sm sm:text-base'
                    : 'text-zinc-500 dark:text-slate-400 hover:text-origin-slate dark:hover:text-slate-100 cursor-pointer'
                }`}
              >
                {mod}

                {/* Windows 11 spring-animated underline indicator */}
                {isCenter && (
                  <div
                    className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 h-[3px] w-8 bg-[#0284C7] rounded-full shadow-sm"
                    style={{
                      transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Action Icons: Fullscreen (F11), Collapse Header, and Theme Toggle (D) */}
      <div className="flex items-center gap-2 shrink-0">
        {onToggleTheme && (
          <ToolIconButton
            id="flowbar-theme-toggle"
            title="Theme Toggle"
            shortcut="D"
            onClick={onToggleTheme}
            tooltipSide="bottom"
          >
            <IconThemeToggle size={18} />
          </ToolIconButton>
        )}

        {onToggleFullscreen && (
          <ToolIconButton
            id="flowbar-fullscreen-toggle"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Mode'}
            shortcut="F11"
            active={isFullscreen}
            onClick={onToggleFullscreen}
            tooltipSide="bottom"
          >
            {isFullscreen ? <IconExitFullscreen size={18} /> : <IconFullscreen size={18} />}
          </ToolIconButton>
        )}

        {onToggleCollapseHeader && (
          <ToolIconButton
            id="flowbar-collapse-header"
            title="Collapse Header"
            onClick={onToggleCollapseHeader}
            tooltipSide="bottom"
          >
            <IconCollapseHeader size={18} />
          </ToolIconButton>
        )}
      </div>
    </header>
  );
};
