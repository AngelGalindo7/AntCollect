import { API_BASE, fetchWithAuth } from '../../../shared/api/api';
import type { CanvasApiResponse, CanvasState } from '../types/canvas';

export async function getMyCanvas(): Promise<CanvasApiResponse> {
  const res = await fetchWithAuth(`${API_BASE}/canvas/me`);
  if (!res.ok) throw new Error('Failed to load canvas');
  return res.json();
}

export async function saveCanvas(state: CanvasState): Promise<CanvasApiResponse> {
  const res = await fetchWithAuth(`${API_BASE}/canvas/me`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canvas_json: state }),
  });
  if (!res.ok) throw new Error('Failed to save canvas');
  return res.json();
}

export async function uploadCanvasPreview(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', blob, 'canvas-preview.png');
  const res = await fetchWithAuth(`${API_BASE}/canvas/me/preview`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error('Failed to upload canvas preview');
  const data = await res.json();
  return data.preview_path as string;
}

export async function uploadCanvasAsset(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetchWithAuth(`${API_BASE}/canvas/me/assets`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error('Failed to upload image');
  const data = await res.json();
  return data.asset_url as string;
}

export async function getPublicCanvasPreview(username: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/canvas/${username}/preview`);
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = await res.json();
  return data.preview_path as string;
}
