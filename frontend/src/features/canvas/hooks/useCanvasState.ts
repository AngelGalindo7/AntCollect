import { useState, useCallback } from 'react';
import type { CanvasNode, CanvasState, BackgroundConfig, NodeSource } from '../types/canvas';

export const CANVAS_WIDTH = 1440;
export const CANVAS_HEIGHT = 810;

const DEFAULT_BACKGROUND: BackgroundConfig = { type: 'color', value: '#f5f0e8' };

const DEFAULT_NODE_SIZE = 150;

export function useCanvasState(initial: CanvasState | null) {
  const [nodes, setNodes] = useState<CanvasNode[]>(initial?.nodes ?? []);
  const [background, setBackground] = useState<BackgroundConfig>(
    initial?.background ?? DEFAULT_BACKGROUND,
  );
  const [isDirty, setIsDirty] = useState(false);

  const addNode = useCallback((imageUrl: string, source: NodeSource) => {
    const node: CanvasNode = {
      id: crypto.randomUUID(),
      image_url: imageUrl,
      source,
      x: CANVAS_WIDTH / 2 - DEFAULT_NODE_SIZE / 2,
      y: CANVAS_HEIGHT / 2 - DEFAULT_NODE_SIZE / 2,
      width: DEFAULT_NODE_SIZE,
      height: DEFAULT_NODE_SIZE,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    };
    setNodes((prev) => [...prev, node]);
    setIsDirty(true);
  }, []);

  const updateNode = useCallback((id: string, attrs: Partial<CanvasNode>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...attrs } : n)));
    setIsDirty(true);
  }, []);

  const removeNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setIsDirty(true);
  }, []);

  const changeBackground = useCallback((bg: BackgroundConfig) => {
    setBackground(bg);
    setIsDirty(true);
  }, []);

  const moveNodeUp = useCallback((id: string) => {
    setNodes((prev) => {
      const idx = prev.findIndex((n) => n.id === id);
      if (idx === -1 || idx === prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
    setIsDirty(true);
  }, []);

  const moveNodeDown = useCallback((id: string) => {
    setNodes((prev) => {
      const idx = prev.findIndex((n) => n.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
      return next;
    });
    setIsDirty(true);
  }, []);

  const markClean = useCallback(() => setIsDirty(false), []);

  const getCanvasJson = useCallback(
    (): CanvasState => ({ version: 1, background, nodes }),
    [background, nodes],
  );

  return { nodes, background, isDirty, addNode, updateNode, removeNode, moveNodeUp, moveNodeDown, changeBackground, markClean, getCanvasJson };
}
