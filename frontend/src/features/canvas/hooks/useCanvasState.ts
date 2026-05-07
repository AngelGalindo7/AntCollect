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
  const [width, setWidth] = useState<number>(initial?.width ?? CANVAS_WIDTH);
  const [height, setHeight] = useState<number>(initial?.height ?? CANVAS_HEIGHT);
  const [isDirty, setIsDirty] = useState(false);

  const addNode = useCallback((imageUrl: string, source: NodeSource) => {
    const isPreCut = source === 'library';
    setNodes((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        image_url: imageUrl,
        source,
        x: width / 2 - DEFAULT_NODE_SIZE / 2,
        y: height / 2 - DEFAULT_NODE_SIZE / 2,
        width: DEFAULT_NODE_SIZE,
        height: DEFAULT_NODE_SIZE,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        bgRemoved: isPreCut,
        removedBgUrl: isPreCut ? imageUrl : undefined,
      },
    ]);
    setIsDirty(true);
  }, [width, height]);

  const updateNode = useCallback((id: string, attrs: Partial<CanvasNode>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...attrs } : n)));
    setIsDirty(true);
  }, []);

  const removeNode = useCallback((id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setIsDirty(true);
  }, []);

  const duplicateNode = useCallback((id: string): string | null => {
    let newId: string | null = null;
    setNodes((prev) => {
      const src = prev.find((n) => n.id === id);
      if (!src) return prev;
      newId = crypto.randomUUID();
      const copy: CanvasNode = {
        ...src,
        id: newId,
        x: Math.min(width - src.width, src.x + 24),
        y: Math.min(height - src.height, src.y + 24),
      };
      return [...prev, copy];
    });
    setIsDirty(true);
    return newId;
  }, [width, height]);

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

  const setCanvasSize = useCallback((w: number, h: number) => {
    setWidth(w);
    setHeight(h);
    setIsDirty(true);
  }, []);

  const markClean = useCallback(() => setIsDirty(false), []);

  const getCanvasJson = useCallback(
    (): CanvasState => ({ version: 1, width, height, background, nodes }),
    [width, height, background, nodes],
  );

  return {
    nodes,
    background,
    width,
    height,
    isDirty,
    addNode,
    updateNode,
    removeNode,
    duplicateNode,
    moveNodeUp,
    moveNodeDown,
    changeBackground,
    setCanvasSize,
    markClean,
    getCanvasJson,
  };
}
