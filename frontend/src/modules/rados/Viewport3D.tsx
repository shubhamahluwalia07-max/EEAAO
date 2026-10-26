import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Maximize2, Minimize2 } from 'lucide-react';
import { MeshObjectItem } from '../../types';

interface Viewport3DProps {
  objects: MeshObjectItem[];
  isCalculating: boolean;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onBuild3DClick?: () => void;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  objects,
  isCalculating,
  isMaximized,
  onToggleMaximize,
  onBuild3DClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);

  // CAD Camera state
  const isOrbitingRef = useRef<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rotPitchRef = useRef<number>(0.3);
  const rotYawRef = useRef<number>(0.8);
  const panOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const zoomFactorRef = useRef<number>(1.0);

  // Orientation triad matrix
  const [triadMatrix, setTriadMatrix] = useState<THREE.Matrix4>(new THREE.Matrix4());

  // Initialize Three.js scene
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Pure pitch black
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 10000);
    camera.position.set(0, 0, 480);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    // Surgical illumination lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight1.position.set(200, 300, 400);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x90caff, 0.45);
    dirLight2.position.set(-200, -200, -200);
    scene.add(dirLight2);

    const meshGroup = new THREE.Group();
    scene.add(meshGroup);
    meshGroupRef.current = meshGroup;

    const render = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

      const cam = cameraRef.current;
      const dist = 480 / Math.max(0.1, zoomFactorRef.current);
      const pitch = rotPitchRef.current;
      const yaw = rotYawRef.current;

      const cx = dist * Math.cos(pitch) * Math.sin(yaw) + panOffsetRef.current.x;
      const cy = dist * Math.sin(pitch) + panOffsetRef.current.y;
      const cz = dist * Math.cos(pitch) * Math.cos(yaw) + panOffsetRef.current.z;

      cam.position.set(cx, cy, cz);
      cam.lookAt(panOffsetRef.current);

      // Dynamic clipping planes to prevent long bones from clipping
      cam.near = Math.max(0.5, dist * 0.05);
      cam.far = Math.max(2000, dist * 8);
      cam.updateProjectionMatrix();

      // Compute triad matrix
      const m = new THREE.Matrix4();
      m.lookAt(cam.position, panOffsetRef.current, cam.up);
      setTriadMatrix(m);

      rendererRef.current.render(sceneRef.current, cam);
    };

    (window as any).__renderViewport3D = render;
    render();

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth || 400;
      const h = containerRef.current.clientHeight || 400;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      render();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Update meshes when objects change
  useEffect(() => {
    const meshGroup = meshGroupRef.current;
    if (!meshGroup) return;

    // Clear old meshes
    while (meshGroup.children.length > 0) {
      const child = meshGroup.children[0] as THREE.Mesh;
      child.geometry.dispose();
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material.dispose();
      meshGroup.remove(child);
    }

    objects.forEach((obj) => {
      if (!obj.visible || !obj.vertices || obj.vertices.length === 0) return;

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(obj.vertices, 3));
      if (obj.normals && obj.normals.length > 0) {
        geom.setAttribute('normal', new THREE.BufferAttribute(obj.normals, 3));
      } else {
        geom.computeVertexNormals();
      }
      if (obj.indices && obj.indices.length > 0) {
        geom.setIndex(new THREE.BufferAttribute(obj.indices, 1));
      }

      geom.computeBoundingSphere();
      const center = geom.boundingSphere ? geom.boundingSphere.center : new THREE.Vector3();
      // Center mesh around origin
      geom.center();

      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(obj.color),
        roughness: 0.35,
        metalness: 0.15,
        transparent: obj.opacity < 1.0,
        opacity: obj.opacity,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geom, mat);
      meshGroup.add(mesh);
    });

    (window as any).__renderViewport3D?.();
  }, [objects]);

  // Native non-passive wheel listener to eliminate passive violation errors
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      zoomFactorRef.current = Math.max(0.1, Math.min(8.0, zoomFactorRef.current * factor));
      (window as any).__renderViewport3D?.();
    };

    el.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheelNative);
    };
  }, []);

  // Standard CAD mouse interactions
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
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    if (isOrbitingRef.current) {
      // Natural 1:1 non-inverted turntable orbit
      rotYawRef.current += dx * 0.008;
      rotPitchRef.current = Math.max(-1.45, Math.min(1.45, rotPitchRef.current - dy * 0.008));
      (window as any).__renderViewport3D?.();
    } else if (isPanningRef.current) {
      const factor = (480 / Math.max(0.1, zoomFactorRef.current)) * 0.0022;
      panOffsetRef.current.x -= dx * factor;
      panOffsetRef.current.y += dy * factor;
      (window as any).__renderViewport3D?.();
    }
  };

  const handleMouseUp = () => {
    isOrbitingRef.current = false;
    isPanningRef.current = false;
  };

  // Rotating X-Y-Z orientation axis triad projection at bottom-center
  const projectTriad = (x: number, y: number, z: number) => {
    const v = new THREE.Vector3(x, y, z);
    v.applyMatrix4(triadMatrix);
    const len = 34;
    return { x: 44 + v.x * len, y: 44 - v.y * len };
  };

  const ptX = projectTriad(1, 0, 0);
  const ptY = projectTriad(0, 1, 0);
  const ptZ = projectTriad(0, 0, 1);

  const hasVisibleObjects = objects.some((o) => o.visible);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-full h-full bg-[#000000] overflow-hidden select-none border border-slate-800 flex items-center justify-center font-sans"
    >
      {/* Three.js Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

      {/* Top Left Title Badge */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-2 pointer-events-none">
        <span className="font-bold text-xs tracking-wide uppercase text-slate-300 bg-black/60 px-2 py-0.5 rounded border border-white/10">
          3D Objects View
        </span>
      </div>

      {/* Rotating Blue Circular Spinner when Calculating (ZERO text beside it) */}
      {isCalculating && (
        <div className="absolute top-3 left-32 z-30 pointer-events-none flex items-center justify-center">
          <span className="w-5 h-5 rounded-full border-2 border-[#0284C7] border-t-transparent animate-spin" />
        </div>
      )}

      {/* Top Right Maximize Toggle */}
      <button
        type="button"
        onClick={onToggleMaximize}
        className="absolute top-2 right-2 z-20 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white/80 hover:text-white border border-white/10 tactile-rubber cursor-pointer"
        title={isMaximized ? 'Restore Quadrant' : 'Maximize Quadrant'}
      >
        {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
      </button>

      {/* Center Prompt when no 3D objects are calculated */}
      {!hasVisibleObjects && !isCalculating && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 pointer-events-none">
          <button
            type="button"
            onClick={onBuild3DClick}
            className="pointer-events-auto tactile-rubber px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#0284C7] hover:bg-sky-700 shadow-xl shadow-sky-600/30 border border-sky-500 cursor-pointer"
          >
            Calculate 3D Object
          </button>
        </div>
      )}

      {/* Rotating 3D Orientation Triad at Bottom-Center */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <svg width="88" height="88" className="overflow-visible">
          {/* X Axis: Red */}
          <line x1="44" y1="44" x2={ptX.x} y2={ptX.y} stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
          <text x={ptX.x} y={ptX.y - 3} fill="#EF4444" fontSize="10" fontWeight="bold" textAnchor="middle">
            X
          </text>

          {/* Y Axis: Yellow */}
          <line x1="44" y1="44" x2={ptY.x} y2={ptY.y} stroke="#EAB308" strokeWidth="2.5" strokeLinecap="round" />
          <text x={ptY.x} y={ptY.y - 3} fill="#EAB308" fontSize="10" fontWeight="bold" textAnchor="middle">
            Y
          </text>

          {/* Z Axis: Blue */}
          <line x1="44" y1="44" x2={ptZ.x} y2={ptZ.y} stroke="#0EA5E9" strokeWidth="2.5" strokeLinecap="round" />
          <text x={ptZ.x} y={ptZ.y - 3} fill="#0EA5E9" fontSize="10" fontWeight="bold" textAnchor="middle">
            Z
          </text>
        </svg>
      </div>
    </div>
  );
};
