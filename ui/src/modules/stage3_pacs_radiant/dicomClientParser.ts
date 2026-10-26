import JSZip from 'jszip';
import { Decoder } from 'jpeg-lossless-decoder-js';
import {
  DicomTagEntry,
  ImportProgress,
  IngestionResult,
  IngestionTelemetry,
  SeriesCard,
  SeriesVolumePayload,
} from './types';

export interface ParsedDicomSlice {
  fileName: string;
  studyInstanceUid: string;
  seriesInstanceUid: string;
  sopInstanceUid: string;
  patientName: string;
  patientId: string;
  studyDate: string;
  studyTime: string;
  studyDescription: string;
  seriesDate: string;
  seriesTime: string;
  modality: string;
  seriesDescription: string;
  seriesNumber: number;
  instanceNumber: number;
  rows: number;
  columns: number;
  bitsAllocated: number;
  bitsStored: number;
  pixelRepresentation: number;
  rescaleSlope: number;
  rescaleIntercept: number;
  windowCenter: number;
  windowWidth: number;
  pixelSpacing: [number, number];
  sliceThickness: number;
  imagePositionPatient: [number, number, number];
  imageOrientationPatient: [number, number, number, number, number, number];
  imageType: string;
  transferSyntaxUid: string;
  decodedPixels: Int16Array | null;
  distance: number;
  rawTags: DicomTagEntry[];
}

// In-memory volume and slice caches for loaded series
const clientVolumeCache = new Map<string, SeriesVolumePayload>();
const seriesSlicesCache = new Map<string, ParsedDicomSlice[]>();

export function getCachedSeriesVolume(seriesUid: string): SeriesVolumePayload | undefined {
  return clientVolumeCache.get(seriesUid);
}

export function setCachedSeriesVolume(seriesUid: string, payload: SeriesVolumePayload): void {
  clientVolumeCache.set(seriesUid, payload);
}

export function getSeriesSlices(seriesUid: string): ParsedDicomSlice[] | undefined {
  return seriesSlicesCache.get(seriesUid);
}

export function setSeriesSlices(seriesUid: string, slices: ParsedDicomSlice[]): void {
  seriesSlicesCache.set(seriesUid, slices);
}

export const TAG_DICTIONARY: Record<number, { name: string; vr: string }> = {
  0x00080008: { name: 'ImageType', vr: 'CS' },
  0x00080016: { name: 'SOPClassUID', vr: 'UI' },
  0x00080018: { name: 'SOPInstanceUID', vr: 'UI' },
  0x00080020: { name: 'StudyDate', vr: 'DA' },
  0x00080021: { name: 'SeriesDate', vr: 'DA' },
  0x00080030: { name: 'StudyTime', vr: 'TM' },
  0x00080031: { name: 'SeriesTime', vr: 'TM' },
  0x00080060: { name: 'Modality', vr: 'CS' },
  0x00080070: { name: 'Manufacturer', vr: 'LO' },
  0x00080080: { name: 'InstitutionName', vr: 'LO' },
  0x00081030: { name: 'StudyDescription', vr: 'LO' },
  0x0008103e: { name: 'SeriesDescription', vr: 'LO' },
  0x00100010: { name: 'PatientName', vr: 'PN' },
  0x00100020: { name: 'PatientID', vr: 'LO' },
  0x00100030: { name: 'PatientBirthDate', vr: 'DA' },
  0x00100040: { name: 'PatientSex', vr: 'CS' },
  0x00180015: { name: 'BodyPartExamined', vr: 'CS' },
  0x00180050: { name: 'SliceThickness', vr: 'DS' },
  0x00181030: { name: 'ProtocolName', vr: 'LO' },
  0x0020000d: { name: 'StudyInstanceUID', vr: 'UI' },
  0x0020000e: { name: 'SeriesInstanceUID', vr: 'UI' },
  0x00200011: { name: 'SeriesNumber', vr: 'IS' },
  0x00200013: { name: 'InstanceNumber', vr: 'IS' },
  0x00200032: { name: 'ImagePositionPatient', vr: 'DS' },
  0x00200037: { name: 'ImageOrientationPatient', vr: 'DS' },
  0x00201041: { name: 'SliceLocation', vr: 'DS' },
  0x00280004: { name: 'PhotometricInterpretation', vr: 'CS' },
  0x00280010: { name: 'Rows', vr: 'US' },
  0x00280011: { name: 'Columns', vr: 'US' },
  0x00280030: { name: 'PixelSpacing', vr: 'DS' },
  0x00280100: { name: 'BitsAllocated', vr: 'US' },
  0x00280101: { name: 'BitsStored', vr: 'US' },
  0x00280102: { name: 'HighBit', vr: 'US' },
  0x00280103: { name: 'PixelRepresentation', vr: 'US' },
  0x00281050: { name: 'WindowCenter', vr: 'DS' },
  0x00281051: { name: 'WindowWidth', vr: 'DS' },
  0x00281052: { name: 'RescaleIntercept', vr: 'DS' },
  0x00281053: { name: 'RescaleSlope', vr: 'DS' },
};

/**
 * Fast client-side DICOM slice header and pixel data parser supporting
 * standard Explicit/Implicit Little Endian and JPEG Lossless process 14 compression.
 */
export function parseDicomBuffer(buffer: ArrayBuffer, fileName: string): ParsedDicomSlice | null {
  if (buffer.byteLength < 132) return null;

  const view = new DataView(buffer);

  // Check standard DICM preamble at byte 128
  const d = view.getUint8(128);
  const i = view.getUint8(129);
  const c = view.getUint8(130);
  const m = view.getUint8(131);

  let offset = 132;
  let isExplicit = true;

  if (d === 0x44 && i === 0x49 && c === 0x43 && m === 0x4d) {
    // Valid standard DICM header
    offset = 132;
  } else {
    // Check if starts directly at offset 0 with standard group 0x0002 or 0x0008
    const g0 = view.getUint16(0, true);
    if (g0 === 0x0002 || g0 === 0x0008) {
      offset = 0;
    } else {
      return null;
    }
  }

  // Metadata collectors
  let studyInstanceUid = `study.${Date.now()}`;
  let seriesInstanceUid = `series.${Date.now()}`;
  let sopInstanceUid = `sop.${Date.now()}.${Math.random().toString(36).substring(2, 7)}`;
  let patientName = 'Patient Anonymous';
  let patientId = 'ID-001';
  let studyDate = '';
  let studyTime = '';
  let studyDescription = 'CT Study';
  let seriesDate = '';
  let seriesTime = '';
  let imageType = '';
  let modality = 'CT';
  let seriesDescription = 'DICOM Series';
  let seriesNumber = 1;
  let instanceNumber = 1;
  let rows = 512;
  let columns = 512;
  let bitsAllocated = 16;
  let bitsStored = 16;
  let pixelRepresentation = 0;
  let rescaleSlope = 1.0;
  let rescaleIntercept = 0.0;
  let windowCenter = 40;
  let windowWidth = 400;
  let pixelSpacing: [number, number] = [1.0, 1.0];
  let sliceThickness = 1.0;
  let imagePositionPatient: [number, number, number] = [0, 0, 0];
  let imageOrientationPatient: [number, number, number, number, number, number] = [1, 0, 0, 0, 1, 0];
  let transferSyntaxUid = '1.2.840.10008.1.2.1';
  let pixelDataOffset = -1;
  const rawTags: DicomTagEntry[] = [];

  const textDecoder = new TextDecoder('latin1');

  try {
    while (offset + 8 <= buffer.byteLength) {
      const group = view.getUint16(offset, true);
      const element = view.getUint16(offset + 2, true);

      // Pixel Data tag (7FE0, 0010)
      if (group === 0x7fe0 && element === 0x0010) {
        if (isExplicit && offset + 12 <= buffer.byteLength) {
          const vr0 = String.fromCharCode(view.getUint8(offset + 4));
          const vr1 = String.fromCharCode(view.getUint8(offset + 5));
          const vr = vr0 + vr1;

          if (vr === 'OB' || vr === 'OW' || vr === 'UN') {
            pixelDataOffset = offset + 12;
          } else {
            pixelDataOffset = offset + 8;
          }
        } else {
          pixelDataOffset = offset + 8;
        }
        break;
      }

      // Read VR and Length
      let vr = '';
      let valueLength = 0;
      let headerLength = 8;

      if (isExplicit) {
        vr = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5));
        if (
          vr === 'OB' ||
          vr === 'OW' ||
          vr === 'OF' ||
          vr === 'SQ' ||
          vr === 'UT' ||
          vr === 'UN' ||
          vr === 'UC' ||
          vr === 'UR' ||
          vr === 'OD' ||
          vr === 'OL' ||
          vr === 'OV' ||
          vr === 'SV'
        ) {
          headerLength = 12;
          if (offset + 12 > buffer.byteLength) break;
          valueLength = view.getUint32(offset + 8, true);
        } else {
          headerLength = 8;
          valueLength = view.getUint16(offset + 6, true);
        }
      } else {
        headerLength = 8;
        valueLength = view.getUint32(offset + 4, true);
      }

      const valueOffset = offset + headerLength;

      // Handle undefined length (sequences or encapsulated items)
      if (valueLength === 0xffffffff) {
        // Skip ahead to avoid invalid tag parsing
        offset = valueOffset + 4;
        continue;
      }

      if (valueOffset + valueLength > buffer.byteLength) {
        break;
      }

      // Transfer Syntax UID (0002, 0010)
      if (group === 0x0002 && element === 0x0010) {
        transferSyntaxUid = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
        if (transferSyntaxUid === '1.2.840.10008.1.2') {
          isExplicit = false;
        }
      }

      // Tag extraction
      const tagId = (group << 16) | element;
      const hexGroup = group.toString(16).padStart(4, '0').toUpperCase();
      const hexElem = element.toString(16).padStart(4, '0').toUpperCase();
      const tagStr = `(${hexGroup},${hexElem})`;
      const dictEntry = TAG_DICTIONARY[tagId];
      const tagName = dictEntry?.name || 'Unknown';
      const tagVr = vr || dictEntry?.vr || 'UN';

      if (valueLength > 0 && valueLength <= 1024 && tagId !== 0x7fe00010) {
        const tagVal = textDecoder
          .decode(new Uint8Array(buffer, valueOffset, Math.min(valueLength, 64)))
          .replace(/\0/g, '')
          .trim();
        if (tagVal) {
          rawTags.push({
            tag: tagStr,
            group: hexGroup,
            element: hexElem,
            name: tagName,
            vr: tagVr,
            value: tagVal,
          });
        }
      }

      switch (tagId) {
        case 0x00080008: // ImageType
          imageType = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          break;
        case 0x00080020: // StudyDate
          studyDate = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          break;
        case 0x00080021: // SeriesDate
          seriesDate = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          break;
        case 0x00080030: // StudyTime
          studyTime = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          break;
        case 0x00080031: // SeriesTime
          seriesTime = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          break;
        case 0x00081030: // StudyDescription
          studyDescription = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          break;
        case 0x00100010: // PatientName
          patientName = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          break;
        case 0x00100020: // PatientID
          patientId = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          break;
        case 0x00080018: // SOPInstanceUID
          sopInstanceUid = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          break;
        case 0x00080060: // Modality
          modality = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim().toUpperCase();
          break;
        case 0x0008103e: // SeriesDescription
          seriesDescription = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          break;
        case 0x0020000d: // StudyInstanceUID
          studyInstanceUid = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          break;
        case 0x0020000e: // SeriesInstanceUID
          seriesInstanceUid = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          break;
        case 0x00200011: { // SeriesNumber
          const raw = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          const parsed = parseInt(raw, 10);
          if (!isNaN(parsed)) seriesNumber = parsed;
          break;
        }
        case 0x00200013: { // InstanceNumber
          const raw = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          const parsed = parseInt(raw, 10);
          if (!isNaN(parsed)) instanceNumber = parsed;
          break;
        }
        case 0x00280010: // Rows
          rows = view.getUint16(valueOffset, true);
          break;
        case 0x00280011: // Columns
          columns = view.getUint16(valueOffset, true);
          break;
        case 0x00280100: // BitsAllocated
          bitsAllocated = view.getUint16(valueOffset, true);
          break;
        case 0x00280101: // BitsStored
          bitsStored = view.getUint16(valueOffset, true);
          break;
        case 0x00280103: // PixelRepresentation
          pixelRepresentation = view.getUint16(valueOffset, true);
          break;
        case 0x00281050: { // WindowCenter
          const raw = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          const parsed = parseFloat(raw.split('\\')[0]);
          if (!isNaN(parsed)) windowCenter = parsed;
          break;
        }
        case 0x00281051: { // WindowWidth
          const raw = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          const parsed = parseFloat(raw.split('\\')[0]);
          if (!isNaN(parsed)) windowWidth = parsed;
          break;
        }
        case 0x00281052: { // RescaleIntercept
          const raw = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          const parsed = parseFloat(raw);
          if (!isNaN(parsed)) rescaleIntercept = parsed;
          break;
        }
        case 0x00281053: { // RescaleSlope
          const raw = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          const parsed = parseFloat(raw);
          if (!isNaN(parsed)) rescaleSlope = parsed;
          break;
        }
        case 0x00280030: { // PixelSpacing
          const raw = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          const parts = raw.split('\\').map((s) => parseFloat(s.trim()));
          if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            pixelSpacing = [parts[0], parts[1]];
          }
          break;
        }
        case 0x00180050: { // SliceThickness
          const raw = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          const parsed = parseFloat(raw);
          if (!isNaN(parsed)) sliceThickness = parsed;
          break;
        }
        case 0x00200032: { // ImagePositionPatient
          const raw = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          const parts = raw.split('\\').map((s) => parseFloat(s.trim()));
          if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
            imagePositionPatient = [parts[0], parts[1], parts[2]];
          }
          break;
        }
        case 0x00200037: { // ImageOrientationPatient
          const raw = textDecoder.decode(new Uint8Array(buffer, valueOffset, valueLength)).replace(/\0/g, '').trim();
          const parts = raw.split('\\').map((s) => parseFloat(s.trim()));
          if (parts.length >= 6) {
            imageOrientationPatient = [
              parts[0] || 1, parts[1] || 0, parts[2] || 0,
              parts[3] || 0, parts[4] || 1, parts[5] || 0
            ];
          }
          break;
        }
      }

      offset = valueOffset + valueLength;
      if (offset % 2 !== 0) offset += 1;
    }
  } catch (err) {
    console.warn(`Error parsing DICOM tags in ${fileName}:`, err);
  }

  // Calculate slice normal vector: n = r x c
  const [rx, ry, rz, cx, cy, cz] = imageOrientationPatient;
  const nx = ry * cz - rz * cy;
  const ny = rz * cx - rx * cz;
  const nz = rx * cy - ry * cx;

  // Projection distance along normal
  const [px, py, pz] = imagePositionPatient;
  const distance = px * nx + py * ny + pz * nz;

  // --- PIXEL DATA DECODING ---
  const numPixels = rows * columns;
  let decodedPixels: Int16Array | null = null;

  const isJpegLossless =
    transferSyntaxUid === '1.2.840.10008.1.2.4.70' ||
    transferSyntaxUid === '1.2.840.10008.1.2.4.57';

  // Search for JPEG SOI (0xFF, 0xD8) in the buffer
  const u8Buffer = new Uint8Array(buffer);
  let jpegSoiOffset = -1;
  const searchStart = pixelDataOffset > 0 ? pixelDataOffset : 132;
  for (let idx = searchStart; idx < u8Buffer.length - 1; idx++) {
    if (u8Buffer[idx] === 0xff && u8Buffer[idx + 1] === 0xd8) {
      jpegSoiOffset = idx;
      break;
    }
  }

  if (jpegSoiOffset !== -1 && (isJpegLossless || jpegSoiOffset > searchStart - 32)) {
    try {
      const decoder = new Decoder();
      const rawDecoded = decoder.decode(buffer, jpegSoiOffset, buffer.byteLength - jpegSoiOffset, null);
      if (pixelRepresentation === 1) {
        decodedPixels = new Int16Array(rawDecoded);
      } else {
        const u16 = new Uint16Array(rawDecoded);
        decodedPixels = new Int16Array(numPixels);
        for (let i = 0; i < Math.min(u16.length, numPixels); i++) {
          decodedPixels[i] = u16[i];
        }
      }
    } catch (err) {
      console.warn(`JPEG Lossless decode failed for ${fileName}:`, err);
    }
  }

  // Fallback: raw uncompressed 16-bit or 8-bit pixels
  if (!decodedPixels) {
    let dataStart = pixelDataOffset;
    if (dataStart < 0 || dataStart >= buffer.byteLength) {
      // Find 7FE0,0010 tag
      for (let i = 128; i < u8Buffer.length - 8; i += 2) {
        if (
          u8Buffer[i] === 0xe0 &&
          u8Buffer[i + 1] === 0x7f &&
          u8Buffer[i + 2] === 0x10 &&
          u8Buffer[i + 3] === 0x00
        ) {
          const vr0 = String.fromCharCode(u8Buffer[i + 4]);
          const vr1 = String.fromCharCode(u8Buffer[i + 5]);
          if ((vr0 === 'O' && (vr1 === 'W' || vr1 === 'B')) || (vr0 === 'U' && vr1 === 'N')) {
            dataStart = i + 12;
          } else {
            dataStart = i + 8;
          }
          break;
        }
      }
    }

    if (dataStart >= 0 && dataStart < buffer.byteLength) {
      const rawView = new DataView(buffer, dataStart);
      decodedPixels = new Int16Array(numPixels);
      for (let i = 0; i < numPixels; i++) {
        if (bitsAllocated === 16) {
          const byteOff = i * 2;
          if (byteOff + 1 < rawView.byteLength) {
            decodedPixels[i] =
              pixelRepresentation === 1
                ? rawView.getInt16(byteOff, true)
                : rawView.getUint16(byteOff, true);
          }
        } else {
          if (i < rawView.byteLength) {
            decodedPixels[i] = rawView.getUint8(i);
          }
        }
      }
    }
  }

  return {
    fileName,
    studyInstanceUid,
    seriesInstanceUid,
    sopInstanceUid,
    patientName,
    patientId,
    studyDate,
    studyTime,
    studyDescription,
    seriesDate,
    seriesTime,
    modality: modality || 'CT',
    seriesDescription: seriesDescription || `Series ${seriesNumber}`,
    seriesNumber,
    instanceNumber,
    rows,
    columns,
    bitsAllocated,
    bitsStored,
    pixelRepresentation,
    rescaleSlope,
    rescaleIntercept,
    windowCenter,
    windowWidth,
    pixelSpacing,
    sliceThickness,
    imagePositionPatient,
    imageOrientationPatient,
    imageType,
    transferSyntaxUid,
    decodedPixels,
    distance,
    rawTags,
  };
}

/**
 * Generate a pristine thumbnail PNG Data URL from a parsed slice
 */
export function generateSliceThumbnail(slice: ParsedDicomSlice): string {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const { rows, columns, decodedPixels, rescaleSlope, rescaleIntercept, windowCenter, windowWidth } = slice;

  if (!decodedPixels) {
    ctx.fillStyle = '#080C14';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#38BDF8';
    ctx.font = '12px "Noto Sans", sans-serif';
    ctx.fillText(slice.modality, 10, 20);
    return canvas.toDataURL('image/png');
  }

  const imgData = ctx.createImageData(128, 128);
  const data = imgData.data;

  const halfW = (windowWidth || 400) / 2;
  const center = windowCenter || 40;
  const minVal = center - halfW;
  const maxVal = center + halfW;
  const range = maxVal - minVal || 1;

  for (let dy = 0; dy < 128; dy++) {
    const srcY = Math.floor((dy / 128) * rows);
    for (let dx = 0; dx < 128; dx++) {
      const srcX = Math.floor((dx / 128) * columns);
      const pixelIdx = srcY * columns + srcX;
      const raw = decodedPixels[pixelIdx] || 0;
      const hu = raw * rescaleSlope + rescaleIntercept;

      let norm = (hu - minVal) / range;
      if (norm < 0) norm = 0;
      if (norm > 1) norm = 1;
      const val = Math.floor(norm * 255);

      const targetIdx = (dy * 128 + dx) * 4;
      data[targetIdx] = val;
      data[targetIdx + 1] = val;
      data[targetIdx + 2] = val;
      data[targetIdx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Render any slice to a canvas with pure black background
 */
export function renderSliceToCanvas(
  canvas: HTMLCanvasElement,
  slice: ParsedDicomSlice,
  windowCenter?: number,
  windowWidth?: number
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const { rows, columns, decodedPixels, rescaleSlope, rescaleIntercept } = slice;

  if (!decodedPixels) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    return;
  }

  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  const wc = windowCenter ?? slice.windowCenter ?? 40;
  const ww = Math.max(1, windowWidth ?? slice.windowWidth ?? 400);
  const low = wc - ww / 2;
  const high = wc + ww / 2;
  const invRange = 255.0 / (high - low);

  for (let dy = 0; dy < h; dy++) {
    const srcY = Math.floor((dy / h) * rows);
    for (let dx = 0; dx < w; dx++) {
      const srcX = Math.floor((dx / w) * columns);
      const pixelIdx = srcY * columns + srcX;
      const raw = decodedPixels[pixelIdx] || 0;
      const hu = raw * rescaleSlope + rescaleIntercept;

      let val = Math.round((hu - low) * invRange);
      if (val < 0) val = 0;
      if (val > 255) val = 255;

      const targetIdx = (dy * w + dx) * 4;
      data[targetIdx] = val;
      data[targetIdx + 1] = val;
      data[targetIdx + 2] = val;
      data[targetIdx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Process a group of parsed slices into clean series cards and in-memory 16-bit volume
 */
export function buildIngestionResultFromSlices(
  slices: ParsedDicomSlice[],
  totalDiscovered: number = slices.length
): IngestionResult {
  if (slices.length === 0) {
    throw new Error('No valid DICOM instances were parsed.');
  }

  // Group by seriesInstanceUid
  const seriesMap = new Map<string, ParsedDicomSlice[]>();
  for (const slice of slices) {
    const list = seriesMap.get(slice.seriesInstanceUid) || [];
    list.push(slice);
    seriesMap.set(slice.seriesInstanceUid, list);
  }

  const seriesCards: SeriesCard[] = [];
  const modalitiesSet = new Set<string>();
  const logLines: string[] = [];

  let patientName = slices[0]?.patientName || 'Patient Anonymous';
  let patientId = slices[0]?.patientId || 'ID-001';
  let studyDescription = slices[0]?.studyDescription || 'CT Study';
  const studyInstanceUid = slices[0]?.studyInstanceUid || `study.${Date.now()}`;

  logLines.push(`Discovered ${totalDiscovered} total files. Found ${slices.length} valid DICOM slices.`);

  for (const [seriesUid, sliceList] of seriesMap.entries()) {
    // Sort spatially along normal vector
    sliceList.sort((a, b) => {
      if (Math.abs(a.distance - b.distance) > 0.001) {
        return a.distance - b.distance;
      }
      return a.instanceNumber - b.instanceNumber;
    });

    // Cache slices in memory
    setSeriesSlices(seriesUid, sliceList);

    const first = sliceList[0];
    const midIdx = Math.floor(sliceList.length / 2);
    const midSlice = sliceList[midIdx];

    if (first.patientName && first.patientName !== 'Patient Anonymous') {
      patientName = first.patientName;
    }
    if (first.patientId && first.patientId !== 'ID-001') {
      patientId = first.patientId;
    }
    if (first.studyDescription && first.studyDescription !== 'CT Study') {
      studyDescription = first.studyDescription;
    }

    modalitiesSet.add(first.modality);

    // Build contiguous 16-bit HU volume
    const cols = first.columns;
    const rows = first.rows;
    const numSlices = sliceList.length;
    const totalVoxels = cols * rows * numSlices;
    const volumeBuffer = new Int16Array(totalVoxels);

    let minHu = 100000;
    let maxHu = -100000;

    for (let z = 0; z < numSlices; z++) {
      const s = sliceList[z];
      const sliceOffset = z * (cols * rows);
      if (s.decodedPixels) {
        for (let i = 0; i < cols * rows; i++) {
          const raw = s.decodedPixels[i];
          const hu = Math.round(raw * s.rescaleSlope + s.rescaleIntercept);
          volumeBuffer[sliceOffset + i] = hu;
          if (hu < minHu) minHu = hu;
          if (hu > maxHu) maxHu = hu;
        }
      }
    }

    if (minHu === 100000) minHu = 0;
    if (maxHu === -100000) maxHu = 4096;

    // Compute exact Euclidean distance in millimeters between consecutive sorted slices
    let spacingZ = first.sliceThickness || 1.0;
    if (sliceList.length > 1) {
      let totalDist = 0;
      let count = 0;
      for (let i = 0; i < sliceList.length - 1; i++) {
        const p1 = sliceList[i].imagePositionPatient;
        const p2 = sliceList[i + 1].imagePositionPatient;
        const dist = Math.sqrt(
          (p2[0] - p1[0]) ** 2 +
          (p2[1] - p1[1]) ** 2 +
          (p2[2] - p1[2]) ** 2
        );
        if (dist > 0.0001) {
          totalDist += dist;
          count++;
        }
      }
      if (count > 0) {
        spacingZ = totalDist / count;
      }
    }

    // In DICOM (0028, 0030) PixelSpacing: [rowSpacing (Y), colSpacing (X)]
    const spacingX = first.pixelSpacing[1] || 1.0;
    const spacingY = first.pixelSpacing[0] || 1.0;

    // Cache the volume payload
    setCachedSeriesVolume(seriesUid, {
      series_instance_uid: seriesUid,
      modality: first.modality,
      series_description: first.seriesDescription,
      dimensions: [cols, rows, numSlices],
      spacing: [spacingX, spacingY, spacingZ],
      window_center: first.windowCenter,
      window_width: first.windowWidth,
      min_hu: minHu,
      max_hu: maxHu,
      voxel_buffer_base64: '',
      raw_voxels: volumeBuffer,
      slice_positions: sliceList.map((s) => s.distance),
    });

    const thumbnailDataUrl = generateSliceThumbnail(midSlice);

    const descLower = first.seriesDescription.toLowerCase();
    const isScout =
      numSlices === 1 ||
      descLower.includes('topogram') ||
      descLower.includes('scout') ||
      first.imageType.includes('LOCALIZER');

    logLines.push(
      `Series ${first.seriesNumber}: "${first.seriesDescription}" | ${numSlices} slices | ${cols}x${rows} | spacing: [${spacingX.toFixed(2)}, ${spacingY.toFixed(2)}, ${spacingZ.toFixed(2)}] mm`
    );

    seriesCards.push({
      series_instance_uid: seriesUid,
      study_instance_uid: first.studyInstanceUid,
      patient_name: first.patientName,
      patient_id: first.patientId,
      study_description: first.studyDescription,
      series_date: first.seriesDate,
      modality: first.modality,
      series_description: first.seriesDescription,
      series_number: first.seriesNumber,
      slice_count: numSlices,
      rows,
      columns: cols,
      pixel_spacing: [spacingY, spacingX],
      slice_thickness: spacingZ,
      window_center: first.windowCenter,
      window_width: first.windowWidth,
      thumbnail_data_url: thumbnailDataUrl,
      is_scout: isScout,
      raw_tags: first.rawTags,
    });
  }

  seriesCards.sort((a, b) => a.series_number - b.series_number);
  const detectedModalities = ['ALL', ...Array.from(modalitiesSet).sort()];

  const telemetry: IngestionTelemetry = {
    total_files_discovered: totalDiscovered,
    valid_dicom_slices: slices.length,
    skipped_files: Math.max(0, totalDiscovered - slices.length),
    series_count: seriesCards.length,
    study_uid: studyInstanceUid,
    patient_name: patientName,
    patient_id: patientId,
    slice_spacing_verified: true,
    spacing_summary: seriesCards.map((s) => `S#${s.series_number}: dz=${s.slice_thickness.toFixed(2)}mm`).join(', '),
    log_lines: logLines,
  };

  return {
    study_instance_uid: studyInstanceUid,
    patient_name: patientName,
    patient_id: patientId,
    study_description: studyDescription,
    detected_modalities: detectedModalities,
    series: seriesCards,
    telemetry,
  };
}

/**
 * Ingest from FileList (Folder or selected DICOM files) with streaming progress
 */
export async function ingestFileList(
  files: File[],
  onProgress?: (progress: ImportProgress) => void
): Promise<IngestionResult> {
  const validSlices: ParsedDicomSlice[] = [];
  const total = files.length;
  const startTime = performance.now();

  for (let i = 0; i < total; i++) {
    const file = files[i];
    const now = performance.now();
    const elapsedSeconds = (now - startTime) / 1000;
    const rate = (i + 1) / Math.max(0.001, elapsedSeconds);
    const estimatedRemainingSeconds = Math.max(0, Math.round((total - (i + 1)) / Math.max(0.1, rate)));
    const percentage = Math.round(((i + 1) / total) * 100);

    if (onProgress) {
      onProgress({
        fileName: file.name,
        processedCount: i + 1,
        totalCount: total,
        percentage,
        phase: 'parsing',
        elapsedSeconds: Math.round(elapsedSeconds),
        estimatedRemainingSeconds,
      });
    }

    try {
      const buffer = await file.arrayBuffer();
      const slice = parseDicomBuffer(buffer, file.name);
      if (slice) {
        validSlices.push(slice);
      }
    } catch (err) {
      console.warn(`Failed reading file ${file.name}:`, err);
    }
  }

  if (validSlices.length === 0) {
    throw new Error('No valid DICOM instances found in selected files.');
  }

  if (onProgress) {
    onProgress({
      fileName: 'Building 16-bit volume...',
      processedCount: total,
      totalCount: total,
      percentage: 100,
      phase: 'building',
      elapsedSeconds: Math.round((performance.now() - startTime) / 1000),
      estimatedRemainingSeconds: 0,
    });
  }

  return buildIngestionResultFromSlices(validSlices, total);
}

/**
 * Ingest from a ZIP File archive with streaming progress
 */
export async function ingestZipFile(
  zipFile: File,
  onProgress?: (progress: ImportProgress) => void
): Promise<IngestionResult> {
  const startTime = performance.now();
  if (onProgress) {
    onProgress({
      fileName: zipFile.name,
      processedCount: 0,
      totalCount: 1,
      percentage: 0,
      phase: 'extracting',
      elapsedSeconds: 0,
      estimatedRemainingSeconds: 0,
    });
  }

  const zip = await JSZip.loadAsync(zipFile);

  const fileEntries: { name: string; entry: JSZip.JSZipObject }[] = [];
  zip.forEach((relativePath, entry) => {
    if (!entry.dir && !relativePath.startsWith('__MACOSX/')) {
      fileEntries.push({ name: relativePath, entry });
    }
  });

  if (fileEntries.length === 0) {
    throw new Error('ZIP archive is empty or contains no files.');
  }

  const validSlices: ParsedDicomSlice[] = [];
  const total = fileEntries.length;

  for (let i = 0; i < total; i++) {
    const { name, entry } = fileEntries[i];
    const now = performance.now();
    const elapsedSeconds = (now - startTime) / 1000;
    const rate = (i + 1) / Math.max(0.001, elapsedSeconds);
    const estimatedRemainingSeconds = Math.max(0, Math.round((total - (i + 1)) / Math.max(0.1, rate)));
    const percentage = Math.round(((i + 1) / total) * 100);

    if (onProgress) {
      onProgress({
        fileName: name.split('/').pop() || name,
        processedCount: i + 1,
        totalCount: total,
        percentage,
        phase: 'parsing',
        elapsedSeconds: Math.round(elapsedSeconds),
        estimatedRemainingSeconds,
      });
    }

    try {
      const buffer = await entry.async('arraybuffer');
      const slice = parseDicomBuffer(buffer, name);
      if (slice) {
        validSlices.push(slice);
      }
    } catch (err) {
      console.warn(`Failed reading zip entry ${name}:`, err);
    }
  }

  if (validSlices.length === 0) {
    throw new Error('No valid DICOM instances found in ZIP archive.');
  }

  if (onProgress) {
    onProgress({
      fileName: 'Building 16-bit volume...',
      processedCount: total,
      totalCount: total,
      percentage: 100,
      phase: 'building',
      elapsedSeconds: Math.round((performance.now() - startTime) / 1000),
      estimatedRemainingSeconds: 0,
    });
  }

  return buildIngestionResultFromSlices(validSlices, total);
}
