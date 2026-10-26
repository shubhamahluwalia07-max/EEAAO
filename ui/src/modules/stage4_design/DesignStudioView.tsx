import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { ModuleId, medamStateBus, TransferredMeshBuffer } from '../../shell/stateBus';
import {
  ToolIconButton,
  IconResetView,
  IconExportStl,
} from '../stage3_pacs/Icons';

interface DesignStudioViewProps {
  onSelectModule?: (mod: ModuleId) => void;
  theme?: 'light' | 'dark';
}

export const DesignStudioView: React.FC<DesignStudioViewProps> = ({
  onSelectModule,
  theme = 'light',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Geometry state from shared MEDAM state bus
  const [meshData, setMeshData] = useState<TransferredMeshBuffer | null>(() =>
    medamStateBus.getTransferredGeometry()
  );
  const [isWireframe, setIsWireframe] = useState<boolean>(false);

  // Three.js refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Orbit controls state
  const isDraggingRef = useRef<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rotPitchRef = useRef<number>(0.35);
  const rotYawRef = useRef<number>(0.8);
  const panOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 20, 0));
  const zoomDistRef = useRef<number>(220);

  // Listen to incoming geometry transfers
  useEffect(() => {
    const unsub = medamStateBus.onGeometryReceived((geom) => {
      setMeshData(geom);
    });
    return () => unsub();
  }, []);

  // Update camera matrix from spherical angles and pan offset
  const updateCamera = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    const r = zoomDistRef.current;
    const p = rotPitchRef.current;
    const y = rotYawRef.current;
    const pan = panOffsetRef.current;

    const cx = pan.x + r * Math.cos(p) * Math.sin(y);
    const cy = pan.y + r * Math.sin(p);
    const cz = pan.z + r * Math.cos(p) * Math.cos(y);

    camera.position.set(cx, cy, cz);
    camera.lookAt(pan.x, pan.y, pan.z);
    camera.updateProjectionMatrix();
    (window as unknown as { __renderDesignStudio?: () => void }).__renderDesignStudio?.();
  }, []);

  // Initialize Three.js scene and build plate
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(theme === 'dark' ? 0x090d16 : 0xf1f5f9);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 4000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    rendererRef.current = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(150, 250, 200);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x93c5fd, 0.6);
    dirLight2.position.set(-150, -100, -150);
    scene.add(dirLight2);

    // Build Plate (Circular & Rectangular Grids, 200mm x 200mm)
    const gridGroup = new THREE.Group();
    const gridHelper = new THREE.GridHelper(240, 24, 0x0284c7, theme === 'dark' ? 0x1e293b : 0xcbd5e1);
    gridHelper.position.y = 0;
    gridGroup.add(gridHelper);

    // Build plate circular perimeter ring
    const ringGeo = new THREE.RingGeometry(118, 120, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.1;
    gridGroup.add(ringMesh);

    scene.add(gridGroup);

    // Model group container
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    updateCamera();

    // On-demand rendering
    let isPending = false;
    const renderScene = () => {
      isPending = false;
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };

    const requestRender = () => {
      if (!isPending) {
        isPending = true;
        animFrameRef.current = requestAnimationFrame(renderScene);
      }
    };

    (window as unknown as { __renderDesignStudio?: () => void }).__renderDesignStudio = requestRender;
    renderScene();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
    };
  }, [theme, updateCamera]);

  // Load and populate geometry into model group
  useEffect(() => {
    const group = modelGroupRef.current;
    if (!group) return;

    // Clear previous children
    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else if (child.material) child.material.dispose();
      group.remove(child);
    }

    if (!meshData || meshData.vertices.length === 0) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(meshData.vertices, 3));
    if (meshData.normals.length === meshData.vertices.length) {
      geometry.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
    } else {
      geometry.computeVertexNormals();
    }
    if (meshData.indices.length > 0) {
      geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
    }

    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;

    // Center model over build plate and place lowest point at Y = 0
    if (bbox) {
      const centerX = (bbox.min.x + bbox.max.x) / 2;
      const centerZ = (bbox.min.z + bbox.max.z) / 2;
      const minY = bbox.min.y;

      geometry.translate(-centerX, -minY, -centerZ);

      // Fit camera zoom distance to bounding size
      const sizeX = bbox.max.x - bbox.min.x;
      const sizeY = bbox.max.y - bbox.min.y;
      const sizeZ = bbox.max.z - bbox.min.z;
      const maxDim = Math.max(sizeX, sizeY, sizeZ, 50);

      panOffsetRef.current.set(0, sizeY * 0.5, 0);
      zoomDistRef.current = maxDim * 2.2;
      updateCamera();
    }

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(meshData.maskColor || '#0284C7'),
      roughness: 0.35,
      metalness: 0.15,
      wireframe: isWireframe,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
  }, [meshData, isWireframe, updateCamera]);

  // Standard CAD Mouse Orbit & Pan handlers (Right-click orbit, Left-click pan, Wheel zoom)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) {
      // Right-Click + Drag: Rotate / Orbit
      isDraggingRef.current = true;
      isPanningRef.current = false;
    } else if (e.button === 0 || e.button === 1) {
      // Left-Click + Drag: Pan / Translate
      isPanningRef.current = true;
      isDraggingRef.current = false;
    }
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current && !isPanningRef.current) return;
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    if (isDraggingRef.current) {
      rotYawRef.current -= dx * 0.008;
      rotPitchRef.current = Math.max(
        0.05,
        Math.min(Math.PI / 2 - 0.05, rotPitchRef.current + dy * 0.008)
      );
      updateCamera();
    } else if (isPanningRef.current) {
      const cam = cameraRef.current;
      if (!cam) return;
      const factor = zoomDistRef.current * 0.0015;
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);

      panOffsetRef.current.addScaledVector(right, -dx * factor);
      panOffsetRef.current.addScaledVector(up, dy * factor);
      updateCamera();
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    zoomDistRef.current = Math.max(20, Math.min(1500, zoomDistRef.current * factor));
    updateCamera();
  };

  const handleResetCamera = () => {
    rotPitchRef.current = 0.35;
    rotYawRef.current = 0.8;
    panOffsetRef.current.set(0, 20, 0);
    zoomDistRef.current = 220;
    updateCamera();
  };

  const handleExportStlDirect = () => {
    if (!meshData) return;
    const { vertices, indices } = meshData;
    const triCount = indices.length > 0 ? indices.length / 3 : vertices.length / 9;

    const bufferSize = 84 + triCount * 50;
    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    const headerStr = 'MEDAM Studio Design Build Plate Watertight Solid Export';
    for (let i = 0; i < 80; i++) {
      view.setUint8(i, i < headerStr.length ? headerStr.charCodeAt(i) : 0x20);
    }
    view.setUint32(80, triCount, true);

    let offset = 84;
    for (let t = 0; t < triCount; t++) {
      let i0: number, i1: number, i2: number;
      if (indices.length > 0) {
        i0 = indices[t * 3 + 0];
        i1 = indices[t * 3 + 1];
        i2 = indices[t * 3 + 2];
      } else {
        i0 = t * 3 + 0;
        i1 = t * 3 + 1;
        i2 = t * 3 + 2;
      }

      const v0x = vertices[i0 * 3 + 0], v0y = vertices[i0 * 3 + 1], v0z = vertices[i0 * 3 + 2];
      const v1x = vertices[i1 * 3 + 0], v1y = vertices[i1 * 3 + 1], v1z = vertices[i1 * 3 + 2];
      const v2x = vertices[i2 * 3 + 0], v2y = vertices[i2 * 3 + 1], v2z = vertices[i2 * 3 + 2];

      const ax = v1x - v0x, ay = v1y - v0y, az = v1z - v0z;
      const bx = v2x - v0x, by = v2y - v0y, bz = v2z - v0z;
      let nx = ay * bz - az * by;
      let ny = az * bx - ax * bz;
      let nz = ax * by - ay * bx;
      const len = Math.hypot(nx, ny, nz);
      if (len > 1e-7) {
        nx /= len; ny /= len; nz /= len;
      }

      view.setFloat32(offset, nx, true); offset += 4;
      view.setFloat32(offset, ny, true); offset += 4;
      view.setFloat32(offset, nz, true); offset += 4;

      view.setFloat32(offset, v0x, true); offset += 4;
      view.setFloat32(offset, v0y, true); offset += 4;
      view.setFloat32(offset, v0z, true); offset += 4;

      view.setFloat32(offset, v1x, true); offset += 4;
      view.setFloat32(offset, v1y, true); offset += 4;
      view.setFloat32(offset, v1z, true); offset += 4;

      view.setFloat32(offset, v2x, true); offset += 4;
      view.setFloat32(offset, v2y, true); offset += 4;
      view.setFloat32(offset, v2z, true); offset += 4;

      view.setUint16(offset, 0, true); offset += 2;
    }

    const blob = new Blob([buffer], { type: 'model/stl' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${meshData.name || 'medam_design'}_buildplate.stl`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#F8FAFC] dark:bg-[#090D16] overflow-hidden select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => onSelectModule?.('Rados')}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm hover:border-[#0284C7] hover:text-[#0284C7] transition-all"
          >
            <span className="text-slate-400">←</span>
            <span>Rados Workspace</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-md px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg">
          <ToolIconButton
            id="design-reset-cam"
            title="Reset View"
            onClick={handleResetCamera}
          >
            <IconResetView size={18} />
          </ToolIconButton>

          <button
            type="button"
            onClick={() => setIsWireframe((w) => !w)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-all ${
              isWireframe
                ? 'bg-[#0284C7] text-white border-[#0284C7]'
                : 'bg-slate-50 dark:bg-[#1E293B] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            Wireframe
          </button>

          {meshData && (
            <button
              type="button"
              onClick={handleExportStlDirect}
              className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold rounded-md bg-[#0284C7] text-white hover:bg-[#0369a1] transition-all shadow-sm"
            >
              <IconExportStl size={14} />
              <span>Export STL</span>
            </button>
          )}
        </div>
      </div>

      {/* Anatomical Model Metadata Card */}
      {meshData ? (
        <div className="absolute bottom-5 left-5 pointer-events-auto bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xl max-w-sm">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: meshData.maskColor || '#0284C7' }}
              />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {meshData.name}
              </span>
            </div>
            <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-800">
              Watertight Solid
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            <div>
              <span className="text-slate-600">Triangles:</span>{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {meshData.triangleCount.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-slate-600">Vertices:</span>{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {meshData.vertexCount.toLocaleString()}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-600">Physical Bounding Box:</span>{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {meshData.boundsMm.size[0].toFixed(1)} × {meshData.boundsMm.size[1].toFixed(1)} × {meshData.boundsMm.size[2].toFixed(1)} mm
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-600">Patient ID:</span>{' '}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {meshData.sourcePatientId}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl max-w-md text-center pointer-events-auto">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
              Design Studio Build Plate
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              Awaiting anatomical surface mesh from Rados. Use &quot;Send to Design&quot; in the Rados workspace to transfer segmented anatomy directly to the build envelope.
            </p>
            <button
              type="button"
              onClick={() => onSelectModule?.('Rados')}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0284C7] text-white hover:bg-[#0369a1] transition-all shadow-sm"
            >
              Open Rados Workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
