import React, { useState, useRef } from 'react';
import { ingestFileList, ingestZipFile } from './dicomClientParser';
import { ImportProgress, IngestionResult } from './types';

interface Step1ImportViewProps {
  onStudyLoaded: (study: IngestionResult) => void;
}

function formatDuration(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export const Step1ImportView: React.FC<Step1ImportViewProps> = ({ onStudyLoaded }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const handleImportFolderClick = () => {
    setErrorMessage(null);
    folderInputRef.current?.click();
  };

  const handleImportZipClick = () => {
    setErrorMessage(null);
    zipInputRef.current?.click();
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setLoading(true);
      setProgress({
        fileName: files[0]?.name || 'Initializing...',
        processedCount: 0,
        totalCount: files.length,
        percentage: 0,
        phase: 'reading',
        elapsedSeconds: 0,
        estimatedRemainingSeconds: 0,
      });

      const fileArray = Array.from(files);
      const result = await ingestFileList(fileArray, (p) => setProgress(p));
      onStudyLoaded(result);
    } catch (err: unknown) {
      console.warn('Folder import note:', err);
      const msg = err instanceof Error ? err.message : 'No valid DICOM instances found in selected folder.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
      setProgress(null);
      if (e.target) e.target.value = '';
    }
  };

  const handleZipChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const zipFile = files[0];
    try {
      setLoading(true);
      setProgress({
        fileName: zipFile.name,
        processedCount: 0,
        totalCount: 1,
        percentage: 0,
        phase: 'extracting',
        elapsedSeconds: 0,
        estimatedRemainingSeconds: 0,
      });

      const result = await ingestZipFile(zipFile, (p) => setProgress(p));
      onStudyLoaded(result);
    } catch (err: unknown) {
      console.warn('ZIP import note:', err);
      const msg = err instanceof Error ? err.message : 'No valid DICOM instances found in ZIP archive.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
      setProgress(null);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#F8FAFC] select-none font-sans">
      {/* Hidden File Inputs for Native Explorer Dialogs */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard in browser engines
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={handleFolderChange}
      />
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        className="hidden"
        onChange={handleZipChange}
      />

      {loading && progress ? (
        /* MEDAM Import Progress Card */
        <div className="w-full max-w-lg bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-sm flex flex-col">
          <div className="pb-4 mb-5 border-b border-slate-200 dark:border-slate-800">
            <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
              Importing DICOM Data
            </h1>
          </div>

          <div className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate mb-3" title={progress.fileName}>
            Reading file {progress.fileName} ...
          </div>

          {/* Smooth percentage progress bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-200 dark:border-slate-700">
            <div
              className="bg-[#0284C7] h-full rounded-full transition-all duration-200 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress.percentage))}%` }}
            />
          </div>

          <div className="flex items-center justify-between mt-2.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span>{progress.percentage}%</span>
            <span>
              {progress.processedCount} of {progress.totalCount} files
            </span>
          </div>
        </div>
      ) : (
        /* Default Ingestion Initiation Card */
        <div className="w-full max-w-md bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-sm flex flex-col items-center">
          <div className="w-full pb-4 mb-6 border-b border-slate-200 dark:border-slate-800 text-center">
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              DICOM Ingestion
            </h1>
          </div>

          <div className="w-full flex flex-col gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={handleImportFolderClick}
              className="tactile-rubber w-full h-14 rounded-lg flex items-center justify-center px-6 text-sm font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 hover:border-[#0284C7] cursor-pointer disabled:opacity-50"
            >
              Import DICOM Folder
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleImportZipClick}
              className="tactile-rubber w-full h-14 rounded-lg flex items-center justify-center px-6 text-sm font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 hover:border-[#0284C7] cursor-pointer disabled:opacity-50"
            >
              Import DICOM ZIP
            </button>
          </div>

          {errorMessage && (
            <div className="w-full mt-5 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs font-medium text-red-700 dark:text-red-400 text-center">
              {errorMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
