use std::collections::HashMap;
use parking_lot::RwLock;
use base64::Engine;
use crate::dicom_parser::DicomParser;
use crate::models::{DicomInstanceMeta, SeriesVolumePayload};
use crate::synthetic::SyntheticStudyGenerator;

pub struct VolumeCache {
    pub instances: RwLock<HashMap<String, Vec<DicomInstanceMeta>>>,
    pub cached_volumes: RwLock<HashMap<String, SeriesVolumePayload>>,
}

impl VolumeCache {
    pub fn new() -> Self {
        Self {
            instances: RwLock::new(HashMap::new()),
            cached_volumes: RwLock::new(HashMap::new()),
        }
    }

    pub fn register_instances(&self, instances: Vec<DicomInstanceMeta>) {
        let mut map = self.instances.write();
        for inst in instances {
            map.entry(inst.series_instance_uid.clone()).or_default().push(inst);
        }
        for series in map.values_mut() {
            series.sort_by(|a, b| {
                a.spatial_sort_key
                    .partial_cmp(&b.spatial_sort_key)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
        }
    }

    pub fn get_or_build_volume(&self, series_uid: &str) -> Result<SeriesVolumePayload, String> {
        // Check cache first
        {
            let cache = self.cached_volumes.read();
            if let Some(vol) = cache.get(series_uid) {
                return Ok(vol.clone());
            }
        }

        // If it's a synthetic series UID
        if series_uid.starts_with("1.2.840.113619.2.55.3.1092789123") {
            let vol = SyntheticStudyGenerator::generate_series_volume(series_uid)?;
            let mut cache = self.cached_volumes.write();
            cache.insert(series_uid.to_string(), vol.clone());
            return Ok(vol);
        }

        let instances_map = self.instances.read();
        let slices = instances_map.get(series_uid).ok_or_else(|| {
            format!("Series {} not found in active dataset", series_uid)
        })?;

        if slices.is_empty() {
            return Err("Series contains no slices".to_string());
        }

        let first = &slices[0];
        let width = first.columns;
        let height = first.rows;
        let depth = slices.len() as u32;

        let mut all_voxels = Vec::with_capacity((width * height * depth) as usize);
        let mut min_hu = 10000i16;
        let mut max_hu = -10000i16;

        for slice in slices {
            let slice_voxels = DicomParser::read_instance_pixel_data(slice)?;
            for v in slice_voxels {
                if v < min_hu { min_hu = v; }
                if v > max_hu { max_hu = v; }
                all_voxels.push(v);
            }
        }

        let mut byte_buffer = Vec::with_capacity(all_voxels.len() * 2);
        for v in &all_voxels {
            byte_buffer.extend_from_slice(&v.to_le_bytes());
        }

        let slice_positions = slices.iter().map(|s| s.spatial_sort_key).collect();

        let mut spacing_z = first.slice_thickness;
        if slices.len() > 1 {
            let mut total_dist = 0.0f64;
            let mut count = 0usize;
            for i in 0..slices.len() - 1 {
                let p1 = &slices[i].image_position_patient;
                let p2 = &slices[i + 1].image_position_patient;
                let dist = ((p2[0] - p1[0]).powi(2) + (p2[1] - p1[1]).powi(2) + (p2[2] - p1[2]).powi(2)).sqrt();
                if dist > 0.0001 {
                    total_dist += dist;
                    count += 1;
                }
            }
            if count > 0 {
                spacing_z = total_dist / (count as f64);
            }
        }

        let spacing_x = first.pixel_spacing[1];
        let spacing_y = first.pixel_spacing[0];

        let payload = SeriesVolumePayload {
            series_instance_uid: series_uid.to_string(),
            modality: first.modality.clone(),
            series_description: first.series_description.clone(),
            dimensions: [width, height, depth],
            spacing: [spacing_x, spacing_y, spacing_z],
            window_center: first.window_center,
            window_width: first.window_width,
            min_hu,
            max_hu,
            voxel_buffer_base64: base64::engine::general_purpose::STANDARD.encode(&byte_buffer),
            slice_positions,
        };

        let mut cache = self.cached_volumes.write();
        cache.insert(series_uid.to_string(), payload.clone());

        Ok(payload)
    }
}
