import os
import json
import asyncio
import shutil
import tempfile
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.dicom_service import dicom_service
from services.segmentation_service import segmentation_service
from services.mesh_service import mesh_service
from services.design_service import design_service
from routers import datum_router

app = FastAPI(title="MEDAM Studio Scientific Backend", version="1.0.0")

# Enable CORS for local Vite dev frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Sub-Routers
app.include_router(datum_router.router)

# ----------------- Models -----------------
class IngestRequest(BaseModel):
    path: Optional[str] = "C:\\Users\\ShubhamAhluwalia\\Downloads\\Compressed\\KAMLESH 202603583814.zip"

class ThresholdRequest(BaseModel):
    series_id: str
    mask_id: Optional[str] = None
    name: str = "Threshold Mask"
    min_hu: int = 226
    max_hu: int = 3071
    color: Optional[str] = None

class RegionGrowRequest(BaseModel):
    series_id: str
    mask_id: Optional[str] = None
    seed: List[int] # [x, y, z]
    min_hu: int = 150
    max_hu: int = 3071

class UndoRegionGrowRequest(BaseModel):
    series_id: str
    mask_id: str

class SplitMaskRequest(BaseModel):
    series_id: str
    source_mask_id: str
    seeds_a: List[List[int]]
    seeds_b: List[List[int]]

class EditMaskRequest(BaseModel):
    series_id: str
    mask_id: str
    operation: str # brush_draw, brush_erase, keep_largest_island, fill_holes, clear
    params: Dict[str, Any] = {}

class SeedSegmentConfig(BaseModel):
    bones: List[Dict[str, Any]]
    not_need_seeds: List[List[int]] = []
    gap_closing_px: int = 2
    fill_long_bones: bool = True

class CalculateMeshRequest(BaseModel):
    series_id: str
    mask_ids: List[str]
    quality: str = "High" # Low, Medium, High, Optimal
    smooth_iterations: int = 15
    reduce_percent: int = 0
    wrap: bool = True

# ----------------- Endpoints -----------------

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "app": "MEDAM Studio",
        "version": "1.0.0",
        "loaded_series_count": len(dicom_service.series_store),
        "calculated_objects_count": len(mesh_service.objects)
    }

@app.post("/api/dicom/ingest")
def ingest_dicom(req: IngestRequest):
    target_path = req.path or "C:\\Users\\ShubhamAhluwalia\\Downloads\\Compressed\\KAMLESH 202603583814.zip"
    try:
        res = dicom_service.ingest_path(target_path)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/dicom/upload")
async def upload_dicom(files: List[UploadFile] = File(...)):
    """
    Ingests dragged & dropped or browsed DICOM folder files or .ZIP archive.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    td = tempfile.TemporaryDirectory(prefix="medam_upload_")
    dicom_service.temp_dirs.append(td)
    upload_dir = td.name

    try:
        # Check if single zip file
        if len(files) == 1 and files[0].filename and files[0].filename.lower().endswith(".zip"):
            zip_dest = os.path.join(upload_dir, files[0].filename)
            with open(zip_dest, "wb") as f_out:
                shutil.copyfileobj(files[0].file, f_out)
            res = dicom_service.ingest_path(zip_dest)
            return res
        else:
            # Multiple files from folder or individual slices
            for idx, f in enumerate(files):
                # Preserve directory structure or ensure uniqueness
                fname = f.filename or f"slice_{idx}.dcm"
                rel_path = fname.replace("\\", "/").lstrip("/")
                dest_path = os.path.join(upload_dir, rel_path)
                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                with open(dest_path, "wb") as f_out:
                    shutil.copyfileobj(f.file, f_out)
            res = dicom_service.ingest_path(upload_dir)
            return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/dicom/ingest/stream")
async def ingest_dicom_stream(path: str = "C:\\Users\\ShubhamAhluwalia\\Downloads\\Compressed\\KAMLESH 202603583814.zip"):
    """
    SSE stream for real-time import progress
    """
    async def event_generator():
        queue = asyncio.Queue()

        def callback(event_data):
            queue.put_nowait(event_data)

        # Run ingestion in worker thread
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.get_event_loop()
        future = loop.run_in_executor(None, dicom_service.ingest_path, path, callback)

        while not future.done() or not queue.empty():
            try:
                data = await asyncio.wait_for(queue.get(), timeout=0.1)
                yield f"data: {json.dumps(data)}\n\n"
            except asyncio.TimeoutError:
                pass

        try:
            res = await future
            yield f"data: {json.dumps({'stage': 'Complete', 'percent': 100, 'result': res})}\n\n"
        except Exception as ex:
            yield f"data: {json.dumps({'error': str(ex)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/dicom/series/{series_id}/volume-binary")
def get_volume_binary(series_id: str):
    try:
        bin_data = dicom_service.get_series_volume_binary(series_id)
        return Response(content=bin_data, media_type="application/octet-stream")
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))

@app.get("/api/dicom/series/{series_id}/tags")
def get_series_tags(series_id: str):
    try:
        return dicom_service.get_series_tags(series_id)
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))

# ----------------- Segmentation Endpoints -----------------

@app.get("/api/segment/masks")
def list_masks(series_id: str = Query(...)):
    return segmentation_service.get_masks(series_id)

@app.get("/api/segment/mask/{mask_id}/slice-binary")
def get_mask_slice(mask_id: str, series_id: str = Query(...), plane: str = Query(...), slice_index: int = Query(...)):
    try:
        b = segmentation_service.get_mask_slice_binary(series_id, mask_id, plane, slice_index)
        return Response(content=b, media_type="application/octet-stream")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/segment/threshold")
def threshold_mask(req: ThresholdRequest):
    try:
        return segmentation_service.threshold(
            series_id=req.series_id,
            mask_id=req.mask_id,
            name=req.name,
            min_hu=req.min_hu,
            max_hu=req.max_hu,
            color=req.color
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/segment/region-grow")
def region_grow_mask(req: RegionGrowRequest):
    try:
        return segmentation_service.region_grow(
            series_id=req.series_id,
            mask_id=req.mask_id,
            seed=req.seed,
            min_hu=req.min_hu,
            max_hu=req.max_hu
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/segment/region-grow/undo")
def undo_region_grow_mask(req: UndoRegionGrowRequest):
    try:
        return segmentation_service.undo_region_grow(req.series_id, req.mask_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/segment/split-mask")
def split_mask(req: SplitMaskRequest):
    try:
        return segmentation_service.split_mask(
            series_id=req.series_id,
            source_mask_id=req.source_mask_id,
            seeds_a=req.seeds_a,
            seeds_b=req.seeds_b
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/segment/edit-mask")
def edit_mask(req: EditMaskRequest):
    try:
        return segmentation_service.edit_mask(
            series_id=req.series_id,
            mask_id=req.mask_id,
            operation=req.operation,
            params=req.params
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/segment/seed-segment/preview")
def seed_segment_preview(series_id: str = Query(...), config: Optional[SeedSegmentConfig] = None):
    try:
        cfg_dict = (config.model_dump() if hasattr(config, "model_dump") else config.dict()) if config else {}
        return segmentation_service.seed_segment(series_id, cfg_dict, is_preview=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/segment/seed-segment/calculate")
def seed_segment_calculate(series_id: str = Query(...), config: Optional[SeedSegmentConfig] = None):
    try:
        cfg_dict = (config.model_dump() if hasattr(config, "model_dump") else config.dict()) if config else {}
        return segmentation_service.seed_segment(series_id, cfg_dict, is_preview=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ----------------- Mesh & STL Endpoints -----------------

@app.get("/api/objects")
def list_objects(series_id: Optional[str] = None):
    return mesh_service.get_objects(series_id)

@app.post("/api/objects/calculate")
def calculate_mesh(req: CalculateMeshRequest):
    try:
        return mesh_service.calculate_mesh(
            series_id=req.series_id,
            mask_ids=req.mask_ids,
            quality=req.quality,
            smooth_iterations=req.smooth_iterations,
            reduce_percent=req.reduce_percent,
            wrap=req.wrap
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/objects/{object_id}/binary")
def get_object_binary(object_id: str):
    try:
        bin_data = mesh_service.get_mesh_binary(object_id)
        return Response(content=bin_data, media_type="application/octet-stream")
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))

@app.get("/api/objects/{object_id}/export-stl")
def export_stl(object_id: str):
    try:
        stl_bytes = mesh_service.export_stl(object_id)
        filename = f"medam_mesh_{object_id}.stl"
        return Response(
            content=stl_bytes,
            media_type="application/sla",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/objects/{object_id}")
def delete_object(object_id: str):
    success = mesh_service.delete_object(object_id)
    if not success:
        raise HTTPException(status_code=404, detail="Object not found.")
    return {"success": True}

# ----------------- Design Module Endpoints -----------------

class DesignBridgeRequest(BaseModel):
    object_id: str

class CutPlaneRequest(BaseModel):
    mesh_id: str
    plane_origin: List[float] = [0.0, 0.0, 0.0]
    plane_normal: List[float] = [0.0, 0.0, 1.0]

class DrillGuideRequest(BaseModel):
    mesh_id: str
    center: List[float] = [0.0, 0.0, 0.0]
    direction: List[float] = [0.0, 0.0, 1.0]
    diameter_mm: float = 3.5
    depth_mm: float = 40.0

class PlateLoftRequest(BaseModel):
    mesh_id: str
    thickness_mm: float = 2.5
    offset_mm: float = 0.2

class ICPAlignRequest(BaseModel):
    source_mesh_id: str
    target_mesh_id: str
    max_iterations: int = 30

class MirrorRequest(BaseModel):
    mesh_id: str
    axis: str = "x"

class HandoffRequest(BaseModel):
    mesh_id: str
    target_module: str

@app.post("/api/design/session/init-from-rados")
def init_design_from_rados(req: DesignBridgeRequest):
    if req.object_id not in mesh_service.objects:
        raise HTTPException(status_code=404, detail=f"Mesh object {req.object_id} not found in Rados.")
    obj = mesh_service.objects[req.object_id]
    loaded = design_service.load_from_mesh_object(obj)
    return {"status": "success", "mesh": loaded}

@app.get("/api/design/session/meshes")
def list_design_meshes():
    return design_service.list_meshes()

@app.get("/api/design/mesh/{mesh_id}/binary")
def get_design_mesh_binary(mesh_id: str):
    try:
        bin_data, _ = design_service.get_mesh_binary(mesh_id)
        return Response(content=bin_data, media_type="application/octet-stream")
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))

@app.post("/api/design/cut-plane")
def cut_plane(req: CutPlaneRequest):
    try:
        return design_service.apply_cut_plane(req.mesh_id, req.plane_origin, req.plane_normal)
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except Exception as ex:
        raise HTTPException(status_code=400, detail=str(ex))

@app.post("/api/design/drill-guide")
def drill_guide(req: DrillGuideRequest):
    try:
        return design_service.apply_drill_guide(
            req.mesh_id, req.center, req.direction, req.diameter_mm, req.depth_mm
        )
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except Exception as ex:
        raise HTTPException(status_code=400, detail=str(ex))

@app.post("/api/design/plate-loft")
def plate_loft(req: PlateLoftRequest):
    try:
        return design_service.generate_guide_plate(req.mesh_id, req.thickness_mm, req.offset_mm)
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except Exception as ex:
        raise HTTPException(status_code=400, detail=str(ex))

@app.post("/api/design/align-icp")
def align_icp(req: ICPAlignRequest):
    try:
        return design_service.align_icp(req.source_mesh_id, req.target_mesh_id, req.max_iterations)
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except Exception as ex:
        raise HTTPException(status_code=400, detail=str(ex))

@app.post("/api/design/mirror")
def mirror(req: MirrorRequest):
    try:
        return design_service.apply_mirror(req.mesh_id, req.axis)
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except Exception as ex:
        raise HTTPException(status_code=400, detail=str(ex))

@app.get("/api/design/mesh/{mesh_id}/export-stl")
def export_design_stl(mesh_id: str):
    try:
        stl_bytes = design_service.export_stl(mesh_id)
        filename = f"medam_design_{mesh_id}.stl"
        return Response(
            content=stl_bytes,
            media_type="application/sla",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except Exception as ex:
        raise HTTPException(status_code=400, detail=str(ex))

@app.post("/api/design/handoff")
def design_handoff(req: HandoffRequest):
    mesh = design_service.get_mesh(req.mesh_id)
    if not mesh:
        raise HTTPException(status_code=404, detail=f"Mesh {req.mesh_id} not found in Design Studio.")
    
    target = req.target_module.lower()
    return {
        "status": "success",
        "mesh_id": req.mesh_id,
        "target_module": target,
        "payload": {
            "name": mesh.name,
            "num_vertices": len(mesh.vertices),
            "num_triangles": len(mesh.faces),
            "ready_for_meshing": True,
            "ready_for_slicing": True,
            "recommended_layer_height_mm": 0.16,
            "recommended_infill_percent": 100 if "plate" in mesh.name.lower() else 30
        }
    }
