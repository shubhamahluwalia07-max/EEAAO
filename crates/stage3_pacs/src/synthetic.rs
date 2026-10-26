use crate::models::{IngestionResult, SeriesCard, SeriesVolumePayload};
use base64::Engine;
use image::{ImageBuffer, Luma, codecs::png::PngEncoder};

pub struct SyntheticStudyGenerator;

impl SyntheticStudyGenerator {
    pub fn generate_demo_study() -> IngestionResult {
        let study_instance_uid = "1.2.840.113619.2.55.3.1092789123.456".to_string();

        let ct_card = SeriesCard {
            series_instance_uid: "1.2.840.113619.2.55.3.1092789123.456.1".to_string(),
            study_instance_uid: study_instance_uid.clone(),
            modality: "CT".to_string(),
            series_description: "Chest & Thoracic Spine 1.0mm High-Resolution".to_string(),
            series_number: 2,
            slice_count: 64,
            rows: 256,
            columns: 256,
            pixel_spacing: [0.78, 0.78],
            slice_thickness: 1.5,
            window_center: 40.0,
            window_width: 400.0,
            thumbnail_data_url: Self::generate_ct_thumbnail(),
        };

        let mr_card = SeriesCard {
            series_instance_uid: "1.2.840.113619.2.55.3.1092789123.456.2".to_string(),
            study_instance_uid: study_instance_uid.clone(),
            modality: "MR".to_string(),
            series_description: "Brain 3D Axial T1 MPRAGE Iso".to_string(),
            series_number: 3,
            slice_count: 48,
            rows: 256,
            columns: 256,
            pixel_spacing: [0.94, 0.94],
            slice_thickness: 1.2,
            window_center: 350.0,
            window_width: 700.0,
            thumbnail_data_url: Self::generate_mr_thumbnail(),
        };

        let dx_card = SeriesCard {
            series_instance_uid: "1.2.840.113619.2.55.3.1092789123.456.3".to_string(),
            study_instance_uid: study_instance_uid.clone(),
            modality: "DX".to_string(),
            series_description: "Chest PA Standing Diagnostic".to_string(),
            series_number: 1,
            slice_count: 1,
            rows: 512,
            columns: 512,
            pixel_spacing: [0.35, 0.35],
            slice_thickness: 1.0,
            window_center: 2048.0,
            window_width: 4096.0,
            thumbnail_data_url: Self::generate_dx_thumbnail(),
        };

        IngestionResult {
            study_instance_uid,
            detected_modalities: vec!["ALL".to_string(), "CT".to_string(), "MR".to_string(), "DX".to_string()],
            series: vec![ct_card, mr_card, dx_card],
        }
    }

    pub fn generate_series_volume(series_uid: &str) -> Result<SeriesVolumePayload, String> {
        if series_uid.ends_with(".2") {
            // MR Brain volume
            Self::generate_mr_volume(series_uid)
        } else if series_uid.ends_with(".3") {
            // DX single projection
            Self::generate_dx_volume(series_uid)
        } else {
            // Default: CT Chest & Spine volume
            Self::generate_ct_volume(series_uid)
        }
    }

    fn generate_ct_volume(series_uid: &str) -> Result<SeriesVolumePayload, String> {
        let width: u32 = 256;
        let height: u32 = 256;
        let depth: u32 = 64;
        let total_voxels = (width * height * depth) as usize;
        let mut voxels = Vec::with_capacity(total_voxels);

        let mut min_hu = 10000i16;
        let mut max_hu = -10000i16;

        let cx = width as f64 / 2.0;
        let cy = height as f64 / 2.0;
        let cz = depth as f64 / 2.0;

        for z in 0..depth {
            let fz = (z as f64 - cz) / (cz * 0.95);
            for y in 0..height {
                let fy = (y as f64 - cy) / (cy * 0.92);
                for x in 0..width {
                    let fx = (x as f64 - cx) / (cx * 0.92);

                    let r2_body = (fx / 0.85).powi(2) + (fy / 0.65).powi(2);
                    let mut hu: i16 = -1000; // Air outside

                    if r2_body <= 1.0 {
                        // Soft tissue chest wall
                        hu = 45;

                        // Ribs (elliptical ring around chest)
                        let rib_r = (fx / 0.78).powi(2) + (fy / 0.58).powi(2);
                        if (0.88..=1.0).contains(&rib_r) {
                            // Periodic ribs along z and angle
                            let angle = fx.atan2(fy);
                            let rib_mod = ((angle * 7.0).sin() * (fz * 8.0).cos()).abs();
                            if rib_mod > 0.35 {
                                hu = 750; // Cortical rib bone
                            }
                        }

                        // Spine / Vertebra (posterior midline)
                        let spine_dx = fx;
                        let spine_dy = fy - 0.40;
                        let spine_r2 = (spine_dx / 0.16).powi(2) + (spine_dy / 0.16).powi(2);
                        if spine_r2 <= 1.0 {
                            // Vertebral body + canal
                            let canal_r2 = (spine_dx / 0.06).powi(2) + ((spine_dy - 0.03) / 0.06).powi(2);
                            if canal_r2 <= 1.0 {
                                hu = 15; // Spinal cord / CSF
                            } else {
                                hu = 820; // Vertebral bone
                            }
                        }

                        // Lungs (bilateral)
                        let left_lung_dx = fx - 0.36;
                        let left_lung_dy = fy + 0.05;
                        let left_lung_r2 = (left_lung_dx / 0.28).powi(2) + (left_lung_dy / 0.38).powi(2);

                        let right_lung_dx = fx + 0.36;
                        let right_lung_dy = fy + 0.05;
                        let right_lung_r2 = (right_lung_dx / 0.28).powi(2) + (right_lung_dy / 0.38).powi(2);

                        if left_lung_r2 <= 1.0 || right_lung_r2 <= 1.0 {
                            hu = -680; // Lung parenchyma

                            // Pulmonary vessels inside lungs
                            let vessel_noise = (fx * 24.0).sin() * (fy * 24.0).cos() * (fz * 12.0).sin();
                            if vessel_noise > 0.75 {
                                hu = 120; // Pulmonary vessels
                            }
                        }

                        // Mediastinum / Heart (anterior center-left)
                        let heart_dx = fx + 0.08;
                        let heart_dy = fy + 0.12;
                        let heart_r2 = (heart_dx / 0.24).powi(2) + (heart_dy / 0.22).powi(2);
                        if heart_r2 <= 1.0 && left_lung_r2 > 0.95 && right_lung_r2 > 0.95 {
                            hu = 50; // Cardiac muscle
                            // Ventricles with blood pool
                            if (heart_dx / 0.14).powi(2) + (heart_dy / 0.13).powi(2) <= 1.0 {
                                hu = 320; // Contrast-enhanced blood pool
                            }
                        }

                        // Sternum bone anteriorly
                        if fx.abs() < 0.08 && (fy + 0.52).abs() < 0.05 {
                            hu = 880;
                        }
                    }

                    if hu < min_hu { min_hu = hu; }
                    if hu > max_hu { max_hu = hu; }
                    voxels.push(hu);
                }
            }
        }

        let mut byte_buffer = Vec::with_capacity(voxels.len() * 2);
        for v in &voxels {
            byte_buffer.extend_from_slice(&v.to_le_bytes());
        }

        let slice_positions = (0..depth).map(|z| z as f64 * 1.5).collect();

        Ok(SeriesVolumePayload {
            series_instance_uid: series_uid.to_string(),
            modality: "CT".to_string(),
            series_description: "Chest & Thoracic Spine 1.0mm High-Resolution".to_string(),
            dimensions: [width, height, depth],
            spacing: [0.78, 0.78, 1.5],
            window_center: 40.0,
            window_width: 400.0,
            min_hu,
            max_hu,
            voxel_buffer_base64: base64::engine::general_purpose::STANDARD.encode(&byte_buffer),
            slice_positions,
        })
    }

    fn generate_mr_volume(series_uid: &str) -> Result<SeriesVolumePayload, String> {
        let width: u32 = 256;
        let height: u32 = 256;
        let depth: u32 = 48;
        let total_voxels = (width * height * depth) as usize;
        let mut voxels = Vec::with_capacity(total_voxels);

        let mut min_hu = 10000i16;
        let mut max_hu = -10000i16;

        let cx = width as f64 / 2.0;
        let cy = height as f64 / 2.0;
        let cz = depth as f64 / 2.0;

        for z in 0..depth {
            let fz = (z as f64 - cz) / (cz * 0.9);
            for y in 0..height {
                let fy = (y as f64 - cy) / (cy * 0.9);
                for x in 0..width {
                    let fx = (x as f64 - cx) / (cx * 0.9);

                    let r2_head = fx * fx + (fy * 1.15).powi(2) + (fz * 1.25).powi(2);
                    let mut val: i16 = 0; // Air

                    if r2_head <= 0.98 {
                        // Scalp & Skull
                        if r2_head > 0.85 {
                            val = 80; // Bone diploe (low on T1)
                        } else {
                            // Brain parenchyma
                            val = 520; // Cortex / Gray matter
                            if r2_head < 0.65 {
                                val = 750; // White matter (hyperintense on T1)
                            }
                            // Ventricles / CSF
                            let v_dx = fx;
                            let v_dy = fy + 0.05;
                            let v_r2 = (v_dx / 0.12).powi(2) + (v_dy / 0.28).powi(2);
                            if v_r2 < 1.0 {
                                val = 40; // CSF (dark on T1)
                            }
                        }
                    }

                    if val < min_hu { min_hu = val; }
                    if val > max_hu { max_hu = val; }
                    voxels.push(val);
                }
            }
        }

        let mut byte_buffer = Vec::with_capacity(voxels.len() * 2);
        for v in &voxels {
            byte_buffer.extend_from_slice(&v.to_le_bytes());
        }

        let slice_positions = (0..depth).map(|z| z as f64 * 1.2).collect();

        Ok(SeriesVolumePayload {
            series_instance_uid: series_uid.to_string(),
            modality: "MR".to_string(),
            series_description: "Brain 3D Axial T1 MPRAGE Iso".to_string(),
            dimensions: [width, height, depth],
            spacing: [0.94, 0.94, 1.2],
            window_center: 350.0,
            window_width: 700.0,
            min_hu,
            max_hu,
            voxel_buffer_base64: base64::engine::general_purpose::STANDARD.encode(&byte_buffer),
            slice_positions,
        })
    }

    fn generate_dx_volume(series_uid: &str) -> Result<SeriesVolumePayload, String> {
        let width: u32 = 512;
        let height: u32 = 512;
        let depth: u32 = 1;
        let total_voxels = (width * height * depth) as usize;
        let mut voxels = Vec::with_capacity(total_voxels);

        for y in 0..height {
            let fy = (y as f64 - 256.0) / 240.0;
            for x in 0..width {
                let fx = (x as f64 - 256.0) / 240.0;
                let r2 = (fx / 0.75).powi(2) + (fy / 0.85).powi(2);
                let val: i16 = if r2 < 1.0 {
                    let ribs = ((fy * 15.0).sin() * 400.0).abs() as i16;
                    let lung = if (fx.abs() - 0.35).powi(2) + fy.powi(2) < 0.25 {
                        -400
                    } else {
                        200
                    };
                    2048 + lung + ribs
                } else {
                    200
                };
                voxels.push(val);
            }
        }

        let mut byte_buffer = Vec::with_capacity(voxels.len() * 2);
        for v in &voxels {
            byte_buffer.extend_from_slice(&v.to_le_bytes());
        }

        Ok(SeriesVolumePayload {
            series_instance_uid: series_uid.to_string(),
            modality: "DX".to_string(),
            series_description: "Chest PA Standing Diagnostic".to_string(),
            dimensions: [width, height, depth],
            spacing: [0.35, 0.35, 1.0],
            window_center: 2048.0,
            window_width: 4096.0,
            min_hu: 200,
            max_hu: 3200,
            voxel_buffer_base64: base64::engine::general_purpose::STANDARD.encode(&byte_buffer),
            slice_positions: vec![0.0],
        })
    }

    fn generate_ct_thumbnail() -> String {
        let mut img: ImageBuffer<Luma<u8>, Vec<u8>> = ImageBuffer::new(128, 128);
        for y in 0..128 {
            let fy = (y as f64 - 64.0) / 58.0;
            for x in 0..128 {
                let fx = (x as f64 - 64.0) / 58.0;
                let r2_body = (fx / 0.85).powi(2) + (fy / 0.65).powi(2);
                let pixel = if r2_body <= 1.0 {
                    let lung1 = ((fx - 0.36) / 0.28).powi(2) + ((fy + 0.05) / 0.38).powi(2);
                    let lung2 = ((fx + 0.36) / 0.28).powi(2) + ((fy + 0.05) / 0.38).powi(2);
                    let spine = (fx / 0.16).powi(2) + ((fy - 0.40) / 0.16).powi(2);
                    if spine <= 1.0 {
                        230
                    } else if lung1 <= 1.0 || lung2 <= 1.0 {
                        45
                    } else {
                        135
                    }
                } else {
                    10
                };
                img.put_pixel(x, y, Luma([pixel]));
            }
        }
        let mut png_bytes = Vec::new();
        let encoder = PngEncoder::new(&mut png_bytes);
        let _ = image::ImageEncoder::write_image(encoder, img.as_raw(), 128, 128, image::ExtendedColorType::L8);
        format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(&png_bytes))
    }

    fn generate_mr_thumbnail() -> String {
        let mut img: ImageBuffer<Luma<u8>, Vec<u8>> = ImageBuffer::new(128, 128);
        for y in 0..128 {
            let fy = (y as f64 - 64.0) / 58.0;
            for x in 0..128 {
                let fx = (x as f64 - 64.0) / 58.0;
                let r2 = fx * fx + (fy * 1.15).powi(2);
                let pixel = if r2 <= 0.95 {
                    if r2 > 0.85 {
                        60
                    } else if (fx / 0.12).powi(2) + ((fy + 0.05) / 0.28).powi(2) < 1.0 {
                        30
                    } else if r2 < 0.65 {
                        210
                    } else {
                        150
                    }
                } else {
                    10
                };
                img.put_pixel(x, y, Luma([pixel]));
            }
        }
        let mut png_bytes = Vec::new();
        let encoder = PngEncoder::new(&mut png_bytes);
        let _ = image::ImageEncoder::write_image(encoder, img.as_raw(), 128, 128, image::ExtendedColorType::L8);
        format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(&png_bytes))
    }

    fn generate_dx_thumbnail() -> String {
        let mut img: ImageBuffer<Luma<u8>, Vec<u8>> = ImageBuffer::new(128, 128);
        for y in 0..128 {
            let fy = (y as f64 - 64.0) / 60.0;
            for x in 0..128 {
                let fx = (x as f64 - 64.0) / 60.0;
                let r2 = (fx / 0.75).powi(2) + (fy / 0.85).powi(2);
                let pixel = if r2 < 1.0 {
                    let ribs = ((fy * 12.0).sin() * 40.0).abs() as u8;
                    120 + ribs
                } else {
                    20
                };
                img.put_pixel(x, y, Luma([pixel]));
            }
        }
        let mut png_bytes = Vec::new();
        let encoder = PngEncoder::new(&mut png_bytes);
        let _ = image::ImageEncoder::write_image(encoder, img.as_raw(), 128, 128, image::ExtendedColorType::L8);
        format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(&png_bytes))
    }
}
