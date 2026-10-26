import os
import json
import struct
import time
from typing import Dict, List, Any, Optional
import numpy as np
import vtk
from vtk.util import numpy_support

from .dicom_service import dicom_service
from .segmentation_service import segmentation_service

class MeshObject:
    def __init__(self, object_id: str, name: str, color: str, series_id: str):
        self.object_id: str = object_id
        self.name: str = name
        self.color: str = color
        self.series_id: str = series_id
        self.visible: bool = True
        self.opacity: float = 1.0
        self.num_vertices: int = 0
        self.num_triangles: int = 0
        self.vertices: np.ndarray = np.empty((0, 3), dtype=np.float32)
        self.normals: np.ndarray = np.empty((0, 3), dtype=np.float32)
        self.indices: np.ndarray = np.empty(0, dtype=np.uint32)
        self.polydata: Any = None
        self.is_watertight: bool = True
        self.created_at: float = time.time()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "object_id": self.object_id,
            "name": self.name,
            "color": self.color,
            "series_id": self.series_id,
            "visible": self.visible,
            "opacity": self.opacity,
            "num_vertices": self.num_vertices,
            "num_triangles": self.num_triangles,
            "is_watertight": self.is_watertight
        }

class MeshService:
    def __init__(self):
        # object_id -> MeshObject
        self.objects: Dict[str, MeshObject] = {}

    def get_objects(self, series_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if series_id:
            objs = [o for o in self.objects.values() if o.series_id == series_id]
        else:
            objs = list(self.objects.values())
        return [o.to_dict() for o in objs]

    def delete_object(self, object_id: str) -> bool:
        if object_id in self.objects:
            del self.objects[object_id]
            return True
        return False

    def calculate_mesh(self, series_id: str, mask_ids: List[str], 
                       quality: str = "High",
                       smooth_iterations: int = 15,
                       reduce_percent: int = 0,
                       wrap: bool = True) -> Dict[str, Any]:
        """
        Converts one or more binary masks into a 3D triangle mesh using VTK C++ pipeline:
        1. 1-voxel zero-padding for watertight closure
        2. vtkImageData setup with exact millimeter spacing
        3. vtkFlyingEdges3D iso-surface extraction
        4. Volume-preserving smoothing via vtkWindowedSincPolyDataFilter
        5. Quadric decimation (if reduce requested)
        6. Hole filling & normal generation (vtkFillHolesFilter + vtkPolyDataNormals)
        """
        t0 = time.time()
        if series_id not in dicom_service.series_store:
            raise KeyError(f"Series {series_id} not loaded.")

        series = dicom_service.series_store[series_id]
        masks_registry = segmentation_service._get_or_create_series_masks(series_id)

        target_masks = [masks_registry[mid] for mid in mask_ids if mid in masks_registry]
        if not target_masks:
            raise ValueError("No valid masks found for calculation.")

        # Union selected masks into single 3D volume
        base_shape = target_masks[0].data.shape
        combined = np.zeros(base_shape, dtype=np.uint8)
        for m in target_masks:
            combined = np.bitwise_or(combined, m.data)

        if not np.any(combined):
            raise ValueError("Selected masks are empty (no segmented voxels).")

        # 1. 1-voxel zero-padding on all 6 faces to mathematically seal ends
        padded = np.pad(combined, pad_width=1, mode='constant', constant_values=0)
        pd, ph, pw = padded.shape # (z, y, x)

        # 2. Setup vtkImageData with physical spacing
        sx, sy, sz = series.spacing
        image_data = vtk.vtkImageData()
        image_data.SetDimensions(pw, ph, pd)
        image_data.SetSpacing(sx, sy, sz)
        # Shift origin to account for 1-voxel padding offset
        image_data.SetOrigin(series.origin[0] - sx, series.origin[1] - sy, series.origin[2] - sz)

        # Transfer numpy array to VTK (Fortran order / contiguous)
        vtk_arr = numpy_support.numpy_to_vtk(padded.ravel(), deep=True, array_type=vtk.VTK_UNSIGNED_CHAR)
        vtk_arr.SetName("Scalars")
        image_data.GetPointData().SetScalars(vtk_arr)

        current_output_port = image_data

        # Quality presets
        if quality == "Low":
            shrink = vtk.vtkImageShrink3D()
            shrink.SetInputData(image_data)
            shrink.SetShrinkFactors(2, 2, 2)
            shrink.AveragingOff()
            shrink.Update()
            current_output_port = shrink.GetOutput()
        elif quality == "Optimal":
            wrap = True
            smooth_iterations = max(smooth_iterations, 20)

        # 3. Iso-surface extraction with vtkFlyingEdges3D
        surface = vtk.vtkFlyingEdges3D()
        if isinstance(current_output_port, vtk.vtkImageData):
            surface.SetInputData(current_output_port)
        else:
            surface.SetInputConnection(current_output_port.GetOutputPort())
        surface.SetValue(0, 0.5)
        surface.ComputeNormalsOff()
        surface.ComputeGradientsOff()
        surface.Update()

        polydata = surface.GetOutput()

        # 4. Volume-preserving smoothing (Windowed Sinc)
        if smooth_iterations > 0:
            smoother = vtk.vtkWindowedSincPolyDataFilter()
            smoother.SetInputData(polydata)
            smoother.SetNumberOfIterations(smooth_iterations)
            smoother.SetPassBand(0.05)
            smoother.BoundarySmoothingOff()
            smoother.FeatureEdgeSmoothingOff()
            smoother.NonManifoldSmoothingOn()
            smoother.NormalizeCoordinatesOn()
            smoother.Update()
            polydata = smoother.GetOutput()

        # 5. Decimation if reduce_percent > 0
        if reduce_percent > 0:
            decimator = vtk.vtkQuadricDecimation()
            decimator.SetInputData(polydata)
            decimator.SetTargetReduction(min(0.9, reduce_percent / 100.0))
            decimator.Update()
            polydata = decimator.GetOutput()

        # 6. Watertight hole filling & smooth normals
        if wrap or quality == "Optimal":
            filler = vtk.vtkFillHolesFilter()
            filler.SetInputData(polydata)
            filler.SetHoleSize(1000.0)
            filler.Update()
            polydata = filler.GetOutput()

        cleaner = vtk.vtkCleanPolyData()
        cleaner.SetInputData(polydata)
        cleaner.Update()
        polydata = cleaner.GetOutput()

        normals_filter = vtk.vtkPolyDataNormals()
        normals_filter.SetInputData(polydata)
        normals_filter.ConsistencyOn()
        normals_filter.AutoOrientNormalsOn()
        normals_filter.SplittingOff()
        normals_filter.ComputePointNormalsOn()
        normals_filter.Update()
        polydata = normals_filter.GetOutput()

        # Convert to numpy arrays
        points = polydata.GetPoints()
        num_pts = points.GetNumberOfPoints() if points else 0
        verts_np = numpy_support.vtk_to_numpy(points.GetData()).astype(np.float32) if num_pts > 0 else np.empty((0, 3), dtype=np.float32)

        p_normals = polydata.GetPointData().GetNormals()
        normals_np = numpy_support.vtk_to_numpy(p_normals).astype(np.float32) if p_normals else np.empty((0, 3), dtype=np.float32)

        # Extract triangle indices
        polys = polydata.GetPolys()
        num_cells = polydata.GetNumberOfPolys()
        indices_list = []
        if polys and num_cells > 0:
            id_list = vtk.vtkIdList()
            polys.InitTraversal()
            while polys.GetNextCell(id_list):
                if id_list.GetNumberOfIds() == 3:
                    indices_list.extend([id_list.GetId(0), id_list.GetId(1), id_list.GetId(2)])
        indices_np = np.array(indices_list, dtype=np.uint32)

        obj_id = f"obj_{len(self.objects) + 1}_{int(time.time())}"
        name = target_masks[0].name + (" (Solid)" if len(target_masks) == 1 else " (Combined)")
        color = target_masks[0].color

        mesh_obj = MeshObject(obj_id, name, color, series_id)
        mesh_obj.num_vertices = num_pts
        mesh_obj.num_triangles = len(indices_list) // 3
        mesh_obj.vertices = verts_np
        mesh_obj.normals = normals_np
        mesh_obj.indices = indices_np
        mesh_obj.polydata = polydata
        mesh_obj.is_watertight = True

        self.objects[obj_id] = mesh_obj
        calc_time = round(time.time() - t0, 3)

        result_dict = mesh_obj.to_dict()
        result_dict["calculation_time_sec"] = calc_time
        return result_dict

    def get_mesh_binary(self, object_id: str) -> bytes:
        """
        Packs mesh metadata + float32 vertices + float32 normals + uint32 indices
        [uint32 header_len] + [UTF-8 JSON header] + [vertices] + [normals] + [indices]
        """
        if object_id not in self.objects:
            raise KeyError(f"Object {object_id} not found.")

        obj = self.objects[object_id]
        header = {
            "object_id": obj.object_id,
            "name": obj.name,
            "color": obj.color,
            "series_id": obj.series_id,
            "num_vertices": obj.num_vertices,
            "num_triangles": obj.num_triangles,
            "opacity": obj.opacity,
            "is_watertight": obj.is_watertight
        }

        header_bytes = json.dumps(header).encode("utf-8")
        header_len = len(header_bytes)

        prefix = struct.pack("<I", header_len)
        verts_bytes = obj.vertices.tobytes()
        normals_bytes = obj.normals.tobytes()
        indices_bytes = obj.indices.tobytes()

        return prefix + header_bytes + verts_bytes + normals_bytes + indices_bytes

    def export_stl(self, object_id: str) -> bytes:
        """
        Exports the 3D surface model as a watertight binary STL file
        """
        if object_id not in self.objects:
            raise KeyError(f"Object {object_id} not found.")

        obj = self.objects[object_id]
        if obj.polydata is None or obj.num_triangles == 0:
            raise ValueError("Object has no geometry to export.")

        import tempfile
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".stl")
        os.close(tmp_fd)
        try:
            writer = vtk.vtkSTLWriter()
            writer.SetInputData(obj.polydata)
            writer.SetFileName(tmp_path)
            writer.SetFileTypeToBinary()
            writer.Write()
            with open(tmp_path, "rb") as f:
                return f.read()
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

# Global instance
mesh_service = MeshService()
