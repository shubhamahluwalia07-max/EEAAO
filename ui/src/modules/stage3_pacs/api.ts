import { IngestionResult, SeriesVolumePayload } from './types';
import { getCachedSeriesVolume, ingestFileList, ingestZipFile } from './dicomClientParser';

export { ingestFileList, ingestZipFile };

// Check if Tauri desktop environment is active
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// Import DICOM directory
export async function scanDicomDirectory(folderPath?: string): Promise<IngestionResult> {
  if (isTauri() && folderPath) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<IngestionResult>('scan_dicom_directory', { path: folderPath });
  }

  // Fallback demo study loader
  return getDemoStudy();
}

// Import DICOM ZIP archive
export async function scanDicomZip(zipPath?: string): Promise<IngestionResult> {
  if (isTauri() && zipPath) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<IngestionResult>('scan_dicom_zip', { path: zipPath });
  }

  // Fallback demo study loader
  return getDemoStudy();
}

// Load clinical demo study
export async function getDemoStudy(): Promise<IngestionResult> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<IngestionResult>('load_demo_study');
  }

  // Pure frontend synthetic generator fallback for browser dev
  return generateClientDemoStudy();
}

// Fetch 16-bit volume payload for a series
export async function fetchSeriesVolume(seriesUid: string): Promise<SeriesVolumePayload> {
  const cached = getCachedSeriesVolume(seriesUid);
  if (cached) {
    return cached;
  }

  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<SeriesVolumePayload>('get_series_volume', { seriesUid });
  }

  // Generate volume on client
  return generateClientVolume(seriesUid);
}

// Open native Tauri folder picker
export async function openFolderDialog(): Promise<string | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select DICOM Folder',
    });
    return selected as string | null;
  }
  return null;
}

// Open native Tauri file picker for ZIP
export async function openZipDialog(): Promise<string | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      directory: false,
      multiple: false,
      filters: [{ name: 'DICOM Archive', extensions: ['zip', 'tar', 'gz'] }],
      title: 'Select DICOM ZIP Archive',
    });
    return selected as string | null;
  }
  return null;
}

// Client-side fallback generator for browser dev mode
function generateClientDemoStudy(): IngestionResult {
  const studyUid = '1.2.840.113619.2.55.3.1092789123.456';

  return {
    study_instance_uid: studyUid,
    detected_modalities: ['ALL', 'CT', 'MR', 'DX'],
    series: [
      {
        series_instance_uid: `${studyUid}.1`,
        study_instance_uid: studyUid,
        modality: 'CT',
        series_description: 'Chest & Thoracic Spine 1.0mm High-Resolution',
        series_number: 2,
        slice_count: 64,
        rows: 256,
        columns: 256,
        pixel_spacing: [0.78, 0.78],
        slice_thickness: 1.5,
        window_center: 40,
        window_width: 400,
        thumbnail_data_url: generateThumbnailUrl('CT'),
      },
      {
        series_instance_uid: `${studyUid}.2`,
        study_instance_uid: studyUid,
        modality: 'MR',
        series_description: 'Brain 3D Axial T1 MPRAGE Iso',
        series_number: 3,
        slice_count: 48,
        rows: 256,
        columns: 256,
        pixel_spacing: [0.94, 0.94],
        slice_thickness: 1.2,
        window_center: 350,
        window_width: 700,
        thumbnail_data_url: generateThumbnailUrl('MR'),
      },
      {
        series_instance_uid: `${studyUid}.3`,
        study_instance_uid: studyUid,
        modality: 'DX',
        series_description: 'Chest PA Standing Diagnostic',
        series_number: 1,
        slice_count: 1,
        rows: 512,
        columns: 512,
        pixel_spacing: [0.35, 0.35],
        slice_thickness: 1.0,
        window_center: 2048,
        window_width: 4096,
        thumbnail_data_url: generateThumbnailUrl('DX'),
      },
    ],
  };
}

function generateClientVolume(seriesUid: string): SeriesVolumePayload {
  const isMr = seriesUid.endsWith('.2');
  const isDx = seriesUid.endsWith('.3');

  const width = isDx ? 512 : 256;
  const height = isDx ? 512 : 256;
  const depth = isDx ? 1 : isMr ? 48 : 64;
  const total = width * height * depth;

  const buffer = new Int16Array(total);
  let minHu = 10000;
  let maxHu = -10000;

  const cx = width / 2;
  const cy = height / 2;
  const cz = depth / 2;

  let idx = 0;
  for (let z = 0; z < depth; z++) {
    const fz = (z - cz) / (cz * 0.95);
    for (let y = 0; y < height; y++) {
      const fy = (y - cy) / (cy * 0.92);
      for (let x = 0; x < width; x++) {
        const fx = (x - cx) / (cx * 0.92);

        let hu = -1000;

        if (isMr) {
          const r2 = fx * fx + (fy * 1.15) ** 2 + (fz * 1.25) ** 2;
          if (r2 <= 0.98) {
            hu = r2 > 0.85 ? 80 : r2 < 0.65 ? 750 : 520;
            if ((fx / 0.12) ** 2 + ((fy + 0.05) / 0.28) ** 2 < 1) hu = 40;
          } else {
            hu = 0;
          }
        } else if (isDx) {
          const r2 = (fx / 0.75) ** 2 + (fy / 0.85) ** 2;
          hu = r2 < 1 ? 2048 + Math.abs(Math.sin(fy * 15) * 400) : 200;
        } else {
          // CT Chest
          const r2Body = (fx / 0.85) ** 2 + (fy / 0.65) ** 2;
          if (r2Body <= 1.0) {
            hu = 45;
            // Ribs
            const ribR = (fx / 0.78) ** 2 + (fy / 0.58) ** 2;
            if (ribR >= 0.88 && ribR <= 1.0) {
              const ribMod = Math.abs(Math.sin(Math.atan2(fy, fx) * 7) * Math.cos(fz * 8));
              if (ribMod > 0.35) hu = 750;
            }
            // Spine
            const spineR2 = (fx / 0.16) ** 2 + ((fy - 0.4) / 0.16) ** 2;
            if (spineR2 <= 1.0) {
              hu = (fx / 0.06) ** 2 + ((fy - 0.43) / 0.06) ** 2 <= 1.0 ? 15 : 820;
            }
            // Lungs
            const lLung = ((fx - 0.36) / 0.28) ** 2 + ((fy + 0.05) / 0.38) ** 2;
            const rLung = ((fx + 0.36) / 0.28) ** 2 + ((fy + 0.05) / 0.38) ** 2;
            if (lLung <= 1.0 || rLung <= 1.0) {
              hu = -680;
            }
            // Heart
            const heartR2 = ((fx + 0.08) / 0.24) ** 2 + ((fy + 0.12) / 0.22) ** 2;
            if (heartR2 <= 1.0 && lLung > 0.95 && rLung > 0.95) {
              hu = ((fx + 0.08) / 0.14) ** 2 + ((fy + 0.12) / 0.13) ** 2 <= 1.0 ? 320 : 50;
            }
          }
        }

        if (hu < minHu) minHu = hu;
        if (hu > maxHu) maxHu = hu;
        buffer[idx++] = hu;
      }
    }
  }

  // Convert Int16Array to Base64
  const uint8View = new Uint8Array(buffer.buffer);
  let binary = '';
  const chunkSize = 32768;
  for (let i = 0; i < uint8View.length; i += chunkSize) {
    const chunk = uint8View.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  const voxelBufferBase64 = btoa(binary);

  const spacing: [number, number, number] = isDx
    ? [0.35, 0.35, 1.0]
    : isMr
    ? [0.94, 0.94, 1.2]
    : [0.78, 0.78, 1.5];

  const slicePositions = Array.from({ length: depth }, (_, i) => i * spacing[2]);

  return {
    series_instance_uid: seriesUid,
    modality: isDx ? 'DX' : isMr ? 'MR' : 'CT',
    series_description: isDx
      ? 'Chest PA Standing Diagnostic'
      : isMr
      ? 'Brain 3D Axial T1 MPRAGE Iso'
      : 'Chest & Thoracic Spine 1.0mm High-Resolution',
    dimensions: [width, height, depth],
    spacing,
    window_center: isDx ? 2048 : isMr ? 350 : 40,
    window_width: isDx ? 4096 : isMr ? 700 : 400,
    min_hu: minHu,
    max_hu: maxHu,
    voxel_buffer_base64: voxelBufferBase64,
    slice_positions: slicePositions,
  };
}

function generateThumbnailUrl(modality: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = modality === 'CT' ? '#38BDF8' : modality === 'MR' ? '#34D399' : '#F472B6';
  ctx.beginPath();
  ctx.arc(64, 64, 44, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#09090B';
  ctx.beginPath();
  ctx.arc(64, 64, 30, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toDataURL('image/png');
}
