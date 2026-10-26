export interface DicomTagEntry {
  tag: string; // e.g. "(0010,0010)"
  group: string; // e.g. "0010"
  element: string; // e.g. "0010"
  name: string; // e.g. "PatientName"
  vr: string; // e.g. "PN"
  value: string; // e.g. "Doe^John"
}

export interface SeriesCard {
  series_instance_uid: string;
  study_instance_uid: string;
  patient_name?: string;
  patient_id?: string;
  study_description?: string;
  series_date?: string;
  modality: string;
  series_description: string;
  series_number: number;
  slice_count: number;
  rows: number;
  columns: number;
  pixel_spacing: [number, number]; // [row_spacing (dy), col_spacing (dx)] in mm
  slice_thickness: number; // dz in mm
  window_center: number;
  window_width: number;
  thumbnail_data_url: string;
  is_scout?: boolean;
  raw_tags?: DicomTagEntry[];
}

export interface IngestionTelemetry {
  total_files_discovered: number;
  valid_dicom_slices: number;
  skipped_files: number;
  series_count: number;
  study_uid: string;
  patient_name: string;
  patient_id: string;
  slice_spacing_verified: boolean;
  spacing_summary: string;
  log_lines: string[];
}

export interface IngestionResult {
  study_instance_uid: string;
  patient_name?: string;
  patient_id?: string;
  study_description?: string;
  detected_modalities: string[];
  series: SeriesCard[];
  telemetry?: IngestionTelemetry;
}

export interface SeriesVolumePayload {
  series_instance_uid: string;
  modality: string;
  series_description: string;
  dimensions: [number, number, number]; // [cols (x), rows (y), slices (z)]
  spacing: [number, number, number]; // [dx, dy, dz] in mm
  window_center: number;
  window_width: number;
  min_hu: number;
  max_hu: number;
  voxel_buffer_base64: string; // 16-bit signed Hounsfield voxels (i16 little endian)
  raw_voxels?: Int16Array; // Direct zero-copy 16-bit voxel array
  slice_positions: number[];
}

export interface ImportProgress {
  fileName: string;
  processedCount: number;
  totalCount: number;
  percentage: number;
  phase: 'reading' | 'extracting' | 'parsing' | 'building' | 'complete';
  elapsedSeconds: number;
  estimatedRemainingSeconds: number;
}

export type ToolMode =
  | 'crosshair'
  | 'window'
  | 'pan'
  | 'zoom'
  | 'length'
  | 'angle'
  | 'cobb'
  | 'roi';

export type SlabMode = 'none' | 'mip' | 'minip' | 'average';

export type ProjectionPlane = 'axial' | 'coronal' | 'sagittal';

export interface MeasurementPoint {
  x: number;
  y: number;
}

export interface RoiStats {
  mean: number;
  min: number;
  max: number;
  stdDev: number;
  areaMm2: number;
}

export interface Measurement {
  id: string;
  type: 'length' | 'angle' | 'cobb' | 'roi';
  plane: ProjectionPlane;
  sliceIndex: number;
  points: MeasurementPoint[];
  value: number; // mm or degrees
  stats?: RoiStats;
}

export interface WindowPreset {
  id: string;
  name: string;
  center: number;
  width: number;
}

export const CLINICAL_PRESETS: WindowPreset[] = [
  { id: 'bone', name: 'Bone', center: 450, width: 2000 },
  { id: 'soft_tissue', name: 'Soft Tissue', center: 40, width: 350 },
  { id: 'lung', name: 'Lung', center: -600, width: 1500 },
  { id: 'brain', name: 'Brain', center: 40, width: 80 },
  { id: 'abdomen', name: 'Abdomen', center: 50, width: 400 },
  { id: 'angio', name: 'Angio', center: 200, width: 600 },
  { id: 'dynamic', name: 'Full Range', center: 0, width: 4000 },
];

export type SegmentToolMode =
  | 'threshold'
  | 'region_grow'
  | 'brush'
  | 'lasso_erase'
  | 'island'
  | 'morphology'
  | 'bone_auto_segment'
  | 'seed_segment'
  | 'split_mask'
  | 'edit_mask'
  | 'generate_mesh'
  | 'calculate_3d';

export interface TissuePreset {
  id: string;
  name: string;
  minHu: number;
  maxHu: number;
}

export const TISSUE_PRESETS: TissuePreset[] = [
  { id: 'cortical_bone', name: 'Cortical Bone', minHu: 400, maxHu: 3000 },
  { id: 'cancellous_bone', name: 'Cancellous Bone', minHu: 150, maxHu: 400 },
  { id: 'soft_tissue', name: 'Soft Tissue', minHu: -100, maxHu: 100 },
  { id: 'skin_airway', name: 'Skin / Airway', minHu: -1000, maxHu: -200 },
];

export interface SegmentationMask {
  id: string;
  name: string;
  color: string; // e.g. '#06B6D4'
  rgb: [number, number, number];
  opacity: number; // 0 to 1
  visible: boolean;
  minHu: number;
  maxHu: number;
  activePreset?: string;
  voxelMask?: Uint8Array;
  exclusionMask?: Uint8Array; // Black overlay barrier voxels
  selected?: boolean;
}

export type QualityPreset = 'Low' | 'Medium' | 'High' | 'Optimal';

export interface Calculated3DObject {
  id: string;
  name: string;
  sourceMaskIds: string[];
  color: string;
  rgb: [number, number, number];
  opacity: number;
  visible: boolean;
  showContour2D: boolean;
  triangleCount: number;
  qualityPreset: QualityPreset;
  uniquePositions: Float32Array;
  indices: Uint32Array;
  uniqueNormals: Float32Array;
  vertices: Float32Array;
  normals: Float32Array;
}

export type SeedKind = 'need' | 'not_need';

export interface SeedPointEntry {
  id: string;
  name: string;
  kind: SeedKind; // 'need' (green #22C55E) or 'not_need' (red #EF4444)
  voxel: [number, number, number];
  coordsMm: [number, number, number];
  hu: number;
  slicePlane: ProjectionPlane;
  sliceIndex: number;
  boneName?: string;
}

export interface BoneSeedPoint {
  id: string;
  voxel: [number, number, number];
  hu: number;
  color: string;
  boneName?: string;
  kind?: SeedKind;
}

export interface RegionGrowSeedRecord {
  seed: [number, number, number];
  hu: number;
  addedIndices: number[];
}

export type ThemeMode = 'light' | 'dark';

