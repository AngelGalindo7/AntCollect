import { API_BASE, fetchWithAuth } from '@/shared/api/api';
import type { Panel, WorkspaceData } from '../types/workspace';
import type { CanvasState } from '@/features/canvas/types/canvas';

export interface PanelCreateRequest {
  rect?: { x: number; y: number; w: number; h: number };
  w?: number;
  h?: number;
  title?: string;
  accent?: string;
}

export interface PanelMetaUpdate {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  z?: number;
  locked?: boolean;
  placed?: boolean;
  title?: string | null;
  accent?: string | null;
}

export async function getMyWorkspace(): Promise<WorkspaceData> {
  const res = await fetchWithAuth(`${API_BASE}/workspace/me`);
  if (!res.ok) throw new Error('Failed to load workspace');
  return res.json();
}

export async function createPanel(req?: PanelCreateRequest): Promise<Panel> {
  const res = await fetchWithAuth(`${API_BASE}/workspace/me/panels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req ?? {}),
  });
  if (!res.ok) throw new Error('Failed to create panel');
  return res.json();
}

export async function updatePanelMeta(id: number, patch: PanelMetaUpdate): Promise<Panel> {
  const res = await fetchWithAuth(`${API_BASE}/workspace/me/panels/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update panel');
  return res.json();
}

export async function savePanelCanvas(id: number, canvasJson: CanvasState): Promise<Panel> {
  const res = await fetchWithAuth(`${API_BASE}/workspace/me/panels/${id}/canvas`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canvas_json: canvasJson }),
  });
  if (!res.ok) throw new Error('Failed to save panel canvas');
  return res.json();
}

export async function uploadPanelPreview(id: number, blob: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', blob, 'panel-preview.png');
  const res = await fetchWithAuth(`${API_BASE}/workspace/me/panels/${id}/preview`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error('Failed to upload panel preview');
  const data: { preview_path: string } = await res.json();
  return data.preview_path;
}

export async function createLibraryPanel(): Promise<Panel> {
  const res = await fetchWithAuth(`${API_BASE}/workspace/me/panels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placed: false }),
  });
  if (!res.ok) throw new Error('Failed to create library panel');
  return res.json();
}

export async function placePanel(id: number, rect: { x: number; y: number; w: number; h: number }): Promise<Panel> {
  return updatePanelMeta(id, { placed: true, ...rect });
}

export async function deletePanel(id: number): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/workspace/me/panels/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete panel');
}

export async function uploadWorkspaceAsset(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetchWithAuth(`${API_BASE}/workspace/me/assets`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error('Failed to upload asset');
  const data: { asset_url: string } = await res.json();
  return data.asset_url;
}

export async function getPublicWorkspace(username: string): Promise<WorkspaceData> {
  const res = await fetch(`${API_BASE}/workspace/${username}`);
  if (!res.ok) throw new Error('Failed to load public workspace');
  return res.json();
}
