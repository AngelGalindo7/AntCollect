import { create } from 'zustand';

interface UIState {
  isCreatePostModalOpen: boolean;
  openCreatePostModal: () => void;
  closeCreatePostModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isCreatePostModalOpen: false,
  openCreatePostModal: () => set({ isCreatePostModalOpen: true }),
  closeCreatePostModal: () => set({ isCreatePostModalOpen: false }),
}));
