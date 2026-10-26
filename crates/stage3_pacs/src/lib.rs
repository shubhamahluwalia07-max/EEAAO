pub mod models;
pub mod dicom_parser;
pub mod volume_builder;
pub mod synthetic;
pub mod mesh_export;

use std::sync::OnceLock;
use base64::Engine;
use crate::models::{IngestionResult, SeriesVolumePayload};
use crate::volume_builder::VolumeCache;
use crate::synthetic::SyntheticStudyGenerator;
use crate::dicom_parser::DicomParser;

static GLOBAL_VOLUME_CACHE: OnceLock<VolumeCache> = OnceLock::new();

pub fn get_cache() -> &'static VolumeCache {
    GLOBAL_VOLUME_CACHE.get_or_init(VolumeCache::new)
}

pub fn scan_directory(path: &str) -> Result<IngestionResult, String> {
    let result = DicomParser::scan_directory(path)?;
    Ok(result)
}

pub fn scan_zip(path: &str) -> Result<IngestionResult, String> {
    let result = DicomParser::scan_zip(path)?;
    Ok(result)
}

pub fn load_demo_study() -> Result<IngestionResult, String> {
    Ok(SyntheticStudyGenerator::generate_demo_study())
}

pub fn get_series_volume(series_uid: &str) -> Result<SeriesVolumePayload, String> {
    get_cache().get_or_build_volume(series_uid)
}

pub fn export_volume_stl(series_uid: &str, iso_threshold: i16) -> Result<Vec<u8>, String> {
    let volume = get_series_volume(series_uid)?;
    let raw_bytes = base64::engine::general_purpose::STANDARD
        .decode(&volume.voxel_buffer_base64)
        .map_err(|e| e.to_string())?;

    let voxel_count = (volume.dimensions[0] * volume.dimensions[1] * volume.dimensions[2]) as usize;
    let mut voxels = Vec::with_capacity(voxel_count);
    for chunk in raw_bytes.chunks_exact(2) {
        voxels.push(i16::from_le_bytes([chunk[0], chunk[1]]));
    }

    Ok(mesh_export::generate_volume_stl(
        &voxels,
        volume.dimensions[0],
        volume.dimensions[1],
        volume.dimensions[2],
        volume.spacing,
        iso_threshold,
    ))
}

pub const BENCHMARK_DATASET_ZIP: &str = r"C:\Users\ShubhamAhluwalia\Downloads\Compressed\KAMLESH 202603583814.zip";

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct BenchmarkDiagnosticReport {
    pub dataset_path: String,
    pub total_series: usize,
    pub modalities: Vec<String>,
    pub primary_series_uid: String,
    pub slice_count: usize,
    pub spacing_verified: bool,
    pub volume_dimensions: [u32; 3],
    pub success: bool,
}

pub fn run_benchmark_test_dataset() -> Result<BenchmarkDiagnosticReport, String> {
    if !std::path::Path::new(BENCHMARK_DATASET_ZIP).exists() {
        return Err(format!("Benchmark dataset not found at {}", BENCHMARK_DATASET_ZIP));
    }
    let study = scan_zip(BENCHMARK_DATASET_ZIP)?;
    if study.series.is_empty() {
        return Err("No series separated from benchmark dataset".to_string());
    }

    // Pick series with maximum slice count as primary diagnostic volume
    let primary = study.series.iter().max_by_key(|s| s.slice_count).unwrap_or(&study.series[0]);
    let vol = get_series_volume(&primary.series_instance_uid)?;

    Ok(BenchmarkDiagnosticReport {
        dataset_path: BENCHMARK_DATASET_ZIP.to_string(),
        total_series: study.series.len(),
        modalities: study.detected_modalities,
        primary_series_uid: primary.series_instance_uid.clone(),
        slice_count: primary.slice_count,
        spacing_verified: vol.spacing[0] > 0.0 && vol.spacing[1] > 0.0 && vol.spacing[2] > 0.0,
        volume_dimensions: vol.dimensions,
        success: true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_demo_study_generation() {
        let study = load_demo_study().expect("Failed to load demo study");
        assert_eq!(study.series.len(), 3);
        assert!(study.detected_modalities.contains(&"CT".to_string()));
        assert!(study.detected_modalities.contains(&"MR".to_string()));
        assert!(study.detected_modalities.contains(&"DX".to_string()));
    }

    #[test]
    fn test_volume_payload_generation() {
        let study = load_demo_study().expect("Failed to load demo study");
        let ct_uid = &study.series[0].series_instance_uid;
        let volume = get_series_volume(ct_uid).expect("Failed to get volume");
        assert_eq!(volume.dimensions[0], 256);
        assert_eq!(volume.dimensions[1], 256);
        assert_eq!(volume.dimensions[2], 64);
        assert!(!volume.voxel_buffer_base64.is_empty());
        assert_eq!(volume.slice_positions.len(), 64);
    }

    #[test]
    fn test_volume_stl_export() {
        let study = load_demo_study().expect("Failed to load demo study");
        let ct_uid = &study.series[0].series_instance_uid;
        let stl_bytes = export_volume_stl(ct_uid, 300).expect("Failed to export STL");
        assert!(stl_bytes.len() > 84);
        let header = String::from_utf8_lossy(&stl_bytes[..40]);
        assert!(header.contains("MEDAM"));
    }

    #[test]
    fn test_benchmark_dataset_ingestion() {
        if std::path::Path::new(BENCHMARK_DATASET_ZIP).exists() {
            let report = run_benchmark_test_dataset().expect("Failed to ingest benchmark dataset");
            assert!(report.total_series > 0);
            assert!(report.slice_count > 0);
            assert!(report.success);
        }
    }
}
