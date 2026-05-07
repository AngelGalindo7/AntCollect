export const HEADER_FRAME_WIDTH = 1800;
export const HEADER_FRAME_HEIGHT = 300;

export interface BackgroundImagePosition {
  offsetX: number;
  offsetY: number;
  scale: number;
}

export const DEFAULT_BG_POSITION: BackgroundImagePosition = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
};
