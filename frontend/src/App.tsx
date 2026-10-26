import React, { useState, useEffect, useCallback } from 'react';
import { ModuleType, TrackType, MeshObjectItem } from './types';
import { Header } from './components/Header';
import { RadosView } from './modules/rados/RadosView';
import { DesignStudioView } from './modules/design/DesignStudioView';

export const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<ModuleType>('Rados');
  const [activeTrack, setActiveTrack] = useState<TrackType>('Medical');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(false);

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

  // Fullscreen F11 listener
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  }, []);

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

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-[#F8FAFC] dark:bg-[#090D16] text-[#0F172A] dark:text-[#F8FAFC]">
      {/* Single Unified Top Bar */}
      <Header
        activeModule={activeModule}
        onSelectModule={setActiveModule}
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
        {activeModule === 'Rados' && (
          <RadosView
            onNavigateModule={setActiveModule}
            onSendMeshToDesign={(mesh) => {
              setDesignMesh(mesh);
              setActiveModule('Design');
            }}
          />
        )}

        {activeModule === 'Design' && (
          <DesignStudioView
            activeMesh={designMesh}
            onNavigateModule={setActiveModule}
          />
        )}

        {activeModule !== 'Rados' && activeModule !== 'Design' && (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="p-8 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-xl max-w-md flex flex-col items-center gap-3">
              <span className="text-sm font-bold text-[#0284C7]">
                {activeModule} Module
              </span>
              <p className="text-xs text-slate-500 leading-relaxed">
                Connect anatomical structures from Rados and Design directly into the {activeModule} workflow.
              </p>
              <button
                type="button"
                onClick={() => setActiveModule('Rados')}
                className="tactile-rubber px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 shadow-md shadow-sky-600/30 cursor-pointer mt-1"
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
