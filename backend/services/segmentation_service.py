import time
from typing import Dict, List, Any, Optional
import numpy as np
import scipy.ndimage as ndi
import SimpleITK as sitk
from .dicom_service import dicom_service

class MaskLayer:
    def __init__(self, mask_id: str, name: str, color: str, dims: List[int]):
        self.mask_id: str = mask_id
        self.name: str = name
        self.color: str = color # e.g. '#0284C7'
        self.visible: bool = True
        self.dims: List[int] = dims # [w, h, d]
        # Binary mask stored as uint8 numpy array shape (depth, height, width)
        self.data: np.ndarray = np.zeros((dims[2], dims[1], dims[0]), dtype=np.uint8)
        self.min_hu: int = 226
        self.max_hu: int = 3071
        self.history_stack: List[np.ndarray] = []

    def push_undo(self):
        # Keep maximum 5 undo states to optimize memory
        if len(self.history_stack) >= 5:
            self.history_stack.pop(0)
        self.history_stack.append(self.data.copy())

    def pop_undo(self) -> bool:
        if self.history_stack:
            self.data = self.history_stack.pop()
            return True
        return False

    def to_dict(self) -> Dict[str, Any]:
        voxel_count = int(np.count_nonzero(self.data))
        return {
            "mask_id": self.mask_id,
            "name": self.name,
            "color": self.color,
            "visible": self.visible,
            "min_hu": self.min_hu,
            "max_hu": self.max_hu,
            "voxel_count": voxel_count,
            "dims": self.dims
        }

class SegmentationService:
    def __init__(self):
        # Series UID -> { mask_id -> MaskLayer }
        self.series_masks: Dict[str, Dict[str, MaskLayer]] = {}
        # Predefined clinical colors for automatic layer assignment
        self.palette = [
            "#0284C7", "#10B981", "#F59E0B", "#EC4899", 
            "#8B5CF6", "#14B8A6", "#F97316", "#06B6D4"
        ]

    def _get_or_create_series_masks(self, series_id: str) -> Dict[str, MaskLayer]:
        if series_id not in self.series_masks:
            self.series_masks[series_id] = {}
        return self.series_masks[series_id]

    def get_masks(self, series_id: str) -> List[Dict[str, Any]]:
        masks = self._get_or_create_series_masks(series_id)
        return [m.to_dict() for m in masks.values()]

    def get_mask_slice_binary(self, series_id: str, mask_id: str, plane: str, slice_index: int) -> bytes:
        """
        Returns raw uint8 slice buffer of the mask for fast 2D canvas overlay
        """
        masks = self._get_or_create_series_masks(series_id)
        if mask_id not in masks:
            raise KeyError(f"Mask {mask_id} not found.")

        data = masks[mask_id].data # (depth, height, width)
        d, h, w = data.shape

        if plane == "axial":
            idx = max(0, min(d - 1, slice_index))
            slice_data = data[idx, :, :]
        elif plane == "coronal":
            idx = max(0, min(h - 1, slice_index))
            slice_data = data[:, idx, :]
        elif plane == "sagittal":
            idx = max(0, min(w - 1, slice_index))
            slice_data = data[:, :, idx]
        else:
            raise ValueError(f"Invalid plane: {plane}")

        return slice_data.tobytes()

    def threshold(self, series_id: str, mask_id: Optional[str], name: str, 
                  min_hu: int, max_hu: int, color: Optional[str] = None) -> Dict[str, Any]:
        """
        Calculates or updates binary threshold mask: min_hu <= HU <= max_hu
        """
        if series_id not in dicom_service.series_store:
            raise KeyError(f"Series {series_id} not loaded.")

        series = dicom_service.series_store[series_id]
        if series.volume_hu is None:
            raise ValueError("No volume data loaded.")

        vol = series.volume_hu
        d, h, w = vol.shape
        masks = self._get_or_create_series_masks(series_id)

        target_id = mask_id or f"mask_{len(masks) + 1}_{int(time.time())}"
        target_color = color or self.palette[len(masks) % len(self.palette)]

        if target_id not in masks:
            masks[target_id] = MaskLayer(target_id, name, target_color, [w, h, d])

        mask = masks[target_id]
        mask.push_undo()
        mask.name = name
        mask.color = target_color
        mask.min_hu = min_hu
        mask.max_hu = max_hu

        # High-speed numpy vectorized threshold
        binary_arr = ((vol >= min_hu) & (vol <= max_hu)).astype(np.uint8)
        mask.data = binary_arr

        return mask.to_dict()

    def region_grow(self, series_id: str, mask_id: Optional[str], 
                    seed: List[int], min_hu: int, max_hu: int) -> Dict[str, Any]:
        """
        Connected threshold region grow from seed voxel [x, y, z],
        followed by local hole filling and 1-voxel closing to prevent trabecular gaps,
        accumulated (OR) into active mask.
        """
        if series_id not in dicom_service.series_store:
            raise KeyError(f"Series {series_id} not loaded.")

        series = dicom_service.series_store[series_id]
        vol = series.volume_hu
        if vol is None:
            raise ValueError("Volume not loaded.")

        d, h, w = vol.shape
        x, y, z = seed
        if not (0 <= x < w and 0 <= y < h and 0 <= z < d):
            raise IndexError("Seed out of bounds.")

        masks = self._get_or_create_series_masks(series_id)
        target_id = mask_id or f"mask_{len(masks) + 1}_{int(time.time())}"
        if target_id not in masks:
            target_color = self.palette[len(masks) % len(self.palette)]
            masks[target_id] = MaskLayer(target_id, f"Region Grow {len(masks) + 1}", target_color, [w, h, d])

        mask = masks[target_id]
        mask.push_undo()

        # SimpleITK ConnectedThreshold
        sitk_img = sitk.GetImageFromArray(vol)
        sitk_img.SetSpacing(series.spacing)

        # Region grow
        grown = sitk.ConnectedThreshold(
            sitk_img,
            seedList=[[int(x), int(y), int(z)]],
            lower=float(min_hu),
            upper=float(max_hu),
            replaceValue=1
        )

        # Apply local 3D hole filling & 1-voxel morphological closing pass
        filled = sitk.BinaryFillhole(grown, fullyConnected=True)
        closed = sitk.BinaryMorphologicalClosing(filled, [1, 1, 1])

        grown_arr = sitk.GetArrayFromImage(closed).astype(np.uint8)

        # Accumulate (bitwise OR) into active mask
        mask.data = np.bitwise_or(mask.data, grown_arr)
        mask.min_hu = min_hu
        mask.max_hu = max_hu

        return mask.to_dict()

    def undo_region_grow(self, series_id: str, mask_id: str) -> Dict[str, Any]:
        masks = self._get_or_create_series_masks(series_id)
        if mask_id not in masks:
            raise KeyError(f"Mask {mask_id} not found.")
        mask = masks[mask_id]
        success = mask.pop_undo()
        info = mask.to_dict()
        info["undone"] = success
        return info

    def split_mask(self, series_id: str, source_mask_id: str, 
                   seeds_a: List[List[int]], seeds_b: List[List[int]]) -> Dict[str, Any]:
        """
        Splits a single mask into Bone A and Bone B using MorphologicalWatershedFromMarkers
        """
        masks = self._get_or_create_series_masks(series_id)
        if source_mask_id not in masks:
            raise KeyError(f"Source mask {source_mask_id} not found.")

        src = masks[source_mask_id]
        data = src.data
        d, h, w = data.shape

        # Create marker volume
        marker_arr = np.zeros((d, h, w), dtype=np.int32)
        for s in seeds_a:
            sx, sy, sz = s
            if 0 <= sx < w and 0 <= sy < h and 0 <= sz < d:
                marker_arr[sz, sy, sx] = 1 # Label 1: Bone A
        for s in seeds_b:
            sx, sy, sz = s
            if 0 <= sx < w and 0 <= sy < h and 0 <= sz < d:
                marker_arr[sz, sy, sx] = 2 # Label 2: Bone B

        sitk_mask = sitk.GetImageFromArray(data)
        sitk_markers = sitk.GetImageFromArray(marker_arr)
        sitk_markers.CopyInformation(sitk_mask)

        # Morphological watershed
        dist = sitk.SignedMaurerDistanceMap(sitk_mask, insideIsPositive=True, useImageSpacing=True)
        ws = sitk.MorphologicalWatershedFromMarkers(dist, sitk_markers, markWatershedLine=False)
        ws_arr = sitk.GetArrayFromImage(ws)

        # Mask A: where label == 1 and src.data == 1
        mask_a_arr = ((ws_arr == 1) & (data == 1)).astype(np.uint8)
        mask_b_arr = ((ws_arr == 2) & (data == 1)).astype(np.uint8)

        id_a = f"{source_mask_id}_split_A"
        id_b = f"{source_mask_id}_split_B"

        layer_a = MaskLayer(id_a, f"{src.name} Part A", self.palette[0], [w, h, d])
        layer_a.data = mask_a_arr
        layer_b = MaskLayer(id_b, f"{src.name} Part B", self.palette[1], [w, h, d])
        layer_b.data = mask_b_arr

        masks[id_a] = layer_a
        masks[id_b] = layer_b

        return {
            "mask_a": layer_a.to_dict(),
            "mask_b": layer_b.to_dict()
        }

    def edit_mask(self, series_id: str, mask_id: str, operation: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Supports:
        - brush_draw / brush_erase: spherical brush at voxel [x,y,z] with radius_px
        - keep_largest_island: sitk.ConnectedComponent + sitk.RelabelComponent
        - fill_holes: sitk.BinaryFillhole
        - clear: wipe mask
        """
        masks = self._get_or_create_series_masks(series_id)
        if mask_id not in masks:
            raise KeyError(f"Mask {mask_id} not found.")

        mask = masks[mask_id]
        mask.push_undo()

        d, h, w = mask.data.shape

        if operation in ("brush_draw", "brush_erase"):
            vx, vy, vz = params["voxel"]
            radius = params.get("radius", 4)
            val = 1 if operation == "brush_draw" else 0

            z_min = max(0, vz - radius)
            z_max = min(d, vz + radius + 1)
            y_min = max(0, vy - radius)
            y_max = min(h, vy + radius + 1)
            x_min = max(0, vx - radius)
            x_max = min(w, vx + radius + 1)

            zz, yy, xx = np.ogrid[z_min:z_max, y_min:y_max, x_min:x_max]
            dist_sq = (xx - vx)**2 + (yy - vy)**2 + (zz - vz)**2
            sphere_mask = dist_sq <= (radius**2)

            sub_vol = mask.data[z_min:z_max, y_min:y_max, x_min:x_max]
            if val == 1:
                sub_vol[sphere_mask] = 1
            else:
                sub_vol[sphere_mask] = 0
            mask.data[z_min:z_max, y_min:y_max, x_min:x_max] = sub_vol

        elif operation == "keep_largest_island":
            sitk_mask = sitk.GetImageFromArray(mask.data)
            cc = sitk.ConnectedComponent(sitk_mask)
            relabelled = sitk.RelabelComponent(cc)
            relabel_arr = sitk.GetArrayFromImage(relabelled)
            # Label 1 is the largest connected component
            mask.data = (relabel_arr == 1).astype(np.uint8)

        elif operation == "fill_holes":
            sitk_mask = sitk.GetImageFromArray(mask.data)
            filled = sitk.BinaryFillhole(sitk_mask, fullyConnected=True)
            mask.data = sitk.GetArrayFromImage(filled).astype(np.uint8)

        elif operation == "clear":
            mask.data.fill(0)

        return mask.to_dict()

    def seed_segment(self, series_id: str, config: Dict[str, Any], is_preview: bool = False) -> Dict[str, Any]:
        """
        Docked 3-Step Seed Segment Engine:
        Competitive watershed with Need Seed (positive markers) and Not Need (exclusion markers),
        sensitivity scaling gradient barriers, finishing gap closing, and medullary cavity filling.
        """
        t0 = time.time()
        if series_id not in dicom_service.series_store:
            raise KeyError(f"Series {series_id} not loaded.")

        series = dicom_service.series_store[series_id]
        vol = series.volume_hu
        if vol is None:
            raise ValueError("Volume not loaded.")

        d, h, w = vol.shape
        bones_config = config.get("bones", [])
        global_not_need = config.get("not_need_seeds", [])
        gap_closing_px = int(config.get("gap_closing_px", 2))
        fill_long_bones = bool(config.get("fill_long_bones", True))

        if not bones_config:
            raise ValueError("No bones specified in seed segment config.")

        # Markers volume: label 1..N for bones, label 999 for Not Need barriers
        marker_arr = np.zeros((d, h, w), dtype=np.int32)
        bone_labels: Dict[int, Dict[str, Any]] = {}

        label_counter = 1
        min_hu_all = 150
        max_hu_all = 3071
        seed_thresh_hu = 150
        sensitivity = 50.0

        for bone in bones_config:
            lbl = label_counter
            bone_labels[lbl] = bone
            label_counter += 1

            seed_thresh_hu = bone.get("seed_threshold_hu", seed_thresh_hu)
            sensitivity = float(bone.get("sensitivity", 50.0))
            min_hu_all = min(min_hu_all, bone.get("min_hu", 150))
            max_hu_all = max(max_hu_all, bone.get("max_hu", 3071))

            for s in bone.get("need_seeds", []):
                sx, sy, sz = s
                if 0 <= sx < w and 0 <= sy < h and 0 <= sz < d:
                    # Place a 3-voxel ball marker for robust watershed seeding
                    z0, z1 = max(0, sz-1), min(d, sz+2)
                    y0, y1 = max(0, sy-1), min(h, sy+2)
                    x0, x1 = max(0, sx-1), min(w, sx+2)
                    marker_arr[z0:z1, y0:y1, x0:x1] = lbl

            for s in bone.get("not_need_seeds", []):
                sx, sy, sz = s
                if 0 <= sx < w and 0 <= sy < h and 0 <= sz < d:
                    z0, z1 = max(0, sz-1), min(d, sz+2)
                    y0, y1 = max(0, sy-1), min(h, sy+2)
                    x0, x1 = max(0, sx-1), min(w, sx+2)
                    marker_arr[z0:z1, y0:y1, x0:x1] = 999

        for s in global_not_need:
            sx, sy, sz = s
            if 0 <= sx < w and 0 <= sy < h and 0 <= sz < d:
                marker_arr[sz, sy, sx] = 999

        # Domain restriction: voxels in HU threshold domain
        domain_mask = (vol >= seed_thresh_hu) & (vol <= max_hu_all)

        # Sensitivity: scale morphological gradient smoothing sigma
        # Higher sensitivity (-> 100) relaxes barriers; lower (-> 0) enforces sharp cortical borders
        sigma = max(0.5, 3.0 - (sensitivity / 50.0) * 1.5)

        sitk_vol = sitk.GetImageFromArray(vol.astype(np.float32))
        sitk_vol.SetSpacing(series.spacing)

        # Compute gradient magnitude
        grad = sitk.GradientMagnitudeRecursiveGaussian(sitk_vol, sigma=sigma)
        sitk_markers = sitk.GetImageFromArray(marker_arr)
        sitk_markers.CopyInformation(grad)

        # Competitive watershed from markers
        ws = sitk.MorphologicalWatershedFromMarkers(grad, sitk_markers, markWatershedLine=False)
        ws_arr = sitk.GetArrayFromImage(ws)

        # Restrict watershed output to bone domain
        ws_arr = np.where(domain_mask, ws_arr, 0)

        # Exclusion mask (label 999) renders in black (#000000) on DICOM preview
        exclusion_mask = (ws_arr == 999).astype(np.uint8)

        masks_result = []
        masks_registry = self._get_or_create_series_masks(series_id)

        for lbl, bone in bone_labels.items():
            bone_raw = (ws_arr == lbl).astype(np.uint8)

            # Finishing: morphological closing and medullary filling
            if gap_closing_px > 0:
                sitk_b = sitk.GetImageFromArray(bone_raw)
                sitk_b.SetSpacing(series.spacing)
                closed_b = sitk.BinaryMorphologicalClosing(sitk_b, [gap_closing_px]*3)
                bone_raw = sitk.GetArrayFromImage(closed_b).astype(np.uint8)

            if fill_long_bones:
                # Axial slice-by-slice medullary cavity hole filling
                for z_idx in range(d):
                    slice_b = bone_raw[z_idx, :, :]
                    if np.any(slice_b):
                        bone_raw[z_idx, :, :] = ndi.binary_fill_holes(slice_b).astype(np.uint8)

            bone_id = bone.get("id", f"bone_{lbl}_{int(time.time())}")
            bone_name = bone.get("name", f"Bone {lbl}")
            bone_color = bone.get("color", self.palette[(lbl - 1) % len(self.palette)])

            if not is_preview:
                # Store permanent mask layer
                layer = MaskLayer(bone_id, bone_name, bone_color, [w, h, d])
                layer.data = bone_raw
                layer.min_hu = bone.get("min_hu", min_hu_all)
                layer.max_hu = bone.get("max_hu", max_hu_all)
                masks_registry[bone_id] = layer
                masks_result.append(layer.to_dict())
            else:
                voxel_count = int(np.count_nonzero(bone_raw))
                masks_result.append({
                    "mask_id": bone_id,
                    "name": bone_name,
                    "color": bone_color,
                    "voxel_count": voxel_count,
                    "dims": [w, h, d]
                })

        computation_time = round(time.time() - t0, 3)

        return {
            "success": True,
            "computation_time_sec": computation_time,
            "masks": masks_result,
            "has_exclusion": bool(np.any(exclusion_mask)),
            "message": f"{len(masks_result)} bone mask{'s' if len(masks_result) > 1 else ''} calculated in {computation_time} s"
        }

# Global instance
segmentation_service = SegmentationService()
