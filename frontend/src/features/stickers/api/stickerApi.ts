import { API_BASE, fetchWithAuth, fetchPublic } from '@/shared/api/api';
import type { UserStickerOut } from '@/features/binder/types';

export type UserStickerUpdate = {
  favorite?: boolean;
  for_trade?: boolean;
  bg_removed?: boolean;
  condition?: string | null;
  note?: string | null;
  acquired_at?: string | null;
};

export async function listMyStickers(): Promise<UserStickerOut[]> {
  const res = await fetchWithAuth(`${API_BASE}/stickers/me`);
  if (!res.ok) throw new Error('Failed to load stickers');
  return res.json();
}

export async function listUserStickers(username: string): Promise<UserStickerOut[]> {
  const res = await fetchPublic(`${API_BASE}/stickers/${username}`);
  if (!res.ok) throw new Error('Failed to load stickers');
  return res.json();
}

export async function uploadSticker(formData: FormData): Promise<UserStickerOut> {
  const res = await fetchWithAuth(`${API_BASE}/stickers/me/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? 'Failed to upload sticker');
  }
  return res.json();
}

export async function deleteSticker(id: number): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/stickers/me/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error('Failed to delete sticker');
}

export async function removeStickerBackground(id: number): Promise<UserStickerOut> {
  const res = await fetchWithAuth(`${API_BASE}/stickers/me/${id}/remove-bg`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to remove background');
  return res.json();
}

export async function updateSticker(id: number, body: UserStickerUpdate): Promise<UserStickerOut> {
  const res = await fetchWithAuth(`${API_BASE}/stickers/me/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to update sticker');
  return res.json();
}
