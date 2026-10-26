import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { MprVolume, ViewportPlaneMetrics } from './mprEngine';
import {
  ProjectionPlane,
  SlabMode,
  ToolMode,
  SegmentToolMode,
  Measurement,
  MeasurementPoint,
  SegmentationMask,
  BoneSeedPoint,
  RoiStats,
} from './types';
import { ToolIconButton, IconMaximize, IconRestore } from './Icons';

interface Viewport2DProps {
  volume: MprVolume | null;
  plane: ProjectionPlane;
  sliceIndex: number;
  onSliceChange: (index: number) => void;
  crosshairPos: [number, number, number];
  onCrosshairChange: (pos: [number, number, number]) => void;
  windowCenter: number;
  windowWidth: number;
  onWindowChange: (center: number, width: number) => void;
  slabMode: SlabMode;
  slabThicknessMm: number;
  rotationDeg: number;
  flipH: boolean;
  flipV: boolean;
  isLutInverted: boolean;
  activeTool: ToolMode;
  measurements: Measurement[];
  onAddMeasurement: (measurement: Measurement) => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  quadrantLabel?: string;
  activeMask?: SegmentationMask | null;
  masks?: SegmentationMask[];
  showCrosshairs?: boolean;
  // Segmentation Mode Props
  isSegmentMode?: boolean;
  activeSegmentTool?: SegmentToolMode;
  brushRadiusMm?: number;
  brushMode?: 'paint' | 'erase';
  brush3D?: boolean;
  onBrushStroke?: (coords: [number, number, number], prevCoords: [number, number, number] | null) => void;
  onRegionGrowClick?: (coords: [number, number, number], hu: number) => void;
  onLassoErase?: (plane: ProjectionPlane, sliceIndex: number, points: { x: number; y: number }[], throughVolume: boolean) => void;
  lassoThroughVolume?: boolean;
  boneSeeds?: BoneSeedPoint[];
  onBoneSeedClick?: (coords: [number, number, number], hu: number) => void;
  isBoneWizardActive?: boolean;
  isSeedPlacementActive?: boolean;
  onSplitMaskSeedClick?: (coords: [number, number, number], hu: number) => void;
}

export const Viewport2D: React.FC<Viewport2DProps> = ({
  volume,
  plane,
  sliceIndex,
  onSliceChange,
  crosshairPos,
  onCrosshairChange,
  windowCenter,
  windowWidth,
  onWindowChange,
  slabMode,
  slabThicknessMm,
  rotationDeg,
  flipH,
  flipV,
  isLutInverted,
  activeTool,
  measurements,
  onAddMeasurement,
  isMaximized,
  onToggleMaximize,
  activeMask,
  masks,
  showCrosshairs = true,
  isSegmentMode = false,
  activeSegmentTool = 'threshold',
  brushRadiusMm = 5.0,
  brushMode = 'paint',
  brush3D = false,
  onBrushStroke,
  onRegionGrowClick,
  onLassoErase,
  lassoThroughVolume = false,
  boneSeeds = [],
  onBoneSeedClick,
  isBoneWizardActive = false,
  isSeedPlacementActive = false,
  onSplitMaskSeedClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollbarTrackRef = useRef<HTMLDivElement>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Container viewport dimensions
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 400,
    height: 400,
  });

  // Default camera zoom set to 0.86 (14% mandatory viewport buffer window for true physical millimeter rendering)
  const [zoom, setZoom] = useState<number>(0.86);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Interaction dragging states
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragMode, setDragMode] = useState<
    ToolMode | 'right_window' | 'crosshair_drag' | 'scrollbar_drag' | 'brush_drag' | 'lasso_drag' | 'roi_drag' | 'dist_drag' | null
  >(null);

  // Live mouse screen position for visual feedback
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // In-progress measurement creation points in slice coordinates
  const [currentPoints, setCurrentPoints] = useState<MeasurementPoint[]>([]);

  // In-progress freehand lasso points in slice coordinates
  const [lassoPoints, setLassoPoints] = useState<MeasurementPoint[]>([]);

  // Tracking last brush voxel coordinate for continuous interpolation
  const lastBrushVoxelRef = useRef<[number, number, number] | null>(null);

  // Observe container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Compute exact physical dimensions and buffer margin metrics
  const planeMetrics: ViewportPlaneMetrics | null = useMemo(() => {
    if (!volume || containerSize.width <= 0 || containerSize.height <= 0) return null;
    return volume.getViewportPlaneMetrics(
      plane,
      containerSize.width,
      containerSize.height,
      pan,
      zoom
    );
  }, [volume, plane, containerSize, pan, zoom]);

  // Total slices for this plane
  const totalSlices = useMemo(() => {
    if (!volume) return 1;
    return volume.getPlaneSliceCount(plane);
  }, [volume, plane]);

  // Render slice directly into viewport canvas with pure black background
  const renderSlice = useCallback(() => {
    if (!volume || !canvasRef.current || !planeMetrics) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== containerSize.width || canvas.height !== containerSize.height) {
      canvas.width = containerSize.width;
      canvas.height = containerSize.height;
    }

    const imageData = ctx.createImageData(containerSize.width, containerSize.height);

    volume.renderViewportWithBuffer(
      imageData,
      plane,
      sliceIndex,
      windowCenter,
      windowWidth,
      slabMode,
      slabThicknessMm,
      isLutInverted,
      planeMetrics,
      activeMask,
      masks
    );

    ctx.putImageData(imageData, 0, 0);
  }, [
    volume,
    plane,
    sliceIndex,
    windowCenter,
    windowWidth,
    slabMode,
    slabThicknessMm,
    isLutInverted,
    planeMetrics,
    containerSize,
    activeMask,
    masks,
  ]);

  useEffect(() => {
    renderSlice();
  }, [renderSlice]);

  // Coordinate transformations
  const screenToSliceCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      if (!containerRef.current || !planeMetrics || !volume) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;

      const relX = clickX - planeMetrics.offsetX;
      const relY = clickY - planeMetrics.offsetY;

      const normX = Math.max(0, Math.min(1, relX / Math.max(1, planeMetrics.renderW)));
      const normY = Math.max(0, Math.min(1, relY / Math.max(1, planeMetrics.renderH)));

      if (plane === 'axial') {
        return {
          x: normX * (volume.width - 1),
          y: normY * (volume.height - 1),
        };
      } else if (plane === 'coronal') {
        return {
          x: normX * (volume.width - 1),
          y: (1.0 - normY) * (volume.depth - 1),
        };
      } else {
        return {
          x: normX * (volume.height - 1),
          y: (1.0 - normY) * (volume.depth - 1),
        };
      }
    },
    [planeMetrics, volume, plane]
  );

  const screenToVolumeVoxel = useCallback(
    (clientX: number, clientY: number): [number, number, number] | null => {
      if (!containerRef.current || !planeMetrics || !volume) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;

      const relX = clickX - planeMetrics.offsetX;
      const relY = clickY - planeMetrics.offsetY;

      const normX = Math.max(0, Math.min(1, relX / Math.max(1, planeMetrics.renderW)));
      const normY = Math.max(0, Math.min(1, relY / Math.max(1, planeMetrics.renderH)));

      if (plane === 'axial') {
        const vx = Math.round(normX * (volume.width - 1));
        const vy = Math.round(normY * (volume.height - 1));
        const vz = Math.max(0, Math.min(volume.depth - 1, sliceIndex));
        return [vx, vy, vz];
      } else if (plane === 'coronal') {
        const vx = Math.round(normX * (volume.width - 1));
        const vy = Math.max(0, Math.min(volume.height - 1, sliceIndex));
        const vz = Math.round((1.0 - normY) * (volume.depth - 1));
        return [vx, vy, vz];
      } else {
        const vx = Math.max(0, Math.min(volume.width - 1, sliceIndex));
        const vy = Math.round(normX * (volume.height - 1));
        const vz = Math.round((1.0 - normY) * (volume.depth - 1));
        return [vx, vy, vz];
      }
    },
    [planeMetrics, volume, plane, sliceIndex]
  );

  const sliceToScreenCoords = useCallback(
    (pt: MeasurementPoint): { x: number; y: number } | null => {
      if (!planeMetrics || !volume) return null;

      let normX = 0;
      let normY = 0;

      if (plane === 'axial') {
        normX = pt.x / Math.max(1, volume.width - 1);
        normY = pt.y / Math.max(1, volume.height - 1);
      } else if (plane === 'coronal') {
        normX = pt.x / Math.max(1, volume.width - 1);
        normY = 1.0 - pt.y / Math.max(1, volume.depth - 1);
      } else {
        normX = pt.x / Math.max(1, volume.height - 1);
        normY = 1.0 - pt.y / Math.max(1, volume.depth - 1);
      }

      return {
        x: planeMetrics.offsetX + normX * planeMetrics.renderW,
        y: planeMetrics.offsetY + normY * planeMetrics.renderH,
      };
    },
    [planeMetrics, volume, plane]
  );

  // Wheel scrolling for smooth slice cycling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const delta = e.deltaY < 0 ? 1.08 : 0.92;
        setZoom((z) => Math.max(0.2, Math.min(8.0, z * delta)));
      } else {
        const step = e.deltaY > 0 ? 1 : -1;
        const nextSlice = Math.max(0, Math.min(totalSlices - 1, sliceIndex + step));
        onSliceChange(nextSlice);
      }
    };

    el.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheelNative);
    };
  }, [totalSlices, sliceIndex, onSliceChange]);

  // Update synchronized 3D crosshair from slice coordinates
  const updateCrosshairFromSliceCoords = useCallback(
    (sliceX: number, sliceY: number) => {
      if (!volume) return;

      if (plane === 'axial') {
        onCrosshairChange([
          Math.max(0, Math.min(volume.width - 1, Math.round(sliceX))),
          Math.max(0, Math.min(volume.height - 1, Math.round(sliceY))),
          sliceIndex,
        ]);
      } else if (plane === 'coronal') {
        const vz = Math.max(0, Math.min(volume.depth - 1, Math.round(sliceY)));
        onCrosshairChange([
          Math.max(0, Math.min(volume.width - 1, Math.round(sliceX))),
          sliceIndex,
          vz,
        ]);
      } else {
        const vz = Math.max(0, Math.min(volume.depth - 1, Math.round(sliceY)));
        onCrosshairChange([
          sliceIndex,
          Math.max(0, Math.min(volume.height - 1, Math.round(sliceX))),
          vz,
        ]);
      }
    },
    [volume, plane, sliceIndex, onCrosshairChange]
  );

  // Scrollbar direct scrub helper
  const handleScrollbarScrub = useCallback(
    (clientY: number) => {
      if (!scrollbarTrackRef.current || totalSlices <= 1) return;
      const rect = scrollbarTrackRef.current.getBoundingClientRect();
      const relativeY = clientY - rect.top;
      const ratio = Math.max(0, Math.min(1, relativeY / rect.height));
      const targetSlice = Math.round(ratio * (totalSlices - 1));
      onSliceChange(targetSlice);
    },
    [totalSlices, onSliceChange]
  );

  // Mouse Down Router
  const handleMouseDown = (e: React.MouseEvent) => {
    const isRightClick = e.button === 2;
    const isMiddleClick = e.button === 1;
    const isShiftLeft = e.button === 0 && e.shiftKey;
    setDragStart({ x: e.clientX, y: e.clientY });
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    setIsDragging(true);

    if (isMiddleClick || isShiftLeft) {
      setDragMode('pan');
      return;
    }

    if (isRightClick) {
      setDragMode('right_window');
      return;
    }

    if (e.button !== 0) return;

    // ==========================================
    // 1. SEGMENT MODE INTERACTIONS
    // ==========================================
    if (isSegmentMode) {
      if (activeSegmentTool === 'seed_segment' || activeSegmentTool === 'bone_auto_segment' || isBoneWizardActive) {
        // Do NOT plant seeds on mouse down! Wait for deliberate stationary mouse up click
        setDragMode('pan');
        return;
      }

      if (activeSegmentTool === 'region_grow') {
        const voxel = screenToVolumeVoxel(e.clientX, e.clientY);
        if (voxel && volume) {
          const hu = volume.getVoxel(voxel[0], voxel[1], voxel[2]);
          onRegionGrowClick?.(voxel, hu);
        }
        return;
      }

      if (activeSegmentTool === 'split_mask') {
        const voxel = screenToVolumeVoxel(e.clientX, e.clientY);
        if (voxel && volume) {
          const hu = volume.getVoxel(voxel[0], voxel[1], voxel[2]);
          onSplitMaskSeedClick?.(voxel, hu);
        }
        return;
      }

      if (activeSegmentTool === 'brush' || activeSegmentTool === 'edit_mask') {
        setDragMode('brush_drag');
        const voxel = screenToVolumeVoxel(e.clientX, e.clientY);
        if (voxel) {
          lastBrushVoxelRef.current = voxel;
          onBrushStroke?.(voxel, null);
        }
        return;
      }

      if (activeSegmentTool === 'lasso_erase') {
        setDragMode('lasso_drag');
        const slicePt = screenToSliceCoords(e.clientX, e.clientY);
        if (slicePt) {
          setLassoPoints([slicePt]);
        }
        return;
      }

      // Default fallback in segment mode: Pan
      setDragMode('pan');
      return;
    }

    // ==========================================
    // 2. PACS MODE TOOL INTERACTIONS
    // ==========================================
    if (activeTool === 'crosshair') {
      setDragMode('crosshair_drag');
      const coords = screenToSliceCoords(e.clientX, e.clientY);
      if (coords) {
        updateCrosshairFromSliceCoords(coords.x, coords.y);
      }
    } else if (activeTool === 'window') {
      setDragMode('window');
    } else if (activeTool === 'pan') {
      setDragMode('pan');
    } else if (activeTool === 'zoom') {
      setDragMode('zoom');
    } else if (activeTool === 'length') {
      const coords = screenToSliceCoords(e.clientX, e.clientY);
      if (!coords) return;

      if (currentPoints.length === 0) {
        setCurrentPoints([coords]);
        setDragMode('dist_drag');
      } else {
        // Complete distance measurement
        const p0 = currentPoints[0];
        const p1 = coords;
        const [dx, dy, dz] = volume?.spacing || [1, 1, 1];
        const sx = (p1.x - p0.x) * (plane === 'sagittal' ? dy : dx);
        const sy = (p1.y - p0.y) * (plane === 'axial' ? dy : dz);
        const val = Math.hypot(sx, sy);

        onAddMeasurement({
          id: 'm_' + Date.now(),
          type: 'length',
          plane,
          sliceIndex,
          points: [p0, p1],
          value: val,
        });
        setCurrentPoints([]);
        setDragMode(null);
      }
    } else if (activeTool === 'angle') {
      const coords = screenToSliceCoords(e.clientX, e.clientY);
      if (!coords) return;

      const newPts = [...currentPoints, coords];
      if (newPts.length < 3) {
        setCurrentPoints(newPts);
      } else {
        const v1x = newPts[0].x - newPts[1].x;
        const v1y = newPts[0].y - newPts[1].y;
        const v2x = newPts[2].x - newPts[1].x;
        const v2y = newPts[2].y - newPts[1].y;
        const dot = v1x * v2x + v1y * v2y;
        const mag = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) || 1;
        const val = (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;

        onAddMeasurement({
          id: 'm_' + Date.now(),
          type: 'angle',
          plane,
          sliceIndex,
          points: newPts,
          value: val,
        });
        setCurrentPoints([]);
      }
    } else if (activeTool === 'cobb') {
      const coords = screenToSliceCoords(e.clientX, e.clientY);
      if (!coords) return;

      const newPts = [...currentPoints, coords];
      if (newPts.length < 4) {
        setCurrentPoints(newPts);
      } else {
        const a1 = Math.atan2(newPts[1].y - newPts[0].y, newPts[1].x - newPts[0].x);
        const a2 = Math.atan2(newPts[3].y - newPts[2].y, newPts[3].x - newPts[2].x);
        let diff = Math.abs(a1 - a2) * (180 / Math.PI);
        if (diff > 90) diff = 180 - diff;

        onAddMeasurement({
          id: 'm_' + Date.now(),
          type: 'cobb',
          plane,
          sliceIndex,
          points: newPts,
          value: diff,
        });
        setCurrentPoints([]);
      }
    } else if (activeTool === 'roi') {
      const coords = screenToSliceCoords(e.clientX, e.clientY);
      if (!coords) return;
      setCurrentPoints([coords]);
      setDragMode('roi_drag');
    }
  };

  // Mouse Move Router
  const handleMouseMove = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    if (!isDragging) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    if (dragMode === 'scrollbar_drag') {
      handleScrollbarScrub(e.clientY);
      return;
    }

    if (dragMode === 'brush_drag') {
      const voxel = screenToVolumeVoxel(e.clientX, e.clientY);
      if (voxel) {
        onBrushStroke?.(voxel, lastBrushVoxelRef.current);
        lastBrushVoxelRef.current = voxel;
      }
      return;
    }

    if (dragMode === 'lasso_drag') {
      const slicePt = screenToSliceCoords(e.clientX, e.clientY);
      if (slicePt) {
        setLassoPoints((prev) => {
          const last = prev[prev.length - 1];
          if (!last || Math.hypot(slicePt.x - last.x, slicePt.y - last.y) > 2) {
            return [...prev, slicePt];
          }
          return prev;
        });
      }
      return;
    }

    if (dragMode === 'window' || dragMode === 'right_window') {
      onWindowChange(windowCenter + deltaY * 2, Math.max(1, windowWidth + deltaX * 2));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (dragMode === 'pan') {
      setPan((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (dragMode === 'zoom') {
      const factor = 1 - deltaY * 0.01;
      setZoom((z) => Math.max(0.2, Math.min(8.0, z * factor)));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (dragMode === 'crosshair_drag') {
      const coords = screenToSliceCoords(e.clientX, e.clientY);
      if (coords) {
        updateCrosshairFromSliceCoords(coords.x, coords.y);
      }
    }
  };

  // Mouse Up Router
  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);

    const startPos = mouseDownPosRef.current;
    const isCleanClick = startPos && Math.hypot(e.clientX - startPos.x, e.clientY - startPos.y) < 5;

    // Handle Seed Placement on deliberate stationary left click
    if (
      isCleanClick &&
      e.button === 0 &&
      !e.shiftKey &&
      !e.ctrlKey &&
      !e.altKey &&
      isSegmentMode &&
      (activeSegmentTool === 'seed_segment' || activeSegmentTool === 'bone_auto_segment' || isBoneWizardActive) &&
      isSeedPlacementActive &&
      volume
    ) {
      const voxel = screenToVolumeVoxel(e.clientX, e.clientY);
      if (
        voxel &&
        voxel[0] >= 0 && voxel[0] < volume.width &&
        voxel[1] >= 0 && voxel[1] < volume.height &&
        voxel[2] >= 0 && voxel[2] < volume.depth
      ) {
        const hu = volume.getVoxel(voxel[0], voxel[1], voxel[2]);
        // Guard against clicking on air outside anatomical volume (< -600 HU)
        if (hu > -600) {
          onBoneSeedClick?.(voxel, hu);
        }
      }
      setDragMode(null);
      return;
    }

    if (dragMode === 'brush_drag') {
      lastBrushVoxelRef.current = null;
    } else if (dragMode === 'lasso_drag') {
      if (lassoPoints.length >= 3) {
        onLassoErase?.(plane, sliceIndex, lassoPoints, lassoThroughVolume);
      }
      setLassoPoints([]);
    } else if (dragMode === 'dist_drag' && currentPoints.length === 1) {
      const coords = screenToSliceCoords(e.clientX, e.clientY);
      if (coords) {
        const p0 = currentPoints[0];
        const p1 = coords;
        const [dx, dy, dz] = volume?.spacing || [1, 1, 1];
        const sx = (p1.x - p0.x) * (plane === 'sagittal' ? dy : dx);
        const sy = (p1.y - p0.y) * (plane === 'axial' ? dy : dz);
        const val = Math.hypot(sx, sy);

        if (val > 1.0) {
          onAddMeasurement({
            id: 'm_' + Date.now(),
            type: 'length',
            plane,
            sliceIndex,
            points: [p0, p1],
            value: val,
          });
          setCurrentPoints([]);
        }
      }
    } else if (dragMode === 'roi_drag' && currentPoints.length === 1 && volume) {
      const coords = screenToSliceCoords(e.clientX, e.clientY);
      if (coords) {
        const center = currentPoints[0];
        const radiusX = Math.abs(coords.x - center.x);
        const radiusY = Math.abs(coords.y - center.y);

        if (radiusX > 2 && radiusY > 2) {
          const stats = volume.calculateEllipseRoiStats(plane, sliceIndex, center, radiusX, radiusY);
          onAddMeasurement({
            id: 'm_' + Date.now(),
            type: 'roi',
            plane,
            sliceIndex,
            points: [center, coords],
            value: stats.mean,
            stats,
          });
        }
      }
      setCurrentPoints([]);
    }

    setDragMode(null);
  };

  // Physical slice position in mm
  const slicePositionMm = useMemo(() => {
    if (!volume) return '0.00';
    const [dx, dy, dz] = volume.spacing;
    if (plane === 'axial') {
      return (sliceIndex * dz).toFixed(2);
    } else if (plane === 'coronal') {
      return (sliceIndex * dy).toFixed(2);
    } else {
      return (sliceIndex * dx).toFixed(2);
    }
  }, [volume, plane, sliceIndex]);

  // Projected 3D crosshair position on screen
  const crosshairScreenPos = useMemo(() => {
    if (!volume || !planeMetrics) return null;
    const [cx, cy, cz] = crosshairPos;

    let normX = 0;
    let normY = 0;

    if (plane === 'axial') {
      normX = cx / Math.max(1, volume.width - 1);
      normY = cy / Math.max(1, volume.height - 1);
    } else if (plane === 'coronal') {
      normX = cx / Math.max(1, volume.width - 1);
      normY = 1.0 - cz / Math.max(1, volume.depth - 1);
    } else {
      normX = cy / Math.max(1, volume.height - 1);
      normY = 1.0 - cz / Math.max(1, volume.depth - 1);
    }

    return {
      x: planeMetrics.offsetX + normX * planeMetrics.renderW,
      y: planeMetrics.offsetY + normY * planeMetrics.renderH,
    };
  }, [plane, crosshairPos, volume, planeMetrics]);

  // Screen pixel radius for brush visual indicator
  const brushScreenRadius = useMemo(() => {
    if (!volume || !planeMetrics) return 12;
    const [dx, dy] = volume.spacing;
    const refDx = plane === 'sagittal' ? dy : dx;
    const pixelsPerVoxel = planeMetrics.renderW / Math.max(1, plane === 'sagittal' ? volume.height : volume.width);
    const voxels = brushRadiusMm / refDx;
    return Math.max(4, voxels * pixelsPerVoxel);
  }, [volume, planeMetrics, plane, brushRadiusMm]);

  // MEDAM Signature Surgical Palette
  const planeBorderClass =
    plane === 'coronal'
      ? 'border-[#8B5CF6]'
      : plane === 'axial'
        ? 'border-[#06B6D4]'
        : 'border-[#F59E0B]';

  const planeSignatureColor =
    plane === 'coronal' ? '#8B5CF6' : plane === 'axial' ? '#06B6D4' : '#F59E0B';

  const planeTitle =
    plane === 'coronal' ? 'Coronal' : plane === 'axial' ? 'Axial' : 'Sagittal';

  const horizCrosshairColor =
    plane === 'coronal' ? '#06B6D4' : plane === 'axial' ? '#8B5CF6' : '#06B6D4';
  const vertCrosshairColor =
    plane === 'coronal' ? '#F59E0B' : plane === 'axial' ? '#F59E0B' : '#8B5CF6';

  const orientation =
    plane === 'coronal'
      ? { top: 'T', bottom: 'B', left: 'R', right: 'L' }
      : plane === 'axial'
        ? { top: 'A', bottom: 'P', left: 'R', right: 'L' }
        : { top: 'T', bottom: 'B', left: 'A', right: 'P' };

  const scrollThumbRatio = totalSlices > 1 ? sliceIndex / (totalSlices - 1) : 0;

  // Real-time cursor coordinates in slice space
  const cursorSliceCoords = useMemo(() => {
    if (!cursorPos || !containerRef.current) return null;
    return screenToSliceCoords(
      cursorPos.x + containerRef.current.getBoundingClientRect().left,
      cursorPos.y + containerRef.current.getBoundingClientRect().top
    );
  }, [cursorPos, screenToSliceCoords]);

  // Real-time distance preview calculation during length drag
  const liveDistanceMm = useMemo(() => {
    if (currentPoints.length !== 1 || !cursorSliceCoords || !volume) return null;
    const p0 = currentPoints[0];
    const p1 = cursorSliceCoords;
    const [dx, dy, dz] = volume.spacing;
    const sx = (p1.x - p0.x) * (plane === 'sagittal' ? dy : dx);
    const sy = (p1.y - p0.y) * (plane === 'axial' ? dy : dz);
    return Math.hypot(sx, sy);
  }, [currentPoints, cursorSliceCoords, volume, plane]);

  // Real-time ROI stats preview during ROI drag
  const liveRoiStats: RoiStats | null = useMemo(() => {
    if (dragMode !== 'roi_drag' || currentPoints.length !== 1 || !cursorSliceCoords || !volume) return null;
    const center = currentPoints[0];
    const rx = Math.abs(cursorSliceCoords.x - center.x);
    const ry = Math.abs(cursorSliceCoords.y - center.y);
    if (rx < 2 || ry < 2) return null;
    return volume.calculateEllipseRoiStats(plane, sliceIndex, center, rx, ry);
  }, [dragMode, currentPoints, cursorSliceCoords, volume, plane, sliceIndex]);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setCursorPos(null);
        if (isDragging) {
          setIsDragging(false);
          setDragMode(null);
        }
      }}
      onDoubleClick={onToggleMaximize}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative w-full h-full bg-[#000000] overflow-hidden select-none border ${planeBorderClass} font-sans ${
        isSegmentMode
          ? activeSegmentTool === 'brush' || activeSegmentTool === 'region_grow' || activeSegmentTool === 'lasso_erase' || activeSegmentTool === 'seed_segment'
            ? 'cursor-crosshair'
            : 'cursor-default'
          : activeTool === 'crosshair'
            ? 'cursor-crosshair'
            : activeTool === 'window'
              ? 'cursor-ew-resize'
              : activeTool === 'pan'
                ? 'cursor-grab'
                : activeTool === 'zoom'
                  ? 'cursor-ns-resize'
                  : 'cursor-crosshair'
      }`}
    >
      {/* 2D Viewport Canvas with direct pure black buffer rendering */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block pointer-events-none"
        style={{
          transform: `rotate(${rotationDeg}deg) scaleX(${flipH ? -1 : 1}) scaleY(${
            flipV ? -1 : 1
          })`,
          transformOrigin: 'center center',
        }}
      />

      {/* Synchronized Crisp 1px Solid Continuous Crosshairs Overlay */}
      {showCrosshairs && crosshairScreenPos && planeMetrics && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
        >
          {/* Horizontal solid continuous crosshair */}
          <line
            x1={planeMetrics.offsetX}
            y1={crosshairScreenPos.y}
            x2={planeMetrics.offsetX + planeMetrics.renderW}
            y2={crosshairScreenPos.y}
            stroke={horizCrosshairColor}
            strokeWidth={1}
            opacity={0.88}
          />
          {/* Vertical solid continuous crosshair */}
          <line
            x1={crosshairScreenPos.x}
            y1={planeMetrics.offsetY}
            x2={crosshairScreenPos.x}
            y2={planeMetrics.offsetY + planeMetrics.renderH}
            stroke={vertCrosshairColor}
            strokeWidth={1}
            opacity={0.88}
          />
          {/* Center reference ring */}
          <circle
            cx={crosshairScreenPos.x}
            cy={crosshairScreenPos.y}
            r={3}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={1}
            opacity={0.9}
          />
        </svg>
      )}

      {/* Persistent Clinical Measurement Overlays */}
      {planeMetrics && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
        >
          {measurements
            .filter((m) => m.plane === plane && m.sliceIndex === sliceIndex)
            .map((m) => {
              if (m.type === 'length' && m.points.length === 2) {
                const p1 = sliceToScreenCoords(m.points[0]);
                const p2 = sliceToScreenCoords(m.points[1]);
                if (!p1 || !p2) return null;
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;

                return (
                  <g key={m.id}>
                    <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#F59E0B" strokeWidth={1.5} />
                    <circle cx={p1.x} cy={p1.y} r={3} fill="#F59E0B" />
                    <circle cx={p2.x} cy={p2.y} r={3} fill="#F59E0B" />
                    <rect
                      x={midX - 28}
                      y={midY - 14}
                      width={56}
                      height={18}
                      fill="#0F172A"
                      opacity={0.92}
                      rx={3}
                    />
                    <text
                      x={midX}
                      y={midY - 1}
                      fill="#FCD34D"
                      fontSize={11}
                      fontWeight={600}
                      fontFamily="Inter, sans-serif"
                      textAnchor="middle"
                    >
                      {m.value.toFixed(1)} mm
                    </text>
                  </g>
                );
              }

              if (m.type === 'angle' && m.points.length === 3) {
                const p0 = sliceToScreenCoords(m.points[0]);
                const p1 = sliceToScreenCoords(m.points[1]);
                const p2 = sliceToScreenCoords(m.points[2]);
                if (!p0 || !p1 || !p2) return null;

                return (
                  <g key={m.id}>
                    <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="#10B981" strokeWidth={1.5} />
                    <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#10B981" strokeWidth={1.5} />
                    <circle cx={p0.x} cy={p0.y} r={3} fill="#10B981" />
                    <circle cx={p1.x} cy={p1.y} r={3} fill="#10B981" />
                    <circle cx={p2.x} cy={p2.y} r={3} fill="#10B981" />
                    <text
                      x={p1.x + 8}
                      y={p1.y - 8}
                      fill="#34D399"
                      fontSize={11}
                      fontWeight={600}
                      fontFamily="Inter, sans-serif"
                    >
                      {m.value.toFixed(1)}°
                    </text>
                  </g>
                );
              }

              if (m.type === 'cobb' && m.points.length === 4) {
                const p0 = sliceToScreenCoords(m.points[0]);
                const p1 = sliceToScreenCoords(m.points[1]);
                const p2 = sliceToScreenCoords(m.points[2]);
                const p3 = sliceToScreenCoords(m.points[3]);
                if (!p0 || !p1 || !p2 || !p3) return null;

                return (
                  <g key={m.id}>
                    <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="#EC4899" strokeWidth={1.5} />
                    <line x1={p2.x} y1={p2.y} x2={p3.x} y2={p3.y} stroke="#EC4899" strokeWidth={1.5} />
                    <circle cx={p0.x} cy={p0.y} r={3} fill="#EC4899" />
                    <circle cx={p1.x} cy={p1.y} r={3} fill="#EC4899" />
                    <circle cx={p2.x} cy={p2.y} r={3} fill="#EC4899" />
                    <circle cx={p3.x} cy={p3.y} r={3} fill="#EC4899" />
                    <text
                      x={p1.x + 6}
                      y={p1.y - 6}
                      fill="#F472B6"
                      fontSize={11}
                      fontWeight={600}
                      fontFamily="Inter, sans-serif"
                    >
                      Cobb {m.value.toFixed(1)}°
                    </text>
                  </g>
                );
              }

              if (m.type === 'roi' && m.points.length === 2) {
                const pCenter = sliceToScreenCoords(m.points[0]);
                const pEdge = sliceToScreenCoords(m.points[1]);
                if (!pCenter || !pEdge) return null;

                const rx = Math.abs(pEdge.x - pCenter.x);
                const ry = Math.abs(pEdge.y - pCenter.y);

                return (
                  <g key={m.id}>
                    <ellipse
                      cx={pCenter.x}
                      cy={pCenter.y}
                      rx={rx}
                      ry={ry}
                      fill="rgba(56, 189, 248, 0.12)"
                      stroke="#38BDF8"
                      strokeWidth={1.5}
                    />
                    {m.stats && (
                      <g>
                        <rect
                          x={pCenter.x - 55}
                          y={pCenter.y + ry + 4}
                          width={110}
                          height={30}
                          fill="#0F172A"
                          opacity={0.92}
                          rx={3}
                        />
                        <text
                          x={pCenter.x}
                          y={pCenter.y + ry + 16}
                          fill="#38BDF8"
                          fontSize={10}
                          fontWeight={600}
                          fontFamily="Inter, sans-serif"
                          textAnchor="middle"
                        >
                          Mean: {m.stats.mean} ±{m.stats.stdDev} HU
                        </text>
                        <text
                          x={pCenter.x}
                          y={pCenter.y + ry + 27}
                          fill="#94A3B8"
                          fontSize={9}
                          fontWeight={500}
                          fontFamily="Inter, sans-serif"
                          textAnchor="middle"
                        >
                          Area: {m.stats.areaMm2} mm²
                        </text>
                      </g>
                    )}
                  </g>
                );
              }

              return null;
            })}

          {/* Live In-Progress Measurement Previews */}
          {currentPoints.length === 1 && activeTool === 'length' && cursorPos && (
            (() => {
              const p0 = sliceToScreenCoords(currentPoints[0]);
              if (!p0) return null;
              return (
                <g>
                  <line x1={p0.x} y1={p0.y} x2={cursorPos.x} y2={cursorPos.y} stroke="#FCD34D" strokeWidth={1.5} strokeDasharray="3 3" />
                  <circle cx={p0.x} cy={p0.y} r={3} fill="#FCD34D" />
                  <circle cx={cursorPos.x} cy={cursorPos.y} r={3} fill="#FCD34D" />
                  {liveDistanceMm !== null && (
                    <g>
                      <rect
                        x={(p0.x + cursorPos.x) / 2 - 28}
                        y={(p0.y + cursorPos.y) / 2 - 14}
                        width={56}
                        height={18}
                        fill="#0F172A"
                        opacity={0.9}
                        rx={3}
                      />
                      <text
                        x={(p0.x + cursorPos.x) / 2}
                        y={(p0.y + cursorPos.y) / 2 - 1}
                        fill="#FCD34D"
                        fontSize={11}
                        fontWeight={600}
                        textAnchor="middle"
                      >
                        {liveDistanceMm.toFixed(1)} mm
                      </text>
                    </g>
                  )}
                </g>
              );
            })()
          )}

          {/* Live Angle In-Progress Preview */}
          {activeTool === 'angle' && currentPoints.length > 0 && cursorPos && (
            (() => {
              const scPts = currentPoints.map((pt) => sliceToScreenCoords(pt)).filter(Boolean) as { x: number; y: number }[];
              return (
                <g>
                  {scPts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={3} fill="#34D399" />
                  ))}
                  {scPts.length === 1 && (
                    <line x1={scPts[0].x} y1={scPts[0].y} x2={cursorPos.x} y2={cursorPos.y} stroke="#34D399" strokeWidth={1.5} strokeDasharray="3 3" />
                  )}
                  {scPts.length === 2 && (
                    <>
                      <line x1={scPts[0].x} y1={scPts[0].y} x2={scPts[1].x} y2={scPts[1].y} stroke="#10B981" strokeWidth={1.5} />
                      <line x1={scPts[1].x} y1={scPts[1].y} x2={cursorPos.x} y2={cursorPos.y} stroke="#34D399" strokeWidth={1.5} strokeDasharray="3 3" />
                    </>
                  )}
                </g>
              );
            })()
          )}

          {/* Live ROI In-Progress Preview */}
          {activeTool === 'roi' && currentPoints.length === 1 && cursorPos && (
            (() => {
              const pCenter = sliceToScreenCoords(currentPoints[0]);
              if (!pCenter) return null;
              const rx = Math.abs(cursorPos.x - pCenter.x);
              const ry = Math.abs(cursorPos.y - pCenter.y);
              return (
                <g>
                  <ellipse
                    cx={pCenter.x}
                    cy={pCenter.y}
                    rx={rx}
                    ry={ry}
                    fill="rgba(56, 189, 248, 0.15)"
                    stroke="#38BDF8"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                  />
                  {liveRoiStats && (
                    <g>
                      <rect
                        x={pCenter.x - 55}
                        y={pCenter.y + ry + 4}
                        width={110}
                        height={30}
                        fill="#0F172A"
                        opacity={0.92}
                        rx={3}
                      />
                      <text
                        x={pCenter.x}
                        y={pCenter.y + ry + 16}
                        fill="#38BDF8"
                        fontSize={10}
                        fontWeight={600}
                        textAnchor="middle"
                      >
                        Mean: {liveRoiStats.mean} ±{liveRoiStats.stdDev} HU
                      </text>
                      <text
                        x={pCenter.x}
                        y={pCenter.y + ry + 27}
                        fill="#94A3B8"
                        fontSize={9}
                        fontWeight={500}
                        textAnchor="middle"
                      >
                        Area: {liveRoiStats.areaMm2} mm²
                      </text>
                    </g>
                  )}
                </g>
              );
            })()
          )}

          {/* Live Freehand Lasso Polygon Preview */}
          {lassoPoints.length > 1 && (
            (() => {
              const pts = lassoPoints
                .map((pt) => sliceToScreenCoords(pt))
                .filter(Boolean) as { x: number; y: number }[];
              const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
              return (
                <path
                  d={d}
                  fill="rgba(244, 63, 94, 0.15)"
                  stroke="#F43F5E"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                />
              );
            })()
          )}

          {/* Live Bone Auto-Segment Seeds Overlay */}
          {((isBoneWizardActive || isSeedPlacementActive) && boneSeeds.length > 0) && boneSeeds.map((seed, i) => {
            // Check if seed lies on or near current slice
            let onSlice = false;
            let pt: MeasurementPoint = { x: 0, y: 0 };
            if (plane === 'axial' && Math.abs(seed.voxel[2] - sliceIndex) <= 1) {
              onSlice = true;
              pt = { x: seed.voxel[0], y: seed.voxel[1] };
            } else if (plane === 'coronal' && Math.abs(seed.voxel[1] - sliceIndex) <= 1) {
              onSlice = true;
              pt = { x: seed.voxel[0], y: seed.voxel[2] };
            } else if (plane === 'sagittal' && Math.abs(seed.voxel[0] - sliceIndex) <= 1) {
              onSlice = true;
              pt = { x: seed.voxel[1], y: seed.voxel[2] };
            }

            if (!onSlice) return null;
            const sc = sliceToScreenCoords(pt);
            if (!sc) return null;

            const labelText = seed.boneName || `Bone ${i + 1}`;
            const labelWidth = Math.max(38, labelText.length * 6.8 + 10);

            return (
              <g key={seed.id}>
                <circle cx={sc.x} cy={sc.y} r={6} fill={seed.color || '#06B6D4'} stroke="#FFFFFF" strokeWidth={2} />
                <rect
                  x={sc.x + 9}
                  y={sc.y - 9}
                  width={labelWidth}
                  height={18}
                  fill="#0F172A"
                  opacity={0.92}
                  rx={4}
                  stroke="#334155"
                  strokeWidth={0.75}
                />
                <text
                  x={sc.x + 14}
                  y={sc.y + 4}
                  fill="#FFFFFF"
                  fontSize={10}
                  fontWeight={600}
                  fontFamily="Inter, sans-serif"
                >
                  {labelText}
                </text>
              </g>
            );
          })}

          {/* Smart Brush Cursor Footprint Overlay */}
          {isSegmentMode && activeSegmentTool === 'brush' && cursorPos && (
            <circle
              cx={cursorPos.x}
              cy={cursorPos.y}
              r={brushScreenRadius}
              fill={brushMode === 'paint' ? 'rgba(6, 182, 212, 0.22)' : 'rgba(244, 63, 94, 0.22)'}
              stroke={brushMode === 'paint' ? '#06B6D4' : '#F43F5E'}
              strokeWidth={1.5}
            />
          )}
        </svg>
      )}

      {/* MEDAM Diagnostic HUD */}

      {/* 1. Top-Left Corner: Series Description and Plane Name */}
      <div className="absolute top-2.5 left-2.5 text-[11px] leading-tight pointer-events-none select-none z-20">
        <div className="text-slate-300 font-medium truncate max-w-[200px]">
          {volume?.seriesDescription || 'Series'}
        </div>
        <div className="font-semibold" style={{ color: planeSignatureColor }}>
          {planeTitle}
        </div>
      </div>

      {/* 2. Edge Midpoints: Anatomical Orientation Letters */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[11px] font-bold text-slate-300 pointer-events-none select-none z-20">
        {orientation.top}
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] font-bold text-slate-300 pointer-events-none select-none z-20">
        {orientation.bottom}
      </div>
      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-300 pointer-events-none select-none z-20">
        {orientation.left}
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-300 pointer-events-none select-none z-20">
        {orientation.right}
      </div>

      {/* 3. Bottom-Right Corner: Physical Slice Position in mm */}
      <div
        className="absolute bottom-2.5 right-4 text-[11px] font-medium pointer-events-none select-none z-20"
        style={{ color: planeSignatureColor }}
      >
        {slicePositionMm} mm
      </div>

      {/* 4. Right Edge: Sleek 10px-wide Vertical Scrollbar for Direct Slice Scrubbing */}
      <div
        ref={scrollbarTrackRef}
        onMouseDown={(e) => {
          e.stopPropagation();
          setIsDragging(true);
          setDragMode('scrollbar_drag');
          handleScrollbarScrub(e.clientY);
        }}
        className="absolute top-8 bottom-8 right-1 w-[10px] bg-slate-900/60 hover:bg-slate-900/80 rounded-full z-20 cursor-pointer flex flex-col justify-start items-center p-[1px]"
      >
        <div
          className="w-full bg-slate-400 hover:bg-slate-200 rounded-full transition-colors cursor-grab active:cursor-grabbing"
          style={{
            height: '24px',
            transform: `translateY(${
              scrollThumbRatio * Math.max(0, containerSize.height - 64 - 24)
            }px)`,
          }}
        />
      </div>

      {/* 5. Top-Right Corner: Maximize / Restore Toggle */}
      <div className="absolute top-2 right-2 z-30">
        <ToolIconButton
          id={`viewport-max-${plane}`}
          title={isMaximized ? 'Restore Viewport' : `Maximize ${planeTitle}`}
          shortcut={plane === 'coronal' ? '1' : plane === 'axial' ? '2' : '3'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleMaximize();
          }}
          tooltipSide="left"
          className="w-7 h-7 rounded-md bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 shadow-sm"
        >
          {isMaximized ? <IconRestore size={15} /> : <IconMaximize size={15} />}
        </ToolIconButton>
      </div>
    </div>
  );
};
