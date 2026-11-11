import React, { useMemo, useCallback } from 'react';
import {
  Shield,
  Database,
  Scan,
  Box,
  Activity,
  Layers,
  Printer,
  Cpu,
  LucideIcon,
} from 'lucide-react';
import { ModuleType } from '../types';

export interface ModuleDefinition {
  id: ModuleType;
  label: string;
  color: string;
  icon: LucideIcon;
}

export const FLOWBAR_MODULES: ModuleDefinition[] = [
  { id: 'Account', label: 'Account', color: '#38BDF8', icon: Shield },
  { id: 'Datum', label: 'Datum', color: '#10B981', icon: Database },
  { id: 'Rados', label: 'Rados', color: '#06B6D4', icon: Scan },
  { id: 'Design', label: 'Design', color: '#8B5CF6', icon: Box },
  { id: 'FEA', label: 'FEA', color: '#F43F5E', icon: Activity },
  { id: 'Slicer', label: 'Slicer', color: '#F59E0B', icon: Layers },
  { id: 'Print Factory', label: 'Print Factory', color: '#14B8A6', icon: Printer },
  { id: 'I 5.0', label: 'I 5.0', color: '#3B82F6', icon: Cpu },
];

interface FlowbarProps {
  activeModule: ModuleType;
  onSelectModule: (m: ModuleType) => void;
}

export const Flowbar: React.FC<FlowbarProps> = ({
  activeModule,
  onSelectModule,
}) => {
  const activeIndex = useMemo(
    () => FLOWBAR_MODULES.findIndex((m) => m.id === activeModule),
    [activeModule]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (e.deltaY > 0 || e.deltaX > 0) {
        if (activeIndex < FLOWBAR_MODULES.length - 1) {
          onSelectModule(FLOWBAR_MODULES[activeIndex + 1].id);
        }
      } else if (e.deltaY < 0 || e.deltaX < 0) {
        if (activeIndex > 0) {
          onSelectModule(FLOWBAR_MODULES[activeIndex - 1].id);
        }
      }
    },
    [activeIndex, onSelectModule]
  );

  return (
    <div
      onWheel={handleWheel}
      className="relative flex items-center justify-center overflow-hidden h-full min-w-[680px] max-w-[860px] px-6 select-none"
    >
      <div
        className="flex items-center gap-3 transition-transform duration-300"
        style={{ perspective: '900px' }}
      >
        {FLOWBAR_MODULES.map((mod, idx) => {
          const isActive = mod.id === activeModule;
          const offset = idx - activeIndex;
          const distance = Math.abs(offset);

          // 3D cylinder arc rotation angle and depth
          const rotY = offset * 15; // degrees
          const transZ = -distance * 30; // px

          // Scale & Opacity hierarchy
          let sizeClasses = 'text-xs px-2.5 py-1';
          let iconSize = 'w-3.5 h-3.5';
          let opacity = 1.0;
          let scale = 1.0;

          if (distance === 0) {
            // Active center module
            sizeClasses = 'text-base font-semibold px-4 py-1.5';
            iconSize = 'w-4.5 h-4.5';
            opacity = 1.0;
            scale = 1.06;
          } else if (distance === 1) {
            // Immediate neighbors
            sizeClasses = 'text-sm font-medium px-3 py-1';
            iconSize = 'w-4 h-4';
            opacity = 0.85;
            scale = 0.95;
          } else if (distance === 2) {
            // Offset +/- 2
            sizeClasses = 'text-xs font-normal px-2.5 py-1';
            iconSize = 'w-3.5 h-3.5';
            opacity = 0.45;
            scale = 0.84;
          } else {
            // Smoothly fade out modules beyond offset +/- 2 along the edges
            sizeClasses = 'text-xs px-2 py-0.5 pointer-events-none';
            iconSize = 'w-3 h-3';
            opacity = 0.08;
            scale = 0.75;
          }

          const IconComponent = mod.icon;

          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => onSelectModule(mod.id)}
              style={{
                transform: `rotateY(${rotY}deg) translateZ(${transZ}px) scale(${scale})`,
                opacity,
                transition: 'all 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
                transformStyle: 'preserve-3d',
              }}
              className={`tactile-rubber relative rounded-2xl flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-all ${sizeClasses} ${
                isActive
                  ? 'neu-convex bg-[#0284C7] text-white border border-sky-400/50 shadow-lg shadow-sky-600/30'
                  : 'neu-btn text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-white/5'
              }`}
            >
              <IconComponent
                className={`${iconSize} shrink-0 transition-transform`}
                style={{
                  color: isActive ? '#FFFFFF' : mod.color,
                  filter: !isActive ? `drop-shadow(0 1px 2px ${mod.color}40)` : undefined,
                }}
              />
              <span className="tracking-tight">{mod.label}</span>
              {isActive && (
                <span className="absolute -bottom-[2px] left-3 right-3 h-[2px] bg-white rounded-full shadow-sm shadow-white/60" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

