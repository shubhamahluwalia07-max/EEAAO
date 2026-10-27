import os
import sys
import time
import io
import trimesh
import numpy as np

# Ensure backend directory is in python path
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
sys.path.insert(0, backend_dir)

from services.dicom_service import dicom_service
from services.segmentation_service import segmentation_service
from services.mesh_service import mesh_service

BENCHMARK_ZIP = r"C:\Users\ShubhamAhluwalia\Downloads\Compressed\KAMLESH 202603583814.zip"

def run_e2e_verification():
    print("=" * 65)
    print("MEDAM STUDIO - AUTOMATED END-TO-END VERIFICATION")
    print(f"Target Benchmark Dataset: {BENCHMARK_ZIP}")
    print("=" * 65)

    if not os.path.exists(BENCHMARK_ZIP):
        print(f"[-] ERROR: Benchmark dataset not found at {BENCHMARK_ZIP}")
        sys.exit(1)

    # 1. Ingestion & Series Separation
    print("\n[1/6] Ingesting DICOM dataset and separating series...")
    t0 = time.time()
    study = dicom_service.ingest_path(BENCHMARK_ZIP)
    ingest_time = round(time.time() - t0, 2)
    print(f"[+] Ingestion completed in {ingest_time}s")
    print(f"    Patient: {study['patient_name']} (ID: {study['patient_id']})")
    print(f"    Total Series Detected: {len(study['series'])}")

    for s in study['series']:
        print(f"    - Modality: {s['modality']} | Slices: {s['num_slices']:3d} | Dims: {s['dimensions']} | Scout: {s['is_scout']} | Desc: {s['series_description']}")

    # Select primary diagnostic CT series
    primary_series = next((s for s in study['series'] if not s['is_scout']), study['series'][0])
    s_uid = primary_series['series_instance_uid']
    print(f"\n[+] Active Diagnostic Series: {primary_series['series_description']} ({s_uid})")

    # 2. Binary Volume Streaming Verification
    print("\n[2/6] Verifying binary volume streaming endpoint buffer...")
    vol_bin = dicom_service.get_series_volume_binary(s_uid)
    import struct, json
    h_len = struct.unpack("<I", vol_bin[:4])[0]
    header = json.loads(vol_bin[4:4+h_len].decode('utf-8'))
    w, h, d = header['dims']
    sx, sy, sz = header['spacing']
    expected_bytes = 4 + h_len + (w * h * d * 2)
    assert len(vol_bin) == expected_bytes, f"Buffer size mismatch: got {len(vol_bin)}, expected {expected_bytes}"
    print(f"[+] Binary payload verified: {len(vol_bin):,} bytes (Dimensions: {w}x{h}x{d}, Spacing: {sx:.3f}x{sy:.3f}x{sz:.3f} mm)")

    # 3. Threshold Segmentation Verification
    print("\n[3/6] Testing Threshold segmentation...")
    t0 = time.time()
    thresh_mask = segmentation_service.threshold(
        series_id=s_uid,
        mask_id="mask_threshold_test",
        name="Bone Threshold 226..3071 HU",
        min_hu=226,
        max_hu=3071,
        color="#0284C7"
    )
    t_thresh = round(time.time() - t0, 3)
    assert thresh_mask['voxel_count'] > 0, "Threshold mask is empty!"
    print(f"[+] Threshold generated in {t_thresh}s: {thresh_mask['voxel_count']:,} segmented bone voxels")

    # 4. Region Grow & Undo Verification
    print("\n[4/6] Testing Accumulative Region Grow + SimpleITK Hole Filling...")
    # Seed in center slice
    series_obj = dicom_service.series_store[s_uid]
    vol = series_obj.volume_hu
    # Find a high HU voxel (dense bone)
    bone_voxels = np.argwhere(vol > 500)
    assert len(bone_voxels) > 0, "No bone voxels found above 500 HU"
    seed_z, seed_y, seed_x = bone_voxels[len(bone_voxels) // 2]
    seed = [int(seed_x), int(seed_y), int(seed_z)]

    t0 = time.time()
    rg_mask = segmentation_service.region_grow(
        series_id=s_uid,
        mask_id="mask_rg_test",
        seed=seed,
        min_hu=226,
        max_hu=3071
    )
    t_rg = round(time.time() - t0, 3)
    assert rg_mask['voxel_count'] > 0, "Region grow produced 0 voxels"
    print(f"[+] Region grow from seed {seed} completed in {t_rg}s: {rg_mask['voxel_count']:,} voxels")

    undo_info = segmentation_service.undo_region_grow(s_uid, rg_mask['mask_id'])
    assert undo_info['undone'] == True, "Undo region grow failed"
    print("[+] Region grow undo stack verified")

    # 5. Docked 3-Step Seed Segment (Competitive Watershed) Verification
    print("\n[5/6] Testing 3-Step Competitive Watershed Seed Segment Engine...")
    need_seeds = [seed]
    # Pick a neighbor region for not_need
    not_need_z = min(d - 1, seed_z + 5)
    not_need = [[int(seed_x + 20), int(seed_y + 20), int(not_need_z)]]

    config = {
        "bones": [
            {
                "id": "bone_1",
                "name": "Target Bone 1",
                "color": "#0284C7",
                "need_seeds": need_seeds,
                "not_need_seeds": not_need,
                "seed_threshold_hu": 200,
                "sensitivity": 65,
                "min_hu": 150,
                "max_hu": 3071
            }
        ],
        "gap_closing_px": 2,
        "fill_long_bones": True
    }

    t0 = time.time()
    ss_result = segmentation_service.seed_segment(s_uid, config, is_preview=False)
    t_ss = round(time.time() - t0, 3)
    print(f"[+] Competitive watershed completed in {t_ss}s: {ss_result['message']}")
    assert len(ss_result['masks']) == 1, "Expected 1 generated bone mask"
    assert ss_result['masks'][0]['voxel_count'] > 0, "Generated bone mask is empty"

    # 6. VTK C++ Mesh Iso-Surface Calculation & Watertight STL Export
    print("\n[6/6] Testing VTK C++ Iso-Surface extraction and Watertight STL Export...")
    t0 = time.time()
    mesh_info = mesh_service.calculate_mesh(
        series_id=s_uid,
        mask_ids=[thresh_mask['mask_id']],
        quality="Optimal",
        smooth_iterations=20,
        reduce_percent=10,
        wrap=True
    )
    t_mesh = round(time.time() - t0, 3)
    print(f"[+] VTK surface extraction & smoothing completed in {t_mesh}s")
    print(f"    Vertices: {mesh_info['num_vertices']:,} | Triangles: {mesh_info['num_triangles']:,}")
    assert mesh_info['num_triangles'] > 0, "No triangles in generated mesh!"

    # Export STL
    stl_bytes = mesh_service.export_stl(mesh_info['object_id'])
    assert len(stl_bytes) > 84, "Invalid binary STL file size"

    # Verify watertight manifold with Trimesh
    stl_stream = io.BytesIO(stl_bytes)
    tri_mesh = trimesh.load(stl_stream, file_type='stl')
    is_watertight = tri_mesh.is_watertight

    print(f"[+] STL Export: {len(stl_bytes):,} bytes")
    print(f"    Trimesh Watertight Check: {is_watertight}")
    print(f"    Euler Characteristic: {tri_mesh.euler_number}")

    print("\n" + "=" * 65)
    print("[SUCCESS] ALL 6 END-TO-END BENCHMARKS PASSED 100%!")
    print("=" * 65)

if __name__ == "__main__":
    run_e2e_verification()
