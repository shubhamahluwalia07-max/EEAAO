import os
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from models.datum_models import (
    datum_repo,
    PatientRecord,
    PatientCohort,
    PatientCreateRequest,
    PatientUpdateRequest,
    DatumBridgeRequest,
)
from services.dicom_service import dicom_service

router = APIRouter(prefix="/api/datum", tags=["Datum Clinical Registry"])

class SelectFolderRequest(BaseModel):
    folder_path: Optional[str] = None
    browse: Optional[bool] = False

@router.get("/config")
def get_config():
    """
    Get current Datum configuration, including default data folder.
    """
    return {
        "default_data_folder": datum_repo.get_default_data_folder()
    }

@router.post("/select-folder")
def select_folder(req: SelectFolderRequest):
    """
    Select or input default DICOM data folder, save to backend config,
    recursively scan for real patients, and populate Datum table.
    """
    folder = req.folder_path
    if req.browse:
        try:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', True)
            selected = filedialog.askdirectory(title="Select Default DICOM Data Folder")
            root.destroy()
            if selected:
                folder = selected
        except Exception as e:
            if not folder:
                raise HTTPException(status_code=500, detail=f"Native directory dialog error: {str(e)}")

    if not folder:
        raise HTTPException(status_code=400, detail="Folder path must be provided or selected via browser.")

    clean_folder = os.path.normpath(folder.strip('\'"'))
    if not os.path.exists(clean_folder):
        raise HTTPException(status_code=400, detail=f"Folder path does not exist on disk: {clean_folder}")

    try:
        datum_repo.set_default_data_folder(clean_folder)
        patients = datum_repo.scan_and_populate_from_folder(clean_folder)
        return {
            "status": "success",
            "folder_path": clean_folder,
            "patient_count": len(patients),
            "patients": [p.model_dump() for p in patients]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to scan DICOM folder: {str(e)}")

@router.post("/rescan")
def rescan_folder():
    """
    Rescan the configured default data folder and reload real patients.
    """
    folder = datum_repo.get_default_data_folder()
    if not folder or not os.path.exists(folder):
        raise HTTPException(status_code=400, detail="Default data folder is not set or missing.")
    try:
        patients = datum_repo.scan_and_populate_from_folder(folder)
        return {
            "status": "success",
            "folder_path": folder,
            "patient_count": len(patients),
            "patients": [p.model_dump() for p in patients]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to rescan folder: {str(e)}")

@router.get("/cohorts", response_model=List[PatientCohort])
def list_cohorts():
    """
    List all clinical trial patient cohorts with active patient counts.
    """
    try:
        return datum_repo.list_cohorts()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/patients", response_model=List[PatientRecord])
def list_patients(
    query: str = Query("", description="Search by 12-digit CR Number, Name, or AO/OTA code"),
    cohort_id: Optional[str] = Query(None, description="Filter by clinical cohort ID"),
):
    """
    Search-as-you-type query over clinical trial registry patients.
    """
    try:
        return datum_repo.list_patients(query=query, cohort_id=cohort_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/patients/{patient_id}", response_model=PatientRecord)
def get_patient(patient_id: str):
    """
    Get full clinical record and Dynamic EDC schema for a single patient.
    """
    p = datum_repo.get_patient(patient_id)
    if not p:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found.")
    return p

@router.post("/patients", response_model=PatientRecord)
def create_patient(req: PatientCreateRequest):
    """
    Enroll a new patient with 12-digit CR validation into a clinical cohort.
    """
    try:
        return datum_repo.create_patient(req)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/patients/{patient_id}", response_model=PatientRecord)
def update_patient(patient_id: str, req: PatientUpdateRequest):
    """
    Update clinical trial parameters, scanogram verification, or dynamic EDC values.
    """
    try:
        return datum_repo.update_patient(patient_id, req)
    except KeyError as ke:
        raise HTTPException(status_code=404, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bridge-to-rados")
def bridge_to_rados(req: DatumBridgeRequest):
    """
    Direct bridge taking a selected patient study from Datum and initializing
    session state in Rados with their DICOM series pre-loaded.
    """
    lookup_val = req.patient_id or req.cr_number
    if not lookup_val:
        raise HTTPException(status_code=400, detail="Must provide patient_id or cr_number.")

    patient = datum_repo.get_patient(lookup_val)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {lookup_val} not found in Datum registry.")

    # Ingest DICOM dataset into DICOM service
    target_path = patient.dicom_path
    if not target_path or not os.path.exists(target_path):
        target_path = r"C:\Users\ShubhamAhluwalia\Downloads\Compressed\KAMLESH 202603583814.zip"

    if not os.path.exists(target_path):
        raise HTTPException(status_code=400, detail=f"Patient DICOM file does not exist on disk: {target_path}")

    try:
        study = dicom_service.ingest_path(target_path)
        primary_series = None
        if study.get("series") and len(study["series"]) > 0:
            primary_series = next((s for s in study["series"] if not s.get("is_scout")), study["series"][0])

        return {
            "success": True,
            "patient": patient.model_dump(),
            "study": study,
            "selected_series": primary_series,
            "active_series": primary_series,
            "message": f"Pre-loaded study for patient {patient.name} (CR: {patient.cr_number})"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to bridge DICOM to Rados: {str(e)}")
