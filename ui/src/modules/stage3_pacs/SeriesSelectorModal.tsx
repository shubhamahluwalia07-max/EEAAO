import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { IngestionResult, SeriesCard, DicomTagEntry } from './types';
import { getSeriesSlices, renderSliceToCanvas, ParsedDicomSlice } from './dicomClientParser';

interface SeriesSelectorModalProps {
  study: IngestionResult;
  onSelectSeries: (series: SeriesCard) => void;
  onClose: () => void;
  currentSelectedSeriesUid?: string;
}

// Small helper component to render a 64x64 slice thumbnail for each series card
const SeriesThumbnail: React.FC<{ series: SeriesCard }> = ({ series }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const slices = getSeriesSlices(series.series_instance_uid);
    if (slices && slices.length > 0) {
      const midSlice = slices[Math.floor(slices.length / 2)];
      renderSliceToCanvas(canvas, midSlice, series.window_center, series.window_width);
    } else {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(0, 0, 64, 64);
      }
    }
  }, [series]);

  return (
    <canvas
      ref={canvasRef}
      width={64}
      height={64}
      className="w-16 h-16 rounded-lg bg-black object-contain shrink-0 border border-slate-200"
    />
  );
};

export const SeriesSelectorModal: React.FC<SeriesSelectorModalProps> = ({
  study,
  onSelectSeries,
  onClose,
  currentSelectedSeriesUid,
}) => {
  // Highlighted series in modal
  const [highlightedUid, setHighlightedUid] = useState<string>(() => {
    if (currentSelectedSeriesUid) return currentSelectedSeriesUid;
    // Prefer non-scout series
    const primary = study.series.find((s) => !s.is_scout);
    return primary ? primary.series_instance_uid : study.series[0]?.series_instance_uid || '';
  });

  // Active modality filter
  const [selectedModality, setSelectedModality] = useState<string>('ALL');

  // Inspector tab
  const [inspectorTab, setInspectorTab] = useState<'preview' | 'tags'>('preview');

  // Preview slice index
  const [previewSliceIndex, setPreviewSliceIndex] = useState<number>(0);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Search query for tags
  const [tagSearchQuery, setTagSearchQuery] = useState<string>('');

  // Modalities detected across series
  const modalityList = useMemo(() => {
    const set = new Set<string>();
    study.series.forEach((s) => {
      if (s.modality) set.add(s.modality.toUpperCase());
    });
    return Array.from(set);
  }, [study.series]);

  // Filtered series list
  const filteredSeries = useMemo(() => {
    if (selectedModality === 'ALL') return study.series;
    return study.series.filter(
      (s) => (s.modality || '').toUpperCase() === selectedModality
    );
  }, [study.series, selectedModality]);

  // Active highlighted series object
  const highlightedSeries = useMemo(() => {
    return (
      study.series.find((s) => s.series_instance_uid === highlightedUid) ||
      filteredSeries[0] ||
      study.series[0]
    );
  }, [study.series, filteredSeries, highlightedUid]);

  // Slices for highlighted series
  const highlightedSlices: ParsedDicomSlice[] = useMemo(() => {
    if (!highlightedSeries) return [];
    return getSeriesSlices(highlightedSeries.series_instance_uid) || [];
  }, [highlightedSeries]);

  // Reset slice index to middle when series changes
  useEffect(() => {
    if (highlightedSlices.length > 0) {
      setPreviewSliceIndex(Math.floor(highlightedSlices.length / 2));
    } else {
      setPreviewSliceIndex(0);
    }
  }, [highlightedUid, highlightedSlices.length]);

  // Render slice to preview canvas
  const renderCurrentSlice = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const slice = highlightedSlices[previewSliceIndex];
    if (slice) {
      renderSliceToCanvas(
        canvas,
        slice,
        highlightedSeries?.window_center,
        highlightedSeries?.window_width
      );
    } else {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [highlightedSlices, previewSliceIndex, highlightedSeries]);

  useEffect(() => {
    renderCurrentSlice();
  }, [renderCurrentSlice]);

  // Wheel scrub over preview canvas
  const handleCanvasWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (highlightedSlices.length <= 1) return;
    const delta = e.deltaY > 0 ? 1 : -1;
    setPreviewSliceIndex((prev) =>
      Math.max(0, Math.min(highlightedSlices.length - 1, prev + delta))
    );
  };

  // Filtered DICOM tags
  const displayedTags: DicomTagEntry[] = useMemo(() => {
    const raw = highlightedSeries?.raw_tags || [];
    if (!tagSearchQuery.trim()) return raw;
    const q = tagSearchQuery.toLowerCase();
    return raw.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.tag.toLowerCase().includes(q) ||
        t.value.toLowerCase().includes(q)
    );
  }, [highlightedSeries, tagSearchQuery]);

  const patientName = study.patient_name || highlightedSeries?.patient_name || 'Patient Anonymous';
  const patientId = study.patient_id || highlightedSeries?.patient_id || 'EX-9021';
  const studyDate = highlightedSeries?.series_date || '2026-09-23';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm select-none font-sans p-4">
      {/* Centered Pop-Up Modal Dialog */}
      <div className="w-[90vw] max-w-5xl h-[80vh] rounded-2xl bg-[#F8FAFC] dark:bg-[#0B132B] shadow-2xl border border-slate-300 dark:border-[#1E293B] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 animate-in fade-in duration-200">
        {/* Modal Header */}
        <header className="h-14 px-6 bg-white dark:bg-[#0F172A] border-b border-slate-200 dark:border-[#1E293B] flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
              {patientName}
            </h1>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {patientId}
            </span>
            <span className="text-xs text-slate-400 font-medium">|</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Study Date: {studyDate}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
              {study.series.length} Series
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="tactile-rubber px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </header>

        {/* Modal 3-Column Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column (22% width): Modality Filter Pills & Study Summary Info */}
          <aside className="w-[22%] shrink-0 border-r border-slate-200 dark:border-[#1E293B] p-4 flex flex-col justify-between bg-slate-50/70 dark:bg-[#090D16] overflow-y-auto">
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
                  Modality Filters
                </span>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedModality('ALL')}
                    className={`tactile-rubber w-full py-2 px-3 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer flex items-center justify-between ${
                      selectedModality === 'ALL'
                        ? 'bg-[#0284C7] text-[#FFFFFF] border border-[#0369A1] shadow-sm'
                        : 'bg-[#FFFFFF] dark:bg-[#111827] text-[#0F172A] dark:text-slate-200 border border-[#CBD5E1] dark:border-[#1E293B] hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className={selectedModality === 'ALL' ? 'text-[#FFFFFF]' : 'text-[#0F172A] dark:text-slate-200'}>
                      All Series
                    </span>
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                        selectedModality === 'ALL'
                          ? 'bg-[#FFFFFF] text-[#0284C7]'
                          : 'bg-slate-100 dark:bg-slate-800 text-[#475569] dark:text-slate-300'
                      }`}
                    >
                      {study.series.length}
                    </span>
                  </button>

                  {modalityList.map((mod) => {
                    const count = study.series.filter(
                      (s) => (s.modality || '').toUpperCase() === mod
                    ).length;
                    const isActive = selectedModality === mod;

                    return (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => setSelectedModality(mod)}
                        className={`tactile-rubber w-full py-2 px-3 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer flex items-center justify-between ${
                          isActive
                            ? 'bg-[#0284C7] text-[#FFFFFF] border border-[#0369A1] shadow-sm'
                            : 'bg-[#FFFFFF] dark:bg-[#111827] text-[#0F172A] dark:text-slate-200 border border-[#CBD5E1] dark:border-[#1E293B] hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className={isActive ? 'text-[#FFFFFF]' : 'text-[#0F172A] dark:text-slate-200'}>
                          {mod} Series
                        </span>
                        <span
                          className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                            isActive
                              ? 'bg-[#FFFFFF] text-[#0284C7]'
                              : 'bg-slate-100 dark:bg-slate-800 text-[#475569] dark:text-slate-300'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Study Summary Info Card */}
            <div className="p-3 bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#1E293B] rounded-xl shadow-xs text-xs flex flex-col gap-2 mt-4">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block text-[11px]">
                Study Information
              </span>
              <div className="text-slate-600 dark:text-slate-400 leading-snug">
                <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Description</span>
                <span className="font-semibold text-[#0F172A] dark:text-slate-100 truncate block">
                  {study.study_description || 'Diagnostic Scan'}
                </span>
              </div>
              <div className="text-slate-600 dark:text-slate-400 leading-snug">
                <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Total Slices</span>
                <span className="font-semibold text-[#0F172A] dark:text-slate-100">
                  {study.series.reduce((acc, s) => acc + s.slice_count, 0)} images
                </span>
              </div>
              {study.telemetry?.spacing_summary && (
                <div className="text-slate-600 dark:text-slate-400 leading-snug">
                  <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Physical Spacing</span>
                  <span className="font-semibold text-[#0F172A] dark:text-slate-100 text-[11px]">
                    {study.telemetry.spacing_summary}
                  </span>
                </div>
              )}
            </div>
          </aside>

          {/* Center Column (43% width): Scrollable Stack of Tactile Series Selection Cards */}
          <section className="w-[43%] shrink-0 border-r border-slate-200 dark:border-[#1E293B] p-3.5 flex flex-col overflow-hidden bg-white dark:bg-[#0D1527]">
            <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-200 dark:border-[#1E293B] shrink-0">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Series Selection ({filteredSeries.length})
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                Double-click to load
              </span>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1">
              {filteredSeries.map((s) => {
                const isSelected = highlightedUid === s.series_instance_uid;

                return (
                  <div
                    key={s.series_instance_uid}
                    onClick={() => setHighlightedUid(s.series_instance_uid)}
                    onDoubleClick={() => onSelectSeries(s)}
                    className={`tactile-rubber p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#0284C7] border-[#0369A1] shadow-md'
                        : 'bg-[#FFFFFF] dark:bg-[#111827] border-[#CBD5E1] dark:border-[#1E293B] hover:border-sky-500 dark:hover:border-sky-500 hover:bg-slate-50 dark:hover:bg-[#162035]'
                    }`}
                  >
                    {/* Square slice thumbnail on left */}
                    <SeriesThumbnail series={s} />

                    {/* Metadata on right */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`font-semibold text-xs truncate ${
                            isSelected ? 'text-[#FFFFFF]' : 'text-[#0F172A] dark:text-slate-100'
                          }`}
                        >
                          {s.series_description || `Series #${s.series_number}`}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isSelected
                              ? 'bg-[#FFFFFF] text-[#0284C7]'
                              : 'bg-slate-100 dark:bg-slate-800 text-[#475569] dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {s.modality}
                        </span>
                      </div>

                      <div
                        className={`text-xs flex items-center gap-2 font-medium ${
                          isSelected ? 'text-[#FFFFFF]' : 'text-[#475569] dark:text-slate-400'
                        }`}
                      >
                        <span className={isSelected ? 'text-[#FFFFFF]' : 'text-[#475569] dark:text-slate-300'}>
                          {s.slice_count} slices
                        </span>
                        <span className={isSelected ? 'text-[#FFFFFF]' : 'text-slate-400'}>·</span>
                        <span className={isSelected ? 'text-[#FFFFFF]' : 'text-[#475569] dark:text-slate-300'}>
                          {s.rows} × {s.columns}
                        </span>
                      </div>

                      <div
                        className={`text-[11px] font-medium truncate ${
                          isSelected ? 'text-[#FFFFFF]' : 'text-[#475569] dark:text-slate-400'
                        }`}
                      >
                        Spacing: {s.pixel_spacing[0].toFixed(2)} × {s.pixel_spacing[1].toFixed(2)} mm (dz={s.slice_thickness.toFixed(2)}mm)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Right Column (35% width): Unified Interactive Slice Scrubber & Tag Inspector */}
          <aside className="w-[35%] flex flex-col bg-[#F8FAFC] dark:bg-[#090D16] overflow-hidden">
            {/* Top Segmented Switch */}
            <div className="p-3 bg-white dark:bg-[#0F172A] border-b border-slate-200 dark:border-[#1E293B] flex items-center justify-between shrink-0">
              <div className="grid grid-cols-2 bg-slate-100 dark:bg-[#111827] p-0.5 rounded-lg w-full max-w-xs border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setInspectorTab('preview')}
                  className={`py-1 rounded text-xs font-semibold transition-all cursor-pointer text-center ${
                    inspectorTab === 'preview'
                      ? 'bg-[#0284C7] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Slice Preview
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab('tags')}
                  className={`py-1 rounded text-xs font-semibold transition-all cursor-pointer text-center ${
                    inspectorTab === 'tags'
                      ? 'bg-[#0284C7] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  DICOM Metadata
                </button>
              </div>
            </div>

            {/* Inspector Tab Content */}
            <div className="flex-1 flex flex-col overflow-hidden p-3.5">
              {inspectorTab === 'preview' ? (
                /* Interactive Slice Scrubber */
                <div className="flex-1 flex flex-col items-center justify-between gap-3 overflow-hidden">
                  {/* Canvas Viewport */}
                  <div
                    onWheel={handleCanvasWheel}
                    className="relative flex-1 w-full max-h-[300px] bg-black rounded-xl overflow-hidden border border-slate-300 dark:border-slate-800 flex items-center justify-center shadow-inner cursor-ns-resize"
                  >
                    <canvas
                      ref={previewCanvasRef}
                      width={256}
                      height={256}
                      className="w-full h-full object-contain pointer-events-none"
                    />
                    <div className="absolute top-2 left-2 text-[10px] font-semibold text-white/80 bg-black/60 px-1.5 py-0.5 rounded">
                      Slice {previewSliceIndex + 1} / {highlightedSlices.length || 1}
                    </div>
                  </div>

                  {/* Scrubber Range Slider */}
                  <div className="w-full bg-white dark:bg-[#111827] p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-2 shrink-0">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-500 dark:text-slate-400">Slice Position:</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {previewSliceIndex + 1} of {highlightedSlices.length || 1}
                      </span>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, highlightedSlices.length - 1)}
                      value={previewSliceIndex}
                      onChange={(e) => setPreviewSliceIndex(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
                    />

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>WW: {highlightedSeries?.window_width || 400}</span>
                      <span>WL: {highlightedSeries?.window_center || 40}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* DICOM Metadata Tag Inspector */
                <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl">
                  {/* Search bar */}
                  <div className="p-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <input
                      type="text"
                      placeholder="Search tags, VR, value..."
                      value={tagSearchQuery}
                      onChange={(e) => setTagSearchQuery(e.target.value)}
                      className="w-full px-2.5 py-1 text-xs bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-md outline-none focus:border-[#0284C7]"
                    />
                  </div>

                  {/* Tags list */}
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                    {displayedTags.length > 0 ? (
                      displayedTags.map((t, idx) => (
                        <div key={idx} className="p-2 flex flex-col gap-0.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-semibold">
                            <span>{t.tag}</span>
                            <span className="text-slate-400 dark:text-slate-500 text-[10px]">{t.vr}</span>
                          </div>
                          <div className="text-slate-800 dark:text-slate-200 font-sans font-medium text-xs">
                            {t.name}
                          </div>
                          <div className="text-slate-600 dark:text-slate-400 truncate text-[10px]">
                            {t.value}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400 font-sans">
                        No DICOM tags found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Action Bar */}
            <div className="h-14 px-4 bg-white dark:bg-[#0F172A] border-t border-slate-200 dark:border-[#1E293B] flex items-center justify-between shrink-0 shadow-sm">
              <button
                type="button"
                onClick={onClose}
                className="tactile-rubber px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  if (highlightedSeries) {
                    onSelectSeries(highlightedSeries);
                  }
                }}
                className="tactile-rubber px-5 py-2 rounded-lg text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 shadow-sm transition-colors cursor-pointer"
              >
                Load Selected Series
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
