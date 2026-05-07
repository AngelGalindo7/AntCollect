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
  type: 'color' | 'gradient' | 'image';
  value: string;
  gradientEnd?: string;
  angle?: number;
  imageUrl?: string;
  imageOffsetX?: number;
  imageOffsetY?: number;
  imageScale?: number;
}

export const HOLO_VARIANTS: { value: HoloVariant; label: string; hint: string }[] = [
  { value: 'regular', label: 'Regular',  hint: 'Classic foil' },
  { value: 'reverse', label: 'Reverse',  hint: 'Mirror shine' },
  { value: 'rainbow', label: 'Rainbow',  hint: 'Prismatic burst' },
  { value: 'radiant', label: 'Radiant',  hint: 'Brushed metal' },
  { value: 'secret',  label: 'Secret',   hint: 'Low-light gloss' },
  { value: 'amazing', label: 'Amazing',  hint: 'Saturated glitter' },
];

export interface CanvasState {
  version: 1;
  width?: number;
  height?: number;
  background: BackgroundConfig;
  nodes: CanvasNode[];
}

export interface CanvasApiResponse {
  canvas_json: CanvasState | null;
  preview_path: string | null;
}
