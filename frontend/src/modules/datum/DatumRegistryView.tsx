import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  Play,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Filter,
  Save,
  Clock,
  User,
  ShieldCheck,
  Stethoscope,
  Activity,
  ChevronRight,
  Hash,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { PatientRecord, PatientCohort, DynamicEDCData, IngestionResult, SeriesCard } from '../../types';

interface DatumRegistryViewProps {
  onLaunchRados: (study: IngestionResult, series: SeriesCard) => void;
  onOpenImportWizard: () => void;
}

const AO_OTA_OPTIONS = [
  { code: '33-C3', desc: 'Distal femur, complete articular, multi-fragmentary' },
  { code: '41-C2', desc: 'Proximal tibia, complete articular, bicondylar metaphyseal' },
  { code: '42-B2', desc: 'Tibial shaft, wedge fracture, bending wedge' },
  { code: '31-A2', desc: 'Trochanteric region, pertrochanteric multifragmentary' },
  { code: '22-A1', desc: 'Forearm shaft, ulna single fracture, radius intact' },
  { code: '11-C3', desc: 'Proximal humerus, articular, 4-part valgus impacted' },
  { code: '61-B2', desc: 'Pelvic ring, partially stable, unilateral posterior disruption' },
];

export const DatumRegistryView: React.FC<DatumRegistryViewProps> = ({
  onLaunchRados,
  onOpenImportWizard,
}) => {
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [cohorts, setCohorts] = useState<PatientCohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isBridging, setIsBridging] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Folder configuration & scanning state
  const [isFolderModalOpen, setIsFolderModalOpen] = useState<boolean>(false);
  const [defaultFolder, setDefaultFolder] = useState<string>('');
  const [folderInput, setFolderInput] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<string>('');

  // Dynamic EDC Form State for currently selected patient
  const [edcForm, setEdcForm] = useState<DynamicEDCData>({});
  const [diagnosisEdit, setDiagnosisEdit] = useState<string>('');

  // Fetch initial folder config
  useEffect(() => {
    fetch('/api/datum/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.default_data_folder) {
          setDefaultFolder(data.default_data_folder);
          setFolderInput(data.default_data_folder);
        }
      })
      .catch((e) => console.error('Failed to load datum config:', e));
  }, []);

  // Fetch Cohorts and Patients on mount
  const fetchRegistry = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cohortRes, patientRes] = await Promise.all([
        fetch('/api/datum/cohorts'),
        fetch(`/api/datum/patients?query=${encodeURIComponent(searchQuery)}${selectedCohortId !== 'ALL' ? `&cohort_id=${selectedCohortId}` : ''}`),
      ]);

      if (cohortRes.ok) {
        const cData = await cohortRes.json();
        setCohorts(cData);
      }
      if (patientRes.ok) {
        const pData: PatientRecord[] = await patientRes.json();
        setPatients(pData);
        if (pData.length > 0) {
          setSelectedPatientId((prev) => (prev && pData.some((p) => p.id === prev) ? prev : pData[0].id));
        } else {
          setSelectedPatientId(null);
        }
      }
    } catch (err) {
      console.error('Failed to load Datum registry:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedCohortId]);

  useEffect(() => {
    fetchRegistry();
  }, [fetchRegistry]);

  // Folder selection and scanning handlers
  const handleBrowseFolder = async () => {
    setIsScanning(true);
    setScanMessage('Waiting for folder selection...');
    try {
      const res = await fetch('/api/datum/select-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ browse: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setDefaultFolder(data.folder_path);
        setFolderInput(data.folder_path);
        setPatients(data.patients);
        if (data.patients.length > 0) {
          setSelectedPatientId(data.patients[0].id);
        }
        setScanMessage(`Discovered and loaded ${data.patient_count} real patients.`);
        setTimeout(() => {
          setIsFolderModalOpen(false);
          setScanMessage('');
        }, 1200);
      } else {
        const err = await res.json();
        setScanMessage(`Error: ${err.detail || 'Folder selection cancelled or failed.'}`);
      }
    } catch (err: any) {
      setScanMessage(`Selection error: ${err.message || 'Failed to select folder.'}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleScanFolder = async (path: string) => {
    if (!path.trim()) return;
    setIsScanning(true);
    setScanMessage('Scanning directory for DICOM studies...');
    try {
      const res = await fetch('/api/datum/select-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: path.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setDefaultFolder(data.folder_path);
        setPatients(data.patients);
        if (data.patients.length > 0) {
          setSelectedPatientId(data.patients[0].id);
        }
        setScanMessage(`Discovered and loaded ${data.patient_count} real patients.`);
        setTimeout(() => {
          setIsFolderModalOpen(false);
          setScanMessage('');
        }, 1200);
      } else {
        const err = await res.json();
        setScanMessage(`Error: ${err.detail || 'Failed to scan directory.'}`);
      }
    } catch (err: any) {
      setScanMessage(`Scan error: ${err.message || 'Failed to scan directory.'}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Keep EDC form synced with selected patient
  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );

  useEffect(() => {
    if (selectedPatient) {
      setEdcForm({ ...selectedPatient.edc_data });
      setDiagnosisEdit(selectedPatient.diagnosis || '');
      setSaveSuccess(false);
    }
  }, [selectedPatient]);

  // Save changes to patient & Dynamic EDC parameters
  const handleSaveEdc = async () => {
    if (!selectedPatient) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/datum/patients/${selectedPatient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnosis: diagnosisEdit,
          edc_data: edcForm,
        }),
      });

      if (res.ok) {
        const updated: PatientRecord = await res.json();
        setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save EDC parameters:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Launch patient study directly in Rados PACS Workstation
  const handleLaunchRadosForPatient = async (targetPatient: PatientRecord) => {
    setIsBridging(true);
    try {
      const res = await fetch('/api/datum/bridge-to-rados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: targetPatient.id,
          cr_number: targetPatient.cr_number,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const seriesToLoad = data.selected_series || data.active_series;
        onLaunchRados(data.study, seriesToLoad);
      } else {
        const err = await res.json();
        alert(`Bridge error: ${err.detail || 'Could not launch study in Rados.'}`);
      }
    } catch (err) {
      console.error('Bridge request failed:', err);
      alert('Failed to connect to MEDAM bridge endpoint.');
    } finally {
      setIsBridging(false);
    }
  };

  const handleLaunchRados = () => {
    if (selectedPatient) {
      handleLaunchRadosForPatient(selectedPatient);
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#F8FAFC] dark:bg-[#090D16]">
      {/* Top Action Toolbar */}
      <div className="w-full h-14 px-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white/70 dark:bg-[#0d121f]/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            <span className="text-xs font-bold tracking-wide uppercase text-slate-500 dark:text-slate-400">
              Clinical Trial EDC & Registry
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {patients.length} Enrolled Studies
          </span>
          {defaultFolder && (
            <span className="hidden md:inline-block text-[11px] text-slate-400 max-w-xs truncate" title={defaultFolder}>
              ({defaultFolder})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsFolderModalOpen(true)}
            className="tactile-rubber neu-btn px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[#0284C7] dark:hover:text-[#38BDF8] flex items-center gap-1.5 cursor-pointer"
            title="Set Default Data Folder"
          >
            <FolderOpen className="w-4 h-4 text-[#0284C7]" />
            <span>Set Default Data Folder</span>
          </button>
          <button
            type="button"
            onClick={fetchRegistry}
            className="tactile-rubber neu-btn p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            title="Refresh Registry"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#0284C7]' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onOpenImportWizard}
            className="tactile-rubber neu-btn px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[#0284C7] dark:hover:text-[#38BDF8] flex items-center gap-1.5 cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 text-[#0284C7]" />
            <span>Import DICOM Wizard</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 w-full flex overflow-hidden">
        {/* Left 65%: Origin UI DataTable */}
        <div className="w-[64%] h-full flex flex-col border-r border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#090D16] overflow-hidden">
          {/* Search bar & Cohort Filter Chips */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3 shrink-0">
            {/* Search Input */}
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by 12-Digit CR Number, Patient Name, Diagnosis, or AO/OTA Code..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl neu-pressed bg-transparent border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#0284C7]"
              />
            </div>

            {/* Cohort Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCohortId('ALL')}
                className={`tactile-rubber px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                  selectedCohortId === 'ALL'
                    ? 'neu-primary text-white shadow-sm'
                    : 'neu-btn text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Cohorts ({patients.length})
              </button>
              {cohorts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCohortId(c.id)}
                  className={`tactile-rubber px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                    selectedCohortId === c.id
                      ? 'neu-primary text-white shadow-sm'
                      : 'neu-btn text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {c.name} ({c.patient_count})
                </button>
              ))}
            </div>
          </div>

          {/* DataTable Table Header */}
          <div className="w-full px-4 py-2.5 bg-slate-100/70 dark:bg-[#0d121f] border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider grid grid-cols-12 gap-2 select-none shrink-0">
            <div className="col-span-3">12-Digit CR Number</div>
            <div className="col-span-3">Patient & Demographics</div>
            <div className="col-span-3">Diagnosis & AO/OTA</div>
            <div className="col-span-2">Modalities</div>
            <div className="col-span-1 text-right">Action</div>
          </div>

          {/* DataTable Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-200/60 dark:divide-slate-800/60">
            {isLoading ? (
              <div className="w-full h-48 flex items-center justify-center text-xs text-slate-400 gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#0284C7]" />
                <span>Loading clinical registry records...</span>
              </div>
            ) : patients.length === 0 ? (
              <div className="w-full h-64 flex flex-col items-center justify-center text-xs text-slate-400 gap-3 p-6 text-center">
                <FolderOpen className="w-10 h-10 text-slate-400 opacity-60" />
                <div className="flex flex-col gap-1 max-w-sm">
                  <span className="font-bold text-slate-700 dark:text-slate-300">No Patients in Registry</span>
                  <span className="text-slate-500">
                    Click "Set Default Data Folder" to scan a local DICOM directory and populate the registry with real patients.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(true)}
                  className="tactile-rubber neu-primary px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm cursor-pointer mt-1"
                >
                  Set Default Data Folder
                </button>
              </div>
            ) : (
              patients.map((p) => {
                const isSelected = p.id === selectedPatientId;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPatientId(p.id)}
                    onDoubleClick={() => handleLaunchRadosForPatient(p)}
                    className={`w-full px-4 py-3 grid grid-cols-12 gap-2 items-center text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-sky-50/80 dark:bg-sky-950/20 border-l-4 border-l-[#0284C7]'
                        : 'hover:bg-slate-100/50 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    {/* CR Number */}
                    <div className="col-span-3 flex flex-col">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
                        <Hash className="w-3.5 h-3.5 text-[#0284C7]" />
                        <span>{p.cr_number}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-2.5 h-2.5" />
                        {p.study_date}
                      </span>
                    </div>

                    {/* Patient Name & Age/Gender */}
                    <div className="col-span-3 flex flex-col">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {p.name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {p.age} yrs • {p.gender}
                      </span>
                    </div>

                    {/* Diagnosis & AO/OTA Code */}
                    <div className="col-span-3 flex flex-col">
                      <span className="text-slate-800 dark:text-slate-200 truncate font-medium">
                        {p.diagnosis}
                      </span>
                      {p.edc_data?.ao_ota_classification && (
                        <span className="inline-block px-1.5 py-0.5 mt-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 w-fit">
                          AO/OTA {p.edc_data.ao_ota_classification}
                        </span>
                      )}
                    </div>

                    {/* Modality Badges */}
                    <div className="col-span-2 flex flex-wrap gap-1">
                      {p.modalities.map((mod) => {
                        const isCt = mod.includes('CT');
                        const isCr = mod.includes('CR') || mod.includes('X-Ray');
                        const isMr = mod.includes('MR');
                        return (
                          <span
                            key={mod}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tight ${
                              isCt
                                ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                                : isCr
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : isMr
                                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {mod}
                          </span>
                        );
                      })}
                    </div>

                    {/* Action Arrow / Open in Rados */}
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPatientId(p.id);
                          handleLaunchRadosForPatient(p);
                        }}
                        title="Open in Rados"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-transform cursor-pointer ${
                          isSelected
                            ? 'bg-[#0284C7] text-white shadow-sm shadow-sky-600/30 translate-x-1'
                            : 'neu-btn text-slate-400 hover:text-[#0284C7]'
                        }`}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 36%: Split Dynamic EDC Parameter Editor */}
        <div className="w-[36%] h-full flex flex-col bg-white dark:bg-[#0c101d] overflow-hidden">
          {selectedPatient ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* EDC Header Card */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-[#101626]/50">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-[#0284C7]/15 text-[#0284C7] border border-[#0284C7]/30">
                      CR #{selectedPatient.cr_number}
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {selectedPatient.name}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1">
                    Cohort: {cohorts.find((c) => c.id === selectedPatient.cohort_id)?.name || selectedPatient.cohort_id}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSaveEdc}
                    disabled={isSaving}
                    className="tactile-rubber neu-btn px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[#0284C7] dark:hover:text-[#38BDF8] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-[#0284C7]" />
                    <span>{isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save EDC'}</span>
                  </button>
                </div>
              </div>

              {/* Dynamic EDC Parameters Body */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {/* Primary Launch Action Card */}
                <div className="neu-convex p-4 rounded-2xl border border-sky-300/40 dark:border-sky-800/40 bg-gradient-to-br from-sky-50/50 to-transparent dark:from-sky-950/20 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#0284C7]" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Connected DICOM Session
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Ready to Bridge
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Instantly transfer this patient's CT/MR volumetric series into Rados Multi-Planar Reconstruction and 3D segmentation viewports.
                  </p>
                  <button
                    type="button"
                    onClick={handleLaunchRados}
                    disabled={isBridging}
                    className="tactile-rubber neu-primary w-full py-2.5 rounded-xl text-xs font-bold text-white shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 cursor-pointer mt-1"
                  >
                    <Play className={`w-3.5 h-3.5 fill-current ${isBridging ? 'animate-pulse' : ''}`} />
                    <span>{isBridging ? 'Opening in Rados...' : 'Open in Rados'}</span>
                  </button>
                </div>

                {/* Clinical Parameters Form */}
                <div className="neu-pressed p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col gap-3.5">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Stethoscope className="w-3.5 h-3.5 text-[#0284C7]" />
                      Trauma & Fracture Parameters
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      Standard EDC Schema
                    </span>
                  </div>

                  {/* Diagnosis field */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Clinical Diagnosis & Site
                    </label>
                    <input
                      type="text"
                      value={diagnosisEdit}
                      onChange={(e) => setDiagnosisEdit(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl neu-convex bg-transparent border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#0284C7]"
                    />
                  </div>

                  {/* AO/OTA Classification */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      AO/OTA Fracture Classification
                    </label>
                    <select
                      value={edcForm.ao_ota_classification || ''}
                      onChange={(e) =>
                        setEdcForm((prev) => ({ ...prev, ao_ota_classification: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl neu-convex bg-slate-50 dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#0284C7]"
                    >
                      <option value="">Select AO/OTA Code...</option>
                      {AO_OTA_OPTIONS.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.code} — {opt.desc}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Injury Severity Score (ISS) Slider */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-600 dark:text-slate-400">
                        Injury Severity Score (ISS)
                      </span>
                      <span className="font-mono font-bold text-[#0284C7]">
                        {edcForm.injury_severity_score || 0} / 75
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="75"
                      value={edcForm.injury_severity_score || 16}
                      onChange={(e) =>
                        setEdcForm((prev) => ({
                          ...prev,
                          injury_severity_score: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full accent-[#0284C7] cursor-pointer"
                    />
                  </div>

                  {/* Scanogram Verification Toggle */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl neu-convex border border-slate-200/80 dark:border-slate-800">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Scanogram Calibration Verification
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Full-length bilateral anatomical axis validated
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEdcForm((prev) => ({
                          ...prev,
                          scanogram_verified: !prev.scanogram_verified,
                        }))
                      }
                      className={`tactile-rubber px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        edcForm.scanogram_verified
                          ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/40'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {edcForm.scanogram_verified ? 'Verified' : 'Pending'}
                    </button>
                  </div>

                  {/* Pre-Op Planned Implant */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Planned Surgical Implant Fixture
                    </label>
                    <input
                      type="text"
                      value={edcForm.implant_type || ''}
                      onChange={(e) =>
                        setEdcForm((prev) => ({ ...prev, implant_type: e.target.value }))
                      }
                      placeholder="e.g., Anatomical Distal Femur LCP 8-Hole"
                      className="w-full px-3 py-1.5 text-xs rounded-xl neu-convex bg-transparent border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#0284C7]"
                    />
                  </div>

                  {/* Surgeon Name */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Lead Operating Surgeon
                    </label>
                    <input
                      type="text"
                      value={edcForm.surgeon_name || ''}
                      onChange={(e) =>
                        setEdcForm((prev) => ({ ...prev, surgeon_name: e.target.value }))
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-xl neu-convex bg-transparent border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#0284C7]"
                    />
                  </div>

                  {/* Pre-Op Notes */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Pre-Op Clinical Planning & Reconstruction Notes
                    </label>
                    <textarea
                      rows={3}
                      value={edcForm.pre_op_notes || ''}
                      onChange={(e) =>
                        setEdcForm((prev) => ({ ...prev, pre_op_notes: e.target.value }))
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-xl neu-convex bg-transparent border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#0284C7] resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-xs text-slate-400 gap-2 p-6 text-center">
              <FolderOpen className="w-8 h-8 text-slate-400" />
              <span>Select a patient record from the registry table to view and edit Dynamic EDC trial parameters.</span>
            </div>
          )}
        </div>
      </div>

      {/* Set Default Data Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-[480px] p-6 bg-white dark:bg-[#101626] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-[#0284C7]" />
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  Set Default Data Folder
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsFolderModalOpen(false);
                  setScanMessage('');
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white neu-btn cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              {defaultFolder && (
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Current Default Folder</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 truncate" title={defaultFolder}>
                    {defaultFolder}
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Select Local DICOM Directory
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={folderInput ?? ''}
                    onChange={(e) => setFolderInput(e.target.value)}
                    placeholder="e.g. C:\DICOM_Archive or C:\Users\Downloads\Compressed"
                    className="flex-1 px-3 py-2 rounded-xl neu-pressed bg-transparent border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#0284C7]"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseFolder}
                    disabled={isScanning}
                    className="tactile-rubber neu-btn px-3 py-2 rounded-xl font-bold text-slate-700 dark:text-slate-200 hover:text-[#0284C7] shrink-0 cursor-pointer"
                  >
                    Browse...
                  </button>
                </div>
                <span className="text-[10px] text-slate-400">
                  Recursively scans for real DICOM studies (.dcm files and clinical .zip archives).
                </span>
              </div>

              {scanMessage && (
                <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 text-[#0284C7] border border-sky-300/40 text-xs font-medium">
                  {scanMessage}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsFolderModalOpen(false);
                  setScanMessage('');
                }}
                className="tactile-rubber neu-btn px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleScanFolder(folderInput)}
                disabled={isScanning || !folderInput.trim()}
                className="tactile-rubber neu-primary px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md shadow-sky-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Scanning Directory...</span>
                  </>
                ) : (
                  <span>Set & Scan Directory</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
