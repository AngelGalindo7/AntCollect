import { fetchWithAuth, API_BASE } from '@/shared/api/api';

export type ReportReason = 'spam' | 'inappropriate' | 'harassment' | 'copyright' | 'other';

export async function reportPost(postId: number, reason: ReportReason): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_type: 'post', target_id: postId, reason }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as { detail?: string }).detail ?? 'Failed to submit report');
  }
}
