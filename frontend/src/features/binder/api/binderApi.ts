import { API_BASE, fetchWithAuth, fetchPublic } from '@/shared/api/api';
import type { BinderOut } from '../types';

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
