import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Plus, PenLine } from 'lucide-react';
import type { Post } from '@/shared/types/Types';
import type { WorkspaceBounds, Rect } from '../types/workspace';
import { useWorkspaceState } from '../hooks/useWorkspaceState';
import { PanelFrame } from './PanelFrame';
import { PanelEditor } from './PanelEditor';
import { PanelPickerPalette } from './PanelPickerPalette';
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
  const [isWorkspaceEditMode, setIsWorkspaceEditMode] = useState(false);
  const [workspaceH, setWorkspaceH] = useState(600);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [canvasApi, setCanvasApi] = useState<CanvasApiHandle | null>(null);

  const {
    panels,
    focusedId: _focusedId,
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

  // Height = max(viewport remaining height, panel content bottom)
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const compute = () => {
      const top = el.getBoundingClientRect().top;
      const remainingVH = Math.max(window.innerHeight - top, 400);
      const contentH =
        panels.length > 0
          ? Math.max(...panels.map((p) => p.y + p.h)) + 60
          : remainingVH;
      setWorkspaceH(Math.max(remainingVH, contentH));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [panels]);

  // Track container dimensions for collision bounds
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

  // Escape exits canvas edit
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

  // Leaving workspace edit mode clears any open canvas editor
  useEffect(() => {
    if (!isWorkspaceEditMode) {
      setEditingPanelId(null);
      setCanvasApi(null);
    }
  }, [isWorkspaceEditMode]);

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
      className="relative w-full bg-[#F0EBE5]"
      style={{ height: workspaceH }}
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

      {!isLoading &&
        panels.map((panel) => {
          const others: Rect[] = panels
            .filter((p) => p.id !== panel.id)
            .map(({ x, y, w, h }) => ({ x, y, w, h }));

          return (
            <PanelFrame
              key={panel.id}
              panel={panel}
              isOwner={isOwner}
              isEditing={editingPanelId === panel.id}
              isWorkspaceEditMode={isWorkspaceEditMode}
              bounds={bounds}
              others={others}
              onUpdateRect={(id, rect) => updatePanelRect(id, rect)}
              onCommitRect={commitPanelRect}
              onFocus={focus}
              onBringToFront={(id) => {
                bringToFront(id).catch(() => {});
              }}
              onDelete={(id) => {
                deletePanel(id).catch(() => {});
              }}
              onLock={(id, locked) => {
                lockPanel(id, locked).catch(() => {});
              }}
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

      {isOwner && editingPanel && isWorkspaceEditMode && (
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

      {/* Owner toolbar — top-right of workspace */}
      {isOwner && (
        <div
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 9999 }}
          className="flex items-center gap-2"
        >
          {isWorkspaceEditMode ? (
            <>
              <button
                onClick={() => {
                  spawnPanel().catch(() => {});
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-espresso text-white text-xs font-semibold shadow-md hover:bg-espresso/90 transition-colors"
              >
                <Plus size={13} strokeWidth={2.5} />
                Add Canvas
              </button>
              <button
                onClick={() => setIsWorkspaceEditMode(false)}
                className="px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-sm text-espresso text-xs font-semibold shadow-md hover:bg-white transition-colors border border-espresso/10"
              >
                Done
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsWorkspaceEditMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-sm text-espresso text-xs font-semibold shadow-md hover:bg-white transition-colors border border-espresso/10"
            >
              <PenLine size={13} />
              Edit Showcase
            </button>
          )}
        </div>
      )}
    </div>
  );
}
