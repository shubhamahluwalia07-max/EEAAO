import React, { useState, useEffect, useCallback } from 'react';
import { Flowbar, ModuleId } from './shell/Flowbar';
import { WorkflowTrack, medamStateBus } from './shell/stateBus';
import { IngestionResult, SeriesCard } from './modules/stage3_pacs/types';
import { Step1ImportView } from './modules/stage3_pacs/Step1ImportView';
import { SeriesSelectorModal } from './modules/stage3_pacs/SeriesSelectorModal';
import { Step3PacsWorkstationView } from './modules/stage3_pacs/Step3PacsWorkstationView';
import { DesignStudioView } from './modules/stage4_design/DesignStudioView';
import { AccountProfileView } from './modules/account/AccountProfileView';
import { ToolIconButton, IconExpandHeader } from './modules/stage3_pacs/Icons';

export const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ModuleId>('Rados');
  const [activeTrack, setActiveTrack] = useState<WorkflowTrack>(() => medamStateBus.getTrack());

  // Listen to track changes from Flowbar or bus
  useEffect(() => {
    return medamStateBus.onTrackChange((t) => setActiveTrack(t));
  }, []);

  // Fullscreen and Collapsible Header state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Fullscreen handler (HTML5 Fullscreen API + Tauri Window API)
  const toggleFullscreen = useCallback(async () => {
    try {
      const tauriWindow = (window as unknown as { __TAURI__?: { window?: { getCurrentWindow: () => { isFullscreen: () => Promise<boolean>; setFullscreen: (v: boolean) => Promise<void> } } } }).__TAURI__?.window;
      if (tauriWindow) {
        const win = tauriWindow.getCurrentWindow();
        const isFs = await win.isFullscreen();
        await win.setFullscreen(!isFs);
        setIsFullscreen(!isFs);
        return;
      }
    } catch {
      // Fallback to HTML5 API below
    }

    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, []);

  // Sync theme with root document element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Fullscreenchange listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Global F11 key shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen]);

  // Stage 3 PACS State
  const [activeStudy, setActiveStudy] = useState<IngestionResult | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<SeriesCard | null>(null);
  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState<boolean>(false);

  const handleStudyLoaded = (study: IngestionResult) => {
    setActiveStudy(study);
    const primary = study.series.find((s) => !s.is_scout) || study.series[0] || null;
    setSelectedSeries(primary);
    setIsSeriesModalOpen(true);
  };

  const handleSelectSeries = (series: SeriesCard) => {
    setSelectedSeries(series);
    setIsSeriesModalOpen(false);
  };

  const handleBackToSeries = () => {
    setIsSeriesModalOpen(true);
  };

  const handleResetStudy = () => {
    setActiveStudy(null);
    setSelectedSeries(null);
    setIsSeriesModalOpen(false);
  };

  useEffect(() => {
    // Expose internal test hooks for headless verification without rendering dummy UI
    (window as unknown as { __loadDevStudy?: (s: IngestionResult) => void }).__loadDevStudy = handleStudyLoaded;
    (window as unknown as { __selectDevSeries?: (s: SeriesCard) => void }).__selectDevSeries = handleSelectSeries;

    const params = new URLSearchParams(window.location.search);
    const devMode = params.get('dev');
    if (devMode) {
      const seriesUid = '1.2.840.113619.2.55.3.60468824.540.123456789.3';
      const sampleStudy: IngestionResult = {
        study_instance_uid: '1.2.840.113619.2.55.3.60468824.540.123456789.1',
        patient_name: 'Patient Anonymous',
        patient_id: 'EX-9021',
        study_description: 'CT Extremity Contrast',
        detected_modalities: ['ALL', 'CT'],
        telemetry: {
          total_files_discovered: 450,
          valid_dicom_slices: 450,
          skipped_files: 0,
          series_count: 2,
          study_uid: '1.2.840.113619.2.55.3.60468824.540.123456789.1',
          patient_name: 'Patient Anonymous',
          patient_id: 'EX-9021',
          slice_spacing_verified: true,
          spacing_summary: 'S#2: dz=4.00mm, S#3: dz=1.00mm',
          log_lines: [
            'Ingestion started. Reading files...',
            'Parsed 450 DICOM instances.',
            'Extremity 4.0 B60s: 67 slices, spacing [0.48, 0.48, 4.00] mm',
            'Extremity 1.0 B30s: 383 slices, spacing [0.48, 0.48, 1.00] mm',
            'Physical slice spacing verified and consistent across all volumes.',
          ],
        },
        series: [
          {
            series_instance_uid: '1.2.840.113619.2.55.3.60468824.540.123456789.2',
            study_instance_uid: '1.2.840.113619.2.55.3.60468824.540.123456789.1',
            patient_name: 'Patient Anonymous',
            patient_id: 'EX-9021',
            study_description: 'CT Extremity Contrast',
            series_date: '20260923',
            modality: 'CT',
            series_description: 'Extremity 4.0 B60s',
            series_number: 2,
            slice_count: 67,
            rows: 512,
            columns: 512,
            pixel_spacing: [0.48, 0.48],
            slice_thickness: 4.0,
            window_center: 450,
            window_width: 2000,
            thumbnail_data_url: '',
            is_scout: false,
            raw_tags: [
              { tag: '(0010,0010)', group: '0010', element: '0010', name: 'PatientName', vr: 'PN', value: 'Patient Anonymous' },
              { tag: '(0010,0020)', group: '0010', element: '0020', name: 'PatientID', vr: 'LO', value: 'EX-9021' },
              { tag: '(0008,0060)', group: '0008', element: '0060', name: 'Modality', vr: 'CS', value: 'CT' },
              { tag: '(0008,103e)', group: '0008', element: '103e', name: 'SeriesDescription', vr: 'LO', value: 'Extremity 4.0 B60s' },
              { tag: '(0018,0050)', group: '0018', element: '0050', name: 'SliceThickness', vr: 'DS', value: '4.00' },
              { tag: '(0028,0030)', group: '0028', element: '0030', name: 'PixelSpacing', vr: 'DS', value: '0.488281\\0.488281' },
            ],
          },
          {
            series_instance_uid: seriesUid,
            study_instance_uid: '1.2.840.113619.2.55.3.60468824.540.123456789.1',
            patient_name: 'Patient Anonymous',
            patient_id: 'EX-9021',
            study_description: 'CT Extremity Contrast',
            series_date: '20260923',
            modality: 'CT',
            series_description: 'Extremity 1.0 B30s',
            series_number: 3,
            slice_count: 383,
            rows: 512,
            columns: 512,
            pixel_spacing: [0.48, 0.48],
            slice_thickness: 1.0,
            window_center: 450,
            window_width: 2000,
            thumbnail_data_url: '',
            is_scout: false,
            raw_tags: [
              { tag: '(0010,0010)', group: '0010', element: '0010', name: 'PatientName', vr: 'PN', value: 'Patient Anonymous' },
              { tag: '(0010,0020)', group: '0010', element: '0020', name: 'PatientID', vr: 'LO', value: 'EX-9021' },
              { tag: '(0008,0060)', group: '0008', element: '0060', name: 'Modality', vr: 'CS', value: 'CT' },
              { tag: '(0008,103e)', group: '0008', element: '103e', name: 'SeriesDescription', vr: 'LO', value: 'Extremity 1.0 B30s' },
              { tag: '(0018,0050)', group: '0018', element: '0050', name: 'SliceThickness', vr: 'DS', value: '1.00' },
              { tag: '(0028,0030)', group: '0028', element: '0030', name: 'PixelSpacing', vr: 'DS', value: '0.488281\\0.488281' },
            ],
          },
        ],
      };

      // Synthesize diagnostic 16-bit volume for workstation test
      const cols = 128;
      const rows = 128;
      const slices = 64;
      const rawVoxels = new Int16Array(cols * rows * slices);
      for (let z = 0; z < slices; z++) {
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const idx = z * cols * rows + y * cols + x;
            const dx = x - 64;
            const dy = y - 64;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 14) {
              rawVoxels[idx] = 250; // Marrow cavity
            } else if (dist <= 26) {
              rawVoxels[idx] = 950; // Cortical bone
            } else if (dist <= 44) {
              rawVoxels[idx] = 40; // Soft tissue
            } else {
              rawVoxels[idx] = -1000; // Air
            }
          }
        }
      }

      import('./modules/stage3_pacs/dicomClientParser').then(({ setCachedSeriesVolume }) => {
        setCachedSeriesVolume(seriesUid, {
          series_instance_uid: seriesUid,
          modality: 'CT',
          series_description: 'Extremity 1.0 B30s',
          dimensions: [cols, rows, slices],
          spacing: [0.48, 0.48, 1.0],
          window_center: 450,
          window_width: 2000,
          min_hu: -1000,
          max_hu: 1200,
          voxel_buffer_base64: '',
          raw_voxels: rawVoxels,
          slice_positions: Array.from({ length: slices }, (_, i) => i * 1.0),
        });
      });

      setActiveStudy(sampleStudy);
      if (devMode === 'workstation') {
        setSelectedSeries(sampleStudy.series[1]);
        setIsSeriesModalOpen(false);
      }
    }
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col bg-origin-alabaster dark:bg-[#090D16] overflow-hidden relative">
      {/* Top Persistent Rotary Cylinder Flowbar */}
      <Flowbar
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        isHeaderCollapsed={isHeaderCollapsed}
        onToggleCollapseHeader={() => setIsHeaderCollapsed((v) => !v)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        activeTrack={activeTrack}
        onSelectTrack={(t) => medamStateBus.setTrack(t)}
      />

      {/* Floating corner button to restore collapsed header */}
      {isHeaderCollapsed && (
        <div className="fixed top-2.5 right-2.5 z-50">
          <ToolIconButton
            id="expand-header-corner-btn"
            title="Expand Header"
            onClick={() => setIsHeaderCollapsed(false)}
            tooltipSide="bottom"
          >
            <IconExpandHeader size={18} />
          </ToolIconButton>
        </div>
      )}

      {/* Main Module Area */}
      <div className="flex-1 flex overflow-hidden">
        {activeModule === 'Account' ? (
          <AccountProfileView onSelectModule={setActiveModule} theme={theme} />
        ) : activeModule === 'Rados' ? (
          <>
            {/* Step 1: Import View (When no study loaded) */}
            {!activeStudy && (
              <Step1ImportView onStudyLoaded={handleStudyLoaded} />
            )}

            {/* Step 2 & 3: 4-Window Diagnostic Workstation + Floating Series Selector Modal */}
            {activeStudy && selectedSeries && (
              <div className="relative flex-1 flex overflow-hidden">
                <Step3PacsWorkstationView
                  series={selectedSeries}
                  study={activeStudy}
                  onSelectSeries={handleSelectSeries}
                  onBackToSeries={handleBackToSeries}
                  theme={theme}
                  onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
                  isFullscreen={isFullscreen}
                  onToggleFullscreen={toggleFullscreen}
                  onToggleCollapseHeader={() => setIsHeaderCollapsed((v) => !v)}
                  isHeaderCollapsed={isHeaderCollapsed}
                  onSelectModule={setActiveModule}
                />

                {/* Floating Centered MEDAM Series Selector Pop-up Modal */}
                {isSeriesModalOpen && (
                  <SeriesSelectorModal
                    study={activeStudy}
                    onSelectSeries={handleSelectSeries}
                    onClose={() => setIsSeriesModalOpen(false)}
                    currentSelectedSeriesUid={selectedSeries.series_instance_uid}
                  />
                )}
              </div>
            )}
          </>
        ) : activeModule === 'Design' ? (
          <DesignStudioView onSelectModule={setActiveModule} theme={theme} />
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-center font-sans">
            <div className="p-8 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm text-xs font-medium text-slate-800 dark:text-slate-200">
              Module reserved: {activeModule}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
