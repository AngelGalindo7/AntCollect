import { create } from 'zustand';
import type { TradeRequest } from '../types';

interface TradeRequestStore {
  pendingRequests: TradeRequest[];
  sentRequests: TradeRequest[];
  pendingCount: number;
  setPendingRequests: (requests: TradeRequest[]) => void;
  setSentRequests: (requests: TradeRequest[]) => void;
  setPendingCount: (count: number) => void;
  appendRequest: (request: TradeRequest) => void;
  removeRequest: (id: number) => void;
}

export const useTradeRequestStore = create<TradeRequestStore>((set) => ({
  pendingRequests: [],
  sentRequests: [],
  pendingCount: 0,
  setPendingRequests: (requests) => set({ pendingRequests: requests }),
  setSentRequests: (requests) => set({ sentRequests: requests }),
  setPendingCount: (count) => set({ pendingCount: count }),
  appendRequest: (request) =>
    set((state) => ({
      pendingRequests: [request, ...state.pendingRequests],
      pendingCount: state.pendingCount + 1,
    })),
  removeRequest: (id) =>
    set((state) => ({
      pendingRequests: state.pendingRequests.filter((r) => r.id !== id),
      pendingCount: Math.max(0, state.pendingCount - 1),
    })),
}));
