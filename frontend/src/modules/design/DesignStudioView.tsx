import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { ArrowLeft, Download, RotateCcw } from 'lucide-react';
import { MeshObjectItem, ModuleType } from '../../types';

interface DesignStudioViewProps {
  activeMesh: MeshObjectItem | null;
  onNavigateModule?: (m: ModuleType) => void;
}

export const DesignStudioView: React.FC<DesignStudioViewProps> = ({
  activeMesh,
  onNavigateModule,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);

  const isDraggingRef = useRef<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rotPitchRef = useRef<number>(0.35);
  const rotYawRef = useRef<number>(0.8);
  const panOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 20, 0));
  const zoomDistRef = useRef<number>(250);

  const updateCamera = () => {
    if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return;
    const cam = cameraRef.current;
    const dist = zoomDistRef.current;
    const pitch = rotPitchRef.current;
    const yaw = rotYawRef.current;

    const cx = dist * Math.cos(pitch) * Math.sin(yaw) + panOffsetRef.current.x;
    const cy = dist * Math.sin(pitch) + panOffsetRef.current.y;
    const cz = dist * Math.cos(pitch) * Math.cos(yaw) + panOffsetRef.current.z;

    cam.position.set(cx, cy, cz);
    cam.lookAt(panOffsetRef.current);
    rendererRef.current.render(sceneRef.current, cam);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090D16);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 5000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(150, 250, 150);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x0284c7, 0.4);
    dirLight2.position.set(-150, -100, -150);
    scene.add(dirLight2);

    // Build plate grid
    const gridHelper = new THREE.GridHelper(300, 30, 0x0284c7, 0x1e293b);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    const meshGroup = new THREE.Group();
    scene.add(meshGroup);
    meshGroupRef.current = meshGroup;

    updateCamera();

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth || 800;
      const h = containerRef.current.clientHeight || 600;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      updateCamera();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Update mesh geometry
  useEffect(() => {
    const meshGroup = meshGroupRef.current;
    if (!meshGroup || !activeMesh || !activeMesh.vertices) return;

    while (meshGroup.children.length > 0) {
      const c = meshGroup.children[0] as THREE.Mesh;
      c.geometry.dispose();
      meshGroup.remove(c);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(activeMesh.vertices, 3));
    if (activeMesh.normals && activeMesh.normals.length > 0) {
      geom.setAttribute('normal', new THREE.BufferAttribute(activeMesh.normals, 3));
    } else {
      geom.computeVertexNormals();
    }
    if (activeMesh.indices && activeMesh.indices.length > 0) {
      geom.setIndex(new THREE.BufferAttribute(activeMesh.indices, 1));
    }

    geom.center();
    geom.computeBoundingBox();
    if (geom.boundingBox) {
      // Sit on build plate
      const minY = geom.boundingBox.min.y;
      geom.translate(0, -minY, 0);
    }

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(activeMesh.color || '#0284C7'),
      roughness: 0.35,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geom, mat);
    meshGroup.add(mesh);
    updateCamera();
  }, [activeMesh]);

  // Native non-passive wheel listener
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.08 : 0.92;
      zoomDistRef.current = Math.max(20, Math.min(1500, zoomDistRef.current * factor));
      updateCamera();
    };

    el.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheelNative);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      isPanningRef.current = true;
      isDraggingRef.current = false;
    } else if (e.button === 2) {
      isDraggingRef.current = true;
      isPanningRef.current = false;
    }
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current && !isPanningRef.current) return;
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    if (isDraggingRef.current) {
      rotYawRef.current += dx * 0.008;
      rotPitchRef.current = Math.max(-1.45, Math.min(1.45, rotPitchRef.current - dy * 0.008));
      updateCamera();
    } else if (isPanningRef.current) {
      const factor = 0.2;
      panOffsetRef.current.x -= dx * factor;
      panOffsetRef.current.y += dy * factor;
      updateCamera();
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
  };

  const handleResetCamera = () => {
    rotPitchRef.current = 0.35;
    rotYawRef.current = 0.8;
    panOffsetRef.current.set(0, 20, 0);
    zoomDistRef.current = 250;
    updateCamera();
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-full h-full bg-[#090D16] overflow-hidden select-none"
    >
      <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => onNavigateModule?.('Rados')}
            className="tactile-rubber neu-btn px-3 py-1.5 rounded-xl text-xs font-bold text-white backdrop-blur-md flex items-center gap-1.5 cursor-pointer shadow-lg"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Rados</span>
          </button>

          <button
            type="button"
            onClick={handleResetCamera}
            className="tactile-rubber neu-btn p-2 rounded-xl text-white/80 hover:text-white backdrop-blur-md cursor-pointer shadow-lg"
            title="Reset CAD View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeMesh && (
          <div className="flex items-center gap-2 pointer-events-auto">
            <a
              href={`/api/objects/${activeMesh.object_id}/export-stl`}
              download
              className="tactile-rubber neu-primary px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xl flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export {activeMesh.name} STL</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
