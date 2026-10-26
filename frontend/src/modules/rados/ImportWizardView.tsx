import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderOpen,
  FileArchive,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Layers,
  Activity,
  Sliders,
  Sparkles,
  Zap,
  Info,
  Clock,
  User,
  Hash,
  Eye,
  Check,
  ChevronRight,
  UploadCloud,
} from 'lucide-react';
import { IngestionResult, SeriesCard, ModalityType, Volume3DData } from '../../types';

async function extractFilesFromDataTransfer(
  items: DataTransferItemList | null,
  filesFallback: FileList | null
): Promise<File[]> {
  const result: File[] = [];

  if (!items || items.length === 0) {
    if (filesFallback && filesFallback.length > 0) {
      return Array.from(filesFallback);
    }
    return [];
  }

  const traverseEntry = (entry: any): Promise<void> => {
    return new Promise((resolve) => {
      if (entry.isFile) {
        entry.file(
          (file: File) => {
            result.push(file);
            resolve();
          },
          () => resolve()
        );
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const readEntries = () => {
          dirReader.readEntries(
            async (entries: any[]) => {
              if (entries.length === 0) {
                resolve();
              } else {
                for (const subEntry of entries) {
                  await traverseEntry(subEntry);
                }
                readEntries();
              }
            },
            () => resolve()
          );
        };
        readEntries();
      } else {
        resolve();
      }
    });
  };

  const promises: Promise<void>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = (item as any).webkitGetAsEntry ? (item as any).webkitGetAsEntry() : null;
      if (entry) {
        promises.push(traverseEntry(entry));
      } else {
        const file = item.getAsFile();
        if (file) result.push(file);
      }
    }
  }

  await Promise.all(promises);
  if (result.length === 0 && filesFallback && filesFallback.length > 0) {
    return Array.from(filesFallback);
  }
  return result;
}

interface ImportWizardViewProps {
  onCompleteImport: (study: IngestionResult, selectedSeries: SeriesCard, preset: { minHu: number; maxHu: number; quality: string }) => void;
  onCancel: () => void;
}

const BENCHMARK_PATH = 'C:\\Users\\ShubhamAhluwalia\\Downloads\\Compressed\\KAMLESH 202603583814.zip';

const TISSUE_PRESETS = [
  {
    id: 'bone',
    name: 'Bone & Skeletal',
    minHu: 226,
    maxHu: 3071,
    desc: 'Dense cortical and trabecular bone reconstruction',
    badge: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    iconColor: 'text-amber-400',
  },
  {
    id: 'spongiosa',
    name: 'Spongiosa / Trabecular',
    minHu: 150,
    maxHu: 700,
    desc: 'Cancellous bone and internal marrow cavity',
    badge: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
    iconColor: 'text-rose-400',
  },
  {
    id: 'soft_tissue',
    name: 'Soft Tissue',
    minHu: -100,
    maxHu: 200,
    desc: 'Muscles, organs, ligaments, and vessels',
    badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    iconColor: 'text-emerald-400',
  },
  {
    id: 'lung',
    name: 'Pulmonary / Air',
    minHu: -950,
    maxHu: -400,
    desc: 'Low-density pulmonary parenchyma and airway lumen',
    badge: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
    iconColor: 'text-cyan-400',
  },
  {
    id: 'angio',
    name: 'Angiography / Contrast',
    minHu: 120,
    maxHu: 550,
    desc: 'Intravenous iodinated contrast blood vessels',
    badge: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
    iconColor: 'text-purple-400',
  },
];

export const ImportWizardView: React.FC<ImportWizardViewProps> = ({
  onCompleteImport,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanStatus, setScanStatus] = useState<string>('Ready to ingest DICOM');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Ingested study & series
  const [ingestedStudy, setIngestedStudy] = useState<IngestionResult | null>(null);
  const [selectedSeriesUid, setSelectedSeriesUid] = useState<string>('');
  const [filterModality, setFilterModality] = useState<ModalityType>('ALL');

  // Presets & Reconstruction
  const [selectedPresetId, setSelectedPresetId] = useState<string>('bone');
  const [reconstructionQuality, setReconstructionQuality] = useState<'Low' | 'Medium' | 'High' | 'Optimal'>('Optimal');
  const [autoWatertight, setAutoWatertight] = useState<boolean>(true);

  // Canvas preview
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [previewSlice, setPreviewSlice] = useState<number>(0);

  const activeSeries = React.useMemo(() => {
    if (!ingestedStudy) return null;
    return ingestedStudy.series.find((s) => s.series_instance_uid === selectedSeriesUid) || ingestedStudy.series[0];
  }, [ingestedStudy, selectedSeriesUid]);

  // Execute Ingestion
  const handleIngest = useCallback(async (path: string) => {
    setIsScanning(true);
    setScanProgress(15);
    setScanStatus('Reading DICOM directory & parsing SOP instances...');
    setErrorMsg(null);

    try {
      const res = await fetch('/api/dicom/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: path.trim() }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Failed to ingest DICOM dataset');
      }

      setScanProgress(75);
      setScanStatus('Assembling series geometry and 3D HU volumes...');

      const study: IngestionResult = await res.json();
      setIngestedStudy(study);
      setScanProgress(100);
      setScanStatus('DICOM Study successfully ingested');

      // Auto-select primary non-scout series
      const primary = study.series.find((s) => !s.is_scout) || study.series[0];
      if (primary) {
        setSelectedSeriesUid(primary.series_instance_uid);
      }

      setIsScanning(false);
      // Advance to Step 2
      setCurrentStep(2);
    } catch (err: any) {
      console.error('Ingest failed:', err);
      setErrorMsg(err.message || 'Error occurred during DICOM ingestion');
      setIsScanning(false);
      setScanProgress(0);
    }
  }, []);

  // Handle files upload (folder slices or zip)
  const handleUploadFiles = useCallback(async (files: File[]) => {
    if (!files || files.length === 0) return;
    setIsScanning(true);
    setScanProgress(15);
    setScanStatus(`Ingesting ${files.length} file${files.length > 1 ? 's' : ''}...`);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      setScanProgress(40);
      setScanStatus(`Reading DICOM tags & geometric headers (${files.length} item${files.length > 1 ? 's' : ''})...`);

      const res = await fetch('/api/dicom/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(err.detail || 'Failed to ingest DICOM dataset');
      }

      setScanProgress(80);
      setScanStatus('Constructing series geometry and 3D HU volumes...');

      const study: IngestionResult = await res.json();
      setIngestedStudy(study);
      setScanProgress(100);
      setScanStatus('DICOM Study successfully ingested');

      // Auto-select primary non-scout series
      const primary = study.series.find((s) => !s.is_scout) || study.series[0];
      if (primary) {
        setSelectedSeriesUid(primary.series_instance_uid);
      }

      setIsScanning(false);
      setCurrentStep(2);
    } catch (err: any) {
      console.error('Upload/Ingest failed:', err);
      setErrorMsg(err.message || 'Error occurred during DICOM ingestion');
      setIsScanning(false);
      setScanProgress(0);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const items = e.dataTransfer.items;
    const filesFallback = e.dataTransfer.files;
    const extractedFiles = await extractFilesFromDataTransfer(items, filesFallback);
    if (extractedFiles && extractedFiles.length > 0) {
      handleUploadFiles(extractedFiles);
    }
  }, [handleUploadFiles]);

  const handleZipSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(Array.from(e.target.files));
    }
    e.target.value = '';
  }, [handleUploadFiles]);

  const handleFolderSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(Array.from(e.target.files));
    }
    e.target.value = '';
  }, [handleUploadFiles]);

  // Filtered series list
  const filteredSeriesList = React.useMemo(() => {
    if (!ingestedStudy) return [];
    if (filterModality === 'ALL') return ingestedStudy.series;
    return ingestedStudy.series.filter((s) => s.modality.toUpperCase() === filterModality);
  }, [ingestedStudy, filterModality]);

  // Procedural slice canvas preview
  useEffect(() => {
    if (currentStep !== 2 || !previewCanvasRef.current || !activeSeries) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 240;
    const h = 240;
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = '#05070D';
    ctx.fillRect(0, 0, w, h);

    const total = activeSeries.num_slices || 1;
    const t = previewSlice / Math.max(1, total - 1);
    const radius = 40 + Math.sin(t * Math.PI) * 32;

    const grad = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, radius);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.65, '#94A3B8');
    grad.addColorStop(0.9, '#334155');
    grad.addColorStop(1, 'transparent');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.font = '10px Inter';
    ctx.fillText(`Slice ${previewSlice + 1} / ${total}`, 10, h - 10);
  }, [currentStep, activeSeries, previewSlice]);

  // Finish wizard and launch
  const handleFinishAndLaunch = () => {
    if (!ingestedStudy || !activeSeries) return;
    const preset = TISSUE_PRESETS.find((p) => p.id === selectedPresetId) || TISSUE_PRESETS[0];
    onCompleteImport(ingestedStudy, activeSeries, {
      minHu: preset.minHu,
      maxHu: preset.maxHu,
      quality: reconstructionQuality,
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#F8FAFC] dark:bg-[#090D16] text-[#0F172A] dark:text-[#F8FAFC] overflow-y-auto select-none">
      {/* Top Banner with Steps */}
      <div className="w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#0D131F]/90 backdrop-blur-md px-8 py-4 shrink-0 shadow-sm z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0284C7] to-sky-400 text-white flex items-center justify-center font-extrabold text-sm shadow-md shadow-sky-500/20">
              MD
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 dark:text-white">
                  MEDAM DICOM Import & Reconstruction Wizard
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/80 text-[#0284C7] dark:text-sky-400 border border-sky-300 dark:border-sky-800">
                  Origin UI v2.0
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automated spatial grouping, orientation normalization, and clinical tissue presets
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="tactile-rubber neu-btn px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            Cancel & Return
          </button>
        </div>

        {/* Wizard Steps Breadcrumb */}
        <div className="max-w-5xl mx-auto mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
          {[
            { step: 1, title: 'Source & Ingestion', icon: FolderOpen },
            { step: 2, title: 'Study & Series Review', icon: Layers },
          ].map((item, idx) => {
            const isPassed = currentStep > item.step;
            const isCurrent = currentStep === item.step;
            const Icon = item.icon;
            return (
              <React.Fragment key={item.step}>
                <div
                  onClick={() => {
                    if (ingestedStudy && item.step < currentStep) setCurrentStep(item.step);
                  }}
                  className={`flex items-center gap-2.5 cursor-pointer transition-all ${
                    isCurrent
                      ? 'text-[#0284C7] dark:text-[#38BDF8] font-bold'
                      : isPassed
                      ? 'text-emerald-500 font-semibold'
                      : 'text-slate-400 dark:text-slate-600 font-medium'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all ${
                      isCurrent
                        ? 'neu-primary text-white scale-110 shadow-md'
                        : isPassed
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-slate-200/70 dark:bg-slate-800/60 text-slate-400 border border-slate-300/40 dark:border-slate-700/40'
                    }`}
                  >
                    {isPassed ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : item.step}
                  </div>
                  <span className="text-xs whitespace-nowrap">{item.title}</span>
                </div>
                {idx < 1 && (
                  <div
                    className={`flex-1 mx-3 h-[2px] rounded-full transition-all ${
                      currentStep > idx + 1 ? 'bg-emerald-500/60' : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-8 flex flex-col justify-center">
        {/* STEP 1: SOURCE SELECTION */}
        {currentStep === 1 && (
          <div className="w-full flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Hidden native file/folder inputs */}
            <input
              type="file"
              ref={zipInputRef}
              accept=".zip,application/zip"
              className="hidden"
              onChange={handleZipSelected}
            />
            <input
              type="file"
              ref={folderInputRef}
              {...({ webkitdirectory: '', directory: '', multiple: true } as any)}
              className="hidden"
              onChange={handleFolderSelected}
            />

            <div className="neu-convex p-8 rounded-3xl flex flex-col gap-6 border border-white/60 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-[#0284C7] dark:text-sky-400 border border-sky-200 dark:border-sky-800">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Select DICOM Source Directory or ZIP Archive
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Supports CT, MR, CR, and DX multi-slice volumes with spatial tag parsing
                  </p>
                </div>
              </div>

              {/* Drag and Drop Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => folderInputRef.current?.click()}
                className={`relative rounded-3xl p-10 flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer ${
                  isDraggingOver
                    ? 'neu-pressed border-2 border-dashed border-[#0284C7] bg-sky-500/10 scale-[1.01]'
                    : 'neu-pressed border-2 border-dashed border-slate-300 dark:border-slate-700/80 hover:border-[#0284C7]/60'
                }`}
              >
                <div
                  className={`w-16 h-16 rounded-2xl neu-convex flex items-center justify-center text-[#0284C7] dark:text-sky-400 mb-4 shadow-lg transition-transform duration-200 ${
                    isDraggingOver ? 'scale-125 text-[#0284C7]' : ''
                  }`}
                >
                  <UploadCloud className="w-8 h-8" />
                </div>

                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
                  {isDraggingOver ? 'Drop files here to ingest' : 'Drag & drop DICOM folder or ZIP archive here'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mb-6">
                  Accepted formats: uncompressed DICOM directory containing .dcm slices, or standard .zip study archive.
                </p>

                {/* Browse Action Buttons */}
                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    disabled={isScanning}
                    onClick={() => folderInputRef.current?.click()}
                    className="tactile-rubber neu-btn px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border border-slate-200/80 dark:border-white/10 hover:text-[#0284C7] cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    <FolderOpen className="w-4 h-4 text-[#0284C7]" />
                    <span>Browse DICOM Folder</span>
                  </button>

                  <button
                    type="button"
                    disabled={isScanning}
                    onClick={() => zipInputRef.current?.click()}
                    className="tactile-rubber neu-btn px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border border-slate-200/80 dark:border-white/10 hover:text-[#0284C7] cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    <FileArchive className="w-4 h-4 text-amber-500" />
                    <span>Browse ZIP Archive</span>
                  </button>
                </div>
              </div>

              {/* Benchmark CT Study 1-Click Option */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-teal-500/10 border border-sky-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#0284C7] text-white shadow-md shadow-sky-500/20">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Standard Benchmark CT Study (KAMLESH)
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Standardized patient dataset located at {BENCHMARK_PATH}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isScanning}
                  onClick={() => handleIngest(BENCHMARK_PATH)}
                  className="tactile-rubber neu-primary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Load 1-Click Benchmark
                </button>
              </div>

              {/* Scan Status & Progress */}
              {isScanning && (
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[#0284C7] dark:text-sky-400 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#0284C7] animate-ping" />
                      {scanStatus}
                    </span>
                    <span className="text-slate-500 font-bold">{scanProgress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full neu-pressed overflow-hidden">
                    <div
                      style={{ width: `${scanProgress}%` }}
                      className="h-full bg-gradient-to-r from-[#0284C7] to-cyan-400 rounded-full transition-all duration-300"
                    />
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-semibold flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: STUDY & SERIES REVIEW */}
        {currentStep === 2 && ingestedStudy && (
          <div className="w-full flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Patient Header Summary */}
            <div className="neu-convex p-5 rounded-2xl flex items-center justify-between border border-white/60 dark:border-white/5">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#0284C7]" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Patient:</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {ingestedStudy.patient_name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-[#0284C7]" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">ID:</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {ingestedStudy.patient_id}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#0284C7]" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Total Series:</span>
                  <span className="text-xs font-bold text-emerald-500">
                    {ingestedStudy.series.length}
                  </span>
                </div>
              </div>

              {/* Modality Filter Tabs */}
              <div className="flex items-center gap-1 neu-pressed p-1 rounded-xl">
                {(['ALL', 'CT', 'MR', 'CR', 'DX'] as ModalityType[]).map((mod) => (
                  <button
                    key={mod}
                    type="button"
                    onClick={() => setFilterModality(mod)}
                    className={`tactile-rubber px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      filterModality === mod
                        ? 'neu-primary text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {mod}
                  </button>
                ))}
              </div>
            </div>

            {/* Split: Series Cards on Left, Canvas Preview on Right */}
            <div className="grid grid-cols-12 gap-6">
              {/* Left Column: Series Cards */}
              <div className="col-span-8 flex flex-col gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                {filteredSeriesList.map((s) => {
                  const isSelected = s.series_instance_uid === selectedSeriesUid;
                  const modBadge =
                    s.modality === 'CT'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : s.modality === 'MR'
                      ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/40';

                  return (
                    <div
                      key={s.series_instance_uid}
                      onClick={() => setSelectedSeriesUid(s.series_instance_uid)}
                      onDoubleClick={handleFinishAndLaunch}
                      className={`tactile-rubber p-4 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'neu-convex border-[#0284C7] ring-2 ring-[#0284C7]/30 bg-sky-50/40 dark:bg-sky-950/20'
                          : 'neu-btn border-transparent hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${modBadge}`}>
                            {s.modality}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {s.series_description}
                          </span>
                          {s.is_scout && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-500">
                              Scout / Localizer
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          <span className="font-bold text-[#0284C7] dark:text-sky-400">
                            {s.num_slices} Slices
                          </span>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-[#0284C7] bg-[#0284C7]' : 'border-slate-400'
                          }`}>
                            {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[10px] text-slate-500">
                        <span>Dimensions: {s.dimensions.join(' x ')}</span>
                        <span>Spacing: {s.pixel_spacing[0].toFixed(2)} x {s.pixel_spacing[1].toFixed(2)} mm</span>
                        <span>Thickness: {s.slice_thickness.toFixed(2)} mm</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Interactive Slice Preview */}
              <div className="col-span-4 neu-convex p-4 rounded-2xl flex flex-col items-center justify-between border border-white/60 dark:border-white/5">
                <div className="w-full flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span>Slice Scrubbing Preview</span>
                  <span className="text-[10px] text-sky-500 font-semibold">Native Wheel Scrub</span>
                </div>

                <div className="w-full flex items-center justify-center p-2">
                  <canvas ref={previewCanvasRef} className="rounded-xl neu-pressed shadow-inner" />
                </div>

                <div className="w-full flex flex-col gap-1.5 pt-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                    <span>Slice Index</span>
                    <span>{previewSlice + 1} / {activeSeries?.num_slices || 1}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, (activeSeries?.num_slices || 1) - 1)}
                    value={previewSlice}
                    onChange={(e) => setPreviewSlice(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 rounded-lg appearance-none bg-slate-200 dark:bg-slate-700 cursor-pointer accent-[#0284C7]"
                  />
                </div>
              </div>
            </div>

            {/* Step 2 Footer Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="tactile-rubber neu-btn px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Source</span>
              </button>

              <button
                type="button"
                disabled={!activeSeries}
                onClick={handleFinishAndLaunch}
                className="tactile-rubber neu-primary px-8 py-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-xl shadow-sky-600/30 cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>Launch Rados Workstation</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
