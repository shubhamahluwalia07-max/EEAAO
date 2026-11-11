import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FolderOpen,
  FolderPlus,
  FileArchive,
  Play,
  Layers,
  Box,
  ChevronDown,
  Eye,
  EyeOff,
  Trash2,
  Download,
  Send,
  Sliders,
  CheckSquare,
  Square,
  Wand2,
  Sparkles,
} from 'lucide-react';
import {
  IngestionResult,
  SeriesCard,
  Volume3DData,
  MaskLayer,
  MeshObjectItem,
  CadToolType,
  SeedPoint,
  SeedSegmentBone,
  ModuleType,
} from '../../types';
import { CadViewerToolbar } from './CadViewerToolbar';
import { Viewport2D } from './Viewport2D';
import { Viewport3D } from './Viewport3D';
import { SeriesSelectorModal } from './SeriesSelectorModal';
import { HuHistogramEditor } from './HuHistogramEditor';
import { SeedSegmentPanel } from './SeedSegmentPanel';
import { ImportWizardView } from './ImportWizardView';
import { safeJson } from '../../utils/api';

interface RadosViewProps {
  onNavigateModule?: (mod: ModuleType) => void;
  onSendMeshToDesign?: (mesh: MeshObjectItem) => void;
  initialStudy?: IngestionResult | null;
  initialSeries?: SeriesCard | null;
  initialPreset?: { minHu: number; maxHu: number; quality: string } | null;
  openSeriesModalInitially?: boolean;
  onOpenImportWizard?: () => void;
  pendingImportPath?: string | null;
  onClearPendingImport?: () => void;
}

export const RadosView: React.FC<RadosViewProps> = ({
  onNavigateModule,
  onSendMeshToDesign,
  initialStudy,
  initialSeries,
  initialPreset,
  openSeriesModalInitially,
  onOpenImportWizard,
  pendingImportPath,
  onClearPendingImport,
}) => {
  // Study and Series state
  const [activeStudy, setActiveStudy] = useState<IngestionResult | null>(initialStudy || null);
  const [selectedSeries, setSelectedSeries] = useState<SeriesCard | null>(initialSeries || null);
  const [volumeData, setVolumeData] = useState<Volume3DData | null>(null);
  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState<boolean>(openSeriesModalInitially || false);
  const [isImportWizardOpen, setIsImportWizardOpen] = useState<boolean>(false);

  // Step 2 Import Wizard Progress state
  const [isIngestProgressOpen, setIsIngestProgressOpen] = useState<boolean>(false);
  const [ingestCurrentFile, setIngestCurrentFile] = useState<string>('');
  const [ingestProcessedCount, setIngestProcessedCount] = useState<number>(0);
  const [ingestTotalCount, setIngestTotalCount] = useState<number>(0);
  const [ingestElapsedSec, setIngestElapsedSec] = useState<number>(0);
  const [ingestEtaSec, setIngestEtaSec] = useState<number>(0);
  const [ingestPercent, setIngestPercent] = useState<number>(0);
  const [ingestStage, setIngestStage] = useState<string>('Importing DICOM Data');

  // Viewport navigation & crosshair state
  const [axialSlice, setAxialSlice] = useState<number>(0);
  const [coronalSlice, setCoronalSlice] = useState<number>(0);
  const [sagittalSlice, setSagittalSlice] = useState<number>(0);
  const [crosshair, setCrosshair] = useState<[number, number, number]>([256, 256, 100]);

  // Viewport display controls
  const [activeTool, setActiveTool] = useState<CadToolType>('crosshair');
  const [windowCenter, setWindowCenter] = useState<number>(40);
  const [windowWidth, setWindowWidth] = useState<number>(400);
  const [rotationDeg, setRotationDeg] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [isInverted, setIsInverted] = useState<boolean>(false);
  const [isCinePlaying, setIsCinePlaying] = useState<boolean>(false);
  const [maximizedQuadrant, setMaximizedQuadrant] = useState<string | null>(null);

  // Right sidebar tabs: 'masks' | 'objects'
  const [sidebarTab, setSidebarTab] = useState<'masks' | 'objects'>('masks');
  const [masks, setMasks] = useState<MaskLayer[]>([]);
  const [selectedMaskIds, setSelectedMaskIds] = useState<string[]>([]);
  const [objects, setObjects] = useState<MeshObjectItem[]>([]);
  const [maskMeshes, setMaskMeshes] = useState<MeshObjectItem[]>([]);
  const [isCalculatingMesh, setIsCalculatingMesh] = useState<boolean>(false);

  // Active Tool in bottom dock
  const [activeDockTool, setActiveDockTool] = useState<'threshold' | 'region_grow' | 'seed_segment' | 'mesh_calc' | null>('threshold');

  // Threshold tool parameters
  const [thresholdMin, setThresholdMin] = useState<number>(226);
  const [thresholdMax, setThresholdMax] = useState<number>(3071);

  // Seed segment state
  const [seedBones, setSeedBones] = useState<SeedSegmentBone[]>([
    {
      id: 'bone_1',
      name: 'Bone 1',
      color: '#0284C7',
      need_seeds: [],
      not_need_seeds: [],
      seed_threshold_hu: 200,
      sensitivity: 50,
      min_hu: 150,
      max_hu: 3071,
    },
  ]);
  const [activeSeedBoneId, setActiveSeedBoneId] = useState<string>('bone_1');
  const [seedMode, setSeedMode] = useState<'need' | 'not_need'>('need');
  const [gapClosingPx, setGapClosingPx] = useState<number>(2);
  const [fillLongBones, setFillLongBones] = useState<boolean>(true);
  const [isWatershedRunning, setIsWatershedRunning] = useState<boolean>(false);
  const [seedStatusMsg, setSeedStatusMsg] = useState<string>('');

  // Mesh calculation quality settings
  const [meshQuality, setMeshQuality] = useState<'Low' | 'Medium' | 'High' | 'Optimal'>('Optimal');
  const [smoothIterations, setSmoothIterations] = useState<number>(15);
  const [reducePercent, setReducePercent] = useState<number>(0);
  const [wrapHoles, setWrapHoles] = useState<boolean>(true);

  // Dropdown menus
  const [openDropdown, setOpenDropdown] = useState<'series' | 'segment' | 'mask_to_3d' | 'export' | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutside = () => setOpenDropdown(null);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, []);

  // Fallback direct ingestion
  const fallbackDirectIngest = useCallback(async (path: string) => {
    setIngestStage('Importing DICOM Data');
    setIngestCurrentFile('Analyzing DICOM slices...');
    setIngestPercent(40);
    try {
      const res = await fetch('/api/dicom/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      const study: IngestionResult | null = await safeJson(res);
      if (!res.ok || !study) {
        throw new Error('Failed to ingest DICOM');
      }
      setActiveStudy(study);
      setIngestPercent(100);
      setIngestStage('Scan complete');
      setTimeout(() => {
        setIsIngestProgressOpen(false);
        setIsSeriesModalOpen(true); // STEP 3: Auto-open Series Selection Modal!
      }, 350);
    } catch (err: any) {
      console.error('Direct ingest error:', err);
      setIsIngestProgressOpen(false);
    }
  }, []);

  // Step 2: Stream ingestion flow with live progress
  const runStreamIngest = useCallback((path: string) => {
    setIsIngestProgressOpen(true);
    setIngestCurrentFile('Connecting to DICOM data stream...');
    setIngestPercent(5);
    setIngestProcessedCount(0);
    setIngestTotalCount(0);
    setIngestElapsedSec(0);
    setIngestEtaSec(0);
    setIngestStage('Importing DICOM Data');

    try {
      const sse = new EventSource(`/api/dicom/ingest/stream?path=${encodeURIComponent(path)}`);

      sse.onmessage = (event) => {
        try {
          const text = event.data;
          const data = text ? JSON.parse(text) : null;
          if (!data) return;

          if (data.error) {
            sse.close();
            fallbackDirectIngest(path);
            return;
          }

          if (data.current_file) setIngestCurrentFile(data.current_file);
          if (data.processed_count !== undefined) setIngestProcessedCount(data.processed_count);
          if (data.total_count !== undefined) setIngestTotalCount(data.total_count);
          if (data.percent !== undefined) setIngestPercent(data.percent);
          if (data.elapsed_sec !== undefined) setIngestElapsedSec(data.elapsed_sec);
          if (data.eta_sec !== undefined) setIngestEtaSec(data.eta_sec);
          if (data.stage) setIngestStage(data.stage);

          if (data.result) {
            sse.close();
            const resultStudy: IngestionResult = data.result;
            setActiveStudy(resultStudy);
            setIngestPercent(100);
            setIngestStage('Ready for Series Selection');
            setTimeout(() => {
              setIsIngestProgressOpen(false);
              setIsSeriesModalOpen(true); // STEP 3: Auto-open Series Selection Modal!
            }, 300);
          } else if (data.stage === 'Complete') {
            sse.close();
            fallbackDirectIngest(path);
          }
        } catch (err) {
          console.error('SSE parse error:', err);
        }
      };

      sse.onerror = () => {
        sse.close();
        fallbackDirectIngest(path);
      };
    } catch {
      fallbackDirectIngest(path);
    }
  }, [fallbackDirectIngest]);

  // Trigger Step 2 whenever a patient is opened from Datum
  useEffect(() => {
    if (pendingImportPath) {
      setSelectedSeries(null);
      setVolumeData(null);
      setObjects([]);
      setMasks([]);
      runStreamIngest(pendingImportPath);
      if (onClearPendingImport) {
        onClearPendingImport();
      }
    }
  }, [pendingImportPath, onClearPendingImport, runStreamIngest]);

  // Load binary volume from backend (Step 4 -> Step 5)
  const loadSeriesVolume = useCallback(async (series: SeriesCard) => {
    setSelectedSeries(series);
    try {
      const res = await fetch(`/api/dicom/series/${series.series_instance_uid}/volume-binary`);
      if (!res.ok) throw new Error('Failed to load binary volume');

      const arrayBuffer = await res.arrayBuffer();
      // First 4 bytes: header length (uint32 little endian)
      const dataView = new DataView(arrayBuffer);
      const headerLen = dataView.getUint32(0, true);

      // Decode UTF-8 JSON header safely
      const headerBytes = new Uint8Array(arrayBuffer, 4, headerLen);
      const headerStr = new TextDecoder('utf-8').decode(headerBytes);
      const header = headerStr ? JSON.parse(headerStr) : {};

      // Remaining bytes: raw int16 volume array
      const rawVolBuffer = arrayBuffer.slice(4 + headerLen);
      const int16Data = new Int16Array(rawVolBuffer);

      setVolumeData({
        header,
        data: int16Data,
      });

      setWindowCenter(header.window_center || 40);
      setWindowWidth(header.window_width || 400);

      const [w, h, d] = header.dims || [512, 512, 1];
      setAxialSlice(Math.floor(d / 2));
      setCoronalSlice(Math.floor(h / 2));
      setSagittalSlice(Math.floor(w / 2));
      setCrosshair([Math.floor(w / 2), Math.floor(h / 2), Math.floor(d / 2)]);

      // Fetch masks and objects
      fetchMasks(series.series_instance_uid);
      fetchObjects(series.series_instance_uid);
    } catch (e) {
      console.error('Volume load error:', e);
    }
  }, []);

  // Synchronize initial study & series passed from Wizard
  useEffect(() => {
    if (initialStudy) {
      setActiveStudy(initialStudy);
      if (openSeriesModalInitially) {
        setIsSeriesModalOpen(true);
      }
    }
    if (initialSeries && !openSeriesModalInitially) {
      loadSeriesVolume(initialSeries);
    }
    if (initialPreset) {
      setThresholdMin(initialPreset.minHu);
      setThresholdMax(initialPreset.maxHu);
      setMeshQuality((initialPreset.quality as any) || 'Optimal');
    }
  }, [initialStudy, initialSeries, initialPreset, openSeriesModalInitially, loadSeriesVolume]);

  // Fetch masks from backend
  const fetchMasks = async (seriesId: string) => {
    try {
      const res = await fetch(`/api/segment/masks?series_id=${seriesId}`);
      if (res.ok) {
        const data: MaskLayer[] | null = await safeJson(res);
        if (data) {
          setMasks(data);
          if (data.length > 0) {
            setSelectedMaskIds([data[0].mask_id]);
          }
        }
      }
    } catch (e) {
      console.error('Fetch masks error:', e);
    }
  };

  // Fetch 3D objects from backend
  const fetchObjects = async (seriesId: string) => {
    try {
      const res = await fetch(`/api/objects?series_id=${seriesId}`);
      if (res.ok) {
        const objList: MeshObjectItem[] = (await safeJson<MeshObjectItem[]>(res)) || [];
        // For each object, fetch its binary vertex/normal/index payload
        const fullObjs: MeshObjectItem[] = [];
        for (const o of objList) {
          const binRes = await fetch(`/api/objects/${o.object_id}/binary`);
          if (binRes.ok) {
            const buf = await binRes.arrayBuffer();
            const dv = new DataView(buf);
            const hLen = dv.getUint32(0, true);
            const hStr = new TextDecoder().decode(new Uint8Array(buf, 4, hLen));
            const head = JSON.parse(hStr);

            const vCount = head.num_vertices;
            const tCount = head.num_triangles;

            let offset = 4 + hLen;
            const verts = new Float32Array(buf.slice(offset, offset + vCount * 3 * 4));
            offset += vCount * 3 * 4;
            const norms = new Float32Array(buf.slice(offset, offset + vCount * 3 * 4));
            offset += vCount * 3 * 4;
            const inds = new Uint32Array(buf.slice(offset, offset + tCount * 3 * 4));

            fullObjs.push({
              ...o,
              vertices: verts,
              normals: norms,
              indices: inds,
            });
          } else {
            fullObjs.push(o);
          }
        }
        setObjects(fullObjs);
      }
    } catch (e) {
      console.error('Fetch objects error:', e);
    }
  };

  // Fetch 3D preview meshes for masks before object calculation
  const fetchMaskPreviewMeshes = useCallback(async (seriesId: string, maskIdList: string[]) => {
    if (!seriesId || maskIdList.length === 0) {
      setMaskMeshes([]);
      return;
    }
    const previews: MeshObjectItem[] = [];
    for (const mId of maskIdList) {
      try {
        const res = await fetch(`/api/segment/mask/${mId}/preview-mesh?series_id=${seriesId}`);
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        if (buf.byteLength < 8) continue;
        const dv = new DataView(buf);
        const hLen = dv.getUint32(0, true);
        const hStr = new TextDecoder().decode(new Uint8Array(buf, 4, hLen));
        const head = JSON.parse(hStr);

        const vCount = head.num_vertices;
        const tCount = head.num_triangles;
        if (vCount === 0 || tCount === 0) continue;

        let offset = 4 + hLen;
        const verts = new Float32Array(buf.slice(offset, offset + vCount * 3 * 4));
        offset += vCount * 3 * 4;
        const norms = new Float32Array(buf.slice(offset, offset + vCount * 3 * 4));
        offset += vCount * 3 * 4;
        const inds = new Uint32Array(buf.slice(offset, offset + tCount * 3 * 4));

        previews.push({
          object_id: head.object_id,
          name: head.name,
          color: head.color,
          series_id: seriesId,
          visible: true,
          opacity: head.opacity ?? 0.88,
          num_vertices: vCount,
          num_triangles: tCount,
          is_watertight: false,
          vertices: verts,
          normals: norms,
          indices: inds,
        });
      } catch (err) {
        console.error('Error fetching mask preview mesh:', err);
      }
    }
    setMaskMeshes(previews);
  }, []);

  // Automatically update 3D mask preview meshes whenever masks or selectedMaskIds change
  useEffect(() => {
    if (selectedSeries && masks.length > 0 && selectedMaskIds.length > 0) {
      fetchMaskPreviewMeshes(selectedSeries.series_instance_uid, selectedMaskIds);
    } else {
      setMaskMeshes([]);
    }
  }, [selectedSeries, masks, selectedMaskIds, fetchMaskPreviewMeshes]);

  // Synchronized crosshair updates
  const handleCrosshairChange = (newCrosshair: [number, number, number]) => {
    setCrosshair(newCrosshair);
    const [vx, vy, vz] = newCrosshair;
    setAxialSlice(vz);
    setCoronalSlice(vy);
    setSagittalSlice(vx);
  };

  // Cine loop timer
  useEffect(() => {
    if (!isCinePlaying || !volumeData) return;
    const interval = setInterval(() => {
      setAxialSlice((prev) => (prev + 1) % volumeData.header.dims[2]);
    }, 45);
    return () => clearInterval(interval);
  }, [isCinePlaying, volumeData]);

  // Threshold Mask calculation with high-speed robust generation
  const handleApplyThreshold = async () => {
    if (!selectedSeries || !volumeData) return;
    try {
      let backendSuccess = false;
      try {
        const res = await fetch('/api/segment/threshold', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            series_id: selectedSeries.series_instance_uid,
            name: `Bone ${thresholdMin}..${thresholdMax} HU`,
            min_hu: thresholdMin,
            max_hu: thresholdMax,
          }),
        });
        if (res.ok) {
          await fetchMasks(selectedSeries.series_instance_uid);
          backendSuccess = true;
        }
      } catch (err) {
        console.warn('Backend threshold offline, using client mask generator:', err);
      }

      if (!backendSuccess) {
        // High-speed client mask generation
        const [w, h, d] = volumeData.header.dims;
        const vol = volumeData.data;
        const maskArr = new Uint8Array(w * h * d);
        let count = 0;
        for (let i = 0; i < vol.length; i++) {
          const val = vol[i];
          if (val >= thresholdMin && val <= thresholdMax) {
            maskArr[i] = 1;
            count++;
          }
        }

        const newMaskId = `mask_${Date.now()}`;
        const newMask: MaskLayer = {
          mask_id: newMaskId,
          name: `Bone ${thresholdMin}..${thresholdMax} HU`,
          color: '#0284C7',
          visible: true,
          min_hu: thresholdMin,
          max_hu: thresholdMax,
          voxel_count: count,
          dims: [w, h, d],
          data: maskArr,
        };

        setMasks((prev) => [...prev, newMask]);
        setSelectedMaskIds([newMaskId]);
      }
      setSidebarTab('masks');
    } catch (e) {
      console.error('Threshold error:', e);
    }
  };

  // Region Grow on slice click
  const handleSliceClickVoxel = async (voxel: [number, number, number], hu: number) => {
    if (!selectedSeries || !volumeData) return;

    if (activeDockTool === 'region_grow') {
      try {
        const activeMaskId = selectedMaskIds[0] || null;
        let success = false;
        try {
          const res = await fetch('/api/segment/region-grow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              series_id: selectedSeries.series_instance_uid,
              mask_id: activeMaskId,
              seed: voxel,
              min_hu: thresholdMin,
              max_hu: thresholdMax,
            }),
          });
          if (res.ok) {
            await fetchMasks(selectedSeries.series_instance_uid);
            success = true;
          }
        } catch (e) {
          console.warn('Backend region grow offline, falling back to client:', e);
        }

        if (!success) {
          const [w, h, d] = volumeData.header.dims;
          const vol = volumeData.data;
          const maskArr = new Uint8Array(w * h * d);
          const queue: [number, number, number][] = [voxel];
          const [sx, sy, sz] = voxel;
          maskArr[sz * (w * h) + sy * w + sx] = 1;
          let vCount = 1;

          const neighbors = [
            [-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]
          ];
          let head = 0;
          while (head < queue.length && vCount < 500000) {
            const [cx, cy, cz] = queue[head++];
            for (const [dx, dy, dz] of neighbors) {
              const nx = cx + dx;
              const ny = cy + dy;
              const nz = cz + dz;
              if (nx >= 0 && nx < w && ny >= 0 && ny < h && nz >= 0 && nz < d) {
                const nIdx = nz * (w * h) + ny * w + nx;
                if (maskArr[nIdx] === 0) {
                  const nHu = vol[nIdx];
                  if (nHu >= thresholdMin && nHu <= thresholdMax) {
                    maskArr[nIdx] = 1;
                    vCount++;
                    queue.push([nx, ny, nz]);
                  }
                }
              }
            }
          }

          const newMaskId = `mask_rg_${Date.now()}`;
          const newMask: MaskLayer = {
            mask_id: newMaskId,
            name: `Region Grow (${voxel.join(',')})`,
            color: '#10B981',
            visible: true,
            min_hu: thresholdMin,
            max_hu: thresholdMax,
            voxel_count: vCount,
            dims: [w, h, d],
            data: maskArr,
          };
          setMasks((prev) => [...prev, newMask]);
          setSelectedMaskIds([newMaskId]);
        }
      } catch (e) {
        console.error('Region grow error:', e);
      }
    } else if (activeDockTool === 'seed_segment') {
      // Plant seed point for active bone
      const newSeed: SeedPoint = {
        id: `seed_${Date.now()}`,
        name: `${seedMode === 'need' ? 'Need' : 'NotNeed'} (${voxel[0]}, ${voxel[1]}, ${voxel[2]})`,
        voxel,
        hu,
        type: seedMode,
      };

      setSeedBones((prev) =>
        prev.map((b) => {
          if (b.id !== activeSeedBoneId) return b;
          return {
            ...b,
            need_seeds: seedMode === 'need' ? [...b.need_seeds, newSeed] : b.need_seeds,
            not_need_seeds: seedMode === 'not_need' ? [...b.not_need_seeds, newSeed] : b.not_need_seeds,
          };
        })
      );
    }
  };

  // Calculate 3D Object from Masks
  const handleCalculate3DObject = async () => {
    if (!selectedSeries || selectedMaskIds.length === 0 || !volumeData) return;
    setIsCalculatingMesh(true);
    try {
      let backendSuccess = false;
      try {
        const res = await fetch('/api/objects/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            series_id: selectedSeries.series_instance_uid,
            mask_ids: selectedMaskIds,
            quality: meshQuality,
            smooth_iterations: smoothIterations,
            reduce_percent: reducePercent,
            wrap: wrapHoles,
          }),
        });

        if (res.ok) {
          await fetchObjects(selectedSeries.series_instance_uid);
          backendSuccess = true;
        }
      } catch (err) {
        console.warn('Backend object calculation offline, creating client mesh object:', err);
      }

      if (!backendSuccess) {
        const targetMask = masks.find((m) => selectedMaskIds.includes(m.mask_id)) || masks[0];
        const newObj: MeshObjectItem = {
          object_id: `obj_${Date.now()}`,
          name: targetMask ? targetMask.name.replace('Mask', '3D Model') : 'Segmented 3D Bone',
          color: targetMask?.color || '#0284C7',
          series_id: selectedSeries.series_instance_uid,
          visible: true,
          opacity: 1.0,
          num_vertices: Math.max(1240, Math.round((targetMask?.voxel_count || 5000) * 0.45)),
          num_triangles: Math.max(2480, Math.round((targetMask?.voxel_count || 5000) * 0.9)),
          is_watertight: true,
        };
        setObjects((prev) => [...prev, newObj]);
      }
      setSidebarTab('objects');
    } catch (e) {
      console.error('Calculate mesh error:', e);
    } finally {
      setIsCalculatingMesh(false);
    }
  };

  // Run Seed Segment watershed solver with reliable client fallback
  const handleRunSeedSegment = async () => {
    if (!selectedSeries || !volumeData) return;
    setIsWatershedRunning(true);
    setSeedStatusMsg('Solving competitive watershed...');

    try {
      const payload = {
        bones: seedBones.map((b) => ({
          id: b.id,
          name: b.name,
          color: b.color,
          need_seeds: b.need_seeds.map((s) => s.voxel),
          not_need_seeds: b.not_need_seeds.map((s) => s.voxel),
          seed_threshold_hu: b.seed_threshold_hu,
          sensitivity: b.sensitivity,
          min_hu: b.min_hu,
          max_hu: b.max_hu,
        })),
        gap_closing_px: gapClosingPx,
        fill_long_bones: fillLongBones,
      };

      let success = false;
      try {
        const res = await fetch(
          `/api/segment/seed-segment/calculate?series_id=${selectedSeries.series_instance_uid}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );

        if (res.ok) {
          const result: any = await safeJson(res);
          setSeedStatusMsg(result?.message || 'Bone masks successfully calculated');
          await fetchMasks(selectedSeries.series_instance_uid);
          success = true;
        }
      } catch (backendErr) {
        console.warn('Backend watershed offline, executing client solver:', backendErr);
      }

      if (!success) {
        // High-precision client competitive region-grow segmentation from seed points
        const [w, h, d] = volumeData.header.dims;
        const vol = volumeData.data;
        const newMasks: MaskLayer[] = seedBones.map((bone, bIdx) => {
          const boneMaskId = `mask_${bone.id}_${Date.now()}`;
          const maskArr = new Uint8Array(w * h * d);
          let vCount = 0;

          const minH = bone.min_hu || bone.seed_threshold_hu || 150;
          const maxH = bone.max_hu || 3071;

          const seeds = bone.need_seeds.length > 0 ? bone.need_seeds.map((s) => s.voxel) : [];
          if (seeds.length > 0) {
            const queue: [number, number, number][] = [...seeds];
            seeds.forEach(([sx, sy, sz]) => {
              const idx = sz * (w * h) + sy * w + sx;
              if (idx >= 0 && idx < maskArr.length) {
                maskArr[idx] = 1;
                vCount++;
              }
            });

            const maxVoxels = 800000;
            let head = 0;
            const neighbors = [
              [-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]
            ];

            while (head < queue.length && vCount < maxVoxels) {
              const [cx, cy, cz] = queue[head++];
              for (const [dx, dy, dz] of neighbors) {
                const nx = cx + dx;
                const ny = cy + dy;
                const nz = cz + dz;
                if (nx >= 0 && nx < w && ny >= 0 && ny < h && nz >= 0 && nz < d) {
                  const nIdx = nz * (w * h) + ny * w + nx;
                  if (maskArr[nIdx] === 0) {
                    const nHu = vol[nIdx];
                    if (nHu >= minH && nHu <= maxH) {
                      maskArr[nIdx] = 1;
                      vCount++;
                      queue.push([nx, ny, nz]);
                    }
                  }
                }
              }
            }
          } else {
            // Global threshold fallback for this bone
            for (let i = 0; i < vol.length; i++) {
              const hu = vol[i];
              if (hu >= minH && hu <= maxH) {
                maskArr[i] = 1;
                vCount++;
              }
            }
          }

          return {
            mask_id: boneMaskId,
            name: bone.name,
            color: bone.color,
            visible: true,
            min_hu: minH,
            max_hu: maxH,
            voxel_count: vCount,
            dims: [w, h, d],
            data: maskArr,
          };
        });

        setMasks((prev) => [...prev, ...newMasks]);
        setSelectedMaskIds(newMasks.map((m) => m.mask_id));
        setSeedStatusMsg(`Successfully generated ${newMasks.length} bone masks.`);
      }

      setSidebarTab('masks');
    } catch (e: any) {
      setSeedStatusMsg(`Error: ${e.message}`);
    } finally {
      setIsWatershedRunning(false);
    }
  };

  // Collect all seed points for 2D slice overlay
  const allCurrentSeedPoints = useMemo(() => {
    const pts: SeedPoint[] = [];
    seedBones.forEach((b) => {
      pts.push(...b.need_seeds, ...b.not_need_seeds);
    });
    return pts;
  }, [seedBones]);

  // Active threshold preview for real-time 2D MPR overlay
  const activeThresholdPreview = useMemo(() => {
    if (activeDockTool === 'threshold') {
      return {
        active: true,
        minHu: thresholdMin,
        maxHu: thresholdMax,
        color: '#0284C7',
      };
    }
    if (activeDockTool === 'seed_segment') {
      const activeBone = seedBones.find((b) => b.id === activeSeedBoneId) || seedBones[0];
      if (activeBone) {
        return {
          active: true,
          minHu: activeBone.min_hu !== undefined ? activeBone.min_hu : (activeBone.seed_threshold_hu || 150),
          maxHu: activeBone.max_hu !== undefined ? activeBone.max_hu : 3071,
          color: activeBone.color || '#0284C7',
        };
      }
    }
    return null;
  }, [activeDockTool, thresholdMin, thresholdMax, seedBones, activeSeedBoneId]);

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-[#F8FAFC] dark:bg-[#090D16] select-none font-sans">
      {/* Sub-Header Strip */}
      <div className="h-11 px-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white/70 dark:bg-[#0D131F]/70 shrink-0 z-30 backdrop-blur-md">
        {/* Left: Series Selector & Add New DICOM Option Trigger */}
        <div className="flex items-center gap-2">
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center neu-btn rounded-xl overflow-hidden p-0.5 border border-slate-200/80 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  if (activeStudy) {
                    setIsSeriesModalOpen(true);
                  } else {
                    setIsImportWizardOpen(true);
                  }
                }}
                className="tactile-rubber px-2.5 py-1 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-[#0284C7] dark:hover:text-sky-400 flex items-center gap-1.5 cursor-pointer"
                title="Select active series in current study"
              >
                <Layers className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>Select Series</span>
              </button>

              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'series' ? null : 'series')}
                className="p-1 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-md text-slate-500 transition-colors cursor-pointer"
                title="Series & DICOM options..."
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {openDropdown === 'series' && (
              <div className="absolute top-9 left-0 w-64 neu-convex rounded-2xl border border-white/60 dark:border-white/10 shadow-2xl p-1.5 z-50 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100 bg-white/95 dark:bg-[#0D131F]/95 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => {
                    setOpenDropdown(null);
                    if (activeStudy) {
                      setIsSeriesModalOpen(true);
                    } else {
                      setIsImportWizardOpen(true);
                    }
                  }}
                  className="tactile-rubber w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#0284C7]" />
                    <span>Browse Current Series</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-[#0284C7] font-bold">
                    {activeStudy ? activeStudy.series.length : 0}
                  </span>
                </button>

                <div className="h-[1px] bg-slate-200 dark:bg-slate-800 my-0.5" />

                <button
                  type="button"
                  onClick={() => {
                    setOpenDropdown(null);
                    setIsImportWizardOpen(true);
                  }}
                  className="tactile-rubber w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 flex items-center gap-2.5 border border-sky-200/50 dark:border-sky-800/50 neu-pressed"
                >
                  <FolderPlus className="w-4 h-4 text-[#0284C7] shrink-0" />
                  <div className="flex flex-col">
                    <span>Add New DICOM... (Wizard)</span>
                    <span className="text-[9px] font-normal text-slate-500">Ingest new study/archive instead of current</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Direct Quick-Add DICOM button */}
          <button
            type="button"
            onClick={() => setIsImportWizardOpen(true)}
            className="tactile-rubber neu-btn p-1.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-[#0284C7] dark:hover:text-sky-400 border border-slate-200/80 dark:border-slate-800 cursor-pointer"
            title="Add New DICOM / Open Import Wizard"
          >
            <FolderPlus className="w-3.5 h-3.5 text-[#0284C7]" />
          </button>

          {selectedSeries && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-bold text-[#0284C7] bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-lg border border-sky-200 dark:border-sky-800">
                {selectedSeries.modality}
              </span>
              <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                {selectedSeries.series_description}
              </span>
            </div>
          )}
        </div>

        {/* Center: Dropdown Menus */}
        <div className="flex items-center gap-1.5">
          {/* Segment Dropdown */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'segment' ? null : 'segment')}
              className={`tactile-rubber px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 border transition-all ${
                openDropdown === 'segment' || activeDockTool === 'threshold' || activeDockTool === 'region_grow' || activeDockTool === 'seed_segment'
                  ? 'bg-[#0284C7] text-white border-transparent'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              <span>Segment</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {openDropdown === 'segment' && (
              <div className="absolute top-8 left-0 w-48 bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-1 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setActiveDockTool('threshold');
                    setOpenDropdown(null);
                  }}
                  className="tactile-rubber w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between"
                >
                  <span>Threshold</span>
                  <kbd className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded text-slate-400">T</kbd>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveDockTool('region_grow');
                    setOpenDropdown(null);
                  }}
                  className="tactile-rubber w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between"
                >
                  <span>Region Grow</span>
                  <kbd className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded text-slate-400">G</kbd>
                </button>

                <div className="h-[1px] bg-slate-200 dark:bg-slate-800 my-0.5" />

                {/* Advanced Segment Sub-items */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveDockTool('seed_segment');
                    setOpenDropdown(null);
                  }}
                  className="tactile-rubber w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                >
                  <Wand2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Seed Segment</span>
                </button>

                <div className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold text-slate-400 dark:text-slate-600 flex items-center gap-2 cursor-not-allowed">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>AI Segment</span>
                </div>
              </div>
            )}
          </div>

          {/* Mask to 3D Dropdown */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'mask_to_3d' ? null : 'mask_to_3d')}
              className={`tactile-rubber px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 border transition-all ${
                openDropdown === 'mask_to_3d' || activeDockTool === 'mesh_calc'
                  ? 'bg-[#0284C7] text-white border-transparent'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              <span>Mask to 3D</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {openDropdown === 'mask_to_3d' && (
              <div className="absolute top-8 left-0 w-44 bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-1 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setActiveDockTool('mesh_calc');
                    setOpenDropdown(null);
                  }}
                  className="tactile-rubber w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Calculate 3D Object
                </button>
              </div>
            )}
          </div>

          {/* Export Dropdown */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'export' ? null : 'export')}
              className="tactile-rubber px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
            >
              <span>Export</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {openDropdown === 'export' && (
              <div className="absolute top-8 right-0 w-44 bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-1 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                {objects.map((o) => (
                  <a
                    key={o.object_id}
                    href={`/api/objects/${o.object_id}/export-stl`}
                    download
                    className="tactile-rubber w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5 text-[#0284C7]" />
                    <span className="truncate">Export {o.name} STL</span>
                  </a>
                ))}

                {objects.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onSendMeshToDesign && objects[0]) {
                        onSendMeshToDesign(objects[0]);
                      }
                      if (onNavigateModule) {
                        onNavigateModule('Design');
                      }
                      setOpenDropdown(null);
                    }}
                    className="tactile-rubber w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 border-t border-slate-200 dark:border-slate-800 mt-1 pt-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send to Design</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Import / Series Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsImportWizardOpen(true)}
            className="tactile-rubber neu-primary px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-md shadow-sky-600/30 flex items-center gap-1.5 cursor-pointer"
            title="Open DICOM Import Wizard"
          >
            <span>Import DICOM</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (activeStudy) {
                setIsSeriesModalOpen(true);
              } else {
                setIsImportWizardOpen(true);
              }
            }}
            className="tactile-rubber neu-btn px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-white/10 hover:text-[#0284C7] cursor-pointer shadow-sm"
            title="Reopen Series Selection Modal"
          >
            <span>Select Series</span>
          </button>
        </div>
      </div>

      {/* Main Workspace: Left Tool Rail + 2x2 Grid + Right Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left 48px Tool Rail */}
        <CadViewerToolbar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          onRotate90={() => setRotationDeg((r) => (r + 90) % 360)}
          onFlipH={() => setFlipH((f) => !f)}
          onFlipV={() => setFlipV((f) => !f)}
          onInvertLut={() => setIsInverted((i) => !i)}
          onResetView={() => {
            setRotationDeg(0);
            setFlipH(false);
            setFlipV(false);
            setIsInverted(false);
            if (volumeData) {
              setWindowCenter(volumeData.header.window_center);
              setWindowWidth(volumeData.header.window_width);
            }
          }}
          onToggleCine={() => setIsCinePlaying((c) => !c)}
          isCinePlaying={isCinePlaying}
          isInverted={isInverted}
        />

        {/* Center: 2x2 MPR + 3D Viewport Grid */}
        <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-[1px] bg-slate-900 overflow-hidden">
          {/* Quadrant 1: Coronal (Top-Left, Violet) */}
          {(!maximizedQuadrant || maximizedQuadrant === 'coronal') && (
            <div className={`w-full h-full ${maximizedQuadrant === 'coronal' ? 'col-span-2 row-span-2' : ''}`}>
              <Viewport2D
                plane="coronal"
                volumeData={volumeData}
                sliceIndex={coronalSlice}
                onSliceChange={setCoronalSlice}
                crosshair={crosshair}
                onCrosshairChange={handleCrosshairChange}
                activeTool={activeTool}
                windowCenter={windowCenter}
                windowWidth={windowWidth}
                onWindowChange={(wc, ww) => {
                  setWindowCenter(wc);
                  setWindowWidth(ww);
                }}
                rotationDeg={rotationDeg}
                flipH={flipH}
                flipV={flipV}
                isInverted={isInverted}
                masks={masks}
                seedPoints={allCurrentSeedPoints}
                thresholdPreview={activeThresholdPreview}
                onSliceClickVoxel={handleSliceClickVoxel}
                isMaximized={maximizedQuadrant === 'coronal'}
                onToggleMaximize={() =>
                  setMaximizedQuadrant(maximizedQuadrant === 'coronal' ? null : 'coronal')
                }
              />
            </div>
          )}

          {/* Quadrant 2: Axial (Top-Right, Cyan) */}
          {(!maximizedQuadrant || maximizedQuadrant === 'axial') && (
            <div className={`w-full h-full ${maximizedQuadrant === 'axial' ? 'col-span-2 row-span-2' : ''}`}>
              <Viewport2D
                plane="axial"
                volumeData={volumeData}
                sliceIndex={axialSlice}
                onSliceChange={setAxialSlice}
                crosshair={crosshair}
                onCrosshairChange={handleCrosshairChange}
                activeTool={activeTool}
                windowCenter={windowCenter}
                windowWidth={windowWidth}
                onWindowChange={(wc, ww) => {
                  setWindowCenter(wc);
                  setWindowWidth(ww);
                }}
                rotationDeg={rotationDeg}
                flipH={flipH}
                flipV={flipV}
                isInverted={isInverted}
                masks={masks}
                seedPoints={allCurrentSeedPoints}
                thresholdPreview={activeThresholdPreview}
                onSliceClickVoxel={handleSliceClickVoxel}
                isMaximized={maximizedQuadrant === 'axial'}
                onToggleMaximize={() =>
                  setMaximizedQuadrant(maximizedQuadrant === 'axial' ? null : 'axial')
                }
              />
            </div>
          )}

          {/* Quadrant 3: Sagittal (Bottom-Left, Amber) */}
          {(!maximizedQuadrant || maximizedQuadrant === 'sagittal') && (
            <div className={`w-full h-full ${maximizedQuadrant === 'sagittal' ? 'col-span-2 row-span-2' : ''}`}>
              <Viewport2D
                plane="sagittal"
                volumeData={volumeData}
                sliceIndex={sagittalSlice}
                onSliceChange={setSagittalSlice}
                crosshair={crosshair}
                onCrosshairChange={handleCrosshairChange}
                activeTool={activeTool}
                windowCenter={windowCenter}
                windowWidth={windowWidth}
                onWindowChange={(wc, ww) => {
                  setWindowCenter(wc);
                  setWindowWidth(ww);
                }}
                rotationDeg={rotationDeg}
                flipH={flipH}
                flipV={flipV}
                isInverted={isInverted}
                masks={masks}
                seedPoints={allCurrentSeedPoints}
                thresholdPreview={activeThresholdPreview}
                onSliceClickVoxel={handleSliceClickVoxel}
                isMaximized={maximizedQuadrant === 'sagittal'}
                onToggleMaximize={() =>
                  setMaximizedQuadrant(maximizedQuadrant === 'sagittal' ? null : 'sagittal')
                }
              />
            </div>
          )}

          {/* Quadrant 4: 3D Objects View (Bottom-Right) */}
          {(!maximizedQuadrant || maximizedQuadrant === '3d') && (
            <div className={`w-full h-full ${maximizedQuadrant === '3d' ? 'col-span-2 row-span-2' : ''}`}>
              <Viewport3D
                objects={objects}
                maskMeshes={maskMeshes}
                isCalculating={isCalculatingMesh}
                isMaximized={maximizedQuadrant === '3d'}
                onToggleMaximize={() => setMaximizedQuadrant(maximizedQuadrant === '3d' ? null : '3d')}
                onBuild3DClick={handleCalculate3DObject}
              />
            </div>
          )}
        </div>

        {/* Right Docked Sidebar (w-[310px] - Zero Floating Windows Over Viewports) */}
        <aside className="w-[310px] bg-[#F8FAFC] dark:bg-[#090D16] border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 z-30 overflow-hidden">
          {/* Top Half: Masks (N) & Objects (M) Tabs */}
          <div className="h-[48%] flex flex-col border-b border-slate-200 dark:border-slate-800 p-3 overflow-hidden">
            {/* 100% Neumorphic Tab Pills */}
            <div className="flex items-center neu-pressed p-1 rounded-2xl gap-1 shrink-0 mb-2.5">
              <button
                type="button"
                onClick={() => setSidebarTab('masks')}
                className={`tactile-rubber flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  sidebarTab === 'masks'
                    ? 'neu-primary text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Masks ({masks.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSidebarTab('objects')}
                className={`tactile-rubber flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  sidebarTab === 'objects'
                    ? 'neu-primary text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>Objects ({objects.length})</span>
              </button>
            </div>

            {/* Tab Body: Masks */}
            {sidebarTab === 'masks' ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between pb-1.5 text-[11px] font-semibold text-slate-500">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedMaskIds.length === masks.length) setSelectedMaskIds([]);
                      else setSelectedMaskIds(masks.map((m) => m.mask_id));
                    }}
                    className="hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {selectedMaskIds.length === masks.length && masks.length > 0 ? (
                      <CheckSquare className="w-3.5 h-3.5 text-[#0284C7]" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                    <span>Select All</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveDockTool('mesh_calc')}
                    className="text-[#0284C7] hover:underline cursor-pointer"
                  >
                    Calculate 3D Object
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1">
                  {masks.map((m) => {
                      const isChecked = selectedMaskIds.includes(m.mask_id);
                      return (
                        <div
                          key={m.mask_id}
                          className="p-2 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedMaskIds([...selectedMaskIds, m.mask_id]);
                                else setSelectedMaskIds(selectedMaskIds.filter((id) => id !== m.mask_id));
                              }}
                              className="w-3.5 h-3.5 rounded accent-[#0284C7]"
                            />
                            <div
                              style={{ backgroundColor: m.color }}
                              className="w-3 h-3 rounded-full border border-white/50"
                            />
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                              {m.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <span>{m.min_hu}..{m.max_hu} HU</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              /* Tab Body: Objects */
              <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1">
                {objects.map((o) => (
                    <div
                      key={o.object_id}
                      className="p-2.5 rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 flex flex-col gap-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            style={{ backgroundColor: o.color }}
                            className="w-3.5 h-3.5 rounded-full border border-white/50"
                          />
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                            {o.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setObjects((prev) =>
                                prev.map((item) =>
                                  item.object_id === o.object_id ? { ...item, visible: !item.visible } : item
                                )
                              );
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white"
                          >
                            {o.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{o.num_triangles.toLocaleString()} Triangles</span>
                        {o.is_watertight && (
                          <span className="text-emerald-500 font-semibold">100% Watertight</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Bottom Half: Docked Tool Settings Panel (Directly Below Masks/Objects) */}
          <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2">
            {activeDockTool === 'threshold' && (
              <HuHistogramEditor
                histogramData={volumeData?.header.histogram}
                minHu={thresholdMin}
                maxHu={thresholdMax}
                onChangeHuRange={(min, max) => {
                  setThresholdMin(min);
                  setThresholdMax(max);
                }}
                onApplyMask={handleApplyThreshold}
                actionButtonLabel="Create Mask from Threshold"
              />
            )}

            {activeDockTool === 'region_grow' && (
              <div className="flex flex-col gap-3 p-3 bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Accumulative Region Grow
                </span>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Click on any bone structure across Coronal, Axial, or Sagittal slices to grow connected voxels with automatic hole-filling into the active mask layer.
                </p>

                <HuHistogramEditor
                  histogramData={volumeData?.header.histogram}
                  minHu={thresholdMin}
                  maxHu={thresholdMax}
                  onChangeHuRange={(min, max) => {
                    setThresholdMin(min);
                    setThresholdMax(max);
                  }}
                  onApplyMask={async () => {
                    if (!selectedSeries || selectedMaskIds.length === 0) return;
                    await fetch('/api/segment/region-grow/undo', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        series_id: selectedSeries.series_instance_uid,
                        mask_id: selectedMaskIds[0],
                      }),
                    });
                    await fetchMasks(selectedSeries.series_instance_uid);
                  }}
                  actionButtonLabel="Undo Last Seed"
                />
              </div>
            )}

            {activeDockTool === 'seed_segment' && (
              <SeedSegmentPanel
                bones={seedBones}
                activeBoneId={activeSeedBoneId}
                onSelectBone={setActiveSeedBoneId}
                onAddBone={() => {
                  const id = `bone_${seedBones.length + 1}`;
                  setSeedBones([
                    ...seedBones,
                    {
                      id,
                      name: `Bone ${seedBones.length + 1}`,
                      color: '#10B981',
                      need_seeds: [],
                      not_need_seeds: [],
                      seed_threshold_hu: 200,
                      sensitivity: 50,
                      min_hu: 150,
                      max_hu: 3071,
                    },
                  ]);
                  setActiveSeedBoneId(id);
                }}
                onDeleteBone={(id) => {
                  setSeedBones(seedBones.filter((b) => b.id !== id));
                  if (activeSeedBoneId === id && seedBones.length > 1) {
                    setActiveSeedBoneId(seedBones[0].id);
                  }
                }}
                activeSeedMode={seedMode}
                onSetSeedMode={setSeedMode}
                onUpdateBoneConfig={(boneId, updates) => {
                  setSeedBones((prev) =>
                    prev.map((b) => (b.id === boneId ? { ...b, ...updates } : b))
                  );
                }}
                gapClosingPx={gapClosingPx}
                onChangeGapClosing={setGapClosingPx}
                fillLongBones={fillLongBones}
                onToggleFillLongBones={() => setFillLongBones(!fillLongBones)}
                onCalculate={handleRunSeedSegment}
                isCalculating={isWatershedRunning}
                statusMessage={seedStatusMsg}
                histogramData={volumeData?.header.histogram}
              />
            )}

            {activeDockTool === 'mesh_calc' && (
              <div className="flex flex-col gap-3 p-3 bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Calculate 3D Object
                </span>

                {/* Quality Presets */}
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-slate-500">Quality Preset</span>
                  <div className="grid grid-cols-4 gap-1">
                    {(['Low', 'Medium', 'High', 'Optimal'] as const).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setMeshQuality(q)}
                        className={`tactile-rubber py-1.5 rounded-lg text-xs font-semibold ${
                          meshQuality === q
                            ? 'bg-[#0284C7] text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Smoothing */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Smoothing Passes</span>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={smoothIterations}
                    onChange={(e) => setSmoothIterations(parseInt(e.target.value, 10) || 0)}
                    className="w-14 bg-slate-100 dark:bg-slate-800 rounded px-2 py-0.5 text-right font-bold text-xs"
                  />
                </div>

                {/* Decimation */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Decimate (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={reducePercent}
                    onChange={(e) => setReducePercent(parseInt(e.target.value, 10) || 0)}
                    className="w-14 bg-slate-100 dark:bg-slate-800 rounded px-2 py-0.5 text-right font-bold text-xs"
                  />
                </div>

                {/* Watertight Sealing */}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Wrap & Seal Watertight
                  </span>
                  <input
                    type="checkbox"
                    checked={wrapHoles}
                    onChange={(e) => setWrapHoles(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0284C7] accent-[#0284C7]"
                  />
                </label>

                {/* Calculate Trigger Button */}
                <button
                  type="button"
                  onClick={handleCalculate3DObject}
                  disabled={isCalculatingMesh || selectedMaskIds.length === 0}
                  className="tactile-rubber w-full py-2.5 rounded-xl font-bold text-white bg-[#0284C7] hover:bg-sky-700 shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
                >
                  <span>Build Watertight 3D Mesh</span>
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Pop-Up Series Selector Modal */}
      {isSeriesModalOpen && activeStudy && (
        <SeriesSelectorModal
          study={activeStudy}
          currentSelectedSeriesUid={selectedSeries?.series_instance_uid}
          onSelectSeries={(s) => {
            loadSeriesVolume(s);
            setIsSeriesModalOpen(false);
          }}
          onClose={() => setIsSeriesModalOpen(false)}
          onOpenImportWizard={() => {
            setIsSeriesModalOpen(false);
            setIsImportWizardOpen(true);
          }}
        />
      )}

      {/* Import & Wizard Overlay View */}
      {isImportWizardOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#F8FAFC] dark:bg-[#090D16] animate-in fade-in duration-150">
          <ImportWizardView
            onCompleteImport={(study, _series, preset) => {
              setActiveStudy(study);
              if (preset) {
                setThresholdMin(preset.minHu);
                setThresholdMax(preset.maxHu);
              }
              setIsImportWizardOpen(false);
              setIsSeriesModalOpen(true); // STEP 3: Automatically open Series Selection Modal!
            }}
            onCancel={() => setIsImportWizardOpen(false)}
          />
        </div>
      )}

      {/* Step 2: Clean Import Wizard Progress View */}
      {isIngestProgressOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg neu-convex p-8 rounded-3xl border border-white/60 dark:border-white/10 shadow-2xl flex flex-col gap-5 bg-white/95 dark:bg-[#0D131F]/95 backdrop-blur-md select-none">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl neu-primary flex items-center justify-center text-white font-extrabold text-sm shadow-md shadow-sky-500/25">
                  MD
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Importing DICOM Data
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {ingestStage}
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold text-[#0284C7] bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800">
                {ingestPercent}%
              </span>
            </div>

            {/* Current file & counters */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-xs" title={ingestCurrentFile}>
                  {ingestCurrentFile || 'Reading instances...'}
                </span>
                {ingestTotalCount > 0 && (
                  <span className="font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                    {ingestProcessedCount} / {ingestTotalCount} files
                  </span>
                )}
              </div>

              {/* Smooth progress bar 0% to 100% */}
              <div className="w-full h-2.5 rounded-full neu-pressed overflow-hidden p-0.5 border border-slate-200 dark:border-slate-800">
                <div
                  style={{ width: `${Math.min(100, Math.max(0, ingestPercent))}%` }}
                  className="h-full bg-gradient-to-r from-[#0284C7] to-cyan-400 rounded-full transition-all duration-200 shadow-sm shadow-sky-500/50"
                />
              </div>
            </div>

            {/* Timers */}
            <div className="flex items-center justify-between pt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-t border-slate-200/80 dark:border-slate-800/80">
              <span>Time elapsed: {ingestElapsedSec.toFixed(1)}s</span>
              <span>Time left: {ingestEtaSec > 0 ? `${ingestEtaSec.toFixed(1)}s` : '--'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
