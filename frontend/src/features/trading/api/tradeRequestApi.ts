import { fetchWithAuth } from '@/shared/api/api';
import type { TradeRequest, TradeRequestType } from '../types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export async function createTradeRequest(data: {
  target_post_id: number;
  recipient_id: number;
  request_type: TradeRequestType;
  offered_folder_id?: number;
}): Promise<TradeRequest> {
  const res = await fetchWithAuth(`${BACKEND_URL}/trade-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function getTradeInbox(): Promise<TradeRequest[]> {
  const res = await fetchWithAuth(`${BACKEND_URL}/trade-requests/inbox`);
  if (!res.ok) throw new Error('Failed to fetch trade inbox');
  return res.json();
}

export async function getTradeInboxCount(): Promise<number> {
  const res = await fetchWithAuth(`${BACKEND_URL}/trade-requests/inbox/count`);
  if (!res.ok) throw new Error('Failed to fetch trade inbox count');
  const data = await res.json();
  return data.count;
}

export async function getSentTradeRequests(): Promise<TradeRequest[]> {
  const res = await fetchWithAuth(`${BACKEND_URL}/trade-requests/sent`);
  if (!res.ok) throw new Error('Failed to fetch sent requests');
  return res.json();
}

export async function acceptTradeRequest(id: number): Promise<TradeRequest> {
  const res = await fetchWithAuth(`${BACKEND_URL}/trade-requests/${id}/accept`, {
    method: 'POST',
  });
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function declineTradeRequest(id: number): Promise<void> {
  const res = await fetchWithAuth(`${BACKEND_URL}/trade-requests/${id}/decline`, {
    method: 'POST',
  });
  if (!res.ok) throw await res.json();
}
