import { ProjectionPlane } from './types';

/**
 * Creates an empty 3D voxel mask of dimensions width * height * depth.
 */
export function createEmptyMask(width: number, height: number, depth: number): Uint8Array {
  return new Uint8Array(width * height * depth);
}

/**
 * Creates a binary mask from HU threshold criteria.
 */
export function createThresholdMask(
  voxels: Int16Array,
  width: number,
  height: number,
  depth: number,
  minHu: number,
  maxHu: number
): Uint8Array {
  const total = width * height * depth;
  const mask = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const hu = voxels[i];
    if (hu >= minHu && hu <= maxHu) {
      mask[i] = 1;
    }
  }
  return mask;
}

/**
 * 3D 6-connected flood fill from a seed voxel bounded by [minHu, maxHu].
 * Accumulates into targetMask and returns indices of newly set voxels (for undo).
 * Automatically runs a local axial hole-fill pass and 1-voxel closing pass to prevent swiss-cheese holes.
 */
export function floodFill3D(
  voxels: Int16Array,
  width: number,
  height: number,
  depth: number,
  seed: [number, number, number],
  minHu: number,
  maxHu: number,
  targetMask: Uint8Array
): number[] {
  const [sx, sy, sz] = seed;
  if (sx < 0 || sx >= width || sy < 0 || sy >= height || sz < 0 || sz >= depth) {
    return [];
  }

  const rowStride = width;
  const sliceStride = width * height;
  const seedIdx = sz * sliceStride + sy * rowStride + sx;

  const seedHu = voxels[seedIdx];
  if (seedHu < minHu || seedHu > maxHu) {
    return [];
  }

  const newlyAddedIndices: number[] = [];
  const queue = new Int32Array(width * height * depth);
  let head = 0;
  let tail = 0;

  if (targetMask[seedIdx] === 0) {
    targetMask[seedIdx] = 1;
    newlyAddedIndices.push(seedIdx);
  }
  queue[tail++] = seedIdx;

  const dxOffsets = [1, -1, 0, 0, 0, 0];
  const dyOffsets = [0, 0, 1, -1, 0, 0];
  const dzOffsets = [0, 0, 0, 0, 1, -1];

  while (head < tail) {
    const currIdx = queue[head++];
    const cz = Math.floor(currIdx / sliceStride);
    const rem = currIdx % sliceStride;
    const cy = Math.floor(rem / rowStride);
    const cx = rem % rowStride;

    for (let i = 0; i < 6; i++) {
      const nx = cx + dxOffsets[i];
      const ny = cy + dyOffsets[i];
      const nz = cz + dzOffsets[i];

      if (nx >= 0 && nx < width && ny >= 0 && ny < height && nz >= 0 && nz < depth) {
        const nIdx = nz * sliceStride + ny * rowStride + nx;
        if (targetMask[nIdx] === 0) {
          const nHu = voxels[nIdx];
          if (nHu >= minHu && nHu <= maxHu) {
            targetMask[nIdx] = 1;
            newlyAddedIndices.push(nIdx);
            queue[tail++] = nIdx;
          }
        }
      }
    }
  }

  // Automatic local axial hole-fill and 1-voxel closing pass to eliminate swiss-cheese artifacts
  if (newlyAddedIndices.length > 0) {
    postProcessGrownRegion(targetMask, width, height, depth, newlyAddedIndices);
  }

  return newlyAddedIndices;
}

/**
 * Local 2D/3D axial hole-fill and 1-voxel closing pass within the seed region bounding box.
 */
export function postProcessGrownRegion(
  targetMask: Uint8Array,
  width: number,
  height: number,
  depth: number,
  addedIndices: number[]
): void {
  if (addedIndices.length === 0) return;

  const sliceStride = width * height;
  const rowStride = width;

  let minX = width, maxX = 0;
  let minY = height, maxY = 0;
  let minZ = depth, maxZ = 0;

  for (let i = 0; i < addedIndices.length; i++) {
    const idx = addedIndices[i];
    const z = Math.floor(idx / sliceStride);
    const rem = idx % sliceStride;
    const y = Math.floor(rem / rowStride);
    const x = rem % rowStride;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  minX = Math.max(0, minX - 1);
  maxX = Math.min(width - 1, maxX + 1);
  minY = Math.max(0, minY - 1);
  maxY = Math.min(height - 1, maxY + 1);
  minZ = Math.max(0, minZ - 1);
  maxZ = Math.min(depth - 1, maxZ + 1);

  // 1. 2D Axial hole-fill pass for each affected slice
  for (let z = minZ; z <= maxZ; z++) {
    const zOffset = z * sliceStride;
    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;
    const visited = new Uint8Array(boxW * boxH);
    const qX = new Int32Array(boxW * boxH);
    const qY = new Int32Array(boxW * boxH);
    let qh = 0, qt = 0;

    for (let x = minX; x <= maxX; x++) {
      for (const y of [minY, maxY]) {
        const idx = zOffset + y * rowStride + x;
        const bIdx = (y - minY) * boxW + (x - minX);
        if (targetMask[idx] === 0 && visited[bIdx] === 0) {
          visited[bIdx] = 1;
          qX[qt] = x; qY[qt] = y; qt++;
        }
      }
    }
    for (let y = minY; y <= maxY; y++) {
      for (const x of [minX, maxX]) {
        const idx = zOffset + y * rowStride + x;
        const bIdx = (y - minY) * boxW + (x - minX);
        if (targetMask[idx] === 0 && visited[bIdx] === 0) {
          visited[bIdx] = 1;
          qX[qt] = x; qY[qt] = y; qt++;
        }
      }
    }

    const dx4 = [1, -1, 0, 0];
    const dy4 = [0, 0, 1, -1];
    while (qh < qt) {
      const cx = qX[qh];
      const cy = qY[qh];
      qh++;

      for (let d = 0; d < 4; d++) {
        const nx = cx + dx4[d];
        const ny = cy + dy4[d];
        if (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY) {
          const bIdx = (ny - minY) * boxW + (nx - minX);
          const nIdx = zOffset + ny * rowStride + nx;
          if (targetMask[nIdx] === 0 && visited[bIdx] === 0) {
            visited[bIdx] = 1;
            qX[qt] = nx; qY[qt] = ny; qt++;
          }
        }
      }
    }

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const bIdx = (y - minY) * boxW + (x - minX);
        const idx = zOffset + y * rowStride + x;
        if (targetMask[idx] === 0 && visited[bIdx] === 0) {
          targetMask[idx] = 1;
        }
      }
    }
  }

  // 2. 1-voxel closing pass (local dilation followed by erosion within bounding box)
  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  const boxD = maxZ - minZ + 1;
  const localDilated = new Uint8Array(boxW * boxH * boxD);

  for (let z = minZ; z <= maxZ; z++) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = z * sliceStride + y * rowStride + x;
        if (targetMask[idx] === 1) {
          for (const [dx, dy, dz] of [[0,0,0],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
            const nx = x + dx; const ny = y + dy; const nz = z + dz;
            if (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY && nz >= minZ && nz <= maxZ) {
              const lIdx = (nz - minZ) * (boxW * boxH) + (ny - minY) * boxW + (nx - minX);
              localDilated[lIdx] = 1;
            }
          }
        }
      }
    }
  }

  for (let z = minZ; z <= maxZ; z++) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const lIdx = (z - minZ) * (boxW * boxH) + (y - minY) * boxW + (x - minX);
        if (localDilated[lIdx] === 1) {
          let keep = true;
          for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
            const nx = x + dx; const ny = y + dy; const nz = z + dz;
            if (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY && nz >= minZ && nz <= maxZ) {
              const nLIdx = (nz - minZ) * (boxW * boxH) + (ny - minY) * boxW + (nx - minX);
              if (localDilated[nLIdx] === 0) {
                keep = false;
                break;
              }
            } else {
              keep = false;
              break;
            }
          }
          if (keep) {
            targetMask[z * sliceStride + y * rowStride + x] = 1;
          }
        }
      }
    }
  }
}


/**
 * Applies a 2D circular or 3D spherical brush stroke centered at voxel [vx, vy, vz].
 */
export function applyBrushStroke(
  targetMask: Uint8Array,
  width: number,
  height: number,
  depth: number,
  spacing: [number, number, number],
  center: [number, number, number],
  radiusMm: number,
  plane: ProjectionPlane,
  is3D: boolean,
  mode: 'paint' | 'erase',
  constrainedHu?: { voxels: Int16Array; minHu: number; maxHu: number }
): void {
  const [cx, cy, cz] = center;
  const [dx, dy, dz] = spacing;
  const fillVal = mode === 'paint' ? 1 : 0;
  const rowStride = width;
  const sliceStride = width * height;

  const rx = Math.max(1, Math.round(radiusMm / dx));
  const ry = Math.max(1, Math.round(radiusMm / dy));
  const rz = Math.max(1, Math.round(radiusMm / dz));

  const checkHu = (idx: number): boolean => {
    if (!constrainedHu || mode === 'erase') return true;
    const hu = constrainedHu.voxels[idx];
    return hu >= constrainedHu.minHu && hu <= constrainedHu.maxHu;
  };

  if (!is3D) {
    // 2D slice paint
    if (plane === 'axial') {
      const z = Math.max(0, Math.min(depth - 1, Math.round(cz)));
      const zOff = z * sliceStride;
      const minX = Math.max(0, Math.floor(cx - rx));
      const maxX = Math.min(width - 1, Math.ceil(cx + rx));
      const minY = Math.max(0, Math.floor(cy - ry));
      const maxY = Math.min(height - 1, Math.ceil(cy + ry));

      for (let y = minY; y <= maxY; y++) {
        const ny = (y - cy) / ry;
        const yOff = zOff + y * rowStride;
        for (let x = minX; x <= maxX; x++) {
          const nx = (x - cx) / rx;
          if (nx * nx + ny * ny <= 1.0) {
            const idx = yOff + x;
            if (checkHu(idx)) {
              targetMask[idx] = fillVal;
            }
          }
        }
      }
    } else if (plane === 'coronal') {
      const y = Math.max(0, Math.min(height - 1, Math.round(cy)));
      const minX = Math.max(0, Math.floor(cx - rx));
      const maxX = Math.min(width - 1, Math.ceil(cx + rx));
      const minZ = Math.max(0, Math.floor(cz - rz));
      const maxZ = Math.min(depth - 1, Math.ceil(cz + rz));

      for (let z = minZ; z <= maxZ; z++) {
        const nz = (z - cz) / rz;
        const zOff = z * sliceStride + y * rowStride;
        for (let x = minX; x <= maxX; x++) {
          const nx = (x - cx) / rx;
          if (nx * nx + nz * nz <= 1.0) {
            const idx = zOff + x;
            if (checkHu(idx)) {
              targetMask[idx] = fillVal;
            }
          }
        }
      }
    } else {
      // Sagittal
      const x = Math.max(0, Math.min(width - 1, Math.round(cx)));
      const minY = Math.max(0, Math.floor(cy - ry));
      const maxY = Math.min(height - 1, Math.ceil(cy + ry));
      const minZ = Math.max(0, Math.floor(cz - rz));
      const maxZ = Math.min(depth - 1, Math.ceil(cz + rz));

      for (let z = minZ; z <= maxZ; z++) {
        const nz = (z - cz) / rz;
        const zOff = z * sliceStride;
        for (let y = minY; y <= maxY; y++) {
          const ny = (y - cy) / ry;
          if (ny * ny + nz * nz <= 1.0) {
            const idx = zOff + y * rowStride + x;
            if (checkHu(idx)) {
              targetMask[idx] = fillVal;
            }
          }
        }
      }
    }
  } else {
    // 3D Spherical/Ellipsoidal Brush
    const minX = Math.max(0, Math.floor(cx - rx));
    const maxX = Math.min(width - 1, Math.ceil(cx + rx));
    const minY = Math.max(0, Math.floor(cy - ry));
    const maxY = Math.min(height - 1, Math.ceil(cy + ry));
    const minZ = Math.max(0, Math.floor(cz - rz));
    const maxZ = Math.min(depth - 1, Math.ceil(cz + rz));

    for (let z = minZ; z <= maxZ; z++) {
      const nz = (z - cz) / rz;
      const zOff = z * sliceStride;
      for (let y = minY; y <= maxY; y++) {
        const ny = (y - cy) / ry;
        const yOff = zOff + y * rowStride;
        for (let x = minX; x <= maxX; x++) {
          const nx = (x - cx) / rx;
          if (nx * nx + ny * ny + nz * nz <= 1.0) {
            const idx = yOff + x;
            if (checkHu(idx)) {
              targetMask[idx] = fillVal;
            }
          }
        }
      }
    }
  }
}

/**
 * Interpolates brush strokes between previous point and current point to eliminate gaps during fast drag.
 */
export function applyBrushLine(
  targetMask: Uint8Array,
  width: number,
  height: number,
  depth: number,
  spacing: [number, number, number],
  p0: [number, number, number],
  p1: [number, number, number],
  radiusMm: number,
  plane: ProjectionPlane,
  is3D: boolean,
  mode: 'paint' | 'erase',
  constrainedHu?: { voxels: Int16Array; minHu: number; maxHu: number }
): void {
  const dist = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  const step = Math.max(1, radiusMm * 0.4);
  const numSteps = Math.max(1, Math.ceil(dist / step));

  for (let s = 0; s <= numSteps; s++) {
    const t = s / numSteps;
    const pt: [number, number, number] = [
      p0[0] + (p1[0] - p0[0]) * t,
      p0[1] + (p1[1] - p0[1]) * t,
      p0[2] + (p1[2] - p0[2]) * t,
    ];
    applyBrushStroke(targetMask, width, height, depth, spacing, pt, radiusMm, plane, is3D, mode, constrainedHu);
  }
}

/**
 * Freehand closed polygon selection that erases (0) all mask voxels inside the polygon.
 */
export function applyLassoErase(
  targetMask: Uint8Array,
  width: number,
  height: number,
  depth: number,
  plane: ProjectionPlane,
  sliceIndex: number,
  polygonSliceCoords: { x: number; y: number }[],
  throughVolume: boolean
): void {
  if (polygonSliceCoords.length < 3) return;

  // Compute 2D bounding box
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const pt of polygonSliceCoords) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  // Ray-casting point-in-polygon helper
  const isInside = (px: number, py: number): boolean => {
    let inside = false;
    for (let i = 0, j = polygonSliceCoords.length - 1; i < polygonSliceCoords.length; j = i++) {
      const xi = polygonSliceCoords[i].x;
      const yi = polygonSliceCoords[i].y;
      const xj = polygonSliceCoords[j].x;
      const yj = polygonSliceCoords[j].y;
      const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const rowStride = width;
  const sliceStride = width * height;

  if (plane === 'axial') {
    const bMinX = Math.max(0, Math.floor(minX));
    const bMaxX = Math.min(width - 1, Math.ceil(maxX));
    const bMinY = Math.max(0, Math.floor(minY));
    const bMaxY = Math.min(height - 1, Math.ceil(maxY));

    const zStart = throughVolume ? 0 : Math.max(0, Math.min(depth - 1, sliceIndex));
    const zEnd = throughVolume ? depth - 1 : zStart;

    for (let y = bMinY; y <= bMaxY; y++) {
      for (let x = bMinX; x <= bMaxX; x++) {
        if (isInside(x, y)) {
          for (let z = zStart; z <= zEnd; z++) {
            targetMask[z * sliceStride + y * rowStride + x] = 0;
          }
        }
      }
    }
  } else if (plane === 'coronal') {
    const bMinX = Math.max(0, Math.floor(minX));
    const bMaxX = Math.min(width - 1, Math.ceil(maxX));
    const bMinZ = Math.max(0, Math.floor(minY));
    const bMaxZ = Math.min(depth - 1, Math.ceil(maxY));

    const yStart = throughVolume ? 0 : Math.max(0, Math.min(height - 1, sliceIndex));
    const yEnd = throughVolume ? height - 1 : yStart;

    for (let z = bMinZ; z <= bMaxZ; z++) {
      for (let x = bMinX; x <= bMaxX; x++) {
        if (isInside(x, z)) {
          for (let y = yStart; y <= yEnd; y++) {
            targetMask[z * sliceStride + y * rowStride + x] = 0;
          }
        }
      }
    }
  } else {
    // Sagittal
    const bMinY = Math.max(0, Math.floor(minX));
    const bMaxY = Math.min(height - 1, Math.ceil(maxX));
    const bMinZ = Math.max(0, Math.floor(minY));
    const bMaxZ = Math.min(depth - 1, Math.ceil(maxY));

    const xStart = throughVolume ? 0 : Math.max(0, Math.min(width - 1, sliceIndex));
    const xEnd = throughVolume ? width - 1 : xStart;

    for (let z = bMinZ; z <= bMaxZ; z++) {
      for (let y = bMinY; y <= bMaxY; y++) {
        if (isInside(y, z)) {
          for (let x = xStart; x <= xEnd; x++) {
            targetMask[z * sliceStride + y * rowStride + x] = 0;
          }
        }
      }
    }
  }
}

/**
 * 3D 6-connected component labeling that retains only the single largest connected component.
 */
export function keepLargestIsland(
  targetMask: Uint8Array,
  width: number,
  height: number,
  depth: number
): { islandCount: number; retainedVoxels: number } {
  const total = width * height * depth;
  const visited = new Uint8Array(total);
  const sliceStride = width * height;
  const rowStride = width;

  let largestIslandIndices: number[] = [];
  let islandCount = 0;

  const queue = new Int32Array(total);
  const dxOffsets = [1, -1, 0, 0, 0, 0];
  const dyOffsets = [0, 0, 1, -1, 0, 0];
  const dzOffsets = [0, 0, 0, 0, 1, -1];

  for (let idx = 0; idx < total; idx++) {
    if (targetMask[idx] === 1 && visited[idx] === 0) {
      islandCount++;
      const currentIsland: number[] = [];
      let head = 0;
      let tail = 0;

      visited[idx] = 1;
      queue[tail++] = idx;
      currentIsland.push(idx);

      while (head < tail) {
        const cIdx = queue[head++];
        const cz = Math.floor(cIdx / sliceStride);
        const rem = cIdx % sliceStride;
        const cy = Math.floor(rem / rowStride);
        const cx = rem % rowStride;

        for (let i = 0; i < 6; i++) {
          const nx = cx + dxOffsets[i];
          const ny = cy + dyOffsets[i];
          const nz = cz + dzOffsets[i];

          if (nx >= 0 && nx < width && ny >= 0 && ny < height && nz >= 0 && nz < depth) {
            const nIdx = nz * sliceStride + ny * rowStride + nx;
            if (targetMask[nIdx] === 1 && visited[nIdx] === 0) {
              visited[nIdx] = 1;
              queue[tail++] = nIdx;
              currentIsland.push(nIdx);
            }
          }
        }
      }

      if (currentIsland.length > largestIslandIndices.length) {
        largestIslandIndices = currentIsland;
      }
    }
  }

  // Clear mask and restore only the largest component
  targetMask.fill(0);
  for (const idx of largestIslandIndices) {
    targetMask[idx] = 1;
  }

  return {
    islandCount,
    retainedVoxels: largestIslandIndices.length,
  };
}

/**
 * 3D morphological dilation with spherical structuring element.
 */
export function morphologicalDilate3D(
  mask: Uint8Array,
  width: number,
  height: number,
  depth: number,
  spacing: [number, number, number],
  radiusMm: number
): Uint8Array {
  const total = width * height * depth;
  const out = new Uint8Array(mask);
  const [dx, dy, dz] = spacing;
  const rx = Math.max(1, Math.round(radiusMm / dx));
  const ry = Math.max(1, Math.round(radiusMm / dy));
  const rz = Math.max(1, Math.round(radiusMm / dz));

  const sliceStride = width * height;
  const rowStride = width;

  // Precompute spherical offsets
  const offsets: number[] = [];
  for (let z = -rz; z <= rz; z++) {
    const nz = z / rz;
    for (let y = -ry; y <= ry; y++) {
      const ny = y / ry;
      for (let x = -rx; x <= rx; x++) {
        const nx = x / rx;
        if (nx * nx + ny * ny + nz * nz <= 1.0) {
          offsets.push(z * sliceStride + y * rowStride + x);
        }
      }
    }
  }

  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = z * sliceStride + y * rowStride + x;
        if (mask[idx] === 1) {
          for (let o = 0; o < offsets.length; o++) {
            const targetIdx = idx + offsets[o];
            if (targetIdx >= 0 && targetIdx < total) {
              out[targetIdx] = 1;
            }
          }
        }
      }
    }
  }

  return out;
}

/**
 * 3D morphological erosion with spherical structuring element.
 */
export function morphologicalErode3D(
  mask: Uint8Array,
  width: number,
  height: number,
  depth: number,
  spacing: [number, number, number],
  radiusMm: number
): Uint8Array {
  const total = width * height * depth;
  const out = new Uint8Array(total);
  const [dx, dy, dz] = spacing;
  const rx = Math.max(1, Math.round(radiusMm / dx));
  const ry = Math.max(1, Math.round(radiusMm / dy));
  const rz = Math.max(1, Math.round(radiusMm / dz));

  const sliceStride = width * height;
  const rowStride = width;

  const offsets: { x: number; y: number; z: number; offset: number }[] = [];
  for (let z = -rz; z <= rz; z++) {
    const nz = z / rz;
    for (let y = -ry; y <= ry; y++) {
      const ny = y / ry;
      for (let x = -rx; x <= rx; x++) {
        const nx = x / rx;
        if (nx * nx + ny * ny + nz * nz <= 1.0) {
          offsets.push({ x, y, z, offset: z * sliceStride + y * rowStride + x });
        }
      }
    }
  }

  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = z * sliceStride + y * rowStride + x;
        if (mask[idx] === 1) {
          let retains = true;
          for (let o = 0; o < offsets.length; o++) {
            const nx = x + offsets[o].x;
            const ny = y + offsets[o].y;
            const nz = z + offsets[o].z;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height || nz < 0 || nz >= depth) {
              retains = false;
              break;
            }
            if (mask[idx + offsets[o].offset] === 0) {
              retains = false;
              break;
            }
          }
          if (retains) {
            out[idx] = 1;
          }
        }
      }
    }
  }

  return out;
}

/**
 * 3D morphological closing: Dilation followed by Erosion.
 */
export function morphologicalClose3D(
  mask: Uint8Array,
  width: number,
  height: number,
  depth: number,
  spacing: [number, number, number],
  radiusMm: number
): Uint8Array {
  const dilated = morphologicalDilate3D(mask, width, height, depth, spacing, radiusMm);
  return morphologicalErode3D(dilated, width, height, depth, spacing, radiusMm);
}

/**
 * 3D background flood-fill inversion that fills internal medullary cavities and cancellous voids.
 * Any voxel = 0 unreachable from the 6 external volume faces is an internal cavity, inverted to 1.
 */
export function morphologicalFillCavities3D(
  mask: Uint8Array,
  width: number,
  height: number,
  depth: number
): Uint8Array {
  const total = width * height * depth;
  const reachableBackground = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const sliceStride = width * height;
  const rowStride = width;

  // Helper to enqueue border voxels
  const enqueueIfZero = (x: number, y: number, z: number) => {
    const idx = z * sliceStride + y * rowStride + x;
    if (mask[idx] === 0 && reachableBackground[idx] === 0) {
      reachableBackground[idx] = 1;
      queue[tail++] = idx;
    }
  };

  // Seed with all 6 exterior volume faces
  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      enqueueIfZero(0, y, z);
      enqueueIfZero(width - 1, y, z);
    }
    for (let x = 0; x < width; x++) {
      enqueueIfZero(x, 0, z);
      enqueueIfZero(x, height - 1, z);
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      enqueueIfZero(x, y, 0);
      enqueueIfZero(x, y, depth - 1);
    }
  }

  const dxOffsets = [1, -1, 0, 0, 0, 0];
  const dyOffsets = [0, 0, 1, -1, 0, 0];
  const dzOffsets = [0, 0, 0, 0, 1, -1];

  while (head < tail) {
    const cIdx = queue[head++];
    const cz = Math.floor(cIdx / sliceStride);
    const rem = cIdx % sliceStride;
    const cy = Math.floor(rem / rowStride);
    const cx = rem % rowStride;

    for (let i = 0; i < 6; i++) {
      const nx = cx + dxOffsets[i];
      const ny = cy + dyOffsets[i];
      const nz = cz + dzOffsets[i];

      if (nx >= 0 && nx < width && ny >= 0 && ny < height && nz >= 0 && nz < depth) {
        const nIdx = nz * sliceStride + ny * rowStride + nx;
        if (mask[nIdx] === 0 && reachableBackground[nIdx] === 0) {
          reachableBackground[nIdx] = 1;
          queue[tail++] = nIdx;
        }
      }
    }
  }

  // Result: any voxel that is NOT reachable background is part of the solid volume!
  const out = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    out[i] = reachableBackground[i] === 0 ? 1 : 0;
  }

  return out;
}

/**
 * Bitwise OR union of multiple masks.
 */
export function mergeMasks(masks: Uint8Array[], totalVoxels: number): Uint8Array {
  const out = new Uint8Array(totalVoxels);
  for (const m of masks) {
    for (let i = 0; i < totalVoxels; i++) {
      if (m[i] === 1) out[i] = 1;
    }
  }
  return out;
}

/**
 * Bitwise subtraction: maskA AND NOT maskB.
 */
export function subtractMasks(maskA: Uint8Array, maskB: Uint8Array, totalVoxels: number): Uint8Array {
  const out = new Uint8Array(totalVoxels);
  for (let i = 0; i < totalVoxels; i++) {
    if (maskA[i] === 1 && maskB[i] === 0) {
      out[i] = 1;
    }
  }
  return out;
}

/**
 * 3-Step Automated Bone Segmentation Pipeline.
 */
export function executeBoneSegmentation(
  voxels: Int16Array,
  width: number,
  height: number,
  depth: number,
  spacing: [number, number, number],
  seeds: [number, number, number][],
  corticalMinHu: number,
  corticalMaxHu: number,
  cancellousMinHu: number,
  gapClosingMm: number,
  fillCavities: boolean
): Uint8Array {
  const total = width * height * depth;
  const workingMask = new Uint8Array(total);

  // 1. Seeded region growing across cortical + cancellous range
  for (const seed of seeds) {
    floodFill3D(
      voxels,
      width,
      height,
      depth,
      seed,
      cancellousMinHu,
      corticalMaxHu,
      workingMask
    );
  }

  // 2. 3D morphological closing pass to seal cortical gaps
  const closed =
    gapClosingMm > 0
      ? morphologicalClose3D(workingMask, width, height, depth, spacing, gapClosingMm)
      : workingMask;

  // 3. 3D background flood-fill inversion to fill internal medullary cavities
  if (fillCavities) {
    return morphologicalFillCavities3D(closed, width, height, depth);
  }

  return closed;
}

export interface MultiBoneCalculationConfig {
  id: string;
  name: string;
  color: string;
  seeds: [number, number, number][];
  seedThresholdHu: number;
  sensitivity: number;
  minHu: number;
  maxHu: number;
  gapClosingDistancePx: number;
  fillLongBones: boolean;
}

export interface MultiBoneSegmentationResult {
  boneMasks: Map<string, Uint8Array>;
  calculationTimeSeconds: number;
}

/**
 * High-performance Multi-Bone Seeded Watershed Region Growing with Joint-Splitting Sensitivity,
 * 3D Gap Closing, and Medullary Cavity Filling across CT volume.
 */
export function executeMultiBoneSegmentation(
  voxels: Int16Array,
  width: number,
  height: number,
  depth: number,
  spacing: [number, number, number],
  bones: MultiBoneCalculationConfig[]
): MultiBoneSegmentationResult {
  const startTime = performance.now();
  const total = width * height * depth;
  const sliceStride = width * height;
  const rowStride = width;

  const resultMasks = new Map<string, Uint8Array>();

  // Filter bones that have at least one valid seed point
  const activeBones = bones.filter((b) => b.seeds.length > 0);
  if (activeBones.length === 0) {
    for (const b of bones) {
      resultMasks.set(b.id, new Uint8Array(total));
    }
    return {
      boneMasks: resultMasks,
      calculationTimeSeconds: Math.max(0.1, parseFloat(((performance.now() - startTime) / 1000).toFixed(2))),
    };
  }

  // Label volume: 0 = unassigned, 1..K = bone index
  const labels = new Uint16Array(total);
  const cost = new Float32Array(total);
  cost.fill(1e9);

  // Queue for seeded BFS / Dijkstra propagation
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  // Initialize seeds for all active bones
  activeBones.forEach((b, bIdx) => {
    const labelId = bIdx + 1;
    for (const [sx, sy, sz] of b.seeds) {
      if (sx >= 0 && sx < width && sy >= 0 && sy < height && sz >= 0 && sz < depth) {
        const idx = sz * sliceStride + sy * rowStride + sx;
        labels[idx] = labelId;
        cost[idx] = 0;
        queue[tail++] = idx;
      }
    }
  });

  const dxOffsets = [1, -1, 0, 0, 0, 0];
  const dyOffsets = [0, 0, 1, -1, 0, 0];
  const dzOffsets = [0, 0, 0, 0, 1, -1];

  while (head < tail) {
    const currIdx = queue[head++];
    const currLabel = labels[currIdx];
    const bone = activeBones[currLabel - 1];
    const currHu = voxels[currIdx];
    const currCost = cost[currIdx];

    const cz = Math.floor(currIdx / sliceStride);
    const rem = currIdx % sliceStride;
    const cy = Math.floor(rem / rowStride);
    const cx = rem % rowStride;

    // Joint neck splitting sensitivity factor (0 to 1)
    const sensWeight = Math.min(1.0, Math.max(0.0, bone.sensitivity / 100));

    for (let i = 0; i < 6; i++) {
      const nx = cx + dxOffsets[i];
      const ny = cy + dyOffsets[i];
      const nz = cz + dzOffsets[i];

      if (nx >= 0 && nx < width && ny >= 0 && ny < height && nz >= 0 && nz < depth) {
        const nIdx = nz * sliceStride + ny * rowStride + nx;
        const nHu = voxels[nIdx];

        // Must meet bone's min/max HU criteria and seed density threshold
        if (nHu >= bone.minHu && nHu <= bone.maxHu && nHu >= (bone.seedThresholdHu - 20)) {
          // Compute neck-splitting traversal penalty based on local drop in HU density
          const huDrop = Math.max(0, currHu - nHu);
          const stepCost = 1.0 + (huDrop / 50) * sensWeight * 3.0;
          const newCost = currCost + stepCost;

          if (labels[nIdx] === 0) {
            labels[nIdx] = currLabel;
            cost[nIdx] = newCost;
            queue[tail++] = nIdx;
          } else if (labels[nIdx] === currLabel && newCost < cost[nIdx]) {
            cost[nIdx] = newCost;
          }
        }
      }
    }
  }

  // Post-processing for each bone: Gap closing and Medullary Cavity filling
  activeBones.forEach((b, bIdx) => {
    const labelId = bIdx + 1;
    let mask = new Uint8Array(total);
    for (let i = 0; i < total; i++) {
      if (labels[i] === labelId) {
        mask[i] = 1;
      }
    }

    // 1. 3D Gap Closing Distance (bridges cracks without taking other bones)
    if (b.gapClosingDistancePx > 0) {
      const minSpacing = Math.min(spacing[0], spacing[1], spacing[2]) || 1.0;
      const radiusMm = Math.max(0.5, b.gapClosingDistancePx * minSpacing);
      const closed = morphologicalClose3D(mask, width, height, depth, spacing, radiusMm);

      // Prevent stealing voxels allocated to another bone
      for (let i = 0; i < total; i++) {
        if (closed[i] === 1) {
          if (labels[i] === 0 || labels[i] === labelId) {
            mask[i] = 1;
          }
        }
      }
    }

    // 2. Fill Long Bones: 3D Medullary cavity & marrow canal flood-filling
    if (b.fillLongBones) {
      const filled = morphologicalFillCavities3D(mask, width, height, depth);
      // Strictly avoid overwriting other seeded bones
      for (let i = 0; i < total; i++) {
        if (filled[i] === 1) {
          if (labels[i] === 0 || labels[i] === labelId) {
            mask[i] = 1;
          }
        }
      }
    }

    resultMasks.set(b.id, mask);
  });

  // For inactive bones without seeds, return empty mask
  for (const b of bones) {
    if (!resultMasks.has(b.id)) {
      resultMasks.set(b.id, new Uint8Array(total));
    }
  }

  const elapsedSeconds = parseFloat(((performance.now() - startTime) / 1000).toFixed(1));
  return {
    boneMasks: resultMasks,
    calculationTimeSeconds: Math.max(0.1, elapsedSeconds),
  };
}

/**
 * 3D Min-Cut / Watershed Mask Splitting
 * Separates connected bones or fracture fragments within a single source mask into two distinct masks (Mask A and Mask B)
 * without losing cortical boundaries.
 */
export function splitMaskBySeeds(
  sourceMask: Uint8Array,
  voxels: Int16Array,
  width: number,
  height: number,
  depth: number,
  spacing: [number, number, number],
  seedsA: [number, number, number][],
  seedsB: [number, number, number][]
): { maskA: Uint8Array; maskB: Uint8Array } {
  const total = width * height * depth;
  const maskA = new Uint8Array(total);
  const maskB = new Uint8Array(total);

  if (seedsA.length === 0 || seedsB.length === 0) {
    maskA.set(sourceMask);
    return { maskA, maskB };
  }

  const rowStride = width;
  const sliceStride = width * height;

  // Labels: 0 = unassigned, 1 = Bone A, 2 = Bone B
  const labels = new Uint8Array(total);
  const cost = new Float32Array(total);
  cost.fill(1e9);

  // Queue for seeded BFS / Dijkstra propagation
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  for (const [sx, sy, sz] of seedsA) {
    if (sx >= 0 && sx < width && sy >= 0 && sy < height && sz >= 0 && sz < depth) {
      const idx = sz * sliceStride + sy * rowStride + sx;
      if (sourceMask[idx] === 1) {
        labels[idx] = 1;
        cost[idx] = 0;
        queue[tail++] = idx;
      }
    }
  }

  for (const [sx, sy, sz] of seedsB) {
    if (sx >= 0 && sx < width && sy >= 0 && sy < height && sz >= 0 && sz < depth) {
      const idx = sz * sliceStride + sy * rowStride + sx;
      if (sourceMask[idx] === 1) {
        labels[idx] = 2;
        cost[idx] = 0;
        queue[tail++] = idx;
      }
    }
  }

  const dxOffsets = [1, -1, 0, 0, 0, 0];
  const dyOffsets = [0, 0, 1, -1, 0, 0];
  const dzOffsets = [0, 0, 0, 0, 1, -1];

  while (head < tail) {
    const currIdx = queue[head++];
    const currLabel = labels[currIdx];
    const currHu = voxels[currIdx];
    const currCost = cost[currIdx];

    const cz = Math.floor(currIdx / sliceStride);
    const rem = currIdx % sliceStride;
    const cy = Math.floor(rem / rowStride);
    const cx = rem % rowStride;

    for (let i = 0; i < 6; i++) {
      const nx = cx + dxOffsets[i];
      const ny = cy + dyOffsets[i];
      const nz = cz + dzOffsets[i];

      if (nx >= 0 && nx < width && ny >= 0 && ny < height && nz >= 0 && nz < depth) {
        const nIdx = nz * sliceStride + ny * rowStride + nx;
        if (sourceMask[nIdx] === 1) {
          const nHu = voxels[nIdx];
          const huDelta = Math.abs(currHu - nHu);
          const stepCost = 1.0 + (huDelta / 50.0);
          const newCost = currCost + stepCost;

          if (labels[nIdx] === 0) {
            labels[nIdx] = currLabel;
            cost[nIdx] = newCost;
            queue[tail++] = nIdx;
          } else if (labels[nIdx] === currLabel && newCost < cost[nIdx]) {
            cost[nIdx] = newCost;
          }
        }
      }
    }
  }

  for (let i = 0; i < total; i++) {
    if (labels[i] === 1) {
      maskA[i] = 1;
    } else if (labels[i] === 2) {
      maskB[i] = 1;
    } else if (sourceMask[i] === 1) {
      maskA[i] = 1;
    }
  }

  return { maskA, maskB };
}

export interface CompetitiveSeedParams {
  voxels: Int16Array;
  width: number;
  height: number;
  depth: number;
  spacing: [number, number, number];
  seeds: {
    voxel: [number, number, number];
    kind: 'need' | 'not_need';
    hu: number;
  }[];
  seedThresholdHu: number;
  sensitivity: number; // 0 to 100
  gapClosingMm?: number;
  fillLongBones?: boolean;
}

export interface CompetitiveSeedResult {
  inclusionMask: Uint8Array;
  exclusionMask: Uint8Array;
}

/**
 * Competitive multi-seed watershed region growing solver governed by Seed Threshold (HU)
 * and Sensitivity (0 to 100).
 * Need seeds (positive inclusion) grow bone mask in assigned color.
 * Not Need seeds (negative barrier) grow exclusion zone in black (#000000).
 */
export function executeCompetitiveSeedSegmentation({
  voxels,
  width,
  height,
  depth,
  spacing,
  seeds,
  seedThresholdHu,
  sensitivity,
  gapClosingMm = 0,
  fillLongBones = false,
}: CompetitiveSeedParams): CompetitiveSeedResult {
  const total = width * height * depth;
  const inclusionMask = new Uint8Array(total);
  const exclusionMask = new Uint8Array(total);

  if (seeds.length === 0) {
    return { inclusionMask, exclusionMask };
  }

  const sliceStride = width * height;
  const rowStride = width;

  // Labels: 0 = unassigned, 1 = Need (Inclusion), 2 = Not Need (Barrier)
  const labels = new Uint8Array(total);
  const cost = new Float32Array(total);
  cost.fill(1e9);

  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  // S from 0 to 100 controls gradient tolerance and morphological neck-crossing radius
  const S = Math.max(0, Math.min(100, sensitivity));
  const baseDrop = 120.0;
  const maxGradientDrop = baseDrop * (0.15 + 1.85 * (S / 100.0));

  // Initialize seeds
  for (const s of seeds) {
    const [sx, sy, sz] = s.voxel;
    if (sx >= 0 && sx < width && sy >= 0 && sy < height && sz >= 0 && sz < depth) {
      const idx = sz * sliceStride + sy * rowStride + sx;
      const seedLabel = s.kind === 'need' ? 1 : 2;
      labels[idx] = seedLabel;
      cost[idx] = 0;
      queue[tail++] = idx;
    }
  }

  const dxOffsets = [1, -1, 0, 0, 0, 0];
  const dyOffsets = [0, 0, 1, -1, 0, 0];
  const dzOffsets = [0, 0, 0, 0, 1, -1];

  while (head < tail) {
    const currIdx = queue[head++];
    const currLabel = labels[currIdx];
    const currHu = voxels[currIdx];
    const currCost = cost[currIdx];

    const cz = Math.floor(currIdx / sliceStride);
    const rem = currIdx % sliceStride;
    const cy = Math.floor(rem / rowStride);
    const cx = rem % rowStride;

    for (let i = 0; i < 6; i++) {
      const nx = cx + dxOffsets[i];
      const ny = cy + dyOffsets[i];
      const nz = cz + dzOffsets[i];

      if (nx >= 0 && nx < width && ny >= 0 && ny < height && nz >= 0 && nz < depth) {
        const nIdx = nz * sliceStride + ny * rowStride + nx;
        const nHu = voxels[nIdx];

        // Must meet Seed Threshold HU criteria
        if (nHu >= (seedThresholdHu - 25)) {
          const huDrop = Math.max(0, currHu - nHu);

          // If intensity drop exceeds permissible sensitivity gradient, barrier stops growth
          if (huDrop <= maxGradientDrop) {
            const stepCost = 1.0 + (huDrop / Math.max(1, maxGradientDrop)) * 2.0;
            const newCost = currCost + stepCost;

            if (labels[nIdx] === 0) {
              labels[nIdx] = currLabel;
              cost[nIdx] = newCost;
              queue[tail++] = nIdx;
            } else if (labels[nIdx] === currLabel && newCost < cost[nIdx]) {
              cost[nIdx] = newCost;
            }
          }
        }
      }
    }
  }

  // Populate output masks
  for (let i = 0; i < total; i++) {
    if (labels[i] === 1) {
      inclusionMask[i] = 1;
    } else if (labels[i] === 2) {
      exclusionMask[i] = 1;
    }
  }

  // Finishing operations
  let finalInclusion = inclusionMask;
  if (gapClosingMm > 0) {
    const closed = morphologicalClose3D(finalInclusion, width, height, depth, spacing, gapClosingMm);
    // Never allow closed voxels to overwrite exclusion barrier
    for (let i = 0; i < total; i++) {
      if (closed[i] === 1 && labels[i] !== 2) {
        finalInclusion[i] = 1;
      }
    }
  }

  if (fillLongBones) {
    const filled = morphologicalFillCavities3D(finalInclusion, width, height, depth);
    for (let i = 0; i < total; i++) {
      if (filled[i] === 1 && labels[i] !== 2) {
        finalInclusion[i] = 1;
      }
    }
  }

  return { inclusionMask: finalInclusion, exclusionMask };
}

