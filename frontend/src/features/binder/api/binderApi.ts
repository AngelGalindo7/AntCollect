import { API_BASE, fetchWithAuth, fetchPublic } from '@/shared/api/api';
import type { BinderOut, UserStickerOut } from '../types';

export async function getMyBinder(): Promise<BinderOut> {
  const res = await fetchWithAuth(`${API_BASE}/binders/me`);
  if (!res.ok) throw new Error('Failed to load binder');
  return res.json();
}

export async function getPublicBinder(username: string): Promise<BinderOut> {
  const res = await fetchPublic(`${API_BASE}/binders/${encodeURIComponent(username)}`);
  if (!res.ok) throw new Error('Failed to load binder');
  return res.json();
}

export async function getUserStickers(): Promise<UserStickerOut[]> {
  const res = await fetchWithAuth(`${API_BASE}/stickers/me`);
  if (!res.ok) throw new Error('Failed to load stickers');
  return res.json();
}

export async function assignSlot(
  userStickerId: number,
  binderPageId: number,
  slotIndex: number,
): Promise<BinderOut> {
  const res = await fetchWithAuth(`${API_BASE}/binders/me/slots`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_sticker_id: userStickerId, binder_page_id: binderPageId, slot_index: slotIndex }),
  });
  if (!res.ok) throw new Error('Failed to assign slot');
  return res.json();
}
