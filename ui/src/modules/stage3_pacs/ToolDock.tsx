import React from 'react';
import { ToolMode, SlabMode, SegmentToolMode } from './types';

interface ToolDockProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  activeTool: ToolMode;
  onSelectTool: (tool: ToolMode) => void;
  slabMode: SlabMode;
  onChangeSlabMode: (mode: SlabMode) => void;
  onRotate90: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onInvertLut: () => void;
  isLutInverted: boolean;
  onResetView: () => void;
  isCinePlaying: boolean;
  onToggleCine: () => void;
  // Segmentation Mode Props
  isSegmentMode: boolean;
  onToggleSegmentMode: () => void;
  activeSegmentTool: SegmentToolMode;
  onSelectSegmentTool: (tool: SegmentToolMode) => void;
  onExecuteIslandFilter?: () => void;
  onExecuteMorphology?: () => void;
  onGenerateMesh?: () => void;
  onExportStl?: () => void;
}

export const ToolDock: React.FC<ToolDockProps> = ({
  isOpen,
  onToggleOpen,
  activeTool,
  onSelectTool,
  slabMode,
  onChangeSlabMode,
  onRotate90,
  onFlipH,
  onFlipV,
  onInvertLut,
  isLutInverted,
  onResetView,
  isCinePlaying,
  onToggleCine,
  isSegmentMode,
  onToggleSegmentMode,
  activeSegmentTool,
  onSelectSegmentTool,
  onExecuteIslandFilter,
  onExecuteMorphology,
  onGenerateMesh,
  onExportStl,
}) => {
  return (
    <div className="relative flex select-none shrink-0 z-20">
      <aside
        className={`bg-white dark:bg-[#111827] border-r border-slate-200 dark:border-[#1E293B] flex flex-col items-center py-2.5 gap-1.5 shadow-sm overflow-y-auto overflow-x-hidden font-sans transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? 'w-44' : 'w-0 border-r-0 py-0 px-0 opacity-0 pointer-events-none'
        }`}
      >
        {/* Prominent Tactile Rubber "Segment" Button at Top of Left Dock */}
        <div className="w-full px-2 pb-1.5 border-b border-slate-200 dark:border-[#1E293B] shrink-0">
          <button
            type="button"
            onClick={onToggleSegmentMode}
            className={`tactile-rubber w-full h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
              isSegmentMode
                ? 'bg-[#0284C7] text-white shadow-md'
                : 'bg-[#F4F6F9] dark:bg-[#1E293B] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {isSegmentMode ? 'Exit Segment Mode' : 'Segment'}
          </button>
        </div>

        {isSegmentMode ? (
          /* Dedicated Segmentation Tools Workspace */
          <div className="flex-1 w-full flex flex-col gap-1.5 px-2 py-1 animate-in fade-in duration-200">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block px-1 mb-1">
              Segmentation Tools
            </span>

            <button
              type="button"
              onClick={() => onSelectSegmentTool('threshold')}
              className={`tactile-rubber w-full h-9 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer ${
                activeSegmentTool === 'threshold'
                  ? 'bg-[#0284C7] text-white shadow-xs font-semibold'
                  : 'text-[#0F172A] dark:text-slate-200 bg-slate-50 dark:bg-[#1E293B]/70 hover:bg-slate-100 dark:hover:bg-[#1E293B]'
              }`}
            >
              Threshold Mask
            </button>

            <button
              type="button"
              onClick={() => onSelectSegmentTool('region_grow')}
              className={`tactile-rubber w-full h-9 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer ${
                activeSegmentTool === 'region_grow'
                  ? 'bg-[#0284C7] text-white shadow-xs font-semibold'
                  : 'text-[#0F172A] dark:text-slate-200 bg-slate-50 dark:bg-[#1E293B]/70 hover:bg-slate-100 dark:hover:bg-[#1E293B]'
              }`}
            >
              Region Grow (Seed)
            </button>

            <button
              type="button"
              onClick={() => onSelectSegmentTool('brush')}
              className={`tactile-rubber w-full h-9 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer ${
                activeSegmentTool === 'brush'
                  ? 'bg-[#0284C7] text-white shadow-xs font-semibold'
                  : 'text-[#0F172A] dark:text-slate-200 bg-slate-50 dark:bg-[#1E293B]/70 hover:bg-slate-100 dark:hover:bg-[#1E293B]'
              }`}
            >
              Smart Brush 2D/3D
            </button>

            <button
              type="button"
              onClick={() => onSelectSegmentTool('lasso_erase')}
              className={`tactile-rubber w-full h-9 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer ${
                activeSegmentTool === 'lasso_erase'
                  ? 'bg-[#0284C7] text-white shadow-xs font-semibold'
                  : 'text-[#0F172A] dark:text-slate-200 bg-slate-50 dark:bg-[#1E293B]/70 hover:bg-slate-100 dark:hover:bg-[#1E293B]'
              }`}
            >
              Lasso Erase
            </button>

            <button
              type="button"
              onClick={() => onSelectSegmentTool('bone_auto_segment')}
              className={`tactile-rubber w-full h-9 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer ${
                activeSegmentTool === 'bone_auto_segment'
                  ? 'bg-[#0284C7] text-white shadow-xs font-semibold'
                  : 'text-[#0F172A] dark:text-slate-200 bg-slate-50 dark:bg-[#1E293B]/70 hover:bg-slate-100 dark:hover:bg-[#1E293B]'
              }`}
            >
              CT Bone Auto-Segment
            </button>

            <div className="w-full h-[1px] bg-slate-200 dark:bg-[#1E293B] my-1" />

            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block px-1 mb-1">
              Mesh & Morphology
            </span>

            <button
              type="button"
              onClick={() => {
                onSelectSegmentTool('island');
                onExecuteIslandFilter?.();
              }}
              className={`tactile-rubber w-full h-9 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer ${
                activeSegmentTool === 'island'
                  ? 'bg-[#0284C7] text-white shadow-xs font-semibold'
                  : 'text-[#0F172A] dark:text-slate-200 bg-slate-50 dark:bg-[#1E293B]/70 hover:bg-slate-100 dark:hover:bg-[#1E293B]'
              }`}
            >
              Keep Largest Island
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectSegmentTool('morphology');
                onExecuteMorphology?.();
              }}
              className={`tactile-rubber w-full h-9 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer ${
                activeSegmentTool === 'morphology'
                  ? 'bg-[#0284C7] text-white shadow-xs font-semibold'
                  : 'text-[#0F172A] dark:text-slate-200 bg-slate-50 dark:bg-[#1E293B]/70 hover:bg-slate-100 dark:hover:bg-[#1E293B]'
              }`}
            >
              Morphology (Close/Fill)
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectSegmentTool('generate_mesh');
                onGenerateMesh?.();
              }}
              className={`tactile-rubber w-full h-9 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer ${
                activeSegmentTool === 'generate_mesh'
                  ? 'bg-[#0284C7] text-white shadow-xs font-semibold'
                  : 'text-[#0F172A] dark:text-slate-200 bg-slate-50 dark:bg-[#1E293B]/70 hover:bg-slate-100 dark:hover:bg-[#1E293B]'
              }`}
            >
              Generate 3D Mesh
            </button>

            <button
              type="button"
              onClick={onExportStl}
              className="tactile-rubber w-full h-9 rounded-lg flex items-center justify-center text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 shadow-xs cursor-pointer mt-1"
            >
              Export STL
            </button>
          </div>
        ) : (
          /* Standard Diagnostic PACS Viewing Tool Groups */
          <div className="flex-1 w-full flex flex-col gap-1.5 animate-in fade-in duration-200">
            {/* Primary Diagnostic Tools */}
            <div className="flex flex-col gap-1.5 w-full px-2">
              <button
                type="button"
                onClick={() => onSelectTool('crosshair')}
                className={`tactile-rubber w-full h-9 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer ${
                  activeTool === 'crosshair' ? 'tactile-rubber-active' : 'text-[#0F172A]'
                }`}
              >
                Crosshair
              </button>

              <button
                type="button"
                onClick={() => onSelectTool('window')}
                className={`tactile-rubber w-full h-9 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer ${
                  activeTool === 'window' ? 'tactile-rubber-active' : 'text-[#0F172A]'
                }`}
              >
                Window / Level
              </button>

              <button
                type="button"
                onClick={() => onSelectTool('pan')}
                className={`tactile-rubber w-full h-9 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer ${
                  activeTool === 'pan' ? 'tactile-rubber-active' : 'text-[#0F172A]'
                }`}
              >
                Pan
              </button>

              <button
                type="button"
                onClick={() => onSelectTool('zoom')}
                className={`tactile-rubber w-full h-9 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer ${
                  activeTool === 'zoom' ? 'tactile-rubber-active' : 'text-[#0F172A]'
                }`}
              >
                Zoom
              </button>
            </div>

            <div className="w-full h-[1px] bg-slate-200 my-1 px-2" />

            {/* Measurement Tools */}
            <div className="flex flex-col gap-1.5 w-full px-2">
              <button
                type="button"
                onClick={() => onSelectTool('length')}
                className={`tactile-rubber w-full h-9 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer ${
                  activeTool === 'length' ? 'tactile-rubber-active' : 'text-[#0F172A]'
                }`}
              >
                Distance
              </button>

              <button
                type="button"
                onClick={() => onSelectTool('angle')}
                className={`tactile-rubber w-full h-9 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer ${
                  activeTool === 'angle' ? 'tactile-rubber-active' : 'text-[#0F172A]'
                }`}
              >
                Angle
              </button>

              <button
                type="button"
                onClick={() => onSelectTool('cobb')}
                className={`tactile-rubber w-full h-9 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer ${
                  activeTool === 'cobb' ? 'tactile-rubber-active' : 'text-[#0F172A]'
                }`}
              >
                Cobb Angle
              </button>

              <button
                type="button"
                onClick={() => onSelectTool('roi')}
                className={`tactile-rubber w-full h-9 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer ${
                  activeTool === 'roi' ? 'tactile-rubber-active' : 'text-[#0F172A]'
                }`}
              >
                Elliptical ROI
              </button>
            </div>

            <div className="w-full h-[1px] bg-slate-200 my-1 px-2" />

            {/* Slab Projection & Cine Mode */}
            <div className="flex flex-col gap-1.5 w-full px-2">
              <button
                type="button"
                onClick={() => {
                  const nextMode: Record<SlabMode, SlabMode> = {
                    none: 'mip',
                    mip: 'minip',
                    minip: 'average',
                    average: 'none',
                  };
                  onChangeSlabMode(nextMode[slabMode]);
                }}
                className={`tactile-rubber w-full h-9 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer ${
                  slabMode !== 'none' ? 'tactile-rubber-active' : 'text-[#0F172A]'
                }`}
              >
                {slabMode === 'none' ? 'Slab Mode' : `Slab: ${slabMode.toUpperCase()}`}
              </button>

              <button
                type="button"
                onClick={onToggleCine}
                className={`tactile-rubber w-full h-9 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer ${
                  isCinePlaying ? 'tactile-rubber-active' : 'text-[#0F172A]'
                }`}
              >
                {isCinePlaying ? 'Cine Pause' : 'Cine Play'}
              </button>
            </div>

            <div className="flex-1 min-h-2" />

            {/* Geometry Transforms & Reset */}
            <div className="flex flex-col gap-1.5 w-full px-2 pb-2">
              <button
                type="button"
                onClick={onRotate90}
                className="tactile-rubber w-full h-8 rounded-lg flex items-center justify-center text-xs font-medium text-[#0F172A] dark:text-slate-200 dark:bg-[#1E293B]/70 hover:dark:bg-[#1E293B] cursor-pointer"
              >
                Rotate 90
              </button>

              <button
                type="button"
                onClick={onFlipH}
                className="tactile-rubber w-full h-8 rounded-lg flex items-center justify-center text-xs font-medium text-[#0F172A] dark:text-slate-200 dark:bg-[#1E293B]/70 hover:dark:bg-[#1E293B] cursor-pointer"
              >
                Flip Horizontal
              </button>

              <button
                type="button"
                onClick={onFlipV}
                className="tactile-rubber w-full h-8 rounded-lg flex items-center justify-center text-xs font-medium text-[#0F172A] dark:text-slate-200 dark:bg-[#1E293B]/70 hover:dark:bg-[#1E293B] cursor-pointer"
              >
                Flip Vertical
              </button>

              <button
                type="button"
                onClick={onInvertLut}
                className={`tactile-rubber w-full h-8 rounded-lg flex items-center justify-center text-xs font-medium cursor-pointer ${
                  isLutInverted ? 'tactile-rubber-active' : 'text-[#0F172A] dark:text-slate-200 dark:bg-[#1E293B]/70 hover:dark:bg-[#1E293B]'
                }`}
              >
                Invert LUT
              </button>

              <button
                type="button"
                onClick={onResetView}
                className="tactile-rubber w-full h-8 rounded-lg flex items-center justify-center text-xs font-medium text-red-600 hover:text-red-700 dark:text-rose-400 dark:hover:text-rose-300 mt-1 cursor-pointer"
              >
                Reset View
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Tactile Collapse/Expand Handle Tab on Inner Edge */}
      <button
        type="button"
        onClick={onToggleOpen}
        title={isOpen ? 'Collapse Tools ([)' : 'Expand Tools ([)'}
        className="absolute top-1/2 -translate-y-1/2 -right-3.5 z-30 w-3.5 h-12 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#1E293B] rounded-r-md shadow-sm flex items-center justify-center cursor-pointer text-[9px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        style={{ writingMode: 'vertical-lr' }}
      >
        {isOpen ? 'Hide' : 'Tools'}
      </button>
    </div>
  );
};
