import React, { useState, useCallback, useRef } from 'react';
import { IngestionResult, SeriesCard } from '../../types';

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
  onCompleteImport: (
    study: IngestionResult,
    selectedSeries: SeriesCard,
    preset: { minHu: number; maxHu: number; quality: string }
  ) => void;
  onCancel: () => void;
}

export const ImportWizardView: React.FC<ImportWizardViewProps> = ({
  onCompleteImport,
  onCancel,
}) => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanStatus, setScanStatus] = useState<string>('Ready');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Handle files upload (folder slices or zip)
  const handleUploadFiles = useCallback(
    async (files: File[]) => {
      if (!files || files.length === 0) return;
      setIsScanning(true);
      setScanProgress(20);
      setScanStatus('Reading DICOM data...');
      setErrorMsg(null);

      try {
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
          formData.append('files', files[i]);
        }

        setScanProgress(50);
        setScanStatus('Processing headers...');

        const res = await fetch('/api/dicom/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
          throw new Error(err.detail || 'Failed to ingest DICOM dataset');
        }

        setScanProgress(90);
        setScanStatus('Constructing volume...');

        const study: IngestionResult = await res.json();
        const primary = study.series.find((s) => !s.is_scout) || study.series[0];

        setIsScanning(false);
        onCompleteImport(study, primary, { minHu: 226, maxHu: 3071, quality: 'Optimal' });
      } catch (err: any) {
        console.error('Upload/Ingest failed:', err);
        setErrorMsg(err.message || 'Error occurred during DICOM ingestion');
        setIsScanning(false);
        setScanProgress(0);
      }
    },
    [onCompleteImport]
  );

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

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      const items = e.dataTransfer.items;
      const files = e.dataTransfer.files;
      const extracted = await extractFilesFromDataTransfer(items, files);
      if (extracted.length > 0) {
        handleUploadFiles(extracted);
      }
    },
    [handleUploadFiles]
  );

  const handleZipSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(Array.from(e.target.files));
    }
  };

  const handleFolderSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(Array.from(e.target.files));
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#F8FAFC] dark:bg-[#090D16] text-[#0F172A] dark:text-[#F8FAFC] select-none">
      {/* Top Header */}
      <div className="w-full border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#0D131F]/80 backdrop-blur-md px-6 py-3.5 shrink-0 flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl neu-primary flex items-center justify-center text-white font-extrabold text-sm shadow-md shadow-sky-500/25">
            MD
          </div>
          <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
            MEDAM
          </span>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="tactile-rubber neu-btn px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
        >
          Cancel
        </button>
      </div>

      {/* Main Centered Minimal Card */}
      <div className="flex-1 w-full flex items-center justify-center p-6">
        <div className="w-full max-w-md neu-convex p-8 rounded-3xl flex flex-col items-center gap-6 border border-white/60 dark:border-white/5 shadow-2xl">
          {/* Hidden inputs */}
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

          {/* Minimal Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full py-12 px-6 rounded-2xl flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer ${
              isDraggingOver
                ? 'neu-pressed border-2 border-dashed border-[#0284C7] bg-sky-500/10 scale-[1.02]'
                : 'neu-pressed border-2 border-dashed border-slate-300 dark:border-slate-700/80 hover:border-[#0284C7]/60'
            }`}
          >
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-wide">
              Drop DICOM Here
            </span>
          </div>

          {/* Text-Only Tactile Rubber Buttons */}
          <div className="w-full flex items-center gap-3">
            <button
              type="button"
              disabled={isScanning}
              onClick={() => folderInputRef.current?.click()}
              className="tactile-rubber neu-primary flex-1 py-2.5 rounded-xl text-xs font-bold text-white shadow-md shadow-sky-600/30 cursor-pointer disabled:opacity-50 text-center"
            >
              Import Folder
            </button>

            <button
              type="button"
              disabled={isScanning}
              onClick={() => zipInputRef.current?.click()}
              className="tactile-rubber neu-btn flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-white/10 hover:text-[#0284C7] cursor-pointer shadow-sm disabled:opacity-50 text-center"
            >
              Import ZIP
            </button>
          </div>

          {/* Progress Indicator */}
          {isScanning && (
            <div className="w-full flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-[#0284C7] dark:text-sky-400 font-bold">
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

          {/* Error Message */}
          {errorMsg && (
            <div className="w-full p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-semibold text-center">
              {errorMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
