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

app = FastAPI(title="MEDAM Studio Scientific Backend", version="1.0.0")

# Enable CORS for local Vite dev frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
