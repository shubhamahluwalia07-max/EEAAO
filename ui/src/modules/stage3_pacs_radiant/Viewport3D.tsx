import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { MprVolume } from './mprEngine';
import { SegmentationMask, Calculated3DObject } from './types';
import { WatertightMesh, extractWatertightMesh } from './stlExporter';
import { createThresholdMask, mergeMasks } from './maskEngine';
import { ToolIconButton, IconMaximize, IconRestore } from './Icons';

interface Viewport3DProps {
  volume: MprVolume | null;
  is3DSurfaceBuilt: boolean;
  onBuild3DSurface: () => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  activeMask?: SegmentationMask | null;
  masks?: SegmentationMask[];
  objects?: Calculated3DObject[];
  overrideMesh?: WatertightMesh | null;
  onMeshExtracted?: (mesh: WatertightMesh) => void;
  isProcessing3D?: boolean;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  volume,
  is3DSurfaceBuilt,
  onBuild3DSurface,
  isMaximized,
  onToggleMaximize,
  activeMask,
  masks = [],
  objects = [],
  overrideMesh = null,
  onMeshExtracted,
  isProcessing3D = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Standardized CAD Mouse Controls State
  // Right-click drag: Orbit | Left-click drag: Pan | Wheel: Zoom
  const isOrbitingRef = useRef<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rotPitchRef = useRef<number>(0.25); // vertical elevation
  const rotYawRef = useRef<number>(0.75);   // horizontal azimuth
  const panOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const zoomFactorRef = useRef<number>(1.0);

  // Synchronized 3D orientation triad projection basis
  const [triadMatrix, setTriadMatrix] = useState<THREE.Matrix4>(new THREE.Matrix4());

  // Extracted 3D meshes stored per mask ID
  const [extractedMeshes, setExtractedMeshes] = useState<Map<string, WatertightMesh>>(new Map());
  const [isExtracting, setIsExtracting] = useState<boolean>(false);

  // Initialize Three.js scene
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    // Pure pitch-black background (#000000)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 5000);
    camera.position.set(0, 0, 450);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    rendererRef.current = renderer;

    const meshGroup = new THREE.Group();
    scene.add(meshGroup);
    meshGroupRef.current = meshGroup;

    // Multi-directional shadowless camera-linked lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
    keyLight.position.set(200, 300, 400);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.60);
    fillLight.position.set(-250, -100, 300);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.45);
    rimLight.position.set(0, 350, -300);
    scene.add(rimLight);

    // Efficient render on-demand
    let isRenderPending = false;
    const renderScene = () => {
      isRenderPending = false;
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

      if (meshGroupRef.current) {
        meshGroupRef.current.rotation.x = rotPitchRef.current;
        meshGroupRef.current.rotation.y = rotYawRef.current;

        const mat = new THREE.Matrix4();
        mat.makeRotationFromEuler(meshGroupRef.current.rotation);
        setTriadMatrix(mat);
      }

      if (cameraRef.current) {
        const baseDist = 450;
        const dist = baseDist / zoomFactorRef.current;
        const pan = panOffsetRef.current;
        cameraRef.current.position.set(pan.x, pan.y, pan.z + dist);
        cameraRef.current.lookAt(pan.x, pan.y, pan.z);
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };

    (window as unknown as { __renderViewport3D?: () => void }).__renderViewport3D = () => {
      if (!isRenderPending) {
        isRenderPending = true;
        animFrameRef.current = requestAnimationFrame(renderScene);
      }
    };

    renderScene();

    // Resize observer
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
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
      scene.clear();
    };
  }, []);

  // Extract watertight surface meshes whenever is3DSurfaceBuilt is true or triggered
  useEffect(() => {
    if (!is3DSurfaceBuilt || !volume) return;

    setIsExtracting(true);
    const timer = setTimeout(() => {
      try {
        const targetMasks = masks.filter((m) => m.visible);
        const listToProcess = targetMasks.length > 0 ? targetMasks : (activeMask ? [activeMask] : []);
        const newMeshMap = new Map<string, WatertightMesh>();

        for (const m of listToProcess) {
          let maskBuf = m.voxelMask;
          if (!maskBuf) {
            maskBuf = createThresholdMask(
              volume.voxels,
              volume.width,
              volume.height,
              volume.depth,
              m.minHu,
              m.maxHu
            );
          }

          const mesh = extractWatertightMesh(
            maskBuf,
            volume.width,
            volume.height,
            volume.depth,
            volume.spacing,
            0.5,
            10
          );

          if (mesh.triangleCount > 0) {
            newMeshMap.set(m.id, mesh);
          }
        }

        if (newMeshMap.size > 0 && onMeshExtracted) {
          const firstMesh = newMeshMap.values().next().value;
          if (firstMesh) onMeshExtracted(firstMesh);
        }

        setExtractedMeshes(newMeshMap);
      } catch (err) {
        console.error('Failed to extract watertight surface meshes:', err);
      } finally {
        setIsExtracting(false);
      }
    }, 20);

    return () => clearTimeout(timer);
  }, [is3DSurfaceBuilt, volume, masks, activeMask, onMeshExtracted]);

  // Handle external pipeline override mesh (from Smooth, Reduce, or Wrap)
  useEffect(() => {
    if (overrideMesh && overrideMesh.triangleCount > 0) {
      const newMap = new Map<string, WatertightMesh>();
      const key = activeMask?.id || 'active';
      newMap.set(key, overrideMesh);
      setExtractedMeshes(newMap);
    }
  }, [overrideMesh, activeMask]);

  // Update Three.js scene meshes when objects or extractedMeshes change
  useEffect(() => {
    const meshGroup = meshGroupRef.current;
    if (!meshGroup) return;

    // Clear existing meshes
    while (meshGroup.children.length > 0) {
      const child = meshGroup.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else (child.material as THREE.Material).dispose();
      }
      meshGroup.remove(child);
    }

    const volCenterX = volume ? (volume.width * volume.spacing[0]) / 2 : 0;
    const volCenterY = volume ? (volume.height * volume.spacing[1]) / 2 : 0;
    const volCenterZ = volume ? (volume.depth * volume.spacing[2]) / 2 : 0;

    // Prioritize calculated 3D objects from Objects tab
    const visibleObjects = objects.filter((obj) => obj.visible);
    if (visibleObjects.length > 0) {
      visibleObjects.forEach((obj) => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(obj.uniquePositions, 3)
        );
        geometry.setAttribute(
          'normal',
          new THREE.BufferAttribute(obj.uniqueNormals, 3)
        );
        geometry.setIndex(new THREE.BufferAttribute(obj.indices, 1));
        geometry.translate(-volCenterX, -volCenterY, -volCenterZ);

        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(obj.color || '#0284C7'),
          roughness: 0.35,
          metalness: 0.15,
          transparent: obj.opacity < 1.0,
          opacity: obj.opacity,
          side: THREE.DoubleSide,
        });

        const threeMesh = new THREE.Mesh(geometry, material);
        meshGroup.add(threeMesh);
      });
      (window as unknown as { __renderViewport3D?: () => void }).__renderViewport3D?.();
      return;
    }

    if (extractedMeshes.size === 0) {
      (window as unknown as { __renderViewport3D?: () => void }).__renderViewport3D?.();
      return;
    }

    extractedMeshes.forEach((mesh, maskId) => {
      const maskMeta = masks.find((m) => m.id === maskId) || activeMask;
      const maskColor = maskMeta?.color || '#06B6D4';

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(mesh.uniquePositions, 3)
      );
      geometry.setAttribute(
        'normal',
        new THREE.BufferAttribute(mesh.uniqueNormals, 3)
      );
      geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
      
      // Translate all meshes relative to unified volume origin
      geometry.translate(-volCenterX, -volCenterY, -volCenterZ);

      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(maskColor),
        roughness: 0.35,
        metalness: 0.15,
        transparent: (maskMeta?.opacity ?? 1) < 1.0,
        opacity: maskMeta?.opacity ?? 1,
        side: THREE.DoubleSide,
      });

      const threeMesh = new THREE.Mesh(geometry, material);
      meshGroup.add(threeMesh);
    });

    (window as unknown as { __renderViewport3D?: () => void }).__renderViewport3D?.();
  }, [objects, extractedMeshes, masks, activeMask, volume]);

  // Standard CAD mouse interactions:
  // Right-click drag: Rotate/Orbit | Left-click drag: Pan window | Wheel: Zoom
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      isPanningRef.current = true;
      isOrbitingRef.current = false;
    } else if (e.button === 2) {
      isOrbitingRef.current = true;
      isPanningRef.current = false;
    }
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isOrbitingRef.current && !isPanningRef.current) return;
    const deltaX = e.clientX - prevMouseRef.current.x;
    const deltaY = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    if (isOrbitingRef.current) {
      // Natural 1:1 non-inverted turntable orbit
      rotYawRef.current += deltaX * 0.008;
      rotPitchRef.current = Math.max(-1.45, Math.min(1.45, rotPitchRef.current - deltaY * 0.008));
      (window as unknown as { __renderViewport3D?: () => void }).__renderViewport3D?.();
    } else if (isPanningRef.current) {
      // Pan camera horizontally and vertically
      const factor = (450 / Math.max(0.1, zoomFactorRef.current)) * 0.0022;
      panOffsetRef.current.x -= deltaX * factor;
      panOffsetRef.current.y += deltaY * factor;
      (window as unknown as { __renderViewport3D?: () => void }).__renderViewport3D?.();
    }
  };

  const handleMouseUp = () => {
    isOrbitingRef.current = false;
    isPanningRef.current = false;
  };

  // Zoom interaction
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    zoomFactorRef.current = Math.max(0.2, Math.min(6.0, zoomFactorRef.current * factor));
    (window as unknown as { __renderViewport3D?: () => void }).__renderViewport3D?.();
  };

  // Rotating X-Y-Z orientation axis triad projection at bottom-center
  // X: [1, 0, 0] (Red #EF4444)
  // Y: [0, 1, 0] (Yellow #EAB308)
  // Z: [0, 0, 1] (Blue #0EA5E9)
  const projectTriadVector = (x: number, y: number, z: number) => {
    const v = new THREE.Vector3(x, y, z);
    v.applyMatrix4(triadMatrix);
    const len = 34;
    return {
      x: 48 + v.x * len,
      y: 48 - v.y * len, // Invert Y for screen SVG coordinates
    };
  };

  const ptX = projectTriadVector(1, 0, 0);
  const ptY = projectTriadVector(0, 1, 0);
  const ptZ = projectTriadVector(0, 0, 1);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
      onDoubleClick={onToggleMaximize}
      className="relative w-full h-full bg-[#000000] overflow-hidden select-none border border-slate-800 flex flex-col items-center justify-center font-sans"
    >
      {/* Three.js Canvas */}
      <canvas
        ref={canvasRef}
        onContextMenu={(e) => e.preventDefault()}
        className="absolute inset-0 w-full h-full block cursor-grab active:cursor-grabbing"
      />

      {/* When no surface is built yet or loading */}
      {!is3DSurfaceBuilt && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-black/40 pointer-events-auto">
          <button
            type="button"
            onClick={onBuild3DSurface}
            className="tactile-rubber px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 shadow-lg border border-sky-600 transition-all cursor-pointer"
          >
            Build 3D from mask
          </button>
        </div>
      )}

      {(isExtracting || isProcessing3D) && (
        <div className="absolute top-3 left-3 z-30 pointer-events-none flex items-center justify-center">
          <span className="w-5 h-5 rounded-full border-2 border-[#0284C7] border-t-transparent animate-spin" />
        </div>
      )}

      {/* Rotating 3D Coordinate Axis Triad at bottom-center of Quadrant 4 */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none">
        <svg width="96" height="96" viewBox="0 0 96 96" className="overflow-visible">
          {/* Axis X: Red */}
          <line x1="48" y1="48" x2={ptX.x} y2={ptX.y} stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
          <circle cx={ptX.x} cy={ptX.y} r="3" fill="#EF4444" />
          <text x={ptX.x + 4} y={ptX.y + 4} fill="#EF4444" fontSize="10" fontWeight="bold" fontFamily="Inter, sans-serif">
            X
          </text>

          {/* Axis Y: Yellow */}
          <line x1="48" y1="48" x2={ptY.x} y2={ptY.y} stroke="#EAB308" strokeWidth="2" strokeLinecap="round" />
          <circle cx={ptY.x} cy={ptY.y} r="3" fill="#EAB308" />
          <text x={ptY.x + 4} y={ptY.y + 4} fill="#CA8A04" fontSize="10" fontWeight="bold" fontFamily="Inter, sans-serif">
            Y
          </text>

          {/* Axis Z: Blue */}
          <line x1="48" y1="48" x2={ptZ.x} y2={ptZ.y} stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" />
          <circle cx={ptZ.x} cy={ptZ.y} r="3" fill="#0EA5E9" />
          <text x={ptZ.x + 4} y={ptZ.y + 4} fill="#0EA5E9" fontSize="10" fontWeight="bold" fontFamily="Inter, sans-serif">
            Z
          </text>

          {/* Origin center dot */}
          <circle cx="48" cy="48" r="2.5" fill="#64748B" />
        </svg>
      </div>

      {/* Top-Right Corner: Maximize/Restore Toggle */}
      <div className="absolute top-2 right-2 z-30">
        <ToolIconButton
          id="viewport3d-maximize-btn"
          title={isMaximized ? 'Restore Viewport' : 'Maximize 3D Surface View'}
          shortcut="4"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMaximize();
          }}
          tooltipSide="left"
          className="w-7 h-7 rounded-md bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 shadow-sm"
        >
          {isMaximized ? <IconRestore size={15} /> : <IconMaximize size={15} />}
        </ToolIconButton>
      </div>
    </div>
  );
};
