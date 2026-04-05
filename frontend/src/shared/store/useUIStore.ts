import { create } from 'zustand';

interface UIState {
  isCreateMenuOpen: boolean;
  openCreateMenu: () => void;
  closeCreateMenu: () => void;
  isCreatePostModalOpen: boolean;
  openCreatePostModal: () => void;
  closeCreatePostModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isCreateMenuOpen: false,
  openCreateMenu: () => set({ isCreateMenuOpen: true }),
  closeCreateMenu: () => set({ isCreateMenuOpen: false }),
  isCreatePostModalOpen: false,
  openCreatePostModal: () => set({ isCreatePostModalOpen: true, isCreateMenuOpen: false }),
  closeCreatePostModal: () => set({ isCreatePostModalOpen: false }),
}));
