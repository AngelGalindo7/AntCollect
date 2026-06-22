import { create } from 'zustand';

interface UIState {
  isAuthWallOpen: boolean;
  openAuthWall: () => void;
  closeAuthWall: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isAuthWallOpen: false,
  openAuthWall: () => set({ isAuthWallOpen: true }),
  closeAuthWall: () => set({ isAuthWallOpen: false }),
}));
