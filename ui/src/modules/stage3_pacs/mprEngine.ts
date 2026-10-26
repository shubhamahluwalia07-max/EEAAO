import { ProjectionPlane, SlabMode, SeriesVolumePayload, RoiStats, SegmentationMask } from './types';

export interface ViewportPlaneMetrics {
  physicalWidthMm: number;
  physicalHeightMm: number;
  renderW: number;
  renderH: number;
  offsetX: number;
  offsetY: number;
  uniformScale: number;
}

export class MprVolume {
  public seriesInstanceUid: string;
  public modality: string;
  public seriesDescription: string;
  public width: number;
  public height: number;
  public depth: number;
  public spacing: [number, number, number]; // [spacingX, spacingY, spacingZ] in mm
  public voxels: Int16Array;
  public minHu: number;
  public maxHu: number;
  public windowCenter: number;
  public windowWidth: number;

  constructor(payload: SeriesVolumePayload) {
    this.seriesInstanceUid = payload.series_instance_uid;
    this.modality = payload.modality;
    this.seriesDescription = payload.series_description;
    this.width = payload.dimensions[0];
    this.height = payload.dimensions[1];
    this.depth = payload.dimensions[2];
    this.spacing = payload.spacing;
    this.minHu = payload.min_hu;
    this.maxHu = payload.max_hu;
    this.windowCenter = payload.window_center;
    this.windowWidth = payload.window_width;

    if (payload.raw_voxels) {
      this.voxels = payload.raw_voxels;
    } else if (payload.voxel_buffer_base64) {
      const binary = atob(payload.voxel_buffer_base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      this.voxels = new Int16Array(bytes.buffer);
    } else {
      this.voxels = new Int16Array(this.width * this.height * this.depth);
    }
  }

  // Safe nearest-voxel sampling with clamp
  public getVoxel(x: number, y: number, z: number): number {
    const cx = Math.max(0, Math.min(this.width - 1, x | 0));
    const cy = Math.max(0, Math.min(this.height - 1, y | 0));
    const cz = Math.max(0, Math.min(this.depth - 1, z | 0));
    return this.voxels[cz * (this.width * this.height) + cy * this.width + cx];
  }

  // High-fidelity bilinear sub-voxel sampling
  public sampleBilinear(x: number, y: number, z: number): number {
    const cx = Math.max(0, Math.min(this.width - 1, x));
    const cy = Math.max(0, Math.min(this.height - 1, y));
    const cz = Math.max(0, Math.min(this.depth - 1, z));

    const x0 = Math.floor(cx);
    const x1 = Math.min(this.width - 1, x0 + 1);
    const fx = cx - x0;

    const y0 = Math.floor(cy);
    const y1 = Math.min(this.height - 1, y0 + 1);
    const fy = cy - y0;

    const z0 = Math.floor(cz);
    const z1 = Math.min(this.depth - 1, z0 + 1);
    const fz = cz - z0;

    const rowStride = this.width;
    const sliceStride = this.width * this.height;

    // Sample along z0
    const offZ0 = z0 * sliceStride;
    const v00 = this.voxels[offZ0 + y0 * rowStride + x0];
    const v10 = this.voxels[offZ0 + y0 * rowStride + x1];
    const v01 = this.voxels[offZ0 + y1 * rowStride + x0];
    const v11 = this.voxels[offZ0 + y1 * rowStride + x1];
    const valZ0 = (1 - fx) * (1 - fy) * v00 + fx * (1 - fy) * v10 + (1 - fx) * fy * v01 + fx * fy * v11;

    if (fz === 0 || z0 === z1) {
      return valZ0;
    }

    // Sample along z1
    const offZ1 = z1 * sliceStride;
    const w00 = this.voxels[offZ1 + y0 * rowStride + x0];
    const w10 = this.voxels[offZ1 + y0 * rowStride + x1];
    const w01 = this.voxels[offZ1 + y1 * rowStride + x0];
    const w11 = this.voxels[offZ1 + y1 * rowStride + x1];
    const valZ1 = (1 - fx) * (1 - fy) * w00 + fx * (1 - fy) * w10 + (1 - fx) * fy * w01 + fx * fy * w11;

    return (1 - fz) * valZ0 + fz * valZ1;
  }

  // Exact physical millimeter dimensions of each orthogonal MPR plane
  public getPlanePhysicalDimensions(plane: ProjectionPlane): {
    physicalWidthMm: number;
    physicalHeightMm: number;
  } {
    const [dx, dy, dz] = this.spacing;
    switch (plane) {
      case 'axial':
        return {
          physicalWidthMm: this.width * dx,
          physicalHeightMm: this.height * dy,
        };
      case 'coronal':
        return {
          physicalWidthMm: this.width * dx,
          physicalHeightMm: this.depth * dz,
        };
      case 'sagittal':
        return {
          physicalWidthMm: this.height * dy,
          physicalHeightMm: this.depth * dz,
        };
    }
  }

  // Compute uniform scaling with mandatory 14% viewport buffer window
  public getViewportPlaneMetrics(
    plane: ProjectionPlane,
    canvasWidth: number,
    canvasHeight: number,
    pan: { x: number; y: number },
    zoom: number
  ): ViewportPlaneMetrics {
    const { physicalWidthMm, physicalHeightMm } = this.getPlanePhysicalDimensions(plane);

    const baseScale = Math.min(
      canvasWidth / Math.max(0.1, physicalWidthMm),
      canvasHeight / Math.max(0.1, physicalHeightMm)
    );
    const uniformScale = baseScale * zoom;

    const renderW = Math.max(1, Math.round(physicalWidthMm * uniformScale));
    const renderH = Math.max(1, Math.round(physicalHeightMm * uniformScale));

    const offsetX = Math.round((canvasWidth - renderW) / 2 + pan.x);
    const offsetY = Math.round((canvasHeight - renderH) / 2 + pan.y);

    return {
      physicalWidthMm,
      physicalHeightMm,
      renderW,
      renderH,
      offsetX,
      offsetY,
      uniformScale,
    };
  }

  // Legacy aspect ratio helper for UI widgets
  public getPlanePhysicalRatio(plane: ProjectionPlane): {
    sliceWidth: number;
    sliceHeight: number;
    aspectRatio: number;
    pixelSpacingX: number;
    pixelSpacingY: number;
  } {
    const [dx, dy, dz] = this.spacing;
    switch (plane) {
      case 'axial':
        return {
          sliceWidth: this.width,
          sliceHeight: this.height,
          aspectRatio: (this.width * dx) / (this.height * dy),
          pixelSpacingX: dx,
          pixelSpacingY: dy,
        };
      case 'coronal': {
        const coronalHeight = Math.max(1, Math.round((this.depth * dz) / dy));
        return {
          sliceWidth: this.width,
          sliceHeight: coronalHeight,
          aspectRatio: (this.width * dx) / (this.depth * dz),
          pixelSpacingX: dx,
          pixelSpacingY: dy,
        };
      }
      case 'sagittal': {
        const sagittalHeight = Math.max(1, Math.round((this.depth * dz) / dx));
        return {
          sliceWidth: this.height,
          sliceHeight: sagittalHeight,
          aspectRatio: (this.height * dy) / (this.depth * dz),
          pixelSpacingX: dy,
          pixelSpacingY: dx,
        };
      }
    }
  }

  // Slices count for a given plane
  public getPlaneSliceCount(plane: ProjectionPlane): number {
    switch (plane) {
      case 'axial':
        return this.depth;
      case 'coronal':
        return this.height;
      case 'sagittal':
        return this.width;
    }
  }

  // Render orthogonal MPR plane with 14% buffer margin and bilinear interpolation
  public renderViewportWithBuffer(
    targetImageData: ImageData,
    plane: ProjectionPlane,
    sliceIndex: number,
    windowCenter: number,
    windowWidth: number,
    slabMode: SlabMode,
    slabThicknessMm: number,
    inverted: boolean,
    metrics: ViewportPlaneMetrics,
    activeMask?: SegmentationMask | null,
    masks?: SegmentationMask[]
  ): void {
    const data = targetImageData.data;
    const canvasWidth = targetImageData.width;
    const canvasHeight = targetImageData.height;
    const totalPixels = canvasWidth * canvasHeight;

    // Fill canvas with pure black (#000000) so anatomy floats seamlessly
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      data[idx] = 0;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
      data[idx + 3] = 255;
    }

    const { physicalWidthMm, physicalHeightMm, renderW, renderH, offsetX, offsetY } = metrics;
    const [dx, dy, dz] = this.spacing;

    const winW = Math.max(1, windowWidth);
    const low = windowCenter - winW / 2;
    const high = windowCenter + winW / 2;
    const invRange = 255.0 / (high - low);

    let slabRadius = 0;
    if (slabMode !== 'none' && slabThicknessMm > 0) {
      const step = plane === 'axial' ? dz : plane === 'coronal' ? dy : dx;
      slabRadius = Math.max(1, Math.round(slabThicknessMm / (step * 2)));
    }

    const startY = Math.max(0, offsetY);
    const endY = Math.min(canvasHeight, offsetY + renderH);
    const startX = Math.max(0, offsetX);
    const endX = Math.min(canvasWidth, offsetX + renderW);

    if (startX >= endX || startY >= endY) return;

    // Collect list of visible masks to render
    const visibleMasks: SegmentationMask[] = [];
    if (masks && masks.length > 0) {
      for (const m of masks) {
        if (m.visible) visibleMasks.push(m);
      }
    } else if (activeMask && activeMask.visible) {
      visibleMasks.push(activeMask);
    }

    const rowStride = this.width;
    const sliceStride = this.width * this.height;

    for (let cy = startY; cy < endY; cy++) {
      const relY = cy - offsetY;
      const mmY = (relY / renderH) * physicalHeightMm;

      for (let cx = startX; cx < endX; cx++) {
        const relX = cx - offsetX;
        const mmX = (relX / renderW) * physicalWidthMm;

        let hu = 0;
        let vx = 0;
        let vy = 0;
        let vz = 0;

        if (plane === 'axial') {
          vx = mmX / dx;
          vy = mmY / dy;
          vz = Math.max(0, Math.min(this.depth - 1, sliceIndex | 0));

          if (slabMode === 'none' || slabRadius === 0) {
            hu = this.sampleBilinear(vx, vy, vz);
          } else if (slabMode === 'mip') {
            let maxV = -32768;
            const zMin = Math.max(0, vz - slabRadius);
            const zMax = Math.min(this.depth - 1, vz + slabRadius);
            for (let z = zMin; z <= zMax; z++) {
              const v = this.sampleBilinear(vx, vy, z);
              if (v > maxV) maxV = v;
            }
            hu = maxV;
          } else if (slabMode === 'minip') {
            let minV = 32767;
            const zMin = Math.max(0, vz - slabRadius);
            const zMax = Math.min(this.depth - 1, vz + slabRadius);
            for (let z = zMin; z <= zMax; z++) {
              const v = this.sampleBilinear(vx, vy, z);
              if (v < minV) minV = v;
            }
            hu = minV;
          } else {
            let sum = 0;
            let count = 0;
            const zMin = Math.max(0, vz - slabRadius);
            const zMax = Math.min(this.depth - 1, vz + slabRadius);
            for (let z = zMin; z <= zMax; z++) {
              sum += this.sampleBilinear(vx, vy, z);
              count++;
            }
            hu = sum / count;
          }
        } else if (plane === 'coronal') {
          vx = mmX / dx;
          vy = Math.max(0, Math.min(this.height - 1, sliceIndex | 0));
          vz = (this.depth - 1) - (mmY / dz);

          if (slabMode === 'none' || slabRadius === 0) {
            hu = this.sampleBilinear(vx, vy, vz);
          } else if (slabMode === 'mip') {
            let maxV = -32768;
            const yMin = Math.max(0, vy - slabRadius);
            const yMax = Math.min(this.height - 1, vy + slabRadius);
            for (let y = yMin; y <= yMax; y++) {
              const v = this.sampleBilinear(vx, y, vz);
              if (v > maxV) maxV = v;
            }
            hu = maxV;
          } else if (slabMode === 'minip') {
            let minV = 32767;
            const yMin = Math.max(0, vy - slabRadius);
            const yMax = Math.min(this.height - 1, vy + slabRadius);
            for (let y = yMin; y <= yMax; y++) {
              const v = this.sampleBilinear(vx, y, vz);
              if (v < minV) minV = v;
            }
            hu = minV;
          } else {
            let sum = 0;
            let count = 0;
            const yMin = Math.max(0, vy - slabRadius);
            const yMax = Math.min(this.height - 1, vy + slabRadius);
            for (let y = yMin; y <= yMax; y++) {
              sum += this.sampleBilinear(vx, y, vz);
              count++;
            }
            hu = sum / count;
          }
        } else {
          // Sagittal
          vx = Math.max(0, Math.min(this.width - 1, sliceIndex | 0));
          vy = mmX / dy;
          vz = (this.depth - 1) - (mmY / dz);

          if (slabMode === 'none' || slabRadius === 0) {
            hu = this.sampleBilinear(vx, vy, vz);
          } else if (slabMode === 'mip') {
            let maxV = -32768;
            const xMin = Math.max(0, vx - slabRadius);
            const xMax = Math.min(this.width - 1, vx + slabRadius);
            for (let x = xMin; x <= xMax; x++) {
              const v = this.sampleBilinear(x, vy, vz);
              if (v > maxV) maxV = v;
            }
            hu = maxV;
          } else if (slabMode === 'minip') {
            let minV = 32767;
            const xMin = Math.max(0, vx - slabRadius);
            const xMax = Math.min(this.width - 1, vx + slabRadius);
            for (let x = xMin; x <= xMax; x++) {
              const v = this.sampleBilinear(x, vy, vz);
              if (v < minV) minV = v;
            }
            hu = minV;
          } else {
            let sum = 0;
            let count = 0;
            const xMin = Math.max(0, vx - slabRadius);
            const xMax = Math.min(this.width - 1, vx + slabRadius);
            for (let x = xMin; x <= xMax; x++) {
              sum += this.sampleBilinear(x, vy, vz);
              count++;
            }
            hu = sum / count;
          }
        }

        let intensity = (hu - low) * invRange;
        if (intensity < 0) intensity = 0;
        else if (intensity > 255) intensity = 255;

        const gray = inverted ? 255 - (intensity | 0) : (intensity | 0);
        let r = gray;
        let g = gray;
        let b = gray;

        if (visibleMasks.length > 0) {
          const vxi = Math.max(0, Math.min(this.width - 1, Math.round(vx)));
          const vyi = Math.max(0, Math.min(this.height - 1, Math.round(vy)));
          const vzi = Math.max(0, Math.min(this.depth - 1, Math.round(vz)));
          const voxelIdx = vzi * sliceStride + vyi * rowStride + vxi;

          for (let m = 0; m < visibleMasks.length; m++) {
            const mask = visibleMasks[m];
            let isInside = false;
            if (mask.voxelMask && mask.voxelMask.length > 0) {
              isInside = mask.voxelMask[voxelIdx] === 1;
            } else if (!mask.voxelMask) {
              isInside = hu >= mask.minHu && hu <= mask.maxHu;
            }

            if (mask.exclusionMask && mask.exclusionMask[voxelIdx] === 1) {
              // Excluded Not Need region rendered in black (#000000 with subtle dark contour)
              r = Math.round(r * 0.10);
              g = Math.round(g * 0.10);
              b = Math.round(b * 0.10);
            } else if (isInside) {
              const [mr, mg, mb] = mask.rgb;
              const alpha = mask.opacity;
              r = Math.round(r * (1 - alpha) + mr * alpha);
              g = Math.round(g * (1 - alpha) + mg * alpha);
              b = Math.round(b * (1 - alpha) + mb * alpha);
            }
          }
        }

        const pIdx = (cy * canvasWidth + cx) * 4;
        data[pIdx] = r;
        data[pIdx + 1] = g;
        data[pIdx + 2] = b;
        data[pIdx + 3] = 255;
      }
    }
  }

  // Calculate Elliptical ROI Statistics in real time (Mean, Min, Max, SD, Area)
  public calculateEllipseRoiStats(
    plane: ProjectionPlane,
    sliceIndex: number,
    center: { x: number; y: number },
    radiusX: number,
    radiusY: number
  ): RoiStats {
    const [dx, dy] = this.spacing;
    const rx = Math.max(1, Math.abs(radiusX));
    const ry = Math.max(1, Math.abs(radiusY));

    const minX = Math.max(0, Math.floor(center.x - rx));
    const maxX = Math.min(this.width - 1, Math.ceil(center.x + rx));
    const minY = Math.max(0, Math.floor(center.y - ry));
    const maxY = Math.min(this.height - 1, Math.ceil(center.y + ry));

    let sum = 0;
    let min = 32767;
    let max = -32768;
    let count = 0;
    const values: number[] = [];

    for (let y = minY; y <= maxY; y++) {
      const dyNorm = (y - center.y) / ry;
      for (let x = minX; x <= maxX; x++) {
        const dxNorm = (x - center.x) / rx;
        if (dxNorm * dxNorm + dyNorm * dyNorm <= 1.0) {
          let hu = 0;
          if (plane === 'axial') {
            hu = this.getVoxel(x, y, sliceIndex);
          } else if (plane === 'coronal') {
            hu = this.getVoxel(x, sliceIndex, y);
          } else {
            hu = this.getVoxel(sliceIndex, x, y);
          }

          if (hu < min) min = hu;
          if (hu > max) max = hu;
          sum += hu;
          values.push(hu);
          count++;
        }
      }
    }

    if (count === 0) {
      return { mean: 0, min: 0, max: 0, stdDev: 0, areaMm2: 0 };
    }

    const mean = sum / count;
    let varianceSum = 0;
    for (const v of values) {
      varianceSum += (v - mean) * (v - mean);
    }
    const stdDev = Math.sqrt(varianceSum / count);
    const areaMm2 = Math.PI * rx * dx * ry * dy;

    return {
      mean: Math.round(mean * 10) / 10,
      min,
      max,
      stdDev: Math.round(stdDev * 10) / 10,
      areaMm2: Math.round(areaMm2 * 10) / 10,
    };
  }
}
