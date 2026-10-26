import React, { useState } from 'react';
import { ToolMode, SlabMode } from './types';
import {
  IconHand,
  IconZoom,
  IconWindowLevel,
  IconCrosshair,
  IconDistance,
  IconAngle,
  IconCobbAngle,
  IconEllipticalRoi,
  IconSlabMode,
  IconCinePlay,
  IconCinePause,
  IconRotate90,
  IconFlipHorizontal,
  IconFlipVertical,
  IconInvertLut,
  IconResetView,
} from './Icons';

interface LeftIconRailProps {
  activeTool: ToolMode;
  onSelectTool: (tool: ToolMode) => void;
  slabMode: SlabMode;
  onToggleSlab: () => void;
  isCinePlaying: boolean;
  onToggleCine: () => void;
  onRotate90: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onInvertLut: () => void;
  isLutInverted: boolean;
  onResetView: () => void;
}

interface HoverCardState {
  title: string;
  shortcut?: string;
  top: number;
  left: number;
}

export const LeftIconRail: React.FC<LeftIconRailProps> = ({
  activeTool,
  onSelectTool,
  slabMode,
  onToggleSlab,
  isCinePlaying,
  onToggleCine,
  onRotate90,
  onFlipH,
  onFlipV,
  onInvertLut,
  isLutInverted,
  onResetView,
}) => {
  const [hoveredTool, setHoveredTool] = useState<HoverCardState | null>(null);

  const handleMouseEnter = (
    e: React.MouseEvent<HTMLButtonElement>,
    title: string,
    shortcut?: string
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredTool({
      title,
      shortcut,
      top: rect.top + rect.height / 2,
      left: rect.right + 12,
    });
  };

  const handleMouseLeave = () => {
    setHoveredTool(null);
  };

  const viewportTools = [
    {
      id: 'tool-pan',
      title: 'Pan',
      shortcut: 'P',
      mode: 'pan' as ToolMode,
      icon: <IconHand size={20} />,
    },
    {
      id: 'tool-zoom',
      title: 'Zoom',
      shortcut: 'Z',
      mode: 'zoom' as ToolMode,
      icon: <IconZoom size={20} />,
    },
    {
      id: 'tool-window',
      title: 'Window / Level',
      shortcut: 'W',
      mode: 'window' as ToolMode,
      icon: <IconWindowLevel size={20} />,
    },
    {
      id: 'tool-crosshair',
      title: 'Crosshair',
      shortcut: 'C',
      mode: 'crosshair' as ToolMode,
      icon: <IconCrosshair size={20} />,
    },
    {
      id: 'tool-distance',
      title: 'Distance',
      shortcut: 'D',
      mode: 'length' as ToolMode,
      icon: <IconDistance size={20} />,
    },
    {
      id: 'tool-angle',
      title: 'Angle',
      shortcut: 'A',
      mode: 'angle' as ToolMode,
      icon: <IconAngle size={20} />,
    },
    {
      id: 'tool-cobb',
      title: 'Cobb Angle',
      shortcut: 'K',
      mode: 'cobb' as ToolMode,
      icon: <IconCobbAngle size={20} />,
    },
    {
      id: 'tool-roi',
      title: 'Elliptical ROI',
      shortcut: 'O',
      mode: 'roi' as ToolMode,
      icon: <IconEllipticalRoi size={20} />,
    },
  ];

  const actionTools = [
    {
      id: 'action-slab',
      title: 'Slab Mode',
      onClick: onToggleSlab,
      active: slabMode !== 'none',
      icon: <IconSlabMode size={20} />,
    },
    {
      id: 'action-cine',
      title: 'Cine Play',
      shortcut: 'Space',
      onClick: onToggleCine,
      active: isCinePlaying,
      icon: isCinePlaying ? <IconCinePause size={20} /> : <IconCinePlay size={20} />,
    },
    {
      id: 'action-rotate90',
      title: 'Rotate 90',
      shortcut: 'R',
      onClick: onRotate90,
      active: false,
      icon: <IconRotate90 size={20} />,
    },
    {
      id: 'action-fliph',
      title: 'Flip Horizontal',
      onClick: onFlipH,
      active: false,
      icon: <IconFlipHorizontal size={20} />,
    },
    {
      id: 'action-flipv',
      title: 'Flip Vertical',
      onClick: onFlipV,
      active: false,
      icon: <IconFlipVertical size={20} />,
    },
    {
      id: 'action-invert-lut',
      title: 'Invert LUT',
      shortcut: 'I',
      onClick: onInvertLut,
      active: isLutInverted,
      icon: <IconInvertLut size={20} />,
    },
    {
      id: 'action-reset-view',
      title: 'Reset View',
      onClick: onResetView,
      active: false,
      icon: <IconResetView size={20} />,
    },
  ];

  return (
    <div className="relative select-none shrink-0 z-30 h-full">
      <aside className="w-12 h-full flex flex-col items-center py-2 gap-1 bg-white dark:bg-[#0F172A] border-r border-slate-200 dark:border-[#1E293B] shadow-xs overflow-y-auto no-scrollbar">
        {/* Direct 2D/3D Viewport Navigation & Measurement Tools */}
        <div className="flex flex-col items-center gap-1.5 w-full">
          {viewportTools.map((t) => {
            const isActive = activeTool === t.mode;
            return (
              <button
                key={t.id}
                id={t.id}
                type="button"
                onClick={() => onSelectTool(t.mode)}
                onMouseEnter={(e) => handleMouseEnter(e, t.title, t.shortcut)}
                onMouseLeave={handleMouseLeave}
                className={`tactile-rubber w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0284C7] text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
                }`}
                aria-label={t.title}
              >
                {t.icon}
              </button>
            );
          })}
        </div>

        {/* Crisp subtle separator */}
        <div className="w-6 h-[1px] bg-slate-200 dark:bg-slate-800 my-1 shrink-0" />

        {/* Viewport Transforms & Manipulation Tools */}
        <div className="flex flex-col items-center gap-1.5 w-full">
          {actionTools.map((a) => (
            <button
              key={a.id}
              id={a.id}
              type="button"
              onClick={a.onClick}
              onMouseEnter={(e) => handleMouseEnter(e, a.title, a.shortcut)}
              onMouseLeave={handleMouseLeave}
              className={`tactile-rubber w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                a.active
                  ? 'bg-[#0284C7] text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
              aria-label={a.title}
            >
              {a.icon}
            </button>
          ))}
        </div>
      </aside>

      {/* Single-Instance Floating Hover Card Portal (z-index 9999 so it never clips) */}
      {hoveredTool && (
        <div
          style={{
            position: 'fixed',
            top: `${hoveredTool.top}px`,
            left: `${hoveredTool.left}px`,
            transform: 'translateY(-50%)',
            zIndex: 9999,
          }}
          className="pointer-events-none px-3 py-1.5 rounded-lg bg-[#0F172A] text-white border border-slate-700/80 shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in fade-in duration-100"
        >
          <span className="text-xs font-bold whitespace-nowrap text-slate-100 tracking-tight">
            {hoveredTool.title}
          </span>
          {hoveredTool.shortcut && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-sky-400 border border-slate-700 font-sans shadow-xs">
              [{hoveredTool.shortcut}]
            </span>
          )}
        </div>
      )}
    </div>
  );
};
