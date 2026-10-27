export type TrackType = 'Medical' | 'Industrial' | 'Creative';

export type ModuleType =
  | 'Account'
  | 'Datum'
  | 'Rados'
  | 'Design'
  | 'FEA'
  | 'Slicer'
  | 'Print Factory'
  | 'I 5.0';

export type ModalityType = 'ALL' | 'CT' | 'MR' | 'CR' | 'DX';

export interface DicomTagEntry {
  tag: string;
  name: string;
  value: string;
}

export interface SeriesCard {
  series_instance_uid: string;
  series_description: string;
  modality: string;
  num_slices: number;
  is_scout: boolean;
  pixel_spacing: [number, number];
  slice_thickness: number;
  dimensions: [number, number, number];
  patient_name: string;
  patient_id: string;
  raw_tags?: DicomTagEntry[];
}

export interface IngestionResult {
  study_id: string;
  patient_name: string;
  patient_id: string;
  series: SeriesCard[];
}

export interface DicomVolumeHeader {
  series_id: string;
  description: string;
  modality: string;
  dims: [number, number, number]; // width, height, depth
  spacing: [number, number, number]; // dx, dy, dz
  origin: [number, number, number];
  direction: number[];
  window_center: number;
  window_width: number;
  histogram: number[];
}

export interface Volume3DData {
  header: DicomVolumeHeader;
  data: Int16Array;
}

export interface MaskLayer {
  mask_id: string;
  name: string;
  color: string;
  visible: boolean;
  min_hu: number;
  max_hu: number;
  voxel_count: number;
  dims: [number, number, number];
  data?: Uint8Array; // 3D binary buffer
}

export interface MeshObjectItem {
  object_id: string;
  name: string;
  color: string;
  series_id: string;
  visible: boolean;
  opacity: number;
  num_vertices: number;
  num_triangles: number;
  is_watertight: boolean;
  vertices?: Float32Array;
  normals?: Float32Array;
  indices?: Uint32Array;
}

export type CadToolType =
  | 'pan'
  | 'zoom'
  | 'window'
  | 'crosshair'
  | 'distance'
  | 'angle'
  | 'cobb'
  | 'roi'
  | 'slab'
  | 'cine'
  | 'rotate'
  | 'flip_h'
  | 'flip_v'
  | 'invert'
  | 'reset';

export interface SeedPoint {
  id: string;
  name: string;
  voxel: [number, number, number]; // x, y, z
  hu: number;
  type: 'need' | 'not_need';
}

export interface SeedSegmentBone {
  id: string;
  name: string;
  color: string;
  need_seeds: SeedPoint[];
  not_need_seeds: SeedPoint[];
  seed_threshold_hu: number;
  sensitivity: number; // 0..100
  min_hu: number;
  max_hu: number;
}

// ----------------- Datum Registry & EDC Types -----------------

export interface PatientCohort {
  id: string;
  code: string;
  name: string;
  description: string;
  patient_count: number;
  lead_investigator: string;
}

export interface DynamicEDCData {
  ao_ota_classification?: string;
  injury_severity_score?: number;
  scanogram_verified?: boolean;
  implant_type?: string;
  pre_op_notes?: string;
  post_op_rom_degrees?: number;
  surgeon_name?: string;
  follow_up_weeks?: number;
  custom_fields?: Record<string, any>;
}

export interface PatientRecord {
  id: string;
  cr_number: string;
  name: string;
  age: number;
  gender: string;
  cohort_id: string;
  diagnosis: string;
  modalities: string[];
  study_date: string;
  dicom_path?: string;
  edc_data: DynamicEDCData;
  created_at: string;
  updated_at: string;
}

// ----------------- Design Studio Types -----------------

export interface DesignMeshItem {
  mesh_id: string;
  name: string;
  color: string;
  num_vertices: number;
  num_triangles: number;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  metadata?: Record<string, any>;
}
