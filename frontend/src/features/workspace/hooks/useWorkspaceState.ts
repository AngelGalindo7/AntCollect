import { useState, useEffect, useCallback } from 'react';
import type { Panel } from '../types/workspace';
import {
  getMyWorkspace,
  createPanel,
  updatePanelMeta,
  savePanelCanvas as apiSavePanelCanvas,
  uploadPanelPreview as apiUploadPanelPreview,
  deletePanel as apiDeletePanel,
} from '../api/workspaceApi';

interface UseWorkspaceState {
  panels: Panel[];
  focusedId: number | null;
  focus: (id: number) => void;
  blur: () => void;
  spawnPanel: (rect: { x: number; y: number; w: number; h: number }) => Promise<void>;
  deletePanel: (id: number) => Promise<void>;
  updatePanelRect: (id: number, rect: Partial<Pick<Panel, 'x' | 'y' | 'w' | 'h'>>) => void;
  commitPanelRect: (id: number) => Promise<void>;
  bringToFront: (id: number) => Promise<void>;
  lockPanel: (id: number, locked: boolean) => Promise<void>;
  savePanelCanvas: (id: number, canvasJson: unknown) => Promise<void>;
  uploadPanelPreview: (id: number, blob: Blob) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

function replacePanel(panels: Panel[], updated: Panel): Panel[] {
  return panels.map((p) => (p.id === updated.id ? updated : p));
}

export function useWorkspaceState(): UseWorkspaceState {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyWorkspace()
      .then((data) => {
        if (!cancelled) setPanels(data.panels);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load workspace');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const focus = useCallback((id: number) => setFocusedId(id), []);
  const blur = useCallback(() => setFocusedId(null), []);

  const spawnPanel = useCallback(async (rect: { x: number; y: number; w: number; h: number }) => {
    try {
      const newPanel = await createPanel({ rect });
      setPanels((prev) => [...prev, newPanel]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to spawn panel');
    }
  }, []);

  const deletePanel = useCallback(async (id: number) => {
    setPanels((prev) => prev.filter((p) => p.id !== id));
    try {
      await apiDeletePanel(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete panel';
      setError(message);
      const data = await getMyWorkspace();
      setPanels(data.panels);
    }
  }, []);

  const updatePanelRect = useCallback(
    (id: number, rect: Partial<Pick<Panel, 'x' | 'y' | 'w' | 'h'>>) => {
      setPanels((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...rect } : p)),
      );
    },
    [],
  );

  const commitPanelRect = useCallback(async (id: number) => {
    const panel = panels.find((p) => p.id === id);
    if (!panel) return;
    const x = Math.round(panel.x);
    const y = Math.round(panel.y);
    const w = Math.max(280, Math.round(panel.w));
    const h = Math.max(220, Math.round(panel.h));
    try {
      const updated = await updatePanelMeta(id, { x, y, w, h });
      setPanels((prev) => replacePanel(prev, updated));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to commit rect');
    }
  }, [panels]);

  const bringToFront = useCallback(async (id: number) => {
    let nextZ = 1;
    setPanels((prev) => {
      nextZ = prev.length > 0 ? Math.max(...prev.map((p) => p.z)) + 1 : 1;
      return prev;
    });
    const updated = await updatePanelMeta(id, { z: nextZ });
    setPanels((prev) => replacePanel(prev, updated));
  }, []);

  const lockPanel = useCallback(async (id: number, locked: boolean) => {
    const updated = await updatePanelMeta(id, { locked });
    setPanels((prev) => replacePanel(prev, updated));
  }, []);

  const savePanelCanvas = useCallback(async (id: number, canvasJson: unknown) => {
    const updated = await apiSavePanelCanvas(id, canvasJson);
    setPanels((prev) => replacePanel(prev, updated));
  }, []);

  const uploadPanelPreview = useCallback(async (id: number, blob: Blob) => {
    const previewPath = await apiUploadPanelPreview(id, blob);
    setPanels((prev) =>
      prev.map((p) => (p.id === id ? { ...p, preview_path: previewPath } : p)),
    );
  }, []);

  return {
    panels,
    focusedId,
    focus,
    blur,
    spawnPanel,
    deletePanel,
    updatePanelRect,
    commitPanelRect,
    bringToFront,
    lockPanel,
    savePanelCanvas,
    uploadPanelPreview,
    isLoading,
    error,
  };
}
