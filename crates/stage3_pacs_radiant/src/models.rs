use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileSource {
    LocalFile(String),
    ZipEntry {
        archive_path: String,
        entry_index: usize,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DicomInstanceMeta {
    pub study_instance_uid: String,
    pub series_instance_uid: String,
    pub sop_instance_uid: String,
    pub modality: String,
    pub series_description: String,
    pub series_number: i32,
    pub instance_number: i32,
    pub rows: u32,
    pub columns: u32,
    pub bits_allocated: u16,
    pub pixel_representation: u16,
    pub rescale_slope: f64,
    pub rescale_intercept: f64,
    pub window_center: f64,
    pub window_width: f64,
    pub pixel_spacing: [f64; 2], // [row_spacing, col_spacing] (dy, dx)
    pub slice_thickness: f64,    // dz
    pub image_position_patient: [f64; 3], // [x, y, z]
    pub image_orientation_patient: [f64; 6], // [rx, ry, rz, cx, cy, cz]
    pub spatial_sort_key: f64,   // dot product of position and slice normal
    pub file_source: FileSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeriesCard {
    pub series_instance_uid: String,
    pub study_instance_uid: String,
    pub modality: String,
    pub series_description: String,
    pub series_number: i32,
    pub slice_count: usize,
    pub rows: u32,
    pub columns: u32,
    pub pixel_spacing: [f64; 2],
    pub slice_thickness: f64,
    pub window_center: f64,
    pub window_width: f64,
    pub thumbnail_data_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestionResult {
    pub study_instance_uid: String,
    pub detected_modalities: Vec<String>,
    pub series: Vec<SeriesCard>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeriesVolumePayload {
    pub series_instance_uid: String,
    pub modality: String,
    pub series_description: String,
    pub dimensions: [u32; 3], // [width (cols), height (rows), depth (slices)]
    pub spacing: [f64; 3],    // [dx, dy, dz]
    pub window_center: f64,
    pub window_width: f64,
    pub min_hu: i16,
    pub max_hu: i16,
    pub voxel_buffer_base64: String, // 16-bit signed Hounsfield unit voxels in little-endian
    pub slice_positions: Vec<f64>,
}
