import os
import io
import json
import struct
import zipfile
import tempfile
import time
from typing import Dict, List, Any, Optional, Tuple, Generator
import numpy as np
import pydicom
from pydicom.dataset import Dataset
import SimpleITK as sitk

class DicomSeriesData:
    def __init__(self, series_id: str, description: str, modality: str):
        self.series_id: str = series_id
        self.description: str = description
        self.modality: str = modality
        self.patient_name: str = "Anonymous"
        self.patient_id: str = "EX-9021"
        self.study_date: str = ""
        self.pixel_spacing: List[float] = [1.0, 1.0]
        self.slice_thickness: float = 1.0
        self.spacing: List[float] = [1.0, 1.0, 1.0] # dx, dy, dz
        self.origin: List[float] = [0.0, 0.0, 0.0]
        self.direction: List[float] = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0]
        self.window_center: float = 40.0
        self.window_width: float = 400.0
        self.dims: List[int] = [0, 0, 0] # width (cols), height (rows), depth (slices)
        self.volume_hu: Optional[np.ndarray] = None # int16 array shape (depth, height, width)
        self.raw_tags: List[Dict[str, str]] = []
        self.slice_positions: List[float] = []
        self.file_paths: List[str] = []
        self.histogram: List[int] = [] # 100 bins from -1024 to +3071 HU

class DicomService:
    def __init__(self):
        # Global in-memory storage for active study and series
        self.studies: Dict[str, Dict[str, Any]] = {}
        self.series_store: Dict[str, DicomSeriesData] = {}
        self.active_study_id: Optional[str] = None
        self.temp_dirs: List[tempfile.TemporaryDirectory] = []

    def ingest_path(self, path_str: str, progress_callback=None) -> Dict[str, Any]:
        """
        Scan and ingest a DICOM folder or ZIP archive.
        Extracts metadata, groups by series, sorts slices spatially,
        and builds HU volume arrays.
        """
        clean_path = path_str.strip('\'"')
        if not os.path.exists(clean_path):
            raise FileNotFoundError(f"Path does not exist: {clean_path}")

        extracted_dir = clean_path
        if os.path.isfile(clean_path) and clean_path.lower().endswith(".zip"):
            td = tempfile.TemporaryDirectory(prefix="medam_dicom_")
            self.temp_dirs.append(td)
            extracted_dir = td.name
            with zipfile.ZipFile(clean_path, 'r') as zf:
                zf.extractall(extracted_dir)

        # Collect all files
        all_filepaths = []
        for root, _, files in os.walk(extracted_dir):
            for f in files:
                all_filepaths.append(os.path.join(root, f))

        total_files = len(all_filepaths)
        if total_files == 0:
            raise ValueError("No files found in the specified path.")

        start_time = time.time()
        # Group filepaths by SeriesInstanceUID using fast header parsing
        series_groups: Dict[str, List[Tuple[float, str, Dataset]]] = {}
        series_meta: Dict[str, Dict[str, Any]] = {}

        processed = 0
        for fpath in all_filepaths:
            processed += 1
            if progress_callback:
                elapsed = time.time() - start_time
                percent = int((processed / total_files) * 50)
                eta = (elapsed / processed) * (total_files - processed) if processed > 0 else 0
                progress_callback({
                    "current_file": os.path.basename(fpath),
                    "processed_count": processed,
                    "total_count": total_files,
                    "percent": percent,
                    "elapsed_sec": round(elapsed, 1),
                    "eta_sec": round(eta, 1),
                    "stage": "Scanning metadata"
                })

            try:
                # Fast header read without loading pixels
                ds = pydicom.dcmread(fpath, stop_before_pixels=True, force=True)
                if not hasattr(ds, "SeriesInstanceUID") and not hasattr(ds, "SOPClassUID"):
                    continue
                series_uid = getattr(ds, "SeriesInstanceUID", "default_series")
                modality = getattr(ds, "Modality", "OT")
                desc = getattr(ds, "SeriesDescription", f"Series {series_uid[-6:]}")

                # Compute spatial position along slice normal
                iop = getattr(ds, "ImageOrientationPatient", [1, 0, 0, 0, 1, 0])
                ipp = getattr(ds, "ImagePositionPatient", [0, 0, 0])
                iop = [float(v) for v in iop]
                ipp = [float(v) for v in ipp]
                rx, ry, rz = iop[0:3]
                cx, cy, cz = iop[3:6]
                normal = np.cross([rx, ry, rz], [cx, cy, cz])
                norm_len = np.linalg.norm(normal)
                if norm_len > 1e-6:
                    normal = normal / norm_len
                else:
                    normal = np.array([0, 0, 1])
                dist = float(np.dot(ipp, normal))

                if series_uid not in series_groups:
                    series_groups[series_uid] = []
                    series_meta[series_uid] = {
                        "description": desc,
                        "modality": modality,
                        "patient_name": str(getattr(ds, "PatientName", "Anonymous")),
                        "patient_id": str(getattr(ds, "PatientID", "EX-9021")),
                        "study_date": str(getattr(ds, "StudyDate", "")),
                        "window_center": float(getattr(ds, "WindowCenter", 40) if not isinstance(getattr(ds, "WindowCenter", 40), (list, pydicom.multival.MultiValue)) else getattr(ds, "WindowCenter")[0]),
                        "window_width": float(getattr(ds, "WindowWidth", 400) if not isinstance(getattr(ds, "WindowWidth", 400), (list, pydicom.multival.MultiValue)) else getattr(ds, "WindowWidth")[0]),
                    }

                series_groups[series_uid].append((dist, fpath, ds))
            except Exception:
                continue

        if not series_groups:
            raise ValueError("No valid DICOM instances recognized in the directory.")

        # Build Study and Series objects
        study_id = f"study_{int(time.time())}"
        self.active_study_id = study_id
        series_summaries = []

        series_idx = 0
        total_series = len(series_groups)
        for s_uid, slice_list in series_groups.items():
            series_idx += 1
            # Sort slices along the normal vector
            slice_list.sort(key=lambda item: item[0])

            meta = series_meta[s_uid]
            series_data = DicomSeriesData(
                series_id=s_uid,
                description=meta["description"],
                modality=meta["modality"]
            )
            series_data.patient_name = meta["patient_name"]
            series_data.patient_id = meta["patient_id"]
            series_data.study_date = meta["study_date"]
            series_data.window_center = meta["window_center"]
            series_data.window_width = meta["window_width"]
            series_data.file_paths = [item[1] for item in slice_list]
            series_data.slice_positions = [item[0] for item in slice_list]

            # Read first slice tags
            first_ds = slice_list[0][2]
            raw_tags = []
            for elem in first_ds:
                if elem.tag.is_private:
                    continue
                tag_str = f"({elem.tag.group:04X},{elem.tag.element:04X})"
                val_str = str(elem.value)
                if len(val_str) > 80:
                    val_str = val_str[:77] + "..."
                raw_tags.append({
                    "tag": tag_str,
                    "name": elem.name,
                    "value": val_str
                })
            series_data.raw_tags = raw_tags

            # Spacing
            pix_spacing = getattr(first_ds, "PixelSpacing", [1.0, 1.0])
            sx = float(pix_spacing[1]) if len(pix_spacing) > 1 else 1.0
            sy = float(pix_spacing[0]) if len(pix_spacing) > 0 else 1.0
            sz = 1.0
            if len(slice_list) > 1:
                diffs = [abs(slice_list[i+1][0] - slice_list[i][0]) for i in range(len(slice_list)-1)]
                valid_diffs = [d for d in diffs if d > 1e-4]
                if valid_diffs:
                    sz = float(np.median(valid_diffs))
            else:
                sz = float(getattr(first_ds, "SliceThickness", 1.0))

            series_data.spacing = [sx, sy, sz]
            series_data.slice_thickness = sz
            series_data.pixel_spacing = [sx, sy]
            iop = getattr(first_ds, "ImageOrientationPatient", [1, 0, 0, 0, 1, 0])
            ipp = getattr(first_ds, "ImagePositionPatient", [0, 0, 0])
            series_data.origin = [float(v) for v in ipp]
            series_data.direction = [float(v) for v in iop]

            # Load full pixel data and construct 3D HU volume
            if progress_callback:
                progress_callback({
                    "current_file": f"Volume construction {meta['description']}",
                    "processed_count": series_idx,
                    "total_count": total_series,
                    "percent": 50 + int((series_idx / total_series) * 50),
                    "elapsed_sec": round(time.time() - start_time, 1),
                    "eta_sec": 0,
                    "stage": f"Building 3D volume for {meta['description']}"
                })

            sorted_fpaths = [item[1] for item in slice_list]
            vol_loaded = False
            try:
                reader = sitk.ImageSeriesReader()
                reader.SetFileNames(sorted_fpaths)
                sitk_vol = reader.Execute()
                vol_arr = sitk.GetArrayFromImage(sitk_vol) # (depth, height, width)
                if vol_arr.ndim == 4:
                    vol_arr = vol_arr[..., 0]
                elif vol_arr.ndim == 2:
                    vol_arr = np.expand_dims(vol_arr, axis=0)
                d, h, w = vol_arr.shape[:3]
                vol_arr = vol_arr.reshape((d, h, w))
                vol_int16 = np.clip(vol_arr, -1024, 3071).astype(np.int16)
                series_data.volume_hu = vol_int16
                series_data.dims = [w, h, d]
                hist, _ = np.histogram(vol_int16, bins=100, range=(-1024, 3071))
                series_data.histogram = hist.tolist()
                vol_loaded = True
            except Exception:
                vol_loaded = False

            if not vol_loaded:
                volume_slices = []
                for fpath in sorted_fpaths:
                    try:
                        sitk_slice = sitk.ReadImage(fpath)
                        arr = sitk.GetArrayFromImage(sitk_slice)
                        if arr.ndim == 3 and arr.shape[0] == 1:
                            arr = arr[0]
                        elif arr.ndim == 3 and arr.shape[2] in (3, 4):
                            arr = arr[:, :, 0]
                        elif arr.ndim > 2:
                            arr = arr.reshape((arr.shape[-2], arr.shape[-1]))
                        volume_slices.append(arr.astype(np.float32))
                    except Exception:
                        try:
                            full_ds = pydicom.dcmread(fpath, force=True)
                            arr = full_ds.pixel_array.astype(np.float32)
                            if arr.ndim == 3 and arr.shape[2] in (3, 4):
                                arr = arr[:, :, 0]
                            elif arr.ndim == 3 and arr.shape[0] == 1:
                                arr = arr[0]
                            elif arr.ndim > 2:
                                arr = arr.reshape((arr.shape[-2], arr.shape[-1]))
                            slope = float(getattr(full_ds, "RescaleSlope", 1.0))
                            intercept = float(getattr(full_ds, "RescaleIntercept", 0.0))
                            volume_slices.append(arr * slope + intercept)
                        except Exception:
                            continue

                if volume_slices:
                    vol_np = np.stack(volume_slices, axis=0)
                    if vol_np.ndim == 4:
                        vol_np = vol_np[..., 0]
                    elif vol_np.ndim == 2:
                        vol_np = np.expand_dims(vol_np, axis=0)
                    d, h, w = vol_np.shape[:3]
                    vol_np = vol_np.reshape((d, h, w))
                    vol_int16 = np.clip(vol_np, -1024, 3071).astype(np.int16)
                    series_data.volume_hu = vol_int16
                    series_data.dims = [w, h, d]
                    hist, _ = np.histogram(vol_int16, bins=100, range=(-1024, 3071))
                    series_data.histogram = hist.tolist()
                else:
                    series_data.dims = [512, 512, len(slice_list)]

            self.series_store[s_uid] = series_data

            is_scout = "scout" in meta["description"].lower() or "surview" in meta["description"].lower() or len(slice_list) <= 3
            series_summaries.append({
                "series_instance_uid": s_uid,
                "series_description": meta["description"],
                "modality": meta["modality"],
                "num_slices": len(slice_list),
                "is_scout": is_scout,
                "pixel_spacing": [sx, sy],
                "slice_thickness": sz,
                "dimensions": series_data.dims,
                "patient_name": meta["patient_name"],
                "patient_id": meta["patient_id"],
                "raw_tags": series_data.raw_tags[:50]
            })

        study_summary = {
            "study_id": study_id,
            "patient_name": series_summaries[0]["patient_name"] if series_summaries else "Anonymous",
            "patient_id": series_summaries[0]["patient_id"] if series_summaries else "EX-9021",
            "series": series_summaries
        }
        self.studies[study_id] = study_summary
        return study_summary

    def get_series_volume_binary(self, series_id: str) -> bytes:
        """
        Packs metadata JSON header + raw int16 volume buffer into a fast binary payload:
        [uint32 header_length] + [UTF-8 JSON header bytes] + [int16 raw volume bytes]
        """
        if series_id not in self.series_store:
            raise KeyError(f"Series {series_id} not found.")

        series = self.series_store[series_id]
        if series.volume_hu is None:
            raise ValueError(f"Series {series_id} has no pixel data loaded.")

        vol = series.volume_hu # (depth, height, width)
        d, h, w = vol.shape

        header = {
            "series_id": series.series_id,
            "description": series.description,
            "modality": series.modality,
            "dims": [w, h, d],
            "spacing": series.spacing,
            "origin": series.origin,
            "direction": series.direction,
            "window_center": series.window_center,
            "window_width": series.window_width,
            "histogram": series.histogram
        }
        header_bytes = json.dumps(header).encode("utf-8")
        header_len = len(header_bytes)

        # 4 bytes little-endian length prefix
        prefix = struct.pack("<I", header_len)
        raw_vol_bytes = vol.tobytes()

        return prefix + header_bytes + raw_vol_bytes

    def get_series_tags(self, series_id: str) -> List[Dict[str, str]]:
        if series_id not in self.series_store:
            raise KeyError(f"Series {series_id} not found.")
        return self.series_store[series_id].raw_tags

# Global instance
dicom_service = DicomService()
