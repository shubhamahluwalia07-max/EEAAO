import React, { useState } from 'react';
import {
  Move,
  Search,
  Sliders,
  Crosshair,
  Ruler,
  Maximize,
  Circle,
  Layers,
  Play,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Contrast,
  RotateCcw,
} from 'lucide-react';
import { CadToolType } from '../../types';

interface CadViewerToolbarProps {
  activeTool: CadToolType;
  onSelectTool: (t: CadToolType) => void;
  onRotate90: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onInvertLut: () => void;
  onResetView: () => void;
  onToggleCine: () => void;
  isCinePlaying: boolean;
  isInverted: boolean;
}

interface ToolConfig {
  id: CadToolType;
  title: string;
  shortcut: string;
  icon: React.FC<{ className?: string }>;
}

const TOOLS: ToolConfig[] = [
  { id: 'pan', title: 'Pan View', shortcut: 'P', icon: Move },
  { id: 'zoom', title: 'Interactive Zoom', shortcut: 'Z', icon: Search },
  { id: 'window', title: 'Window / Level', shortcut: 'W', icon: Sliders },
  { id: 'crosshair', title: '3D MPR Crosshair', shortcut: 'C', icon: Crosshair },
  { id: 'distance', title: 'Linear Caliper Distance', shortcut: 'D', icon: Ruler },
  { id: 'angle', title: '3-Point Angle', shortcut: 'A', icon: Maximize },
  { id: 'cobb', title: '4-Point Cobb Angle', shortcut: 'K', icon: Maximize },
  { id: 'roi', title: 'Elliptical HU ROI', shortcut: 'O', icon: Circle },
  { id: 'slab', title: 'Thick Slab MIP', shortcut: 'S', icon: Layers },
];

export const CadViewerToolbar: React.FC<CadViewerToolbarProps> = ({
  activeTool,
  onSelectTool,
  onRotate90,
  onFlipH,
  onFlipV,
  onInvertLut,
  onResetView,
  onToggleCine,
  isCinePlaying,
  isInverted,
}) => {
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number } | null>(null);

  const handleMouseEnter = (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredTool(id);
    setTooltipPos({ top: rect.top + rect.height / 2 });
  };

  const handleMouseLeave = () => {
    setHoveredTool(null);
    setTooltipPos(null);
  };

  const hoveredItem = TOOLS.find((t) => t.id === hoveredTool) ||
    (hoveredTool === 'cine' ? { title: isCinePlaying ? 'Pause Cine' : 'Cine Loop Play', shortcut: 'Space' } :
    hoveredTool === 'rotate' ? { title: 'Rotate 90° Clockwise', shortcut: 'R' } :
    hoveredTool === 'flip_h' ? { title: 'Flip Horizontal', shortcut: 'H' } :
    hoveredTool === 'flip_v' ? { title: 'Flip Vertical', shortcut: 'V' } :
    hoveredTool === 'invert' ? { title: 'Invert Grayscale LUT', shortcut: 'I' } :
    hoveredTool === 'reset' ? { title: 'Reset MPR Viewports', shortcut: 'Home' } : null);

  return (
    <aside className="relative w-12 h-full bg-[#F8FAFC] dark:bg-[#090D16] border-r border-slate-200 dark:border-slate-800 flex flex-col items-center py-2.5 gap-1.5 z-30 shrink-0">
      {/* Primary Interaction Tools */}
      {TOOLS.map((t) => {
        const isActive = activeTool === t.id;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelectTool(t.id)}
            onMouseEnter={(e) => handleMouseEnter(t.id, e)}
            onMouseLeave={handleMouseLeave}
            className={`tactile-rubber w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all ${
              isActive
                ? 'neu-primary text-white shadow-md shadow-sky-600/35'
                : 'neu-btn text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4 stroke-[2]" />
          </button>
        );
      })}

      <div className="w-6 h-[1px] bg-slate-200 dark:bg-slate-800 my-1" />

      {/* Cine Play Toggle */}
      <button
        type="button"
        onClick={onToggleCine}
        onMouseEnter={(e) => handleMouseEnter('cine', e)}
        onMouseLeave={handleMouseLeave}
        className={`tactile-rubber w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all ${
          isCinePlaying
            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
            : 'neu-btn text-slate-600 dark:text-slate-400 hover:text-emerald-500'
        }`}
      >
        <Play className="w-4 h-4 stroke-[2]" />
      </button>

      {/* Rotate 90 */}
      <button
        type="button"
        onClick={onRotate90}
        onMouseEnter={(e) => handleMouseEnter('rotate', e)}
        onMouseLeave={handleMouseLeave}
        className="tactile-rubber neu-btn w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-purple-400 cursor-pointer"
      >
        <RotateCw className="w-4 h-4 stroke-[2]" />
      </button>

      {/* Flip H */}
      <button
        type="button"
        onClick={onFlipH}
        onMouseEnter={(e) => handleMouseEnter('flip_h', e)}
        onMouseLeave={handleMouseLeave}
        className="tactile-rubber neu-btn w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-sky-400 cursor-pointer"
      >
        <FlipHorizontal className="w-4 h-4 stroke-[2]" />
      </button>

      {/* Flip V */}
      <button
        type="button"
        onClick={onFlipV}
        onMouseEnter={(e) => handleMouseEnter('flip_v', e)}
        onMouseLeave={handleMouseLeave}
        className="tactile-rubber neu-btn w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-sky-400 cursor-pointer"
      >
        <FlipVertical className="w-4 h-4 stroke-[2]" />
      </button>

      {/* Invert LUT */}
      <button
        type="button"
        onClick={onInvertLut}
        onMouseEnter={(e) => handleMouseEnter('invert', e)}
        onMouseLeave={handleMouseLeave}
        className={`tactile-rubber w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all ${
          isInverted
            ? 'bg-amber-600 text-white shadow-md shadow-amber-500/30'
            : 'neu-btn text-slate-600 dark:text-slate-400 hover:text-amber-500'
        }`}
      >
        <Contrast className="w-4 h-4 stroke-[2]" />
      </button>

      {/* Reset View */}
      <button
        type="button"
        onClick={onResetView}
        onMouseEnter={(e) => handleMouseEnter('reset', e)}
        onMouseLeave={handleMouseLeave}
        className="tactile-rubber neu-btn w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-rose-500 cursor-pointer mt-auto mb-1"
      >
        <RotateCcw className="w-4 h-4 stroke-[2]" />
      </button>

      {/* Floating Single Tooltip Card 12px to the Right */}
      {hoveredItem && tooltipPos && (
        <div
          style={{ top: `${tooltipPos.top}px` }}
          className="fixed left-[60px] -translate-y-1/2 z-50 pointer-events-none flex items-center gap-2 bg-slate-900 text-white dark:bg-slate-800 px-3 py-1.5 rounded-xl shadow-2xl border border-slate-700 whitespace-nowrap text-xs font-medium animate-in fade-in zoom-in-95 duration-100"
        >
          <span>{hoveredItem.title}</span>
          {hoveredItem.shortcut && (
            <kbd className="bg-slate-800 dark:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-slate-600">
              {hoveredItem.shortcut}
            </kbd>
          )}
        </div>
      )}
    </aside>
  );
};
