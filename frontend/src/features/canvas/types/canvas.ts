export type NodeSource = 'library' | 'post' | 'upload';

export type HoloVariant = 'regular' | 'reverse' | 'rainbow' | 'radiant' | 'secret' | 'amazing';

export const DEFAULT_HOLO_VARIANT: HoloVariant = 'regular';

export interface CanvasNode {
  id: string;
  image_url: string;
  source: NodeSource;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  bgRemoved?: boolean;
  originalUrl?: string;
  removedBgUrl?: string;
  holo?: boolean;
  holoVariant?: HoloVariant;
}

export interface BackgroundConfig {
  type: 'color' | 'gradient';
  value: string;
  gradientEnd?: string;
  angle?: number;
}

export interface CanvasState {
  version: 1;
  background: BackgroundConfig;
  nodes: CanvasNode[];
}

export interface CanvasApiResponse {
  canvas_json: CanvasState | null;
  preview_path: string | null;
}
