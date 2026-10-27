import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { X, Search, FileText, Image as ImageIcon, FolderPlus, Sparkles } from 'lucide-react';
import { SeriesCard, IngestionResult, ModalityType, DicomTagEntry } from '../../types';

interface SeriesSelectorModalProps {
  study: IngestionResult;
  currentSelectedSeriesUid?: string;
  onSelectSeries: (series: SeriesCard) => void;
  onClose: () => void;
  onOpenImportWizard?: () => void;
}

export const SeriesSelectorModal: React.FC<SeriesSelectorModalProps> = ({
  study,
  currentSelectedSeriesUid,
  onSelectSeries,
  onClose,
  onOpenImportWizard,
}) => {
  // Currently highlighted series in the selector
  const [highlightedUid, setHighlightedUid] = useState<string>(() => {
    if (currentSelectedSeriesUid) return currentSelectedSeriesUid;
    const nonScout = study.series.find((s) => !s.is_scout);
    return nonScout ? nonScout.series_instance_uid : study.series[0]?.series_instance_uid || '';
  });

  const [activeModality, setActiveModality] = useState<ModalityType>('ALL');
  const [activeTab, setActiveTab] = useState<'preview' | 'tags'>('preview');
  const [previewSliceIndex, setPreviewSliceIndex] = useState<number>(0);
  const [tagSearch, setTagSearch] = useState<string>('');

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const highlightedSeries = useMemo(
    () => study.series.find((s) => s.series_instance_uid === highlightedUid) || study.series[0],
    [study.series, highlightedUid]
  );

  const totalSlices = highlightedSeries?.num_slices || 1;
  const totalSlicesRef = useRef(totalSlices);
  totalSlicesRef.current = totalSlices;

  // Filter series by modality
  const filteredSeries = useMemo(() => {
    if (activeModality === 'ALL') return study.series;
    return study.series.filter((s) => s.modality.toUpperCase() === activeModality);
  }, [study.series, activeModality]);

  // Non-passive native wheel listener for slice scrubbing
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const count = totalSlicesRef.current;
      if (count <= 1) return;
      const delta = e.deltaY > 0 ? 1 : -1;
      setPreviewSliceIndex((prev) => Math.max(0, Math.min(count - 1, prev + delta)));
    };

    el.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheelNative);
    };
  }, []);

  // Simple procedural slice preview rendering on canvas
  const renderPreviewSlice = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 256;
    const h = 256;
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = '#05070D';
    ctx.fillRect(0, 0, w, h);

    // Anatomical bone contour simulation for preview
    const t = previewSliceIndex / Math.max(1, totalSlices - 1);
    const radius = 45 + Math.sin(t * Math.PI) * 35;

    const grad = ctx.createRadialGradient(w / 2, h / 2, 5, w / 2, h / 2, radius);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.7, '#A0AEC0');
    grad.addColorStop(0.95, '#4A5568');
    grad.addColorStop(1, 'transparent');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
    ctx.fill();

    // Orientation text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = '10px Inter';
    ctx.fillText('A', w / 2 - 3, 16);
    ctx.fillText('P', w / 2 - 3, h - 8);
    ctx.fillText('R', 8, h / 2 + 3);
    ctx.fillText('L', w - 16, h / 2 + 3);
  }, [previewSliceIndex, totalSlices]);

  useEffect(() => {
    renderPreviewSlice();
  }, [renderPreviewSlice]);

  // Filtered DICOM tags
  const filteredTags = useMemo(() => {
    const tags = highlightedSeries?.raw_tags || [];
    if (!tagSearch.trim()) return tags;
    const q = tagSearch.toLowerCase();
    return tags.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.tag.toLowerCase().includes(q) ||
        t.value.toLowerCase().includes(q)
    );
  }, [highlightedSeries, tagSearch]);

  const handleConfirm = () => {
    if (highlightedSeries) {
      onSelectSeries(highlightedSeries);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-[90vw] max-w-5xl h-[82vh] bg-[#F8FAFC] dark:bg-[#0D131F] rounded-3xl border border-white/60 dark:border-white/5 neu-convex shadow-2xl flex flex-col overflow-hidden select-none font-sans">
        {/* Top Header */}
        <div className="h-14 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <span className="font-bold text-base text-slate-900 dark:text-white">
              Series Selection
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {study.patient_name} ({study.patient_id})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenImportWizard && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenImportWizard();
                }}
                className="tactile-rubber neu-primary px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="Ingest another DICOM folder or ZIP archive"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Add New DICOM...</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 tactile-rubber"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3-Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Modality Filters */}
          <div className="w-44 border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-1.5 shrink-0 bg-slate-50/50 dark:bg-slate-900/30">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Modality
            </span>
            {(['ALL', 'CT', 'MR', 'CR', 'DX'] as ModalityType[]).map((mod) => {
              const isActive = activeModality === mod;
              return (
                <button
                  key={mod}
                  type="button"
                  onClick={() => setActiveModality(mod)}
                  className={`tactile-rubber w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#0284C7] text-white shadow-md shadow-sky-600/30 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{mod === 'ALL' ? 'All Series' : mod}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {mod === 'ALL'
                      ? study.series.length
                      : study.series.filter((s) => s.modality.toUpperCase() === mod).length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Center Column: Scrollable Series Cards */}
          <div className="flex-1 border-r border-slate-200 dark:border-slate-800 p-4 overflow-y-auto flex flex-col gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
              Available Series ({filteredSeries.length})
            </span>

            {filteredSeries.map((s) => {
              const isSelected = s.series_instance_uid === highlightedUid;
              return (
                <div
                  key={s.series_instance_uid}
                  onClick={() => setHighlightedUid(s.series_instance_uid)}
                  onDoubleClick={handleConfirm}
                  className={`tactile-rubber p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#0284C7] text-white border-transparent shadow-lg shadow-sky-600/25'
                      : 'bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {s.modality}
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                        {s.series_description}
                      </span>
                      <span className={`text-[11px] ${isSelected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                        {s.num_slices} Slices • {s.dimensions[0]}×{s.dimensions[1]} • Spacing: {s.pixel_spacing[0].toFixed(2)} mm
                      </span>
                    </div>
                  </div>

                  {s.is_scout && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      Scout
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Column: Preview & Metadata */}
          <div className="w-[320px] flex flex-col p-4 bg-slate-50/50 dark:bg-slate-900/30 shrink-0 gap-3">
            {/* Inspector Tab Switcher */}
            <div className="flex items-center bg-slate-200/70 dark:bg-slate-800/60 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`tactile-rubber flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
                  activeTab === 'preview'
                    ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Slice Preview</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('tags')}
                className={`tactile-rubber flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
                  activeTab === 'tags'
                    ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>DICOM Tags</span>
              </button>
            </div>

            {/* Tab Contents */}
            {activeTab === 'preview' ? (
              <div className="flex-1 flex flex-col gap-2.5 overflow-hidden">
                <div
                  ref={previewContainerRef}
                  className="relative w-full aspect-square bg-black rounded-xl overflow-hidden border border-slate-300 dark:border-slate-800 flex items-center justify-center shadow-inner cursor-ns-resize"
                >
                  <canvas ref={previewCanvasRef} className="w-full h-full object-contain pointer-events-none" />
                  <div className="absolute top-2 left-2 text-[10px] font-semibold text-white/90 bg-black/60 px-1.5 py-0.5 rounded">
                    Slice {previewSliceIndex + 1} / {totalSlices}
                  </div>
                </div>

                {/* Range Slider Scrubber */}
                <div className="flex flex-col gap-1 px-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>Scrub Position</span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {previewSliceIndex + 1} / {totalSlices}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, totalSlices - 1)}
                    value={previewSliceIndex}
                    onChange={(e) => setPreviewSliceIndex(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                {/* Search tags */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-[#111827] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search tags..."
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>

                <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
                  {filteredTags.map((t, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 rounded bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-[10px] flex flex-col"
                    >
                      <span className="font-semibold text-slate-600 dark:text-slate-400">
                        {t.tag} {t.name}
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 truncate">{t.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 mt-auto">
              <button
                type="button"
                onClick={onClose}
                className="tactile-rubber flex-1 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-200/60 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className="tactile-rubber flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 shadow-md shadow-sky-600/30"
              >
                Load Selected Series
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
