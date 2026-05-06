import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Post } from '@/shared/types/Types';
import type { WorkspaceBounds, Rect } from '../types/workspace';
import { useWorkspaceState } from '../hooks/useWorkspaceState';
import { PanelFrame } from './PanelFrame';
import { PanelEditor } from './PanelEditor';
import { PanelPickerPalette } from './PanelPickerPalette';
import { SpawnButton } from './SpawnButton';
import { Minimap } from './Minimap';
import type Konva from 'konva';
import type { CanvasApiHandle } from './PanelEditor';

interface Props {
  username: string;
  posts: Post[];
  isOwner: boolean;
}

export function Workspace({ posts, isOwner }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<WorkspaceBounds>({ w: 800, h: 600 });
  const [editingPanelId, setEditingPanelId] = useState<number | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [canvasApi, setCanvasApi] = useState<CanvasApiHandle | null>(null);

  const {
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
    isLoading,
    error,
  } = useWorkspaceState();

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBounds({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (editingPanelId === null) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const dirty = canvasApi?.isDirty ?? false;
      if (dirty && !window.confirm('Discard unsaved changes?')) return;
      setEditingPanelId(null);
      setCanvasApi(null);
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [editingPanelId, canvasApi]);

  function handleEnterEdit(id: number) {
    if (!isOwner) return;
    focus(id);
    bringToFront(id).catch(() => {});
    setEditingPanelId(id);
  }

  function handleExitEdit() {
    setEditingPanelId(null);
    setCanvasApi(null);
  }

  const editingPanel = panels.find((p) => p.id === editingPanelId) ?? null;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden bg-neutral-100 w-full"
      style={{ minHeight: 600, flex: 1 }}
      onClick={(e) => {
        if (e.target === containerRef.current) blur();
      }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-neutral-400 text-sm">Loading workspace…</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      )}

      {!isLoading && panels.map((panel) => {
        const others: Rect[] = panels
          .filter((p) => p.id !== panel.id)
          .map(({ x, y, w, h }) => ({ x, y, w, h }));

        return (
          <PanelFrame
            key={panel.id}
            panel={panel}
            isOwner={isOwner}
            isEditing={editingPanelId === panel.id}
            bounds={bounds}
            others={others}
            onUpdateRect={(id, rect) => updatePanelRect(id, rect)}
            onCommitRect={commitPanelRect}
            onFocus={focus}
            onBringToFront={(id) => { bringToFront(id).catch(() => {}); }}
            onDelete={(id) => { deletePanel(id).catch(() => {}); }}
            onLock={(id, locked) => { lockPanel(id, locked).catch(() => {}); }}
            onEnterEdit={handleEnterEdit}
          >
            <PanelEditor
              panel={panel}
              isEditing={editingPanelId === panel.id}
              isOwner={isOwner}
              stageRef={editingPanelId === panel.id ? stageRef : undefined}
              onCanvasState={(api) => {
                if (editingPanelId === panel.id) setCanvasApi(api);
              }}
            />
          </PanelFrame>
        );
      })}

      {isOwner && editingPanel && (
        <PanelPickerPalette
          panel={editingPanel}
          bounds={bounds}
          canvasApi={canvasApi}
          stageRef={stageRef}
          posts={posts}
          onSaveSuccess={(panelId) => {
            const json = canvasApi?.getCanvasJson();
            if (json) savePanelCanvas(panelId, json).catch(() => {});
            canvasApi?.markClean();
            setEditingPanelId(null);
            setCanvasApi(null);
          }}
          onDiscard={handleExitEdit}
        />
      )}

      {isOwner && (
        <SpawnButton onSpawn={() => { spawnPanel().catch(() => {}); }} />
      )}

      {isOwner && (
        <Minimap
          panels={panels}
          bounds={bounds}
          focusedId={focusedId}
          onFocus={focus}
        />
      )}
    </div>
  );
}
