import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Measurement,
  SeriesCard,
  SlabMode,
  ToolMode,
  SegmentToolMode,
  SegmentationMask,
  IngestionResult,
  BoneSeedPoint,
  RegionGrowSeedRecord,
  ThemeMode,
  Calculated3DObject,
  QualityPreset,
  SeedKind,
  SeedPointEntry,
} from './types';
import { MprVolume } from './mprEngine';
import { fetchSeriesVolume } from './api';
import { CadViewerToolbar } from './CadViewerToolbar';
import { SegmentationDrawer } from './SegmentationDrawer';
import { Viewport2D } from './Viewport2D';
import { Viewport3D } from './Viewport3D';
import { SeriesSelectorModal } from './SeriesSelectorModal';
import { LeftIconRail } from './LeftIconRail';
import { SeedSegmentModal } from './SeedSegmentModal';
import {
  floodFill3D,
  applyBrushLine,
  applyLassoErase,
  keepLargestIsland,
  morphologicalDilate3D,
  morphologicalErode3D,
  morphologicalClose3D,
  morphologicalFillCavities3D,
  mergeMasks,
  subtractMasks,
  executeBoneSegmentation,
  executeMultiBoneSegmentation,
  executeCompetitiveSeedSegmentation,
  MultiBoneCalculationConfig,
  createEmptyMask,
  createThresholdMask,
  splitMaskBySeeds,
} from './maskEngine';
import {
  extractWatertightMesh,
  buildBinaryStlBuffer,
  downloadBinaryStl,
  applyTaubinSmoothing,
  applyQemReduction,
  applyShrinkWrap,
  calculate3DObjectFromMask,
} from './stlExporter';
import { runFrontendBenchmarkDiagnostic } from './benchmarkDiagnostic';
import { medamStateBus, ModuleId, TransferredMeshBuffer } from '../../shell/stateBus';

interface Step3PacsWorkstationViewProps {
  series: SeriesCard;
  study?: IngestionResult | null;
  onSelectSeries?: (series: SeriesCard) => void;
  onBackToSeries: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isHeaderCollapsed?: boolean;
  onToggleCollapseHeader?: () => void;
  onSelectModule?: (mod: ModuleId) => void;
}

export const Step3PacsWorkstationView: React.FC<Step3PacsWorkstationViewProps> = ({
  series,
  study,
  onSelectSeries,
  onBackToSeries,
  theme: parentTheme = 'light',
  onToggleTheme: parentToggleTheme,
  isFullscreen = false,
  onToggleFullscreen = () => {},
  isHeaderCollapsed = false,
  onToggleCollapseHeader,
  onSelectModule,
}) => {
  const [volume, setVolume] = useState<MprVolume | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Local theme state fallback if parent does not provide
  const [localTheme, setLocalTheme] = useState<ThemeMode>(parentTheme);

  const handleToggleTheme = () => {
    if (parentToggleTheme) {
      parentToggleTheme();
    } else {
      setLocalTheme((t) => (t === 'light' ? 'dark' : 'light'));
    }
  };

  useEffect(() => {
    setLocalTheme(parentTheme);
  }, [parentTheme]);

  // Series Selector Pop-up Modal State
  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState<boolean>(false);

  // Consolidated CAD Top Toolbar Collapsible State
  const [isCadToolbarCollapsed, setIsCadToolbarCollapsed] = useState<boolean>(false);

  // Synchronized slice indices per orthogonal plane
  const [axialSlice, setAxialSlice] = useState<number>(0);
  const [coronalSlice, setCoronalSlice] = useState<number>(0);
  const [sagittalSlice, setSagittalSlice] = useState<number>(0);

  // Synchronized 3D crosshair position in volume space [x, y, z]
  const [crosshairPos, setCrosshairPos] = useState<[number, number, number]>([128, 128, 32]);
  const [showCrosshairs, setShowCrosshairs] = useState<boolean>(true);

  // Display Parameters
  const [windowCenter, setWindowCenter] = useState<number>(series.window_center || 40);
  const [windowWidth, setWindowWidth] = useState<number>(series.window_width || 400);
  const [slabMode, setSlabMode] = useState<SlabMode>('none');
  const [slabThicknessMm, setSlabThicknessMm] = useState<number>(5.0);

  // Active Tool Mode
  const [activeTool, setActiveTool] = useState<ToolMode>('crosshair');

  // Transformations
  const [rotationDeg, setRotationDeg] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [isLutInverted, setIsLutInverted] = useState<boolean>(false);

  // Measurements
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  // Cine Playback
  const [isCinePlaying, setIsCinePlaying] = useState<boolean>(false);
  const [cineFps, setCineFps] = useState<number>(15);
  const cineIntervalRef = useRef<number | null>(null);

  // 3D Segmented Surface Mesh Viewport State (Quadrant 4)
  const [is3DSurfaceBuilt, setIs3DSurfaceBuilt] = useState<boolean>(false);
  const [watertightMesh, setWatertightMesh] = useState<any | null>(null);
  const [isProcessing3D, setIsProcessing3D] = useState<boolean>(false);

  // Split Mask State
  const [splitMode, setSplitMode] = useState<'boneA' | 'boneB'>('boneA');
  const [seedsBoneA, setSeedsBoneA] = useState<[number, number, number][]>([]);
  const [seedsBoneB, setSeedsBoneB] = useState<[number, number, number][]>([]);

  // Constrained Brush State
  const [brushConstrained, setBrushConstrained] = useState<boolean>(false);
  const [constrainedMinHu, setConstrainedMinHu] = useState<number>(200);
  const [constrainedMaxHu, setConstrainedMaxHu] = useState<number>(2000);

  // Segmentation Workspace Mode State
  const [isSegmentMode, setIsSegmentMode] = useState<boolean>(false);
  const [activeSegmentTool, setActiveSegmentTool] = useState<SegmentToolMode>('threshold');
  const [masks, setMasks] = useState<SegmentationMask[]>([]);
  const [activeMaskId, setActiveMaskId] = useState<string>('');

  // Region Grow Accumulative State
  const [regionGrowSeeds, setRegionGrowSeeds] = useState<RegionGrowSeedRecord[]>([]);

  // Smart Brush Settings
  const [brushRadiusMm, setBrushRadiusMm] = useState<number>(5.0);
  const [brushMode, setBrushMode] = useState<'paint' | 'erase'>('paint');
  const [brush3D, setBrush3D] = useState<boolean>(false);

  // Lasso Erase Settings
  const [lassoThroughVolume, setLassoThroughVolume] = useState<boolean>(false);

  // Morphology Settings
  const [morphologyRadiusMm, setMorphologyRadiusMm] = useState<number>(2.0);

  // 3-Step Automated Bone Segmentation Wizard State
  const [boneWizardStep, setBoneWizardStep] = useState<1 | 2 | 3>(1);
  const [boneSeeds, setBoneSeeds] = useState<BoneSeedPoint[]>([]);
  const [boneWizardMode, setBoneWizardMode] = useState<'unified' | 'separate'>('unified');
  const [corticalMinHu, setCorticalMinHu] = useState<number>(226);
  const [corticalMaxHu, setCorticalMaxHu] = useState<number>(3071);
  const [trabecularMinHu, setTrabecularMinHu] = useState<number>(150);
  const [gapClosingDistanceMm, setGapClosingDistanceMm] = useState<number>(2.0);
  const [fillInternalCavities, setFillInternalCavities] = useState<boolean>(true);

  // 3D Objects Collection state (Rendered in Quadrant 4 & listed in Objects tab)
  const [objects, setObjects] = useState<Calculated3DObject[]>([]);
  const [activeObjectId, setActiveObjectId] = useState<string>('');

  // Floating Seed Segmentation Workflow State
  const [isSeedModalOpen, setIsSeedModalOpen] = useState<boolean>(false);
  const [seedMode, setSeedMode] = useState<SeedKind>('need');
  const [seedPoints, setSeedPoints] = useState<SeedPointEntry[]>([]);
  const [seedThresholdHu, setSeedThresholdHu] = useState<number>(150);
  const [sensitivity, setSensitivity] = useState<number>(60);
  const [seedSegmentStep, setSeedSegmentStep] = useState<1 | 2 | 3>(1);
  const [seedGapClosingMm, setSeedGapClosingMm] = useState<number>(1.0);
  const [seedFillCavities, setSeedFillCavities] = useState<boolean>(true);
  const [seedPreviewOnSlices, setSeedPreviewOnSlices] = useState<boolean>(true);
  const priorMaskBackupRef = useRef<{ id: string; voxelMask?: Uint8Array } | null>(null);
  const cancelIncompleteOperationRef = useRef<() => void>(() => {});

  // Viewport Maximize / Restore (1: Coronal, 2: Axial, 3: Sagittal, 4: 3D)
  const [maximizedQuadrant, setMaximizedQuadrant] = useState<number | null>(null);

  // Mobile segmented view state (0: Coronal, 1: Axial, 2: Sagittal, 3: 3D)
  const [mobileActiveTab, setMobileActiveTab] = useState<number>(0);

  // Active Mask Object (safe when masks is empty)
  const activeMask = masks.find((m) => m.id === activeMaskId) || masks[0] || null;

  // Reset transforms
  const handleResetView = () => {
    setRotationDeg(0);
    setFlipH(false);
    setFlipV(false);
    setIsLutInverted(false);
    setSlabMode('none');
    setSlabThicknessMm(5.0);
    if (volume) {
      setWindowCenter(volume.windowCenter);
      setWindowWidth(volume.windowWidth);
    }
  };

  // Expose global automated benchmark diagnostic hook for automated testing protocols
  useEffect(() => {
    (window as any).__runBenchmarkDiagnostic = runFrontendBenchmarkDiagnostic;
    return () => {
      delete (window as any).__runBenchmarkDiagnostic;
    };
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // T: Toggle Dark / Light Theme
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        handleToggleTheme();
      }

      // `[` or `]`: Toggle CAD Top Toolbar collapse
      else if (e.key === '[' || e.key === ']') {
        e.preventDefault();
        setIsCadToolbarCollapsed((v) => !v);
      }

      // Up / Down Arrow: Step +/- 1 slice (Shift + Up/Down steps +/- 10 slices)
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (maximizedQuadrant === 1) {
          setCoronalSlice((s) => Math.min((volume?.height || 1) - 1, s + step));
        } else if (maximizedQuadrant === 3) {
          setSagittalSlice((s) => Math.min((volume?.width || 1) - 1, s + step));
        } else {
          setAxialSlice((s) => Math.min((volume?.depth || 1) - 1, s + step));
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (maximizedQuadrant === 1) {
          setCoronalSlice((s) => Math.max(0, s - step));
        } else if (maximizedQuadrant === 3) {
          setSagittalSlice((s) => Math.max(0, s - step));
        } else {
          setAxialSlice((s) => Math.max(0, s - step));
        }
      }

      // 1, 2, 3, 4: Maximize/Restore Viewport (Esc restores 2x2 grid)
      else if (e.key === '1') {
        e.preventDefault();
        setMaximizedQuadrant((prev) => (prev === 1 ? null : 1));
      } else if (e.key === '2') {
        e.preventDefault();
        setMaximizedQuadrant((prev) => (prev === 2 ? null : 2));
      } else if (e.key === '3') {
        e.preventDefault();
        setMaximizedQuadrant((prev) => (prev === 3 ? null : 3));
      } else if (e.key === '4') {
        e.preventDefault();
        setMaximizedQuadrant((prev) => (prev === 4 ? null : 4));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setMaximizedQuadrant(null);
        if (isSeriesModalOpen) setIsSeriesModalOpen(false);
        cancelIncompleteOperationRef.current();
      }

      // R: Reset view
      else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleResetView();
      }

      // I: Invert LUT grayscale
      else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setIsLutInverted((v) => !v);
      }

      // C: Crosshair tool
      else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        cancelIncompleteOperationRef.current();
        setActiveTool('crosshair');
        setShowCrosshairs(true);
      }

      // W: Window / Level
      else if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        cancelIncompleteOperationRef.current();
        setActiveTool('window');
      }

      // P: Pan
      else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        cancelIncompleteOperationRef.current();
        setActiveTool('pan');
      }

      // Z: Zoom
      else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        cancelIncompleteOperationRef.current();
        setActiveTool('zoom');
      }

      // D or L: Distance / Length measurement
      else if (e.key === 'd' || e.key === 'D' || e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        cancelIncompleteOperationRef.current();
        setActiveTool('length');
      }

      // A: Angle measurement
      else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        cancelIncompleteOperationRef.current();
        setActiveTool('angle');
      }

      // K: Cobb Angle measurement
      else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        cancelIncompleteOperationRef.current();
        setActiveTool('cobb');
      }

      // O: Elliptical ROI measurement
      else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        cancelIncompleteOperationRef.current();
        setActiveTool('roi');
      }

      // Space: Play / Pause Cine loop
      else if (e.code === 'Space') {
        e.preventDefault();
        setIsCinePlaying((p) => !p);
      }

      // S: Activate / toggle Segment mode
      else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        cancelIncompleteOperationRef.current();
        setIsSegmentMode((m) => !m);
      }

      // G: Region grow
      else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        cancelIncompleteOperationRef.current();
        setIsSegmentMode(true);
        handleSelectSegmentTool('region_grow');
      }

      // Delete / Backspace: Remove selected measurement annotation
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (measurements.length > 0) {
          e.preventDefault();
          setMeasurements((prev) => prev.slice(0, prev.length - 1));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    maximizedQuadrant,
    volume,
    isSeriesModalOpen,
    measurements.length,
  ]);

  // Load Volume
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchSeriesVolume(series.series_instance_uid)
      .then((payload) => {
        if (!isMounted) return;
        const vol = new MprVolume(payload);
        setVolume(vol);

        const midZ = Math.floor(vol.depth / 2);
        const midY = Math.floor(vol.height / 2);
        const midX = Math.floor(vol.width / 2);

        setAxialSlice(midZ);
        setCoronalSlice(midY);
        setSagittalSlice(midX);
        setCrosshairPos([midX, midY, midZ]);
        setWindowCenter(vol.windowCenter);
        setWindowWidth(vol.windowWidth);
      })
      .catch((err) => {
        console.error('Failed to load series volume:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [series.series_instance_uid]);

  // Cine loop timer
  useEffect(() => {
    if (!isCinePlaying || !volume) {
      if (cineIntervalRef.current) clearInterval(cineIntervalRef.current);
      return;
    }

    const intervalMs = Math.max(16, 1000 / cineFps);
    cineIntervalRef.current = window.setInterval(() => {
      setAxialSlice((prev) => (prev + 1) % volume.depth);
    }, intervalMs);

    return () => {
      if (cineIntervalRef.current) clearInterval(cineIntervalRef.current);
    };
  }, [isCinePlaying, cineFps, volume]);

  // Handle synchronized crosshair position change
  const handleCrosshairChange = (newPos: [number, number, number]) => {
    setCrosshairPos(newPos);
    setSagittalSlice(newPos[0]);
    setCoronalSlice(newPos[1]);
    setAxialSlice(newPos[2]);
  };

  // Measurement management
  const handleAddMeasurement = (m: Measurement) => {
    setMeasurements((prev) => [...prev, m]);
  };

  const handleClearMeasurements = () => {
    setMeasurements([]);
  };

  // Mask Management
  const handleCreateMask = () => {
    const swatches = [
      { color: '#06B6D4', rgb: [6, 182, 212] as [number, number, number] },
      { color: '#10B981', rgb: [16, 185, 129] as [number, number, number] },
      { color: '#8B5CF6', rgb: [139, 92, 246] as [number, number, number] },
      { color: '#F43F5E', rgb: [244, 63, 94] as [number, number, number] },
      { color: '#F59E0B', rgb: [245, 158, 11] as [number, number, number] },
      { color: '#3B82F6', rgb: [59, 130, 246] as [number, number, number] },
    ];
    const swatch = swatches[masks.length % swatches.length];
    const newMask: SegmentationMask = {
      id: 'mask_' + Date.now(),
      name: `Manual Mask ${masks.length + 1}`,
      color: swatch.color,
      rgb: swatch.rgb,
      opacity: 0.65,
      visible: true,
      minHu: 150,
      maxHu: 3071,
      selected: false,
      voxelMask: undefined,
    };
    setMasks((prev) => [...prev, newMask]);
    setActiveMaskId(newMask.id);
    return newMask;
  };

  const handleDeleteMask = (id: string) => {
    const remaining = masks.filter((m) => m.id !== id);
    setMasks(remaining);
    if (remaining.length === 0) {
      setActiveMaskId('');
      setWatertightMesh(null);
      setIs3DSurfaceBuilt(false);
    } else if (activeMaskId === id) {
      setActiveMaskId(remaining[0].id);
    }
  };

  const handleUpdateMask = (id: string, updates: Partial<SegmentationMask>) => {
    setMasks((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  };

  const handleToggleSelectMask = (id: string) => {
    setMasks((prev) =>
      prev.map((m) => (m.id === id ? { ...m, selected: !m.selected } : m))
    );
  };

  const handleToggleSelectAllMasks = () => {
    const allSelected = masks.every((m) => m.selected);
    setMasks((prev) => prev.map((m) => ({ ...m, selected: !allSelected })));
  };

  // Multi-Select Batch Actions
  const handleMergeSelectedMasks = () => {
    if (!volume) return;
    const selected = masks.filter((m) => m.selected);
    if (selected.length < 2) return;
    const total = volume.width * volume.height * volume.depth;

    const buffers = selected.map((m) => {
      if (m.voxelMask) return m.voxelMask;
      return createThresholdMask(volume.voxels, volume.width, volume.height, volume.depth, m.minHu, m.maxHu);
    });

    const merged = mergeMasks(buffers, total);
    const newMask: SegmentationMask = {
      id: 'merged_' + Date.now(),
      name: 'Merged_Mask',
      color: selected[0].color,
      rgb: selected[0].rgb,
      opacity: 0.65,
      visible: true,
      minHu: selected[0].minHu,
      maxHu: selected[0].maxHu,
      voxelMask: merged,
      selected: true,
    };

    setMasks((prev) => [...prev.map((m) => ({ ...m, selected: false })), newMask]);
    setActiveMaskId(newMask.id);
  };

  const handleSubtractMasks = () => {
    if (!volume) return;
    const selected = masks.filter((m) => m.selected);
    if (selected.length < 2) return;
    const total = volume.width * volume.height * volume.depth;

    const bufA = selected[0].voxelMask || createThresholdMask(volume.voxels, volume.width, volume.height, volume.depth, selected[0].minHu, selected[0].maxHu);
    const bufB = selected[1].voxelMask || createThresholdMask(volume.voxels, volume.width, volume.height, volume.depth, selected[1].minHu, selected[1].maxHu);

    const subtracted = subtractMasks(bufA, bufB, total);
    const newMask: SegmentationMask = {
      id: 'sub_' + Date.now(),
      name: 'Subtracted_Mask',
      color: selected[0].color,
      rgb: selected[0].rgb,
      opacity: 0.65,
      visible: true,
      minHu: selected[0].minHu,
      maxHu: selected[0].maxHu,
      voxelMask: subtracted,
      selected: true,
    };

    setMasks((prev) => [...prev.map((m) => ({ ...m, selected: false })), newMask]);
    setActiveMaskId(newMask.id);
  };

  const handleDeleteSelectedMasks = () => {
    const remaining = masks.filter((m) => !m.selected);
    setMasks(remaining);
    if (remaining.length === 0) {
      setActiveMaskId('');
      setWatertightMesh(null);
      setIs3DSurfaceBuilt(false);
    } else if (!remaining.some((m) => m.id === activeMaskId)) {
      setActiveMaskId(remaining[0].id);
    }
  };

  const handleBuild3DSurface = () => {
    setIs3DSurfaceBuilt(true);
    if (activeMask && volume) {
      handleCalculate3DObject([activeMask.id], 'Medium', {
        smooth: true,
        smoothIters: 10,
        reduce: true,
        reducePercent: 50,
        wrap: false,
        wrapMm: 0.5,
      });
    }
  };

  const handleSelectSegmentTool = (tool: SegmentToolMode) => {
    if (tool === 'seed_segment') {
      handleOpenSeedSegment();
      return;
    }

    if (isSeedModalOpen || seedPoints.length > 0) {
      cancelIncompleteOperation();
    }

    setActiveSegmentTool(tool);

    if (tool === 'region_grow') {
      const isAlreadyRegionGrow = activeMask && activeMask.name.startsWith('Region_Grow_');
      if (!isAlreadyRegionGrow) {
        const swatches = [
          { color: '#10B981', rgb: [16, 185, 129] as [number, number, number] },
          { color: '#8B5CF6', rgb: [139, 92, 246] as [number, number, number] },
          { color: '#F43F5E', rgb: [244, 63, 94] as [number, number, number] },
          { color: '#F59E0B', rgb: [245, 158, 11] as [number, number, number] },
          { color: '#06B6D4', rgb: [6, 182, 212] as [number, number, number] },
        ];
        const count = masks.filter((m) => m.name.startsWith('Region_Grow_')).length + 1;
        const swatch = swatches[(masks.length + 1) % swatches.length];
        const newMask: SegmentationMask = {
          id: 'rg_mask_' + Date.now(),
          name: `Region_Grow_Mask_${count}`,
          color: swatch.color,
          rgb: swatch.rgb,
          opacity: 0.65,
          visible: true,
          minHu: activeMask ? activeMask.minHu : 226,
          maxHu: activeMask ? activeMask.maxHu : 3071,
          voxelMask: volume ? createEmptyMask(volume.width, volume.height, volume.depth) : undefined,
          selected: false,
        };
        setMasks((prev) => [...prev, newMask]);
        setActiveMaskId(newMask.id);
        setRegionGrowSeeds([]);
      }
    }
  };

  const handleRegionGrowClick = useCallback(
    (coords: [number, number, number], hu: number) => {
      if (!volume || !activeMask) return;
      let targetMaskBuf = activeMask.voxelMask;
      if (!targetMaskBuf) {
        targetMaskBuf = createEmptyMask(volume.width, volume.height, volume.depth);
      } else {
        targetMaskBuf = new Uint8Array(targetMaskBuf);
      }

      const added = floodFill3D(
        volume.voxels,
        volume.width,
        volume.height,
        volume.depth,
        coords,
        activeMask.minHu,
        activeMask.maxHu,
        targetMaskBuf
      );

      if (added.length > 0) {
        const record: RegionGrowSeedRecord = {
          seed: coords,
          hu,
          addedIndices: added,
        };
        setRegionGrowSeeds((prev) => [...prev, record]);
        handleUpdateMask(activeMask.id, { voxelMask: targetMaskBuf });
      }
    },
    [volume, activeMask]
  );

  const handleUndoLastRegionGrowSeed = () => {
    if (regionGrowSeeds.length === 0 || !activeMask?.voxelMask) return;
    const last = regionGrowSeeds[regionGrowSeeds.length - 1];
    const newBuf = new Uint8Array(activeMask.voxelMask);
    for (const idx of last.addedIndices) {
      newBuf[idx] = 0;
    }
    setRegionGrowSeeds((prev) => prev.slice(0, prev.length - 1));
    handleUpdateMask(activeMask.id, { voxelMask: newBuf });
  };

  // Smart Brush Stroke Handler
  const handleBrushStroke = useCallback(
    (coords: [number, number, number], prevCoords: [number, number, number] | null) => {
      if (!volume || !activeMask) return;
      let targetMaskBuf = activeMask.voxelMask;
      if (!targetMaskBuf) {
        targetMaskBuf = createThresholdMask(
          volume.voxels,
          volume.width,
          volume.height,
          volume.depth,
          activeMask.minHu,
          activeMask.maxHu
        );
      } else {
        targetMaskBuf = new Uint8Array(targetMaskBuf);
      }

      applyBrushLine(
        targetMaskBuf,
        volume.width,
        volume.height,
        volume.depth,
        volume.spacing,
        prevCoords || coords,
        coords,
        brushRadiusMm,
        'axial',
        brush3D,
        brushMode,
        brushConstrained ? { voxels: volume.voxels, minHu: constrainedMinHu, maxHu: constrainedMaxHu } : undefined
      );

      handleUpdateMask(activeMask.id, { voxelMask: targetMaskBuf });
    },
    [volume, activeMask, brushRadiusMm, brush3D, brushMode, brushConstrained, constrainedMinHu, constrainedMaxHu]
  );

  // Lasso Erase Handler
  const handleLassoErase = useCallback(
    (
      plane: 'axial' | 'coronal' | 'sagittal',
      sliceIdx: number,
      points: { x: number; y: number }[],
      throughVol: boolean
    ) => {
      if (!volume || !activeMask) return;
      let targetMaskBuf = activeMask.voxelMask;
      if (!targetMaskBuf) {
        targetMaskBuf = createThresholdMask(
          volume.voxels,
          volume.width,
          volume.height,
          volume.depth,
          activeMask.minHu,
          activeMask.maxHu
        );
      } else {
        targetMaskBuf = new Uint8Array(targetMaskBuf);
      }

      applyLassoErase(
        targetMaskBuf,
        volume.width,
        volume.height,
        volume.depth,
        plane,
        sliceIdx,
        points,
        throughVol
      );

      handleUpdateMask(activeMask.id, { voxelMask: targetMaskBuf });
    },
    [volume, activeMask]
  );

  // Keep Largest Island Handler
  const handleKeepLargestIsland = () => {
    if (!volume || !activeMask) return;
    let targetMaskBuf = activeMask.voxelMask;
    if (!targetMaskBuf) {
      targetMaskBuf = createThresholdMask(
        volume.voxels,
        volume.width,
        volume.height,
        volume.depth,
        activeMask.minHu,
        activeMask.maxHu
      );
    } else {
      targetMaskBuf = new Uint8Array(targetMaskBuf);
    }

    keepLargestIsland(targetMaskBuf, volume.width, volume.height, volume.depth);
    handleUpdateMask(activeMask.id, { voxelMask: targetMaskBuf });
  };

  // Morphology Operations Handler
  const handleApplyMorphology = (op: 'dilate' | 'erode' | 'close' | 'fill') => {
    if (!volume || !activeMask) return;
    let targetMaskBuf = activeMask.voxelMask;
    if (!targetMaskBuf) {
      targetMaskBuf = createThresholdMask(
        volume.voxels,
        volume.width,
        volume.height,
        volume.depth,
        activeMask.minHu,
        activeMask.maxHu
      );
    }

    let result: Uint8Array;
    if (op === 'dilate') {
      result = morphologicalDilate3D(
        targetMaskBuf,
        volume.width,
        volume.height,
        volume.depth,
        volume.spacing,
        morphologyRadiusMm
      );
    } else if (op === 'erode') {
      result = morphologicalErode3D(
        targetMaskBuf,
        volume.width,
        volume.height,
        volume.depth,
        volume.spacing,
        morphologyRadiusMm
      );
    } else if (op === 'close') {
      result = morphologicalClose3D(
        targetMaskBuf,
        volume.width,
        volume.height,
        volume.depth,
        volume.spacing,
        morphologyRadiusMm
      );
    } else {
      result = morphologicalFillCavities3D(
        targetMaskBuf,
        volume.width,
        volume.height,
        volume.depth
      );
    }

    handleUpdateMask(activeMask.id, { voxelMask: result });
  };

  // =========================================================================
  // LIVE COMPETITIVE SEED SEGMENTATION ENGINE (Need Seed vs Not Need)
  // =========================================================================
  // =========================================================================
  // CANCEL & TOOL SWITCH COORDINATION (Cancel uncompleted operations)
  // =========================================================================
  const handleCancelSeedSegment = useCallback(() => {
    // Discard in-progress seeds
    setSeedPoints([]);
    // Revert active manual mask's temporary preview if one was generated
    if (priorMaskBackupRef.current) {
      handleUpdateMask(priorMaskBackupRef.current.id, {
        voxelMask: priorMaskBackupRef.current.voxelMask,
        exclusionMask: undefined,
      });
      priorMaskBackupRef.current = null;
    } else if (activeMaskId) {
      handleUpdateMask(activeMaskId, {
        exclusionMask: undefined,
      });
    }
    setIsSeedModalOpen(false);
    setActiveSegmentTool('threshold');
  }, [activeMaskId]);

  const cancelIncompleteOperation = useCallback(() => {
    // 1. If seed segmentation was open or has uncommitted seeds, cancel it
    if (isSeedModalOpen || seedPoints.length > 0) {
      handleCancelSeedSegment();
    }
    // 2. Clear any pending in-progress bone seeds or region grow seeds
    if (boneSeeds.length > 0) setBoneSeeds([]);
    if (regionGrowSeeds.length > 0) setRegionGrowSeeds([]);
    if (seedsBoneA.length > 0 || seedsBoneB.length > 0) {
      setSeedsBoneA([]);
      setSeedsBoneB([]);
    }
  }, [isSeedModalOpen, seedPoints.length, handleCancelSeedSegment, boneSeeds.length, regionGrowSeeds.length, seedsBoneA.length, seedsBoneB.length]);
  cancelIncompleteOperationRef.current = cancelIncompleteOperation;

  const handleOpenSeedSegment = useCallback(() => {
    let targetMask = activeMask;
    if (!targetMask && masks.length === 0) {
      targetMask = handleCreateMask();
    }
    if (targetMask) {
      priorMaskBackupRef.current = {
        id: targetMask.id,
        voxelMask: targetMask.voxelMask ? new Uint8Array(targetMask.voxelMask) : undefined,
      };
      if (volume) {
        handleUpdateMask(targetMask.id, {
          voxelMask: createEmptyMask(volume.width, volume.height, volume.depth),
          exclusionMask: undefined,
        });
      }
    }
    setSeedPoints([]);
    setIsSeedModalOpen(true);
    setIsSegmentMode(true);
    setActiveSegmentTool('seed_segment');
    setSeedSegmentStep(1);
  }, [activeMask, masks.length, handleCreateMask, volume]);

  // Viewport tool selection that removes/cancels previous uncompleted operations
  const handleSelectViewportTool = useCallback(
    (tool: ToolMode) => {
      if (tool !== activeTool) {
        cancelIncompleteOperation();
        setActiveTool(tool);
      }
    },
    [activeTool, cancelIncompleteOperation]
  );

  // =========================================================================
  // LIVE COMPETITIVE SEED SEGMENTATION ENGINE (Need Seed vs Not Need)
  // =========================================================================
  const runLiveSeedSegmentation = useCallback(
    (
      points: SeedPointEntry[],
      sThresh: number,
      sens: number,
      targetMaskId?: string
    ) => {
      if (!volume) return;
      const mId = targetMaskId || activeMaskId;
      const targetMask = masks.find((m) => m.id === mId) || masks[0] || null;
      if (!targetMask) return;

      if (points.length === 0) {
        handleUpdateMask(targetMask.id, {
          voxelMask: volume ? createEmptyMask(volume.width, volume.height, volume.depth) : undefined,
          exclusionMask: undefined,
        });
        return;
      }

      // Execute competitive multi-seed watershed governed by seedThresholdHu and sensitivity
      const { inclusionMask, exclusionMask } = executeCompetitiveSeedSegmentation({
        voxels: volume.voxels,
        width: volume.width,
        height: volume.height,
        depth: volume.depth,
        spacing: volume.spacing,
        seeds: points,
        seedThresholdHu: sThresh,
        sensitivity: sens,
        gapClosingMm: seedGapClosingMm,
        fillLongBones: seedFillCavities,
      });

      handleUpdateMask(targetMask.id, {
        voxelMask: inclusionMask,
        exclusionMask: exclusionMask,
      });
    },
    [volume, activeMaskId, masks, seedGapClosingMm, seedFillCavities]
  );

  // Planting a seed on Axial, Coronal, or Sagittal slice
  const handleBoneSeedClick = useCallback(
    (coords: [number, number, number], hu: number) => {
      if (!isSeedModalOpen || activeSegmentTool !== 'seed_segment') return;
      if (!activeMask) return;

      const [dx, dy, dz] = volume?.spacing || [1, 1, 1];
      const coordsMm: [number, number, number] = [
        parseFloat((coords[0] * dx).toFixed(1)),
        parseFloat((coords[1] * dy).toFixed(1)),
        parseFloat((coords[2] * dz).toFixed(1)),
      ];

      const count = seedPoints.filter((s) => s.kind === seedMode).length + 1;
      const newSeed: SeedPointEntry = {
        id: 'seed_' + Date.now(),
        name: seedMode === 'need' ? `Need Seed ${count}` : `Not Need ${count}`,
        kind: seedMode,
        voxel: coords,
        coordsMm,
        hu,
        slicePlane: 'axial',
        sliceIndex: coords[2],
      };

      const nextSeeds = [...seedPoints, newSeed];
      setSeedPoints(nextSeeds);

      if (seedPreviewOnSlices) {
        runLiveSeedSegmentation(nextSeeds, seedThresholdHu, sensitivity, activeMask.id);
      }
    },
    [isSeedModalOpen, activeSegmentTool, activeMask, volume, seedPoints, seedMode, seedThresholdHu, sensitivity, seedPreviewOnSlices, runLiveSeedSegmentation]
  );

  const handleChangeSensitivity = (val: number) => {
    setSensitivity(val);
    if (activeMask && seedPreviewOnSlices) {
      runLiveSeedSegmentation(seedPoints, seedThresholdHu, val, activeMask.id);
    }
  };

  const handleChangeSeedThresholdHu = (val: number) => {
    setSeedThresholdHu(val);
    if (activeMask && seedPreviewOnSlices) {
      runLiveSeedSegmentation(seedPoints, val, sensitivity, activeMask.id);
    }
  };

  const handleDeleteSeedPoint = (id: string) => {
    const nextSeeds = seedPoints.filter((s) => s.id !== id);
    setSeedPoints(nextSeeds);
    if (activeMask && seedPreviewOnSlices) {
      runLiveSeedSegmentation(nextSeeds, seedThresholdHu, sensitivity, activeMask.id);
    }
  };

  const handleClearSeedPoints = () => {
    setSeedPoints([]);
    if (activeMask) {
      runLiveSeedSegmentation([], seedThresholdHu, sensitivity, activeMask.id);
    }
  };

  const handleFinishSeedSegment = useCallback(() => {
    if (!activeMask || !volume) return;
    if (seedPoints.length > 0) {
      const { inclusionMask } = executeCompetitiveSeedSegmentation({
        voxels: volume.voxels,
        width: volume.width,
        height: volume.height,
        depth: volume.depth,
        spacing: volume.spacing,
        seeds: seedPoints,
        seedThresholdHu,
        sensitivity,
        gapClosingMm: seedGapClosingMm,
        fillLongBones: seedFillCavities,
      });
      handleUpdateMask(activeMask.id, {
        voxelMask: inclusionMask,
        exclusionMask: undefined,
      });
    }
    setSeedPoints([]);
    priorMaskBackupRef.current = null;
    setIsSeedModalOpen(false);
    handleBuild3DSurface();
  }, [activeMask, volume, seedPoints, seedThresholdHu, sensitivity, seedGapClosingMm, seedFillCavities, handleBuild3DSurface]);
  const handleApplySeedSegmentToMask = handleFinishSeedSegment;

  // Unified bone seeds passed to viewports ONLY when Seed Segment is actively open!
  const allBoneSeeds: BoneSeedPoint[] = useMemo(() => {
    if (isSeedModalOpen && activeSegmentTool === 'seed_segment') {
      return seedPoints.map((s) => ({
        id: s.id,
        voxel: s.voxel,
        hu: s.hu,
        color: s.kind === 'need' ? '#10B981' : '#EF4444',
        boneName: s.name,
        kind: s.kind,
      }));
    }
    return boneSeeds;
  }, [isSeedModalOpen, activeSegmentTool, seedPoints, boneSeeds]);

  // Combined masks rendered on slices
  const displayMasks: SegmentationMask[] = useMemo(() => {
    if (!isSegmentMode) return [];
    if (isSeedModalOpen && activeSegmentTool === 'seed_segment' && seedPoints.length === 0) {
      return masks.map((m) => {
        if (m.id === activeMaskId) {
          return {
            ...m,
            voxelMask: volume ? createEmptyMask(volume.width, volume.height, volume.depth) : new Uint8Array(0),
          };
        }
        return m;
      });
    }
    return masks;
  }, [isSegmentMode, masks, isSeedModalOpen, activeSegmentTool, seedPoints.length, activeMaskId, volume]);

  const effectiveActiveMask = useMemo(() => {
    if (!isSegmentMode || !activeMask) return null;
    if (isSeedModalOpen && activeSegmentTool === 'seed_segment' && seedPoints.length === 0) {
      return {
        ...activeMask,
        voxelMask: volume ? createEmptyMask(volume.width, volume.height, volume.depth) : new Uint8Array(0),
      };
    }
    return activeMask;
  }, [isSegmentMode, activeMask, isSeedModalOpen, activeSegmentTool, seedPoints.length, volume]);

  // =========================================================================
  // 3D OBJECT CALCULATION PIPELINE (Quality Presets & Taubin Smoothing)
  // =========================================================================
  const handleCalculate3DObject = useCallback(
    (
      sourceMaskIds: string[],
      preset: QualityPreset,
      options: {
        smooth: boolean;
        smoothIters: number;
        reduce: boolean;
        reducePercent: number;
        wrap: boolean;
        wrapMm: number;
      }
    ) => {
      if (!volume) return;
      const srcMasks = masks.filter((m) => sourceMaskIds.includes(m.id));
      if (srcMasks.length === 0) return;

      setIsProcessing3D(true);
      setTimeout(() => {
        try {
          const newObjects: Calculated3DObject[] = [];
          for (const mask of srcMasks) {
            const obj = calculate3DObjectFromMask({
              mask,
              width: volume.width,
              height: volume.height,
              depth: volume.depth,
              spacing: volume.spacing,
              qualityPreset: preset,
              applySmooth: options.smooth,
              smoothIterations: options.smoothIters,
              applyReduce: options.reduce,
              reducePercent: options.reducePercent,
              applyWrap: options.wrap,
              wrapMm: options.wrapMm,
            });
            newObjects.push(obj);
          }

          setObjects((prev) => [...prev, ...newObjects]);
          if (newObjects.length > 0) {
            const latest = newObjects[newObjects.length - 1];
            setActiveObjectId(latest.id);
            setWatertightMesh({
              vertices: latest.vertices,
              normals: latest.normals,
              triangleCount: latest.triangleCount,
              boundsMm: {
                min: [0, 0, 0],
                max: [100, 100, 100],
                size: [100, 100, 100],
              },
            });
            setIs3DSurfaceBuilt(true);
          }
        } finally {
          setIsProcessing3D(false);
        }
      }, 50);
    },
    [volume, masks]
  );

  const handleDeleteObject = (id: string) => {
    setObjects((prev) => prev.filter((o) => o.id !== id));
    if (activeObjectId === id) {
      setActiveObjectId('');
    }
  };

  const handleUpdateObject = (id: string, updates: Partial<Calculated3DObject>) => {
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
  };

  const handleDeleteBoneSeed = (id: string) => {
    setBoneSeeds((prev) => prev.filter((s) => s.id !== id));
  };

  const handleExecuteBoneSegmentation = () => {
    if (!volume || boneSeeds.length === 0) return;
    const resultMask = executeBoneSegmentation(
      volume.voxels,
      volume.width,
      volume.height,
      volume.depth,
      volume.spacing,
      boneSeeds.map((s) => s.voxel),
      corticalMinHu,
      corticalMaxHu,
      trabecularMinHu,
      gapClosingDistanceMm,
      fillInternalCavities
    );

    const count = masks.filter((m) => m.name.startsWith('Bone_Segmentation_')).length + 1;
    const newMask: SegmentationMask = {
      id: 'bone_mask_' + Date.now(),
      name: `Bone_Segmentation_${count}`,
      color: '#10B981',
      rgb: [16, 185, 129],
      opacity: 0.7,
      visible: true,
      minHu: corticalMinHu,
      maxHu: corticalMaxHu,
      voxelMask: resultMask,
      selected: true,
    };

    setMasks((prev) => [...prev, newMask]);
    setActiveMaskId(newMask.id);
    setIs3DSurfaceBuilt(true);
  };

  // Split Mask Handlers (3D Watershed)
  const handleSplitMaskSeedClick = useCallback(
    (coords: [number, number, number], _hu: number) => {
      if (splitMode === 'boneA') {
        setSeedsBoneA((prev) => [...prev, coords]);
      } else {
        setSeedsBoneB((prev) => [...prev, coords]);
      }
    },
    [splitMode]
  );

  const handleExecuteSplitMask = () => {
    if (!volume || !activeMask) return;
    if (seedsBoneA.length === 0 || seedsBoneB.length === 0) return;

    const sourceBuf =
      activeMask.voxelMask ||
      createThresholdMask(
        volume.voxels,
        volume.width,
        volume.height,
        volume.depth,
        activeMask.minHu,
        activeMask.maxHu
      );

    const { maskA, maskB } = splitMaskBySeeds(
      sourceBuf,
      volume.voxels,
      volume.width,
      volume.height,
      volume.depth,
      volume.spacing,
      seedsBoneA,
      seedsBoneB
    );

    const maskAObj: SegmentationMask = {
      id: `mask_${Date.now()}_A`,
      name: `${activeMask.name} - Part A`,
      color: '#06B6D4',
      rgb: [6, 182, 212],
      opacity: 0.7,
      visible: true,
      minHu: activeMask.minHu,
      maxHu: activeMask.maxHu,
      voxelMask: maskA,
      selected: false,
    };

    const maskBObj: SegmentationMask = {
      id: `mask_${Date.now()}_B`,
      name: `${activeMask.name} - Part B`,
      color: '#F59E0B',
      rgb: [245, 158, 11],
      opacity: 0.7,
      visible: true,
      minHu: activeMask.minHu,
      maxHu: activeMask.maxHu,
      voxelMask: maskB,
      selected: false,
    };

    setMasks((prev) => [...prev.filter((m) => m.id !== activeMask.id), maskAObj, maskBObj]);
    setActiveMaskId(maskAObj.id);
    setSeedsBoneA([]);
    setSeedsBoneB([]);
  };

  const handleClearSplitSeeds = () => {
    setSeedsBoneA([]);
    setSeedsBoneB([]);
  };

  // Mask to 3D Pipeline Handlers (Smooth, Reduce, Wrap)
  const handleApplyTaubinSmooth = (iterations: number, factor: number) => {
    if (!watertightMesh) return;
    setIsProcessing3D(true);
    setTimeout(() => {
      try {
        const smoothed = applyTaubinSmoothing(watertightMesh, iterations, factor);
        setWatertightMesh(smoothed);
      } finally {
        setIsProcessing3D(false);
      }
    }, 20);
  };

  const handleApplyQemReduce = (percent: number) => {
    if (!watertightMesh) return;
    setIsProcessing3D(true);
    setTimeout(() => {
      try {
        const reduced = applyQemReduction(watertightMesh, percent);
        setWatertightMesh(reduced);
      } finally {
        setIsProcessing3D(false);
      }
    }, 20);
  };

  const handleApplyShrinkWrap = (detailSizeMm: number, gapOffsetMm: number) => {
    if (!watertightMesh) return;
    setIsProcessing3D(true);
    setTimeout(() => {
      try {
        const wrapped = applyShrinkWrap(watertightMesh, detailSizeMm, gapOffsetMm);
        setWatertightMesh(wrapped);
      } finally {
        setIsProcessing3D(false);
      }
    }, 20);
  };

  // Send to Design Studio (Operating directly on selected 3D object from Objects tab)
  const handleSendToDesign = () => {
    const targetObj = objects.find((o) => o.id === activeObjectId) || objects[0];
    if (targetObj) {
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      const vCount = targetObj.uniquePositions.length / 3;
      for (let i = 0; i < vCount; i++) {
        const x = targetObj.uniquePositions[i * 3 + 0];
        const y = targetObj.uniquePositions[i * 3 + 1];
        const z = targetObj.uniquePositions[i * 3 + 2];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }

      const payload: TransferredMeshBuffer = {
        id: targetObj.id,
        name: targetObj.name,
        maskColor: targetObj.color,
        vertices: targetObj.vertices,
        normals: targetObj.normals,
        indices: targetObj.indices,
        triangleCount: targetObj.triangleCount,
        vertexCount: vCount,
        boundsMm: {
          min: [minX, minY, minZ],
          max: [maxX, maxY, maxZ],
          size: [Math.max(1, maxX - minX), Math.max(1, maxY - minY), Math.max(1, maxZ - minZ)],
          center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
        },
        spacing: volume?.spacing || [1, 1, 1],
        sourcePatientId: series.patient_id || 'Unknown',
        sourceSeriesDescription: series.series_description || 'Series',
        timestamp: Date.now(),
        pipelineStagesApplied: ['SurfaceNets', 'TaubinSmooth', 'WatertightClosure'],
      };

      medamStateBus.setTransferredGeometry(payload);
      onSelectModule?.('Design');
      return;
    }

    if (!volume) return;
    let meshData = watertightMesh;
    let maskName = 'Volume';
    let maskColor = '#06B6D4';

    if (!meshData) {
      const checked = masks.filter((m) => m.selected);
      const targets = checked.length > 0 ? checked : activeMask ? [activeMask] : [];
      const total = volume.width * volume.height * volume.depth;
      if (targets.length > 0) {
        maskName = targets.map((t) => t.name).join('_');
        maskColor = targets[0].color || '#06B6D4';
        const buffers = targets.map((t) => {
          if (t.voxelMask) return t.voxelMask;
          return createThresholdMask(volume.voxels, volume.width, volume.height, volume.depth, t.minHu, t.maxHu);
        });
        const combined = mergeMasks(buffers, total);
        meshData = extractWatertightMesh(combined, volume.width, volume.height, volume.depth, volume.spacing, 0.5, 6);
      } else {
        const defaultBoneBuf = createThresholdMask(volume.voxels, volume.width, volume.height, volume.depth, 226, 3071);
        meshData = extractWatertightMesh(defaultBoneBuf, volume.width, volume.height, volume.depth, volume.spacing, 0.5, 6);
      }
    }

    if (!meshData || meshData.triangleCount === 0) return;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    const vCount = meshData.uniquePositions.length / 3;
    for (let i = 0; i < vCount; i++) {
      const x = meshData.uniquePositions[i * 3 + 0];
      const y = meshData.uniquePositions[i * 3 + 1];
      const z = meshData.uniquePositions[i * 3 + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }

    const payload: TransferredMeshBuffer = {
      id: `mesh-${Date.now()}`,
      name: maskName,
      maskColor,
      vertices: meshData.vertices,
      normals: meshData.normals,
      indices: meshData.indices,
      triangleCount: meshData.triangleCount,
      vertexCount: vCount,
      boundsMm: {
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ],
        size: [maxX - minX, maxY - minY, maxZ - minZ],
        center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
      },
      spacing: volume.spacing,
      sourcePatientId: series.patient_id || 'Unknown',
      sourceSeriesDescription: series.series_description || 'Series',
      timestamp: Date.now(),
      pipelineStagesApplied: ['SurfaceNets', 'TaubinSmooth', 'WatertightClosure'],
    };

    medamStateBus.setTransferredGeometry(payload);
    onSelectModule?.('Design');
  };

  // Binary Watertight STL Mesh Export (Operating directly on selected 3D object from Objects tab)
  const handleExportStl = async () => {
    const targetObj = objects.find((o) => o.id === activeObjectId) || objects[0];
    if (targetObj) {
      const stlBuffer = buildBinaryStlBuffer(
        {
          vertices: targetObj.vertices,
          normals: targetObj.normals,
          indices: targetObj.indices,
          uniquePositions: targetObj.uniquePositions,
          uniqueNormals: targetObj.uniqueNormals,
          triangleCount: targetObj.triangleCount,
          boundsMm: { min: [0, 0, 0], max: [100, 100, 100], size: [100, 100, 100] },
        },
        `MEDAM Diagnostic Mesh - ${targetObj.name}`
      );
      const filename = `${targetObj.name.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}.stl`;
      await downloadBinaryStl(stlBuffer, filename);
      return;
    }

    if (!volume) return;
    const total = volume.width * volume.height * volume.depth;
    const checked = masks.filter((m) => m.selected);
    const targets = checked.length > 0 ? checked : activeMask ? [activeMask] : [];

    let meshData = watertightMesh;
    let maskName = 'Volume';

    if (!meshData) {
      if (targets.length > 0) {
        maskName = targets.map((t) => t.name).join('_');
        const buffers = targets.map((t) => {
          if (t.voxelMask) return t.voxelMask;
          return createThresholdMask(volume.voxels, volume.width, volume.height, volume.depth, t.minHu, t.maxHu);
        });
        const combined = mergeMasks(buffers, total);
        meshData = extractWatertightMesh(combined, volume.width, volume.height, volume.depth, volume.spacing, 0.5, 6);
      } else {
        const defaultBoneBuf = createThresholdMask(volume.voxels, volume.width, volume.height, volume.depth, 226, 3071);
        meshData = extractWatertightMesh(defaultBoneBuf, volume.width, volume.height, volume.depth, volume.spacing, 0.5, 6);
      }
    } else if (targets.length > 0) {
      maskName = targets.map((t) => t.name).join('_');
    }

    const stlBuffer = buildBinaryStlBuffer(meshData, `MEDAM Diagnostic Mesh - ${series.series_description}`);
    const patient = (series.patient_name || 'Patient').replace(/[\^\s]/g, '_');
    const seriesDesc = (series.series_description || 'Series').replace(/[^a-zA-Z0-9]/g, '_');
    const cleanMaskName = maskName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${patient}_${seriesDesc}_${cleanMaskName}.stl`;

    await downloadBinaryStl(stlBuffer, filename);
  };

  const isSeedPlacementActive = isSeedModalOpen && activeSegmentTool === 'seed_segment' && seedSegmentStep === 1 && !!activeMask;

  return (
    <div
      className={`flex-1 flex flex-col overflow-hidden select-none font-sans ${
        localTheme === 'dark' ? 'bg-[#090D16] text-[#F8FAFC]' : 'bg-[#F8FAFC] text-[#0F172A]'
      }`}
    >
      {/* Consolidated CAD Horizontal Top Toolbar */}
      <CadViewerToolbar
        series={series}
        isCollapsed={isCadToolbarCollapsed}
        onToggleCollapse={() => setIsCadToolbarCollapsed((v) => !v)}
        activeTool={activeTool}
        onSelectTool={handleSelectViewportTool}
        onChangeWindow={(c, w) => {
          setWindowCenter(c);
          setWindowWidth(w);
        }}
        slabMode={slabMode}
        onChangeSlabMode={setSlabMode}
        slabThicknessMm={slabThicknessMm}
        onChangeSlabThickness={setSlabThicknessMm}
        onResetView={handleResetView}
        isSegmentMode={isSegmentMode}
        onToggleSegmentMode={() => setIsSegmentMode((m) => !m)}
        activeSegmentTool={activeSegmentTool}
        onSelectSegmentTool={handleSelectSegmentTool}
        onOpenCtBoneModal={handleOpenSeedSegment}
        onBuild3DSurface={handleBuild3DSurface}
        onApplyTaubinSmooth={handleApplyTaubinSmooth}
        onApplyQemReduce={handleApplyQemReduce}
        onApplyShrinkWrap={handleApplyShrinkWrap}
        meshTriangleCount={watertightMesh?.triangleCount || 0}
        onExportStl={handleExportStl}
        onSendToDesign={handleSendToDesign}
        onOpenSeriesModal={study ? () => setIsSeriesModalOpen(true) : undefined}
        onBackToSeries={onBackToSeries}
        theme={localTheme}
        onToggleTheme={handleToggleTheme}
        isFullscreen={!!isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />

      {/* Main Workspace Body: Left Icon Rail + 2x2 Viewport Grid + Optional 260px Segmentation Drawer */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Narrow 48px Icon Rail for Direct 2D/3D Viewport Tools */}
        <LeftIconRail
          activeTool={activeTool}
          onSelectTool={handleSelectViewportTool}
          slabMode={slabMode}
          onToggleSlab={() => setSlabMode((s) => (s === 'none' ? 'mip' : 'none'))}
          isCinePlaying={isCinePlaying}
          onToggleCine={() => setIsCinePlaying((p) => !p)}
          onRotate90={() => setRotationDeg((r) => (r + 90) % 360)}
          onFlipH={() => setFlipH((f) => !f)}
          onFlipV={() => setFlipV((f) => !f)}
          onInvertLut={() => setIsLutInverted((inv) => !inv)}
          isLutInverted={isLutInverted}
          onResetView={handleResetView}
        />

        {/* 2x2 Diagnostic Workstation Grid (Spans 100% screen width in standard viewing mode!) */}
        <main className="flex-1 bg-black p-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-xs text-sky-400 gap-3 font-medium">
              <span className="w-5 h-5 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
              <span>Reconstructing multi-planar volume...</span>
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-1 h-full">
              {/* Top-Left Viewport: Coronal MPR View */}
              {(maximizedQuadrant === null || maximizedQuadrant === 1) && (
                <div
                  className={`relative w-full h-full ${
                    maximizedQuadrant === 1 ? 'col-span-2 row-span-2' : ''
                  }`}
                >
                  <Viewport2D
                    volume={volume}
                    plane="coronal"
                    sliceIndex={coronalSlice}
                    onSliceChange={(idx) => {
                      setCoronalSlice(idx);
                      setCrosshairPos([crosshairPos[0], idx, crosshairPos[2]]);
                    }}
                    crosshairPos={crosshairPos}
                    onCrosshairChange={handleCrosshairChange}
                    windowCenter={windowCenter}
                    windowWidth={windowWidth}
                    onWindowChange={(c, w) => {
                      setWindowCenter(c);
                      setWindowWidth(w);
                    }}
                    slabMode={slabMode}
                    slabThicknessMm={slabThicknessMm}
                    rotationDeg={rotationDeg}
                    flipH={flipH}
                    flipV={flipV}
                    isLutInverted={isLutInverted}
                    activeTool={activeTool}
                    measurements={measurements}
                    onAddMeasurement={handleAddMeasurement}
                    isMaximized={maximizedQuadrant === 1}
                    onToggleMaximize={() =>
                      setMaximizedQuadrant(maximizedQuadrant === 1 ? null : 1)
                    }
                    activeMask={effectiveActiveMask}
                    masks={displayMasks.length > 0 ? displayMasks : undefined}
                    showCrosshairs={showCrosshairs}
                    isSegmentMode={isSegmentMode}
                    activeSegmentTool={activeSegmentTool}
                    brushRadiusMm={brushRadiusMm}
                    brushMode={brushMode}
                    brush3D={brush3D}
                    onBrushStroke={handleBrushStroke}
                    onRegionGrowClick={handleRegionGrowClick}
                    onLassoErase={handleLassoErase}
                    lassoThroughVolume={lassoThroughVolume}
                    boneSeeds={allBoneSeeds}
                    onBoneSeedClick={handleBoneSeedClick}
                    isBoneWizardActive={activeSegmentTool === 'bone_auto_segment' || activeSegmentTool === 'seed_segment'}
                    isSeedPlacementActive={isSeedPlacementActive}
                    onSplitMaskSeedClick={handleSplitMaskSeedClick}
                  />
                </div>
              )}

              {/* Top-Right Viewport: Axial MPR View */}
              {(maximizedQuadrant === null || maximizedQuadrant === 2) && (
                <div
                  className={`relative w-full h-full ${
                    maximizedQuadrant === 2 ? 'col-span-2 row-span-2' : ''
                  }`}
                >
                  <Viewport2D
                    volume={volume}
                    plane="axial"
                    sliceIndex={axialSlice}
                    onSliceChange={(idx) => {
                      setAxialSlice(idx);
                      setCrosshairPos([crosshairPos[0], crosshairPos[1], idx]);
                    }}
                    crosshairPos={crosshairPos}
                    onCrosshairChange={handleCrosshairChange}
                    windowCenter={windowCenter}
                    windowWidth={windowWidth}
                    onWindowChange={(c, w) => {
                      setWindowCenter(c);
                      setWindowWidth(w);
                    }}
                    slabMode={slabMode}
                    slabThicknessMm={slabThicknessMm}
                    rotationDeg={rotationDeg}
                    flipH={flipH}
                    flipV={flipV}
                    isLutInverted={isLutInverted}
                    activeTool={activeTool}
                    measurements={measurements}
                    onAddMeasurement={handleAddMeasurement}
                    isMaximized={maximizedQuadrant === 2}
                    onToggleMaximize={() =>
                      setMaximizedQuadrant(maximizedQuadrant === 2 ? null : 2)
                    }
                    activeMask={effectiveActiveMask}
                    masks={displayMasks.length > 0 ? displayMasks : undefined}
                    showCrosshairs={showCrosshairs}
                    isSegmentMode={isSegmentMode}
                    activeSegmentTool={activeSegmentTool}
                    brushRadiusMm={brushRadiusMm}
                    brushMode={brushMode}
                    brush3D={brush3D}
                    onBrushStroke={handleBrushStroke}
                    onRegionGrowClick={handleRegionGrowClick}
                    onLassoErase={handleLassoErase}
                    lassoThroughVolume={lassoThroughVolume}
                    boneSeeds={allBoneSeeds}
                    onBoneSeedClick={handleBoneSeedClick}
                    isBoneWizardActive={activeSegmentTool === 'bone_auto_segment' || activeSegmentTool === 'seed_segment'}
                    isSeedPlacementActive={isSeedPlacementActive}
                    onSplitMaskSeedClick={handleSplitMaskSeedClick}
                  />
                </div>
              )}

              {/* Bottom-Left Viewport: Sagittal MPR View */}
              {(maximizedQuadrant === null || maximizedQuadrant === 3) && (
                <div
                  className={`relative w-full h-full ${
                    maximizedQuadrant === 3 ? 'col-span-2 row-span-2' : ''
                  }`}
                >
                  <Viewport2D
                    volume={volume}
                    plane="sagittal"
                    sliceIndex={sagittalSlice}
                    onSliceChange={(idx) => {
                      setSagittalSlice(idx);
                      setCrosshairPos([idx, crosshairPos[1], crosshairPos[2]]);
                    }}
                    crosshairPos={crosshairPos}
                    onCrosshairChange={handleCrosshairChange}
                    windowCenter={windowCenter}
                    windowWidth={windowWidth}
                    onWindowChange={(c, w) => {
                      setWindowCenter(c);
                      setWindowWidth(w);
                    }}
                    slabMode={slabMode}
                    slabThicknessMm={slabThicknessMm}
                    rotationDeg={rotationDeg}
                    flipH={flipH}
                    flipV={flipV}
                    isLutInverted={isLutInverted}
                    activeTool={activeTool}
                    measurements={measurements}
                    onAddMeasurement={handleAddMeasurement}
                    isMaximized={maximizedQuadrant === 3}
                    onToggleMaximize={() =>
                      setMaximizedQuadrant(maximizedQuadrant === 3 ? null : 3)
                    }
                    activeMask={effectiveActiveMask}
                    masks={displayMasks.length > 0 ? displayMasks : undefined}
                    showCrosshairs={showCrosshairs}
                    isSegmentMode={isSegmentMode}
                    activeSegmentTool={activeSegmentTool}
                    brushRadiusMm={brushRadiusMm}
                    brushMode={brushMode}
                    brush3D={brush3D}
                    onBrushStroke={handleBrushStroke}
                    onRegionGrowClick={handleRegionGrowClick}
                    onLassoErase={handleLassoErase}
                    lassoThroughVolume={lassoThroughVolume}
                    boneSeeds={allBoneSeeds}
                    onBoneSeedClick={handleBoneSeedClick}
                    isBoneWizardActive={activeSegmentTool === 'bone_auto_segment' || activeSegmentTool === 'seed_segment'}
                    isSeedPlacementActive={isSeedPlacementActive}
                    onSplitMaskSeedClick={handleSplitMaskSeedClick}
                  />
                </div>
              )}

              {/* Bottom-Right Viewport: Quadrant 4 3D Segmented Surface Mesh Viewport */}
              {(maximizedQuadrant === null || maximizedQuadrant === 4) && (
                <div
                  className={`relative w-full h-full ${
                    maximizedQuadrant === 4 ? 'col-span-2 row-span-2' : ''
                  }`}
                >
                  <Viewport3D
                    volume={volume}
                    is3DSurfaceBuilt={is3DSurfaceBuilt}
                    onBuild3DSurface={handleBuild3DSurface}
                    isMaximized={maximizedQuadrant === 4}
                    onToggleMaximize={() =>
                      setMaximizedQuadrant(maximizedQuadrant === 4 ? null : 4)
                    }
                    activeMask={isSegmentMode ? activeMask : null}
                    masks={isSegmentMode ? masks : undefined}
                    objects={objects}
                    overrideMesh={watertightMesh}
                    onMeshExtracted={setWatertightMesh}
                    isProcessing3D={isProcessing3D}
                  />
                </div>
              )}
            </div>
          )}

          {/* Mobile Bottom Segmented Tab Bar for small screens */}
          <div className="md:hidden flex items-center justify-around h-10 bg-white border-t border-slate-200 mt-1 shrink-0">
            {['Coronal', 'Axial', 'Sagittal', '3D Surface'].map((label, idx) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setMobileActiveTab(idx);
                  setMaximizedQuadrant(idx + 1);
                }}
                className={`px-3 py-1 text-xs font-semibold ${
                  mobileActiveTab === idx
                    ? 'text-[#0284C7] border-b-2 border-[#0284C7]'
                    : 'text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </main>

        {/* Docked Right Studio Sidebar (Width: 310px, Top: Masks & Objects Tabs; Bottom: Tool Operations) */}
        {isSegmentMode && (
          <SegmentationDrawer
            isOpen={isSegmentMode}
            onClose={() => setIsSegmentMode(false)}
            masks={masks}
            activeMaskId={activeMaskId}
            onSelectMask={setActiveMaskId}
            onCreateMask={handleCreateMask}
            onDeleteMask={handleDeleteMask}
            onUpdateMask={handleUpdateMask}
            onToggleSelectMask={handleToggleSelectMask}
            onToggleSelectAllMasks={handleToggleSelectAllMasks}
            onMergeSelectedMasks={handleMergeSelectedMasks}
            onSubtractMasks={handleSubtractMasks}
            onDeleteSelectedMasks={handleDeleteSelectedMasks}
            onBuild3DSurface={handleBuild3DSurface}
            objects={objects}
            activeObjectId={activeObjectId}
            onSelectObject={setActiveObjectId}
            onDeleteObject={handleDeleteObject}
            onUpdateObject={handleUpdateObject}
            onCalculate3DObject={handleCalculate3DObject}
            onExportStl={handleExportStl}
            onSendToDesign={handleSendToDesign}
            is3DSurfaceBuilt={is3DSurfaceBuilt}
            activeSegmentTool={activeSegmentTool}
            onSelectSegmentTool={handleSelectSegmentTool}
            seedMode={seedMode}
            onChangeSeedMode={setSeedMode}
            seedPoints={seedPoints}
            onDeleteSeedPoint={handleDeleteSeedPoint}
            onClearSeedPoints={handleClearSeedPoints}
            seedThresholdHu={seedThresholdHu}
            onChangeSeedThresholdHu={handleChangeSeedThresholdHu}
            sensitivity={sensitivity}
            onChangeSensitivity={handleChangeSensitivity}
            seedSegmentStep={seedSegmentStep}
            onChangeSeedSegmentStep={setSeedSegmentStep}
            seedGapClosingMm={seedGapClosingMm}
            onChangeSeedGapClosingMm={setSeedGapClosingMm}
            seedFillCavities={seedFillCavities}
            onToggleSeedFillCavities={() => setSeedFillCavities((v) => !v)}
            onApplySeedSegmentToMask={handleApplySeedSegmentToMask}
            regionGrowSeedsCount={regionGrowSeeds.length}
            onUndoLastRegionGrowSeed={handleUndoLastRegionGrowSeed}
            brushRadiusMm={brushRadiusMm}
            onChangeBrushRadius={setBrushRadiusMm}
            brushMode={brushMode}
            onChangeBrushMode={setBrushMode}
            brush3D={brush3D}
            onToggleBrush3D={() => setBrush3D((v) => !v)}
            brushConstrained={brushConstrained}
            onToggleBrushConstrained={() => setBrushConstrained((c) => !c)}
            constrainedMinHu={constrainedMinHu}
            onChangeConstrainedMinHu={setConstrainedMinHu}
            constrainedMaxHu={constrainedMaxHu}
            onChangeConstrainedMaxHu={setConstrainedMaxHu}
            lassoThroughVolume={lassoThroughVolume}
            onToggleLassoThroughVolume={() => setLassoThroughVolume((v) => !v)}
            morphologyRadiusMm={morphologyRadiusMm}
            onChangeMorphologyRadius={setMorphologyRadiusMm}
            onApplyMorphology={handleApplyMorphology}
            onKeepLargestIsland={handleKeepLargestIsland}
            splitMode={splitMode}
            onChangeSplitMode={setSplitMode}
            seedsBoneACount={seedsBoneA.length}
            seedsBoneBCount={seedsBoneB.length}
            onExecuteSplitMask={handleExecuteSplitMask}
            onClearSplitSeeds={handleClearSplitSeeds}
          />
        )}
      </div>

      {/* Centered MEDAM Series Selector Pop-up Modal */}
      {isSeriesModalOpen && study && (
        <SeriesSelectorModal
          study={study}
          onSelectSeries={(s) => {
            setIsSeriesModalOpen(false);
            onSelectSeries?.(s);
          }}
          onClose={() => setIsSeriesModalOpen(false)}
          currentSelectedSeriesUid={series.series_instance_uid}
        />
      )}

      {/* Floating Draggable Seed Segmentation Modal Window */}
      {isSeedModalOpen && (
        <SeedSegmentModal
          isOpen={isSeedModalOpen}
          onClose={handleCancelSeedSegment}
          onCancel={handleCancelSeedSegment}
          volume={volume}
          masks={masks}
          activeMaskId={activeMaskId}
          onSelectMaskId={setActiveMaskId}
          onCreateManualMask={handleCreateMask}
          seedMode={seedMode}
          onChangeSeedMode={setSeedMode}
          seedPoints={seedPoints}
          onDeleteSeedPoint={handleDeleteSeedPoint}
          onClearSeedPoints={handleClearSeedPoints}
          sensitivity={sensitivity}
          onChangeSensitivity={handleChangeSensitivity}
          seedThresholdHu={seedThresholdHu}
          onChangeSeedThresholdHu={handleChangeSeedThresholdHu}
          currentTab={seedSegmentStep}
          onChangeTab={setSeedSegmentStep}
          gapClosingMm={seedGapClosingMm}
          onChangeGapClosingMm={setSeedGapClosingMm}
          fillCavities={seedFillCavities}
          onToggleFillCavities={() => setSeedFillCavities((v) => !v)}
          previewOnSlices={seedPreviewOnSlices}
          onTogglePreviewOnSlices={() => setSeedPreviewOnSlices((v) => !v)}
          onCalculate={() => runLiveSeedSegmentation(seedPoints, seedThresholdHu, sensitivity, activeMaskId)}
          onFinish={handleFinishSeedSegment}
          isCalculating={false}
          onUpdateMaskHu={(maskId, minHu, maxHu) => handleUpdateMask(maskId, { minHu, maxHu, voxelMask: undefined })}
        />
      )}
    </div>
  );
};
