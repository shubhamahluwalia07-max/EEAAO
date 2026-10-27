import React, { useState, useEffect, useCallback } from 'react';
import { ModuleType, TrackType, MeshObjectItem, IngestionResult, SeriesCard } from './types';
import { Header } from './components/Header';
import { DatumRegistryView } from './modules/datum/DatumRegistryView';
import { RadosView } from './modules/rados/RadosView';
import { DesignStudioView } from './modules/design/DesignStudioView';
import { FeaModuleView } from './modules/fea/FeaModuleView';
import { SlicerModuleView } from './modules/slicer/SlicerModuleView';
import { ImportWizardView } from './modules/rados/ImportWizardView';

export const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ModuleType>('Datum');
  const [activeTrack, setActiveTrack] = useState<TrackType>('Medical');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(false);
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);

  // Ingested study & series state across modules
  const [activeStudy, setActiveStudy] = useState<IngestionResult | null>(null);
  const [activeSeries, setActiveSeries] = useState<SeriesCard | null>(null);
  const [initialPreset, setInitialPreset] = useState<{ minHu: number; maxHu: number; quality: string } | null>(null);

  // Mesh transferred from Rados to Design studio
  const [designMesh, setDesignMesh] = useState<MeshObjectItem | null>(null);

  // Synchronize dark mode class on document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Fullscreen cross-browser handler and sync
  const toggleFullscreen = useCallback(async () => {
    try {
      const isCurrentlyFs = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      if (!isCurrentlyFs) {
        const el = document.documentElement as any;
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        } else if (el.mozRequestFullScreen) {
          await el.mozRequestFullScreen();
        } else if (el.msRequestFullscreen) {
          await el.msRequestFullscreen();
        }
      } else {
        const doc = document as any;
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch (err) {
      console.error('Fullscreen toggle error:', err);
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFs);
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.removeEventListener('mozfullscreenchange', handleFsChange);
      document.removeEventListener('MSFullscreenChange', handleFsChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleFullscreen]);

  const [openSeriesSelectorOnMount, setOpenSeriesSelectorOnMount] = useState<boolean>(false);

  const handleSelectModule = useCallback((mod: ModuleType) => {
    setIsWizardOpen(false);
    setOpenSeriesSelectorOnMount(false);
    setActiveModule(mod);
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-[#F8FAFC] dark:bg-[#090D16] text-[#0F172A] dark:text-[#F8FAFC]">
      {/* Single Unified Top Bar */}
      <Header
        activeModule={activeModule}
        onSelectModule={handleSelectModule}
        activeTrack={activeTrack}
        onSelectTrack={setActiveTrack}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        isCollapsed={isHeaderCollapsed}
        onToggleCollapse={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
      />

      {/* Main View Area */}
      <main className="flex-1 w-full overflow-hidden relative">
        {activeModule === 'Datum' && (
          isWizardOpen ? (
            <ImportWizardView
              onCompleteImport={(study, series, preset) => {
                setActiveStudy(study);
                setActiveSeries(series);
                setInitialPreset(preset);
                setIsWizardOpen(false);
                setOpenSeriesSelectorOnMount(true);
                setActiveModule('Rados');
              }}
              onCancel={() => setIsWizardOpen(false)}
            />
          ) : (
            <DatumRegistryView
              onLaunchRados={(study, series) => {
                setActiveStudy(study);
                setActiveSeries(series);
                setOpenSeriesSelectorOnMount(false);
                setIsWizardOpen(false);
                setActiveModule('Rados');
              }}
              onOpenImportWizard={() => setIsWizardOpen(true)}
            />
          )
        )}

        {activeModule === 'Rados' && (
          <RadosView
            onNavigateModule={handleSelectModule}
            onSendMeshToDesign={(mesh) => {
              setDesignMesh(mesh);
              handleSelectModule('Design');
            }}
            initialStudy={activeStudy}
            initialSeries={activeSeries}
            initialPreset={initialPreset}
            openSeriesModalInitially={openSeriesSelectorOnMount}
            onOpenImportWizard={() => {
              setIsWizardOpen(true);
              setActiveModule('Datum');
            }}
          />
        )}

        {activeModule === 'Design' && (
          <DesignStudioView
            activeMesh={designMesh}
            onNavigateModule={setActiveModule}
          />
        )}

        {activeModule === 'FEA' && (
          <FeaModuleView
            activeMesh={designMesh}
            onNavigateModule={setActiveModule}
          />
        )}

        {activeModule === 'Slicer' && (
          <SlicerModuleView
            activeMesh={designMesh}
            onNavigateModule={setActiveModule}
          />
        )}

        {activeModule !== 'Datum' &&
          activeModule !== 'Rados' &&
          activeModule !== 'Design' &&
          activeModule !== 'FEA' &&
          activeModule !== 'Slicer' && (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="neu-convex p-8 rounded-3xl border border-white/60 dark:border-white/5 shadow-2xl max-w-md flex flex-col items-center gap-3">
              <span className="text-sm font-bold text-[#0284C7]">
                {activeModule} Module
              </span>
              <p className="text-xs text-slate-500 leading-relaxed">
                Connect anatomical models and surgical fixtures directly into the {activeModule} production pipeline.
              </p>
              <button
                type="button"
                onClick={() => setActiveModule('Rados')}
                className="tactile-rubber neu-primary px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-sky-600/30 cursor-pointer mt-1"
              >
                Return to Rados Workstation
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
