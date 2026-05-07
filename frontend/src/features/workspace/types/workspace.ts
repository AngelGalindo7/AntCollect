export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorkspaceBounds {
  w: number;
  h: number;
}

export type ResizeMode = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export type DragMode = 'move' | ResizeMode;

export interface Panel {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  locked: boolean;
  placed: boolean;
  title: string | null;
  accent: string | null;
  canvas_json: unknown | null;
  preview_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: number;
  z_counter: number;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceData {
  workspace: Workspace;
  panels: Panel[];
}
