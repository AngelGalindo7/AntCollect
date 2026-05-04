import { create } from 'zustand';

export type ToastVariant = 'error' | 'success' | 'info';

export interface Toast {
    id: string;
    variant: ToastVariant;
    message: string;
    requestId?: string | null;
}

interface ToastState {
    toasts: Toast[];
    push: (t: Omit<Toast, 'id'>) => string;
    dismiss: (id: string) => void;
    clear: () => void;
}

const DEFAULT_TTL_MS = 5000;

export const useToastStore = create<ToastState>((set, get) => ({
    toasts: [],
    push: (t) => {
        const id = crypto.randomUUID();
        set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
        window.setTimeout(() => get().dismiss(id), DEFAULT_TTL_MS);
        return id;
    },
    dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    clear: () => set({ toasts: [] }),
}));

/**
 * Convenience accessor for non-component code (handlers, stores). Components
 * should still use the hook so re-renders stay tracked.
 */
export const toast = {
    error: (message: string, requestId?: string | null) =>
        useToastStore.getState().push({ variant: 'error', message, requestId }),
    success: (message: string) =>
        useToastStore.getState().push({ variant: 'success', message }),
    info: (message: string) =>
        useToastStore.getState().push({ variant: 'info', message }),
};
