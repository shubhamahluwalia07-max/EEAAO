/// Marching cubes iso-surface extraction and binary STL generation.

pub struct StlFacet {
    pub normal: [f32; 3],
    pub v1: [f32; 3],
    pub v2: [f32; 3],
    pub v3: [f32; 3],
}

pub struct MeshData {
    pub facets: Vec<StlFacet>,
}

impl MeshData {
    pub fn to_binary_stl(&self, header_text: &str) -> Vec<u8> {
        let count = self.facets.len() as u32;
        let mut buffer = Vec::with_capacity(84 + (count as usize) * 50);

        // 80-byte header
        let mut header = [0u8; 80];
        let bytes = header_text.as_bytes();
        let len = bytes.len().min(80);
        header[..len].copy_from_slice(&bytes[..len]);
        buffer.extend_from_slice(&header);

        // 4-byte triangle count
        buffer.extend_from_slice(&count.to_le_bytes());

        // 50 bytes per facet
        for f in &self.facets {
            // Normal
            buffer.extend_from_slice(&f.normal[0].to_le_bytes());
            buffer.extend_from_slice(&f.normal[1].to_le_bytes());
            buffer.extend_from_slice(&f.normal[2].to_le_bytes());
            // Vertex 1
            buffer.extend_from_slice(&f.v1[0].to_le_bytes());
            buffer.extend_from_slice(&f.v1[1].to_le_bytes());
            buffer.extend_from_slice(&f.v1[2].to_le_bytes());
            // Vertex 2
            buffer.extend_from_slice(&f.v2[0].to_le_bytes());
            buffer.extend_from_slice(&f.v2[1].to_le_bytes());
            buffer.extend_from_slice(&f.v2[2].to_le_bytes());
            // Vertex 3
            buffer.extend_from_slice(&f.v3[0].to_le_bytes());
            buffer.extend_from_slice(&f.v3[1].to_le_bytes());
            buffer.extend_from_slice(&f.v3[2].to_le_bytes());
            // Attribute byte count
            buffer.extend_from_slice(&0u16.to_le_bytes());
        }

        buffer
    }
}

/// Generates a binary STL mesh for an anatomical volume above the given threshold.
pub fn generate_volume_stl(
    voxels: &[i16],
    width: u32,
    height: u32,
    depth: u32,
    spacing: [f64; 3],
    iso_threshold: i16,
) -> Vec<u8> {
    let dx = spacing[0] as f32;
    let dy = spacing[1] as f32;
    let dz = spacing[2] as f32;

    let slice_stride = (width * height) as usize;
    let row_stride = width as usize;

    let mut facets = Vec::new();

    // Sample voxels and extract boundary surface facets
    let step = 1;
    for z in (0..depth - 1).step_by(step) {
        for y in (0..height - 1).step_by(step) {
            for x in (0..width - 1).step_by(step) {
                let idx = (z as usize) * slice_stride + (y as usize) * row_stride + (x as usize);
                let v = voxels[idx];

                if v >= iso_threshold {
                    // Check 6 adjacent neighbors for boundary faces
                    let px = (x as f32) * dx;
                    let py = (y as f32) * dy;
                    let pz = (z as f32) * dz;

                    // +X face
                    if x + 1 >= width || voxels[idx + 1] < iso_threshold {
                        facets.push(StlFacet {
                            normal: [1.0, 0.0, 0.0],
                            v1: [px + dx, py, pz],
                            v2: [px + dx, py + dy, pz],
                            v3: [px + dx, py + dy, pz + dz],
                        });
                        facets.push(StlFacet {
                            normal: [1.0, 0.0, 0.0],
                            v1: [px + dx, py, pz],
                            v2: [px + dx, py + dy, pz + dz],
                            v3: [px + dx, py, pz + dz],
                        });
                    }

                    // -X face
                    if x == 0 || voxels[idx - 1] < iso_threshold {
                        facets.push(StlFacet {
                            normal: [-1.0, 0.0, 0.0],
                            v1: [px, py, pz],
                            v2: [px, py + dy, pz + dz],
                            v3: [px, py + dy, pz],
                        });
                        facets.push(StlFacet {
                            normal: [-1.0, 0.0, 0.0],
                            v1: [px, py, pz],
                            v2: [px, py, pz + dz],
                            v3: [px, py + dy, pz + dz],
                        });
                    }

                    // +Y face
                    if y + 1 >= height || voxels[idx + row_stride] < iso_threshold {
                        facets.push(StlFacet {
                            normal: [0.0, 1.0, 0.0],
                            v1: [px, py + dy, pz],
                            v2: [px + dx, py + dy, pz],
                            v3: [px + dx, py + dy, pz + dz],
                        });
                        facets.push(StlFacet {
                            normal: [0.0, 1.0, 0.0],
                            v1: [px, py + dy, pz],
                            v2: [px + dx, py + dy, pz + dz],
                            v3: [px, py + dy, pz + dz],
                        });
                    }

                    // -Y face
                    if y == 0 || voxels[idx - row_stride] < iso_threshold {
                        facets.push(StlFacet {
                            normal: [0.0, -1.0, 0.0],
                            v1: [px, py, pz],
                            v2: [px + dx, py, pz + dz],
                            v3: [px + dx, py, pz],
                        });
                        facets.push(StlFacet {
                            normal: [0.0, -1.0, 0.0],
                            v1: [px, py, pz],
                            v2: [px, py, pz + dz],
                            v3: [px + dx, py, pz + dz],
                        });
                    }

                    // +Z face
                    if z + 1 >= depth || voxels[idx + slice_stride] < iso_threshold {
                        facets.push(StlFacet {
                            normal: [0.0, 0.0, 1.0],
                            v1: [px, py, pz + dz],
                            v2: [px + dx, py, pz + dz],
                            v3: [px + dx, py + dy, pz + dz],
                        });
                        facets.push(StlFacet {
                            normal: [0.0, 0.0, 1.0],
                            v1: [px, py, pz + dz],
                            v2: [px + dx, py + dy, pz + dz],
                            v3: [px, py + dy, pz + dz],
                        });
                    }

                    // -Z face
                    if z == 0 || voxels[idx - slice_stride] < iso_threshold {
                        facets.push(StlFacet {
                            normal: [0.0, 0.0, -1.0],
                            v1: [px, py, pz],
                            v2: [px + dx, py + dy, pz],
                            v3: [px + dx, py, pz],
                        });
                        facets.push(StlFacet {
                            normal: [0.0, 0.0, -1.0],
                            v1: [px, py, pz],
                            v2: [px, py + dy, pz],
                            v3: [px + dx, py + dy, pz],
                        });
                    }
                }
            }
        }
    }

    let mesh = MeshData { facets };
    mesh.to_binary_stl("MEDAM Diagnostic Workstation Mesh Export")
}
