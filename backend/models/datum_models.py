import os
import json
import sqlite3
import time
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field

# SQLite Database Path
DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "datum.db")

BENCHMARK_PATH = r"C:\Users\ShubhamAhluwalia\Downloads\Compressed\KAMLESH 202603583814.zip"

class PatientCohort(BaseModel):
    id: str
    name: str
    description: str
    color: str
    count: int = 0

class DynamicEDCData(BaseModel):
    implant_planned: str = "Locked Compression Plate (Distal Femur 4.5mm)"
    bone_density_tscore: float = -1.8
    infection_markers: str = "WBC: 7.4, CRP: 4.2 mg/L, ESR: 12 mm/hr (Normal)"
    estimated_blood_loss_ml: int = 150
    range_of_motion_deg: str = "Flexion: 95°, Extension: 0°"
    followup_interval_months: int = 6
    study_protocol: str = "AO Clinical Trauma Registry Protocol v4.2"
    surgical_urgency: str = "Elective Reconstruction"

class PatientRecord(BaseModel):
    id: str
    cr_number: str = Field(..., description="12-Digit Clinical Registration Number")
    name: str
    age: int
    gender: str
    cohort_id: str
    admission_date: str
    primary_diagnosis: str
    ao_ota_classification: str
    trauma_score: int
    scanogram_verified: bool
    modalities: List[str]
    pre_op_notes: str
    dicom_path: str
    edc_data: Dict[str, Any]
    created_at: str
    updated_at: str
    diagnosis: Optional[str] = None
    study_date: Optional[str] = None

class PatientCreateRequest(BaseModel):
    cr_number: str
    name: str
    age: int
    gender: str
    cohort_id: str
    primary_diagnosis: str
    ao_ota_classification: str
    trauma_score: int = 14
    scanogram_verified: bool = True
    modalities: List[str] = ["CT Scan", "X-Ray (CR)"]
    pre_op_notes: Optional[str] = ""
    dicom_path: Optional[str] = BENCHMARK_PATH
    edc_data: Optional[Dict[str, Any]] = None

class PatientUpdateRequest(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    cohort_id: Optional[str] = None
    primary_diagnosis: Optional[str] = None
    ao_ota_classification: Optional[str] = None
    trauma_score: Optional[int] = None
    scanogram_verified: Optional[bool] = None
    modalities: Optional[List[str]] = None
    pre_op_notes: Optional[str] = None
    edc_data: Optional[Dict[str, Any]] = None

class DatumBridgeRequest(BaseModel):
    patient_id: Optional[str] = None
    cr_number: Optional[str] = None

class DatumRepository:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS cohorts (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    color TEXT NOT NULL
                )
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS patients (
                    id TEXT PRIMARY KEY,
                    cr_number TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    age INTEGER NOT NULL,
                    gender TEXT NOT NULL,
                    cohort_id TEXT NOT NULL,
                    admission_date TEXT NOT NULL,
                    primary_diagnosis TEXT NOT NULL,
                    ao_ota_classification TEXT NOT NULL,
                    trauma_score INTEGER NOT NULL,
                    scanogram_verified INTEGER NOT NULL DEFAULT 1,
                    modalities TEXT NOT NULL,
                    pre_op_notes TEXT,
                    dicom_path TEXT NOT NULL,
                    edc_data TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (cohort_id) REFERENCES cohorts (id)
                )
            """)

            # Pre-seed clinical cohorts if empty
            cur.execute("SELECT COUNT(*) FROM cohorts")
            if cur.fetchone()[0] == 0:
                cohorts_data = [
                    ("lower_extremity", "Lower Extremity Trauma", "Femoral, tibial, and patellar fractures and articular injuries", "#0284C7"),
                    ("joint_recon", "Joint Reconstruction", "Complex peri-articular reconstruction, osteotomies, and arthroplasty", "#10B981"),
                    ("polytrauma", "High-Energy Polytrauma", "Multi-system vehicular trauma and high ISS orthopedic damage control", "#F59E0B"),
                    ("spine", "Spinal Deformity & Trauma", "Subaxial cervical, thoracic, and lumbo-sacral stability registries", "#8B5CF6"),
                    ("pediatric", "Pediatric Orthopaedics", "Physeal-sparing fracture fixations and congenital limb corrections", "#EC4899"),
                ]
                cur.executemany("INSERT INTO cohorts (id, name, description, color) VALUES (?, ?, ?, ?)", cohorts_data)

            # No mock patients seeded - Datum starts completely empty with 0 fake patients
            conn.commit()

    def get_default_data_folder(self) -> Optional[str]:
        config_file = os.path.join(DB_DIR, "datum_config.json")
        if os.path.exists(config_file):
            try:
                with open(config_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return data.get("default_data_folder")
            except Exception:
                return None
        return None

    def set_default_data_folder(self, folder_path: str):
        config_file = os.path.join(DB_DIR, "datum_config.json")
        data = {"default_data_folder": folder_path}
        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def scan_and_populate_from_folder(self, folder_path: str) -> List[PatientRecord]:
        clean_folder = os.path.normpath(folder_path.strip('\'"'))
        if not os.path.exists(clean_folder):
            raise ValueError(f"Folder does not exist: {clean_folder}")

        import zipfile
        import pydicom

        discovered_patients: List[Dict[str, Any]] = []
        seen_crs = set()

        # 1. Scan for .zip archives containing DICOM files
        for root, _, files in os.walk(clean_folder):
            for f in files:
                if f.lower().endswith(".zip"):
                    zip_path = os.path.join(root, f)
                    try:
                        with zipfile.ZipFile(zip_path, 'r') as zf:
                            names = [n for n in zf.namelist() if not n.endswith('/') and '__MACOSX' not in n]
                            p_name = ""
                            p_id = ""
                            p_date = ""
                            p_age = 45
                            p_sex = "M"
                            modalities = set()
                            study_desc = ""

                            for entry in names[:60]:
                                base_entry = os.path.basename(entry)
                                if base_entry.lower().endswith('.dcm') or ('.' not in base_entry and not base_entry.startswith('.')):
                                    try:
                                        with zf.open(entry) as df:
                                            ds = pydicom.dcmread(df, stop_before_pixels=True, force=True)
                                            if hasattr(ds, 'SeriesInstanceUID') or hasattr(ds, 'SOPClassUID'):
                                                mod = str(getattr(ds, 'Modality', '')).strip().upper()
                                                if mod:
                                                    modalities.add(mod)
                                                if not p_name and hasattr(ds, 'PatientName'):
                                                    p_name = str(ds.PatientName).replace('^', ' ').strip()
                                                if not p_id and hasattr(ds, 'PatientID'):
                                                    p_id = str(ds.PatientID).strip()
                                                if not p_date and hasattr(ds, 'StudyDate'):
                                                    p_date = str(ds.StudyDate).strip()
                                                if not study_desc and hasattr(ds, 'StudyDescription'):
                                                    study_desc = str(ds.StudyDescription).strip()
                                                if hasattr(ds, 'PatientAge'):
                                                    raw_age = str(ds.PatientAge)
                                                    digs = "".join(c for c in raw_age if c.isdigit())
                                                    if digs:
                                                        p_age = int(digs)
                                                if hasattr(ds, 'PatientSex'):
                                                    s_val = str(ds.PatientSex).strip().upper()
                                                    if s_val in ('M', 'F'):
                                                        p_sex = s_val
                                    except Exception:
                                        pass

                            if modalities:
                                zip_base = os.path.splitext(f)[0]
                                patient_name = p_name or zip_base
                                raw_id = p_id or zip_base
                                clean_id = "".join(c for c in raw_id if c.isalnum()).upper()
                                if not clean_id or len(clean_id) < 6:
                                    nums = "".join(c for c in zip_base if c.isdigit())
                                    clean_id = nums if len(nums) >= 6 else f"2026{int(time.time()) % 100000000:08d}"

                                base_cr = clean_id
                                seq = 1
                                while clean_id in seen_crs:
                                    clean_id = f"{base_cr}_{seq}"
                                    seq += 1
                                seen_crs.add(clean_id)

                                if len(p_date) == 8 and p_date.isdigit():
                                    fmt_date = f"{p_date[:4]}-{p_date[4:6]}-{p_date[6:8]}"
                                else:
                                    fmt_date = time.strftime("%Y-%m-%d")

                                mod_list = []
                                for m in sorted(list(modalities)):
                                    if m == "CT":
                                        mod_list.append("CT Scan")
                                    elif m == "MR":
                                        mod_list.append("MRI")
                                    elif m in ("CR", "DX"):
                                        mod_list.append("X-Ray (CR)")
                                    else:
                                        mod_list.append(m)

                                cohort = "lower_extremity"
                                if "MRI" in mod_list:
                                    cohort = "joint_recon"

                                now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                                default_edc = DynamicEDCData().model_dump()
                                new_pat_id = f"pat_{clean_id[-6:]}_{int(time.time())}_{len(discovered_patients)}"

                                discovered_patients.append({
                                    "id": new_pat_id,
                                    "cr_number": clean_id,
                                    "name": patient_name.upper().strip(),
                                    "age": p_age,
                                    "gender": p_sex,
                                    "cohort_id": cohort,
                                    "admission_date": fmt_date,
                                    "primary_diagnosis": study_desc or f"Volumetric {', '.join(modalities)} Study",
                                    "ao_ota_classification": "33-C2.3" if cohort == "lower_extremity" else "41-B1.2",
                                    "trauma_score": 14,
                                    "scanogram_verified": 1,
                                    "modalities": json.dumps(mod_list),
                                    "pre_op_notes": f"Scanned from {f}",
                                    "dicom_path": zip_path,
                                    "edc_data": json.dumps(default_edc),
                                    "created_at": now_iso,
                                    "updated_at": now_iso,
                                })
                    except Exception:
                        pass

        # 2. Scan for uncompressed DICOM directories
        dcm_dirs: Dict[str, List[str]] = {}
        for root, _, files in os.walk(clean_folder):
            dcm_files = [os.path.join(root, f) for f in files if f.lower().endswith(".dcm")]
            if dcm_files:
                dcm_dirs[root] = dcm_files

        if dcm_dirs:
            for d_path, file_list in dcm_dirs.items():
                sample_file = file_list[0]
                try:
                    ds = pydicom.dcmread(sample_file, stop_before_pixels=True, force=True)
                    if hasattr(ds, 'SeriesInstanceUID') or hasattr(ds, 'SOPClassUID'):
                        p_name = str(getattr(ds, 'PatientName', os.path.basename(d_path))).replace('^', ' ').strip()
                        p_id = str(getattr(ds, 'PatientID', '')).strip()
                        p_date = str(getattr(ds, 'StudyDate', '')).strip()
                        p_mod = str(getattr(ds, 'Modality', 'CT')).strip().upper()
                        study_desc = str(getattr(ds, 'StudyDescription', '')).strip()
                        raw_age = str(getattr(ds, 'PatientAge', '45'))
                        digs = "".join(c for c in raw_age if c.isdigit())
                        p_age = int(digs) if digs else 45
                        p_sex = str(getattr(ds, 'PatientSex', 'M')).strip().upper()
                        if p_sex not in ('M', 'F'):
                            p_sex = 'M'

                        clean_id = "".join(c for c in p_id if c.isalnum()).upper() if p_id else f"2026{int(time.time()) % 100000000:08d}"
                        if clean_id not in seen_crs:
                            seen_crs.add(clean_id)
                            if len(p_date) == 8 and p_date.isdigit():
                                fmt_date = f"{p_date[:4]}-{p_date[4:6]}-{p_date[6:8]}"
                            else:
                                fmt_date = time.strftime("%Y-%m-%d")

                            mod_list = [f"{p_mod} Scan" if p_mod == "CT" else ("MRI" if p_mod == "MR" else p_mod)]
                            now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                            new_pat_id = f"pat_{clean_id[-6:]}_{int(time.time())}_{len(discovered_patients)}"

                            discovered_patients.append({
                                "id": new_pat_id,
                                "cr_number": clean_id,
                                "name": p_name.upper().strip(),
                                "age": p_age,
                                "gender": p_sex,
                                "cohort_id": "lower_extremity",
                                "admission_date": fmt_date,
                                "primary_diagnosis": study_desc or f"Volumetric {p_mod} Study",
                                "ao_ota_classification": "33-C2.3",
                                "trauma_score": 14,
                                "scanogram_verified": 1,
                                "modalities": json.dumps(mod_list),
                                "pre_op_notes": f"Scanned from {os.path.basename(d_path)}",
                                "dicom_path": d_path,
                                "edc_data": json.dumps(DynamicEDCData().model_dump()),
                                "created_at": now_iso,
                                "updated_at": now_iso,
                            })
                except Exception:
                    pass

        # Repopulate table strictly with real scanned patients
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM patients")
            for p in discovered_patients:
                cur.execute("""
                    INSERT INTO patients (
                        id, cr_number, name, age, gender, cohort_id, admission_date,
                        primary_diagnosis, ao_ota_classification, trauma_score,
                        scanogram_verified, modalities, pre_op_notes, dicom_path,
                        edc_data, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    p["id"], p["cr_number"], p["name"], p["age"], p["gender"],
                    p["cohort_id"], p["admission_date"], p["primary_diagnosis"],
                    p["ao_ota_classification"], p["trauma_score"], p["scanogram_verified"],
                    p["modalities"], p["pre_op_notes"], p["dicom_path"],
                    p["edc_data"], p["created_at"], p["updated_at"]
                ))
            conn.commit()

        return self.list_patients()

    def list_cohorts(self) -> List[PatientCohort]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT c.id, c.name, c.description, c.color, COUNT(p.id) as count
                FROM cohorts c
                LEFT JOIN patients p ON c.id = p.cohort_id
                GROUP BY c.id
            """)
            rows = cur.fetchall()
            return [
                PatientCohort(
                    id=row["id"],
                    name=row["name"],
                    description=row["description"],
                    color=row["color"],
                    count=row["count"],
                )
                for row in rows
            ]

    def list_patients(self, query: str = "", cohort_id: Optional[str] = None) -> List[PatientRecord]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            sql = "SELECT * FROM patients WHERE 1=1"
            params = []

            if query:
                sql += " AND (cr_number LIKE ? OR name LIKE ? OR primary_diagnosis LIKE ? OR ao_ota_classification LIKE ?)"
                q_pattern = f"%{query.strip()}%"
                params.extend([q_pattern, q_pattern, q_pattern, q_pattern])

            if cohort_id and cohort_id != "all":
                sql += " AND cohort_id = ?"
                params.append(cohort_id)

            sql += " ORDER BY updated_at DESC"
            cur.execute(sql, params)
            rows = cur.fetchall()

            results = []
            for r in rows:
                results.append(
                    PatientRecord(
                        id=r["id"],
                        cr_number=r["cr_number"],
                        name=r["name"],
                        age=r["age"],
                        gender=r["gender"],
                        cohort_id=r["cohort_id"],
                        admission_date=r["admission_date"],
                        primary_diagnosis=r["primary_diagnosis"],
                        ao_ota_classification=r["ao_ota_classification"],
                        trauma_score=r["trauma_score"],
                        scanogram_verified=bool(r["scanogram_verified"]),
                        modalities=json.loads(r["modalities"]),
                        pre_op_notes=r["pre_op_notes"] or "",
                        dicom_path=r["dicom_path"],
                        edc_data=json.loads(r["edc_data"]),
                        created_at=r["created_at"],
                        updated_at=r["updated_at"],
                        diagnosis=r["primary_diagnosis"],
                        study_date=r["admission_date"],
                    )
                )
            return results

    def get_patient(self, patient_id_or_cr: str) -> Optional[PatientRecord]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT * FROM patients WHERE id = ? OR cr_number = ?",
                (patient_id_or_cr, patient_id_or_cr),
            )
            r = cur.fetchone()
            if not r:
                return None
            return PatientRecord(
                id=r["id"],
                cr_number=r["cr_number"],
                name=r["name"],
                age=r["age"],
                gender=r["gender"],
                cohort_id=r["cohort_id"],
                admission_date=r["admission_date"],
                primary_diagnosis=r["primary_diagnosis"],
                ao_ota_classification=r["ao_ota_classification"],
                trauma_score=r["trauma_score"],
                scanogram_verified=bool(r["scanogram_verified"]),
                modalities=json.loads(r["modalities"]),
                pre_op_notes=r["pre_op_notes"] or "",
                dicom_path=r["dicom_path"],
                edc_data=json.loads(r["edc_data"]),
                created_at=r["created_at"],
                updated_at=r["updated_at"],
                diagnosis=r["primary_diagnosis"],
                study_date=r["admission_date"],
            )

    def create_patient(self, req: PatientCreateRequest) -> PatientRecord:
        clean_cr = "".join(c for c in req.cr_number.strip() if c.isalnum()).upper()
        if len(clean_cr) < 4:
            raise ValueError("CR Number must contain at least 4 alphanumeric characters.")

        new_id = f"pat_{clean_cr[-6:]}_{int(time.time())}"
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        edc_payload = req.edc_data if req.edc_data else DynamicEDCData().model_dump()

        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO patients (
                    id, cr_number, name, age, gender, cohort_id, admission_date,
                    primary_diagnosis, ao_ota_classification, trauma_score,
                    scanogram_verified, modalities, pre_op_notes, dicom_path,
                    edc_data, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                new_id,
                clean_cr,
                req.name.upper().strip(),
                req.age,
                req.gender.upper().strip(),
                req.cohort_id,
                now_iso,
                req.primary_diagnosis.strip(),
                req.ao_ota_classification.strip(),
                req.trauma_score,
                1 if req.scanogram_verified else 0,
                json.dumps(req.modalities),
                req.pre_op_notes or "",
                req.dicom_path or BENCHMARK_PATH,
                json.dumps(edc_payload),
                now_iso,
                now_iso,
            ))
            conn.commit()

        return self.get_patient(new_id)

    def update_patient(self, patient_id: str, req: PatientUpdateRequest) -> PatientRecord:
        existing = self.get_patient(patient_id)
        if not existing:
            raise KeyError(f"Patient with ID {patient_id} not found.")

        updated_name = req.name.upper().strip() if req.name else existing.name
        updated_age = req.age if req.age is not None else existing.age
        updated_gender = req.gender.upper().strip() if req.gender else existing.gender
        updated_cohort = req.cohort_id if req.cohort_id else existing.cohort_id
        updated_diag = req.primary_diagnosis.strip() if req.primary_diagnosis else existing.primary_diagnosis
        updated_ao = req.ao_ota_classification.strip() if req.ao_ota_classification else existing.ao_ota_classification
        updated_trauma = req.trauma_score if req.trauma_score is not None else existing.trauma_score
        updated_scanogram = (1 if req.scanogram_verified else 0) if req.scanogram_verified is not None else (1 if existing.scanogram_verified else 0)
        updated_mods = json.dumps(req.modalities) if req.modalities is not None else json.dumps(existing.modalities)
        updated_notes = req.pre_op_notes if req.pre_op_notes is not None else existing.pre_op_notes

        merged_edc = existing.edc_data
        if req.edc_data:
            merged_edc.update(req.edc_data)

        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                UPDATE patients SET
                    name = ?, age = ?, gender = ?, cohort_id = ?,
                    primary_diagnosis = ?, ao_ota_classification = ?, trauma_score = ?,
                    scanogram_verified = ?, modalities = ?, pre_op_notes = ?,
                    edc_data = ?, updated_at = ?
                WHERE id = ?
            """, (
                updated_name, updated_age, updated_gender, updated_cohort,
                updated_diag, updated_ao, updated_trauma,
                updated_scanogram, updated_mods, updated_notes,
                json.dumps(merged_edc), now_iso, patient_id
            ))
            conn.commit()

        return self.get_patient(patient_id)

datum_repo = DatumRepository()
