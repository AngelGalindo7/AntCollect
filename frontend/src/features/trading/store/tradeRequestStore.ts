import { create } from 'zustand';
import type { TradeRequest } from '../types';

interface TradeRequestStore {
  pendingRequests: TradeRequest[];
  pendingCount: number;
  setPendingRequests: (requests: TradeRequest[]) => void;
  setPendingCount: (count: number) => void;
  removeRequest: (id: number) => void;
}

export const useTradeRequestStore = create<TradeRequestStore>((set) => ({
  pendingRequests: [],
  pendingCount: 0,
  setPendingRequests: (requests) => set({ pendingRequests: requests }),
  setPendingCount: (count) => set({ pendingCount: count }),
  removeRequest: (id) =>
    set((state) => ({
      pendingRequests: state.pendingRequests.filter((r) => r.id !== id),
      pendingCount: Math.max(0, state.pendingCount - 1),
    })),
}));
