/**
 * MEDAM Shared Application State Bus & In-Memory Geometry Store
 * 
 * Manages cross-module state transitions, the three track workflows
 * (Medical, Industrial, Creative), and zero-copy in-memory 3D geometry buffers
 * transferred from Rados to Design studio.
 */

export type ModuleId =
  | 'Account'
  | 'Datum'
  | 'Rados'
  | 'Design'
  | 'FEA'
  | 'Slicer'
  | 'Print Factory'
  | 'I 5.0';

export const MEDAM_MODULES: ModuleId[] = [
  'Account',
  'Datum',
  'Rados',
  'Design',
  'FEA',
  'Slicer',
  'Print Factory',
  'I 5.0',
];

export type WorkflowTrack = 'medical' | 'industrial' | 'creative';

export interface WorkflowTrackDefinition {
  id: WorkflowTrack;
  name: string;
  allowedModules: ModuleId[];
  description: string;
}

export const WORKFLOW_TRACKS: Record<WorkflowTrack, WorkflowTrackDefinition> = {
  medical: {
    id: 'medical',
    name: 'Medical Track',
    allowedModules: ['Datum', 'Rados', 'Design', 'FEA', 'Slicer'],
    description: 'Datum -> Rados -> Design with bidirectional FEA validation and Slicer output',
  },
  industrial: {
    id: 'industrial',
    name: 'Industrial Track',
    allowedModules: ['Design', 'FEA', 'Slicer', 'Print Factory', 'I 5.0'],
    description: 'Design with bidirectional FEA validation -> Slicer -> Print Factory -> I 5.0',
  },
  creative: {
    id: 'creative',
    name: 'Creative Track',
    allowedModules: ['Rados', 'Design'],
    description: 'Rados directly to Design',
  },
};

export interface TransferredMeshBuffer {
  id: string;
  name: string;
  maskColor: string;
  // Raw geometry typed buffers
  vertices: Float32Array; // flat coords [x0, y0, z0, x1, y1, z1, ...] in physical mm
  normals: Float32Array;
  indices: Uint32Array;
  triangleCount: number;
  vertexCount: number;
  // Spatial bounding box in mm
  boundsMm: {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
    center: [number, number, number];
  };
  spacing: [number, number, number];
  sourcePatientId: string;
  sourceSeriesDescription: string;
  timestamp: number;
  pipelineStagesApplied: string[];
}

type GeometryListener = (mesh: TransferredMeshBuffer) => void;
type TrackListener = (track: WorkflowTrack) => void;

class StateBus {
  private activeTrack: WorkflowTrack = 'medical';
  private transferredGeometry: TransferredMeshBuffer | null = null;
  private geometryListeners: Set<GeometryListener> = new Set();
  private trackListeners: Set<TrackListener> = new Set();

  public getTrack(): WorkflowTrack {
    return this.activeTrack;
  }

  public setTrack(track: WorkflowTrack): void {
    this.activeTrack = track;
    this.trackListeners.forEach((l) => l(track));
  }

  public onTrackChange(listener: TrackListener): () => void {
    this.trackListeners.add(listener);
    return () => this.trackListeners.delete(listener);
  }

  public getTransferredGeometry(): TransferredMeshBuffer | null {
    return this.transferredGeometry;
  }

  public setTransferredGeometry(mesh: TransferredMeshBuffer): void {
    this.transferredGeometry = mesh;
    this.geometryListeners.forEach((l) => l(mesh));
  }

  public onGeometryReceived(listener: GeometryListener): () => void {
    this.geometryListeners.add(listener);
    return () => this.geometryListeners.delete(listener);
  }
}

export const medamStateBus = new StateBus();
