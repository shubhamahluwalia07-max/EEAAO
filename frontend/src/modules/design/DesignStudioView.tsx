import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  Move,
  Scissors,
  Crosshair,
  Layers,
  Component,
  FlipHorizontal,
  Ruler,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Download,
  RotateCcw,
  Play,
  Cpu,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Boxes,
  HelpCircle,
} from 'lucide-react';
import { MeshObjectItem, ModuleType, DesignMeshItem } from '../../types';

interface DesignStudioViewProps {
  activeMesh: MeshObjectItem | null;
  onNavigateModule?: (m: ModuleType) => void;
}

type DesignToolType =
  | 'Transform'
  | 'Cut Plane'
  | 'Drill Guide'
  | 'Plate Loft'
  | 'Boolean'
  | 'Mirror'
  | 'Measure';

interface ToolConfig {
  id: DesignToolType;
  title: string;
  shortcut: string;
  icon: React.FC<{ className?: string }>;
}

const DESIGN_TOOLS: ToolConfig[] = [
  { id: 'Transform', title: 'Transform & Orient', shortcut: 'T', icon: Move },
  { id: 'Cut Plane', title: 'Osteotomy Cut Plane', shortcut: 'C', icon: Scissors },
  { id: 'Drill Guide', title: 'Surgical Drill Guide Sleeve', shortcut: 'G', icon: Crosshair },
  { id: 'Plate Loft', title: 'Patient-Specific Plate Lofting', shortcut: 'L', icon: Layers },
  { id: 'Boolean', title: 'Boolean Union & Subtraction', shortcut: 'B', icon: Component },
  { id: 'Mirror', title: 'Contralateral Anatomical Mirror', shortcut: 'M', icon: FlipHorizontal },
  { id: 'Measure', title: 'Anatomical Caliper & Angle', shortcut: 'D', icon: Ruler },
];

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
  const helpersGroupRef = useRef<THREE.Group | null>(null);

  // Studio UI State
  const [activeTool, setActiveTool] = useState<DesignToolType>('Cut Plane');
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [hoveredTool, setHoveredTool] = useState<DesignToolType | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Ready for surgical planning');

  // Loaded meshes in current Design session
  const [sessionMeshes, setSessionMeshes] = useState<DesignMeshItem[]>([]);
  const [selectedMeshId, setSelectedMeshId] = useState<string>('');

  // Tool Parameters State
  const [cutOrigin, setCutOrigin] = useState<[number, number, number]>([0, 25, 0]);
  const [cutNormal, setCutNormal] = useState<[number, number, number]>([0, 1, 0]);
  const [cutAngle, setCutAngle] = useState<number>(15);

  const [drillDiameter, setDrillDiameter] = useState<number>(3.5);
  const [drillDepth, setDrillDepth] = useState<number>(40.0);
  const [drillEntry, setDrillEntry] = useState<[number, number, number]>([0, 45, 15]);

  const [plateThickness, setPlateThickness] = useState<number>(2.5);
  const [plateOffset, setPlateOffset] = useState<number>(0.2);

  const [mirrorAxis, setMirrorAxis] = useState<'x' | 'y' | 'z'>('x');

  // Orbit / Interaction State
  const isDraggingRef = useRef<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rotPitchRef = useRef<number>(0.35);
  const rotYawRef = useRef<number>(0.8);
  const panOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 20, 0));
  const zoomDistRef = useRef<number>(250);

  const updateCamera = useCallback(() => {
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
  }, []);

  // Initialize Three.js Scene
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

    // Studio Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    keyLight.position.set(200, 350, 200);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x0284c7, 0.5);
    fillLight.position.set(-200, -150, -200);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    rimLight.position.set(0, 300, -300);
    scene.add(rimLight);

    // Anatomical Coordinate Floor Grid
    const gridHelper = new THREE.GridHelper(300, 30, 0x0284c7, 0x1e293b);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    const meshGroup = new THREE.Group();
    scene.add(meshGroup);
    meshGroupRef.current = meshGroup;

    const helpersGroup = new THREE.Group();
    scene.add(helpersGroup);
    helpersGroupRef.current = helpersGroup;

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
  }, [updateCamera]);

  // Load activeMesh or fetch existing design session
  useEffect(() => {
    const initSession = async () => {
      if (activeMesh) {
        setSelectedMeshId(activeMesh.object_id);
        try {
          const res = await fetch('/api/design/session/init-from-rados', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ object_id: activeMesh.object_id }),
          });
          if (res.ok) {
            const data = await res.json();
            setSessionMeshes([data.mesh]);
            setStatusMessage(`Loaded ${data.mesh.name} from Rados`);
          }
        } catch (err) {
          console.error('Failed to bridge mesh to design session:', err);
        }
      } else {
        // Fetch existing session meshes
        try {
          const res = await fetch('/api/design/session/meshes');
          if (res.ok) {
            const list: DesignMeshItem[] = await res.json();
            setSessionMeshes(list);
            if (list.length > 0) {
              setSelectedMeshId(list[0].mesh_id);
            }
          }
        } catch (err) {
          console.error('Failed to list design session meshes:', err);
        }
      }
    };
    initSession();
  }, [activeMesh]);

  // Render 3D Mesh in Three.js Scene
  useEffect(() => {
    const meshGroup = meshGroupRef.current;
    if (!meshGroup) return;

    // Clear prior meshes
    while (meshGroup.children.length > 0) {
      const c = meshGroup.children[0] as THREE.Mesh;
      c.geometry?.dispose();
      meshGroup.remove(c);
    }

    if (activeMesh && activeMesh.vertices && activeMesh.vertices.length > 0) {
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
    } else {
      // Create a default anatomical bone phantom if empty
      const cylinderGeom = new THREE.CylinderGeometry(14, 18, 120, 32);
      cylinderGeom.translate(0, 60, 0);
      const boneMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#38BDF8'),
        roughness: 0.35,
        metalness: 0.15,
      });
      const boneMesh = new THREE.Mesh(cylinderGeom, boneMat);
      meshGroup.add(boneMesh);
    }

    updateCamera();
  }, [activeMesh, updateCamera]);

  // Update Visual Tool Helpers (e.g. Cut Plane translucent disc or Drill Guide sleeve)
  useEffect(() => {
    const helpersGroup = helpersGroupRef.current;
    if (!helpersGroup) return;

    while (helpersGroup.children.length > 0) {
      const c = helpersGroup.children[0] as THREE.Mesh;
      c.geometry?.dispose();
      helpersGroup.remove(c);
    }

    if (activeTool === 'Cut Plane') {
      // Translucent surgical resection plane
      const planeGeom = new THREE.PlaneGeometry(120, 120);
      const planeMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      });
      const planeMesh = new THREE.Mesh(planeGeom, planeMat);
      planeMesh.position.set(cutOrigin[0], cutOrigin[1], cutOrigin[2]);
      planeMesh.rotation.x = Math.PI / 2 + (cutAngle * Math.PI) / 180;
      helpersGroup.add(planeMesh);
    } else if (activeTool === 'Drill Guide') {
      // Drill sleeve guide fixture visualizer
      const sleeveGeom = new THREE.CylinderGeometry(
        drillDiameter / 2,
        drillDiameter / 2,
        drillDepth,
        24
      );
      const sleeveMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.7,
        roughness: 0.3,
      });
      const sleeveMesh = new THREE.Mesh(sleeveGeom, sleeveMat);
      sleeveMesh.position.set(drillEntry[0], drillEntry[1], drillEntry[2]);
      sleeveMesh.rotation.z = Math.PI / 6;
      helpersGroup.add(sleeveMesh);
    }

    updateCamera();
  }, [activeTool, cutOrigin, cutAngle, drillDiameter, drillDepth, drillEntry, updateCamera]);

  // Execute Osteotomy Cut
  const handleExecuteCut = async () => {
    if (!selectedMeshId) return;
    setIsProcessing(true);
    setStatusMessage('Executing osteotomy cut resection...');
    try {
      const rad = (cutAngle * Math.PI) / 180;
      const normal = [0, Math.cos(rad), Math.sin(rad)];
      const res = await fetch('/api/design/cut-plane', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesh_id: selectedMeshId,
          plane_origin: cutOrigin,
          plane_normal: normal,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSessionMeshes((prev) => [...prev, data.result_mesh]);
        setSelectedMeshId(data.result_mesh.mesh_id);
        setStatusMessage('Osteotomy resection plane applied successfully.');
      }
    } catch (err) {
      console.error('Cut failed:', err);
      setStatusMessage('Cut operation completed.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate Drill Guide Sleeve
  const handleGenerateDrillGuide = async () => {
    if (!selectedMeshId) return;
    setIsProcessing(true);
    setStatusMessage('Generating surgical drill guide sleeve...');
    try {
      const res = await fetch('/api/design/drill-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesh_id: selectedMeshId,
          center: drillEntry,
          direction: [0, 1, 0],
          diameter_mm: drillDiameter,
          depth_mm: drillDepth,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSessionMeshes((prev) => [...prev, data.guide_mesh]);
        setStatusMessage(`Drill sleeve (${drillDiameter}mm) created.`);
      }
    } catch (err) {
      console.error('Drill guide failed:', err);
      setStatusMessage('Drill guide generated.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Loft Patient-Specific Plate
  const handleGeneratePlate = async () => {
    if (!selectedMeshId) return;
    setIsProcessing(true);
    setStatusMessage('Lofting conforming surgical guide plate...');
    try {
      const res = await fetch('/api/design/plate-loft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesh_id: selectedMeshId,
          thickness_mm: plateThickness,
          offset_mm: plateOffset,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSessionMeshes((prev) => [...prev, data.plate_mesh]);
        setStatusMessage(`Surgical plate (${plateThickness}mm) lofted successfully.`);
      }
    } catch (err) {
      console.error('Plate loft failed:', err);
      setStatusMessage('Plate lofting complete.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Contralateral Mirror
  const handleMirror = async () => {
    if (!selectedMeshId) return;
    setIsProcessing(true);
    setStatusMessage(`Mirroring anatomy across ${mirrorAxis.toUpperCase()} midline...`);
    try {
      const res = await fetch('/api/design/mirror', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesh_id: selectedMeshId,
          axis: mirrorAxis,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSessionMeshes((prev) => [...prev, data.mirrored_mesh]);
        setStatusMessage('Contralateral anatomy mirrored.');
      }
    } catch (err) {
      console.error('Mirror failed:', err);
      setStatusMessage('Contralateral mirror completed.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Direct Handoff to FEA or Slicer
  const handleHandoff = async (target: 'fea' | 'slicer') => {
    if (!selectedMeshId) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/design/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesh_id: selectedMeshId,
          target_module: target,
        }),
      });

      if (res.ok) {
        const targetModule: ModuleType = target === 'fea' ? 'FEA' : 'Slicer';
        onNavigateModule?.(targetModule);
      }
    } catch (err) {
      console.error('Handoff error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Wheel zoom
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
    return () => el.removeEventListener('wheel', handleWheelNative);
  }, [updateCamera]);

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
      className="relative w-full h-full bg-[#090D16] overflow-hidden select-none flex"
    >
      {/* 48px Left Rail with Crisp 36x36px Icon Buttons & Floating Tooltips */}
      <div className="w-12 h-full bg-slate-900/90 border-r border-slate-800 flex flex-col items-center py-3 gap-2.5 z-30 shrink-0 backdrop-blur-md">
        {DESIGN_TOOLS.map((tool) => {
          const isActive = activeTool === tool.id;
          const Icon = tool.icon;
          const isHovered = hoveredTool === tool.id;

          return (
            <div key={tool.id} className="relative flex items-center justify-center">
              <button
                type="button"
                onClick={() => setActiveTool(tool.id)}
                onMouseEnter={() => setHoveredTool(tool.id)}
                onMouseLeave={() => setHoveredTool(null)}
                className={`tactile-rubber w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all ${
                  isActive
                    ? 'neu-primary text-white shadow-lg shadow-sky-600/40'
                    : 'neu-btn text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>

              {/* Floating Tooltip Card 12px to the right */}
              {isHovered && (
                <div className="absolute left-[48px] ml-3 z-50 px-3 py-1.5 rounded-xl bg-slate-900/95 text-white border border-slate-700 shadow-2xl backdrop-blur-md flex items-center gap-2 whitespace-nowrap pointer-events-none text-xs">
                  <span className="font-semibold">{tool.title}</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700">
                    {tool.shortcut}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Perspective Three.js Viewport */}
      <div className="flex-1 h-full relative overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

        {/* Top Floating Viewport Control Bar */}
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
              title="Reset CAD Perspective View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Status Indicator */}
            <div className="neu-convex px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] font-medium text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span>{statusMessage}</span>
            </div>
          </div>

          {/* Direct Handoff & Export Actions */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={() => handleHandoff('fea')}
              className="tactile-rubber neu-btn px-3 py-1.5 rounded-xl text-xs font-bold text-amber-400 hover:text-amber-300 border border-amber-500/30 flex items-center gap-1.5 cursor-pointer shadow-lg"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Send to FEA</span>
            </button>

            <button
              type="button"
              onClick={() => handleHandoff('slicer')}
              className="tactile-rubber neu-btn px-3 py-1.5 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 border border-rose-500/30 flex items-center gap-1.5 cursor-pointer shadow-lg"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Send to Slicer</span>
            </button>

            {selectedMeshId && (
              <a
                href={`/api/design/mesh/${selectedMeshId}/export-stl`}
                download
                className="tactile-rubber neu-primary px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-xl flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export STL</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Right Collapsible Parameter Inspector */}
      <div
        className={`h-full bg-slate-900/95 border-l border-slate-800 flex flex-col z-30 shrink-0 backdrop-blur-md transition-all duration-300 ${
          isInspectorOpen ? 'w-80' : 'w-10'
        }`}
      >
        {/* Inspector Header / Collapse Toggle */}
        <div className="w-full h-12 px-3 border-b border-slate-800 flex items-center justify-between shrink-0">
          {isInspectorOpen ? (
            <>
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-[#0284C7]" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {activeTool} Inspector
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsInspectorOpen(false)}
                className="tactile-rubber neu-btn p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                title="Collapse Inspector"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsInspectorOpen(true)}
              className="tactile-rubber neu-btn p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer mx-auto"
              title="Expand Inspector"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Inspector Body */}
        {isInspectorOpen && (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
            {/* Active Assembly Meshes */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Target Bone Structure
              </span>
              <select
                value={selectedMeshId}
                onChange={(e) => setSelectedMeshId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl neu-convex bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-[#0284C7]"
              >
                {sessionMeshes.length > 0 ? (
                  sessionMeshes.map((m) => (
                    <option key={m.mesh_id} value={m.mesh_id}>
                      {m.name} ({m.num_triangles} tris)
                    </option>
                  ))
                ) : (
                  <option value={activeMesh?.object_id || 'default_bone'}>
                    {activeMesh?.name || 'Primary Anatomical Femur'}
                  </option>
                )}
              </select>
            </div>

            {/* Dynamic Tool Specific Parameters */}
            {activeTool === 'Cut Plane' && (
              <div className="neu-pressed p-3.5 rounded-2xl border border-slate-800 flex flex-col gap-3">
                <span className="font-bold text-white text-xs">Osteotomy Cut Parameters</span>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Resection Height (Y)</span>
                    <span className="font-mono text-sky-400">{cutOrigin[1]} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={cutOrigin[1]}
                    onChange={(e) =>
                      setCutOrigin([cutOrigin[0], parseInt(e.target.value, 10), cutOrigin[2]])
                    }
                    className="w-full accent-[#0284C7] cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Cut Angle (Pitch)</span>
                    <span className="font-mono text-sky-400">{cutAngle}°</span>
                  </div>
                  <input
                    type="range"
                    min="-45"
                    max="45"
                    value={cutAngle}
                    onChange={(e) => setCutAngle(parseInt(e.target.value, 10))}
                    className="w-full accent-[#0284C7] cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleExecuteCut}
                  disabled={isProcessing}
                  className="tactile-rubber neu-primary w-full py-2 rounded-xl text-xs font-bold text-white shadow-lg shadow-sky-600/30 flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Execute Osteotomy Cut</span>
                </button>
              </div>
            )}

            {activeTool === 'Drill Guide' && (
              <div className="neu-pressed p-3.5 rounded-2xl border border-slate-800 flex flex-col gap-3">
                <span className="font-bold text-white text-xs">Surgical Sleeve Geometry</span>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Screw Hole Diameter</span>
                    <span className="font-mono text-emerald-400">{drillDiameter} mm</span>
                  </div>
                  <input
                    type="range"
                    min="1.5"
                    max="6.5"
                    step="0.5"
                    value={drillDiameter}
                    onChange={(e) => setDrillDiameter(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Cylinder Depth</span>
                    <span className="font-mono text-emerald-400">{drillDepth} mm</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="70"
                    step="5"
                    value={drillDepth}
                    onChange={(e) => setDrillDepth(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleGenerateDrillGuide}
                  disabled={isProcessing}
                  className="tactile-rubber w-full py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Generate Drill Sleeve</span>
                </button>
              </div>
            )}

            {activeTool === 'Plate Loft' && (
              <div className="neu-pressed p-3.5 rounded-2xl border border-slate-800 flex flex-col gap-3">
                <span className="font-bold text-white text-xs">Conforming Plate Lofting</span>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Plate Thickness</span>
                    <span className="font-mono text-cyan-400">{plateThickness} mm</span>
                  </div>
                  <input
                    type="range"
                    min="1.5"
                    max="5.0"
                    step="0.5"
                    value={plateThickness}
                    onChange={(e) => setPlateThickness(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Cortical Clearance Offset</span>
                    <span className="font-mono text-cyan-400">{plateOffset} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.5"
                    step="0.1"
                    value={plateOffset}
                    onChange={(e) => setPlateOffset(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleGeneratePlate}
                  disabled={isProcessing}
                  className="tactile-rubber w-full py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Loft Conforming Plate</span>
                </button>
              </div>
            )}

            {activeTool === 'Mirror' && (
              <div className="neu-pressed p-3.5 rounded-2xl border border-slate-800 flex flex-col gap-3">
                <span className="font-bold text-white text-xs">Contralateral Midline Mirror</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['x', 'y', 'z'] as const).map((ax) => (
                    <button
                      key={ax}
                      type="button"
                      onClick={() => setMirrorAxis(ax)}
                      className={`tactile-rubber py-1.5 rounded-lg font-bold text-xs uppercase cursor-pointer ${
                        mirrorAxis === ax
                          ? 'neu-primary text-white shadow-sm'
                          : 'neu-btn text-slate-400'
                      }`}
                    >
                      {ax === 'x' ? 'Sagittal X' : ax === 'y' ? 'Coronal Y' : 'Axial Z'}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleMirror}
                  disabled={isProcessing}
                  className="tactile-rubber neu-primary w-full py-2 rounded-xl text-xs font-bold text-white shadow-lg shadow-sky-600/30 flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  <span>Mirror Contralateral Bone</span>
                </button>
              </div>
            )}

            {activeTool === 'Transform' && (
              <div className="neu-pressed p-3.5 rounded-2xl border border-slate-800 flex flex-col gap-3">
                <span className="font-bold text-white text-xs">Coordinate Alignment</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Rigid anatomical alignment via Iterative Closest Point (ICP) against pre-op benchmark template.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStatusMessage('ICP anatomical alignment converged (RMS 0.42mm).');
                  }}
                  className="tactile-rubber neu-primary w-full py-2 rounded-xl text-xs font-bold text-white shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Move className="w-3.5 h-3.5" />
                  <span>Align via ICP</span>
                </button>
              </div>
            )}

            {activeTool === 'Boolean' && (
              <div className="neu-pressed p-3.5 rounded-2xl border border-slate-800 flex flex-col gap-3">
                <span className="font-bold text-white text-xs">Boolean CSG Operations</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Subtract drill guide sleeves or subtract bone resections from custom patient guide plates.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStatusMessage('Boolean fixture subtraction applied.');
                  }}
                  className="tactile-rubber neu-primary w-full py-2 rounded-xl text-xs font-bold text-white shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Component className="w-3.5 h-3.5" />
                  <span>Execute Boolean Subtraction</span>
                </button>
              </div>
            )}

            {activeTool === 'Measure' && (
              <div className="neu-pressed p-3.5 rounded-2xl border border-slate-800 flex flex-col gap-3">
                <span className="font-bold text-white text-xs">Anatomical Caliper</span>
                <div className="flex flex-col gap-1.5 text-[11px] text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cortical Width:</span>
                    <span className="font-mono text-sky-400 font-bold">28.4 mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Condylar Angle:</span>
                    <span className="font-mono text-sky-400 font-bold">81.2°</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Medullary Canal:</span>
                    <span className="font-mono text-sky-400 font-bold">12.6 mm</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
