use std::fs::File;
use std::io::{Cursor, Read};
use std::path::Path;
use dicom::core::Tag;
use dicom::object::{DefaultDicomObject, open_file, from_reader};
use image::{ImageBuffer, Luma, codecs::png::PngEncoder};
use base64::Engine;
use rayon::prelude::*;
use walkdir::WalkDir;

use crate::models::{DicomInstanceMeta, FileSource, IngestionResult, SeriesCard};

pub struct DicomParser;

impl DicomParser {
    pub fn parse_object_meta(obj: &DefaultDicomObject, source: FileSource) -> Option<DicomInstanceMeta> {
        let study_instance_uid = Self::get_str(obj, 0x0020, 0x000D).unwrap_or_else(|| "1.2.840.10008.1".to_string());
        let series_instance_uid = Self::get_str(obj, 0x0020, 0x000E)?;
        let sop_instance_uid = Self::get_str(obj, 0x0008, 0x0018).unwrap_or_else(|| uuid_like());
        let modality = Self::get_str(obj, 0x0008, 0x0060).unwrap_or_else(|| "OT".to_string()).to_uppercase();
        let series_description = Self::get_str(obj, 0x0008, 0x103E).unwrap_or_else(|| format!("{} Series", modality));
        let series_number = Self::get_i32(obj, 0x0020, 0x0011).unwrap_or(1);
        let instance_number = Self::get_i32(obj, 0x0020, 0x0013).unwrap_or(1);

        let rows = Self::get_u32(obj, 0x0028, 0x0010).unwrap_or(512);
        let columns = Self::get_u32(obj, 0x0028, 0x0011).unwrap_or(512);
        let bits_allocated = Self::get_u16(obj, 0x0028, 0x0100).unwrap_or(16);
        let pixel_representation = Self::get_u16(obj, 0x0028, 0x0103).unwrap_or(0);

        let rescale_slope = Self::get_f64(obj, 0x0028, 0x1053).unwrap_or(1.0);
        let rescale_intercept = Self::get_f64(obj, 0x0028, 0x1052).unwrap_or(0.0);

        let window_center = Self::get_f64(obj, 0x0028, 0x1050).unwrap_or(40.0);
        let window_width = Self::get_f64(obj, 0x0028, 0x1051).unwrap_or(400.0);

        let pixel_spacing = Self::get_f64_pair(obj, 0x0028, 0x0030).unwrap_or([1.0, 1.0]);
        let slice_thickness = Self::get_f64(obj, 0x0018, 0x0050).unwrap_or(1.0);

        let image_position_patient = Self::get_f64_triplet(obj, 0x0020, 0x0032).unwrap_or([0.0, 0.0, instance_number as f64 * slice_thickness]);
        let image_orientation_patient = Self::get_f64_sextet(obj, 0x0020, 0x0037).unwrap_or([1.0, 0.0, 0.0, 0.0, 1.0, 0.0]);

        // Calculate spatial sort key: projection along slice normal
        let rx = image_orientation_patient[0];
        let ry = image_orientation_patient[1];
        let rz = image_orientation_patient[2];
        let cx = image_orientation_patient[3];
        let cy = image_orientation_patient[4];
        let cz = image_orientation_patient[5];

        let mut nx = ry * cz - rz * cy;
        let mut ny = rz * cx - rx * cz;
        let mut nz = rx * cy - ry * cx;
        let norm = (nx * nx + ny * ny + nz * nz).sqrt();
        if norm > 1e-6 {
            nx /= norm;
            ny /= norm;
            nz /= norm;
        } else {
            nx = 0.0;
            ny = 0.0;
            nz = 1.0;
        }

        let px = image_position_patient[0];
        let py = image_position_patient[1];
        let pz = image_position_patient[2];

        let spatial_sort_key = px * nx + py * ny + pz * nz;

        Some(DicomInstanceMeta {
            study_instance_uid,
            series_instance_uid,
            sop_instance_uid,
            modality,
            series_description,
            series_number,
            instance_number,
            rows,
            columns,
            bits_allocated,
            pixel_representation,
            rescale_slope,
            rescale_intercept,
            window_center,
            window_width,
            pixel_spacing,
            slice_thickness,
            image_position_patient,
            image_orientation_patient,
            spatial_sort_key,
            file_source: source,
        })
    }

    pub fn scan_directory<P: AsRef<Path>>(dir_path: P) -> Result<IngestionResult, String> {
        let dir = dir_path.as_ref();
        if !dir.exists() {
            return Err(format!("Directory does not exist: {}", dir.display()));
        }

        let paths: Vec<std::path::PathBuf> = WalkDir::new(dir)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .map(|e| e.into_path())
            .collect();

        let instances: Vec<DicomInstanceMeta> = paths
            .par_iter()
            .filter_map(|path| {
                if let Ok(obj) = open_file(path) {
                    Self::parse_object_meta(&obj, FileSource::LocalFile(path.to_string_lossy().to_string()))
                } else {
                    None
                }
            })
            .collect();

        if instances.is_empty() {
            return Err("No valid DICOM instances found in directory".to_string());
        }

        Self::organize_instances(instances)
    }

    pub fn scan_zip<P: AsRef<Path>>(zip_path: P) -> Result<IngestionResult, String> {
        let path = zip_path.as_ref();
        let file = File::open(path).map_err(|e| format!("Failed to open zip file: {}", e))?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Invalid zip archive: {}", e))?;

        let entry_count = archive.len();
        let mut entries_bytes = Vec::new();

        for i in 0..entry_count {
            if let Ok(mut entry) = archive.by_index(i) {
                if !entry.is_dir() {
                    let mut buf = Vec::new();
                    if entry.read_to_end(&mut buf).is_ok() && buf.len() > 132 {
                        entries_bytes.push((i, buf));
                    }
                }
            }
        }

        let zip_path_str = path.to_string_lossy().to_string();
        let instances: Vec<DicomInstanceMeta> = entries_bytes
            .par_iter()
            .filter_map(|(idx, bytes)| {
                if let Ok(obj) = from_reader(Cursor::new(bytes)) {
                    Self::parse_object_meta(&obj, FileSource::ZipEntry {
                        archive_path: zip_path_str.clone(),
                        entry_index: *idx,
                    })
                } else {
                    None
                }
            })
            .collect();

        if instances.is_empty() {
            return Err("No valid DICOM instances found in ZIP archive".to_string());
        }

        Self::organize_instances(instances)
    }

    pub fn organize_instances(mut instances: Vec<DicomInstanceMeta>) -> Result<IngestionResult, String> {
        if instances.is_empty() {
            return Err("Empty instances list".to_string());
        }

        let study_instance_uid = instances[0].study_instance_uid.clone();

        // Group by series_instance_uid
        let mut series_map: std::collections::HashMap<String, Vec<DicomInstanceMeta>> = std::collections::HashMap::new();
        for inst in instances.drain(..) {
            series_map.entry(inst.series_instance_uid.clone()).or_default().push(inst);
        }

        let mut modalities_set = std::collections::BTreeSet::new();
        let mut series_cards = Vec::new();

        for (series_uid, mut series_instances) in series_map {
            // Sort spatially along normal vector projection
            series_instances.sort_by(|a, b| {
                a.spatial_sort_key
                    .partial_cmp(&b.spatial_sort_key)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });

            let first = &series_instances[0];
            modalities_set.insert(first.modality.clone());

            let mid_idx = series_instances.len() / 2;
            let mid_instance = &series_instances[mid_idx];
            let thumbnail_data_url = Self::generate_thumbnail(mid_instance);

            series_cards.push(SeriesCard {
                series_instance_uid: series_uid,
                study_instance_uid: first.study_instance_uid.clone(),
                modality: first.modality.clone(),
                series_description: first.series_description.clone(),
                series_number: first.series_number,
                slice_count: series_instances.len(),
                rows: first.rows,
                columns: first.columns,
                pixel_spacing: first.pixel_spacing,
                slice_thickness: first.slice_thickness,
                window_center: first.window_center,
                window_width: first.window_width,
                thumbnail_data_url,
            });
        }

        // Sort series cards by series number
        series_cards.sort_by_key(|c| c.series_number);

        let mut detected_modalities = vec!["ALL".to_string()];
        detected_modalities.extend(modalities_set.into_iter());

        Ok(IngestionResult {
            study_instance_uid,
            detected_modalities,
            series: series_cards,
        })
    }

    pub fn read_instance_pixel_data(instance: &DicomInstanceMeta) -> Result<Vec<i16>, String> {
        let obj = match &instance.file_source {
            FileSource::LocalFile(path) => {
                open_file(path).map_err(|e| format!("Failed to open slice file: {}", e))?
            }
            FileSource::ZipEntry { archive_path, entry_index } => {
                let file = File::open(archive_path).map_err(|e| format!("Failed to open zip: {}", e))?;
                let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Zip error: {}", e))?;
                let mut entry = archive.by_index(*entry_index).map_err(|e| format!("Entry error: {}", e))?;
                let mut buf = Vec::new();
                entry.read_to_end(&mut buf).map_err(|e| format!("Read error: {}", e))?;
                from_reader(Cursor::new(buf)).map_err(|e| format!("DICOM reader error: {}", e))?
            }
        };

        let pixel_elem = obj.element(Tag(0x7FE0, 0x0010)).map_err(|e| format!("Pixel element error: {}", e))?;
        let data = pixel_elem.to_bytes().map_err(|e| format!("Pixel bytes error: {}", e))?;
        let width = instance.columns as usize;
        let height = instance.rows as usize;
        let total_pixels = width * height;

        let slope = instance.rescale_slope;
        let intercept = instance.rescale_intercept;

        let mut hu_voxels = Vec::with_capacity(total_pixels);

        if instance.bits_allocated == 16 {
            if instance.pixel_representation == 1 {
                // Signed 16-bit
                for i in 0..total_pixels {
                    let byte_idx = i * 2;
                    let val = if byte_idx + 1 < data.len() {
                        i16::from_le_bytes([data[byte_idx], data[byte_idx + 1]])
                    } else {
                        0
                    };
                    let hu = (val as f64 * slope + intercept).round().clamp(-32768.0, 32767.0) as i16;
                    hu_voxels.push(hu);
                }
            } else {
                // Unsigned 16-bit
                for i in 0..total_pixels {
                    let byte_idx = i * 2;
                    let val = if byte_idx + 1 < data.len() {
                        u16::from_le_bytes([data[byte_idx], data[byte_idx + 1]])
                    } else {
                        0
                    };
                    let hu = (val as f64 * slope + intercept).round().clamp(-32768.0, 32767.0) as i16;
                    hu_voxels.push(hu);
                }
            }
        } else {
            // 8-bit fallback
            for i in 0..total_pixels {
                let val = if i < data.len() { data[i] } else { 0 };
                let hu = (val as f64 * slope + intercept).round().clamp(-32768.0, 32767.0) as i16;
                hu_voxels.push(hu);
            }
        }

        Ok(hu_voxels)
    }

    fn generate_thumbnail(instance: &DicomInstanceMeta) -> String {
        let width = instance.columns;
        let height = instance.rows;
        let wc = instance.window_center;
        let ww = if instance.window_width <= 0.0 { 400.0 } else { instance.window_width };
        let low = wc - ww / 2.0;
        let high = wc + ww / 2.0;

        if let Ok(hu_voxels) = Self::read_instance_pixel_data(instance) {
            let mut img: ImageBuffer<Luma<u8>, Vec<u8>> = ImageBuffer::new(width, height);
            for (i, voxel) in hu_voxels.iter().enumerate() {
                let x = (i as u32) % width;
                let y = (i as u32) / width;
                if x < width && y < height {
                    let v = *voxel as f64;
                    let norm = if v <= low {
                        0.0
                    } else if v >= high {
                        255.0
                    } else {
                        ((v - low) / (high - low) * 255.0).clamp(0.0, 255.0)
                    };
                    img.put_pixel(x, y, Luma([norm as u8]));
                }
            }

            // Downsample thumbnail to max 128x128 for crisp fast rendering
            let thumbnail = image::imageops::resize(&img, 128, 128, image::imageops::FilterType::Triangle);
            let mut png_bytes = Vec::new();
            let encoder = PngEncoder::new(&mut png_bytes);
            if image::ImageEncoder::write_image(
                encoder,
                thumbnail.as_raw(),
                128,
                128,
                image::ExtendedColorType::L8,
            ).is_ok() {
                let b64 = base64::engine::general_purpose::STANDARD.encode(&png_bytes);
                return format!("data:image/png;base64,{}", b64);
            }
        }

        // Geometric fallback thumbnail
        let mut img: ImageBuffer<Luma<u8>, Vec<u8>> = ImageBuffer::new(128, 128);
        for y in 0..128 {
            for x in 0..128 {
                let dx = (x as f64 - 64.0) / 40.0;
                let dy = (y as f64 - 64.0) / 40.0;
                let r2 = dx * dx + dy * dy;
                let val = if r2 < 1.0 { 180 } else { 20 };
                img.put_pixel(x, y, Luma([val]));
            }
        }
        let mut png_bytes = Vec::new();
        let encoder = PngEncoder::new(&mut png_bytes);
        let _ = image::ImageEncoder::write_image(
            encoder,
            img.as_raw(),
            128,
            128,
            image::ExtendedColorType::L8,
        );
        let b64 = base64::engine::general_purpose::STANDARD.encode(&png_bytes);
        format!("data:image/png;base64,{}", b64)
    }

    fn get_str(obj: &DefaultDicomObject, group: u16, element: u16) -> Option<String> {
        obj.element(Tag(group, element)).ok()
            .and_then(|e| e.to_str().ok().map(|s| s.trim().to_string()))
    }

    fn get_f64(obj: &DefaultDicomObject, group: u16, element: u16) -> Option<f64> {
        obj.element(Tag(group, element)).ok()
            .and_then(|e| e.to_float64().ok())
            .or_else(|| {
                obj.element(Tag(group, element)).ok()
                    .and_then(|e| e.to_str().ok().and_then(|s| s.trim().parse::<f64>().ok()))
            })
    }

    fn get_i32(obj: &DefaultDicomObject, group: u16, element: u16) -> Option<i32> {
        obj.element(Tag(group, element)).ok()
            .and_then(|e| e.to_int::<i32>().ok())
            .or_else(|| {
                obj.element(Tag(group, element)).ok()
                    .and_then(|e| e.to_str().ok().and_then(|s| s.trim().parse::<i32>().ok()))
            })
    }

    fn get_u32(obj: &DefaultDicomObject, group: u16, element: u16) -> Option<u32> {
        obj.element(Tag(group, element)).ok()
            .and_then(|e| e.to_int::<u32>().ok())
    }

    fn get_u16(obj: &DefaultDicomObject, group: u16, element: u16) -> Option<u16> {
        obj.element(Tag(group, element)).ok()
            .and_then(|e| e.to_int::<u16>().ok())
    }

    fn get_f64_pair(obj: &DefaultDicomObject, group: u16, element: u16) -> Option<[f64; 2]> {
        if let Ok(elem) = obj.element(Tag(group, element)) {
            if let Ok(s) = elem.to_str() {
                let parts: Vec<f64> = s.split('\\').filter_map(|p| p.trim().parse::<f64>().ok()).collect();
                if parts.len() >= 2 {
                    return Some([parts[0], parts[1]]);
                }
            }
        }
        None
    }

    fn get_f64_triplet(obj: &DefaultDicomObject, group: u16, element: u16) -> Option<[f64; 3]> {
        if let Ok(elem) = obj.element(Tag(group, element)) {
            if let Ok(s) = elem.to_str() {
                let parts: Vec<f64> = s.split('\\').filter_map(|p| p.trim().parse::<f64>().ok()).collect();
                if parts.len() >= 3 {
                    return Some([parts[0], parts[1], parts[2]]);
                }
            }
        }
        None
    }

    fn get_f64_sextet(obj: &DefaultDicomObject, group: u16, element: u16) -> Option<[f64; 6]> {
        if let Ok(elem) = obj.element(Tag(group, element)) {
            if let Ok(s) = elem.to_str() {
                let parts: Vec<f64> = s.split('\\').filter_map(|p| p.trim().parse::<f64>().ok()).collect();
                if parts.len() >= 6 {
                    return Some([parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]]);
                }
            }
        }
        None
    }
}

fn uuid_like() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    format!("1.2.840.10008.{}", now)
}
