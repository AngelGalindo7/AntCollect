import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Plus, Pencil, Check } from 'lucide-react';
import type { Post } from '@/shared/types/Types';
import type { WorkspaceBounds, Rect } from '../types/workspace';
import { useWorkspaceState } from '../hooks/useWorkspaceState';
import { PanelFrame } from './PanelFrame';
import { PanelPreview } from './PanelPreview';
import { CanvasEditorOverlay } from './CanvasEditorOverlay';
import { placementSpot } from '../geometry/placement';

interface Props {
  username: string;
  posts: Post[];
  isOwner: boolean;
  triggerNewCanvas?: boolean;
}

export function Workspace({ posts, isOwner, triggerNewCanvas }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<WorkspaceBounds>({ w: 800, h: 600 });
  const [workspaceH, setWorkspaceH] = useState(600);
  const [editingPanelId, setEditingPanelId] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [creatingCanvas, setCreatingCanvas] = useState(false);
  const freshPanelIdRef = useRef<number | null>(null);
  const pendingCanvasSizeRef = useRef<{ w: number; h: number } | null>(null);
  const newCanvasTriggeredRef = useRef(false);

  const {
    panels,
    placedPanels,
    focus,
    blur,
    placePanel,
    createLibraryCanvas,
    removeFromWorkspace,
    deletePanel,
    updatePanelRect,
    commitPanelRect,
    bringToFront,
    lockPanel,
    setPanelById,
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
        placedPanels.length > 0
          ? Math.max(...placedPanels.map((p) => p.y + p.h)) + 60
          : remainingVH;
      setWorkspaceH(Math.max(remainingVH, contentH));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [placedPanels]);

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

  // Auto-open new canvas editor when arriving from the Create menu (+→Canvas)
  useEffect(() => {
    if (!isLoading && isOwner && triggerNewCanvas && !newCanvasTriggeredRef.current) {
      newCanvasTriggeredRef.current = true;
      createLibraryCanvas().then((panel) => {
        freshPanelIdRef.current = panel.id;
        setEditingPanelId(panel.id);
      }).catch(() => {});
    }
  }, [isLoading, isOwner, triggerNewCanvas, createLibraryCanvas]);

  const handleNewCanvas = () => {
    if (creatingCanvas) return;
    setCreatingCanvas(true);
    createLibraryCanvas()
      .then((panel) => {
        freshPanelIdRef.current = panel.id;
        setEditingPanelId(panel.id);
      })
      .catch(() => {})
      .finally(() => setCreatingCanvas(false));
  };

  const editingPanel = panels.find((p) => p.id === editingPanelId) ?? null;

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl bg-[#F0EBE5] overflow-hidden ring-1 ring-black/8 shadow-sm"
      style={{ height: workspaceH, minHeight: 420 }}
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

      {/* Owner toolbar — Edit toggle + New Canvas */}
      {!isLoading && isOwner && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
          <button
            onClick={handleNewCanvas}
            disabled={creatingCanvas}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm text-espresso text-xs font-semibold shadow-md hover:bg-white transition-colors disabled:opacity-50"
          >
            <Plus size={13} strokeWidth={2.5} />
            {creatingCanvas ? 'Creating…' : 'New Canvas'}
          </button>
          <button
            onClick={() => setIsEditMode((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-md transition-colors ${
              isEditMode
                ? 'bg-uci-gold text-espresso hover:brightness-105'
                : 'bg-white/90 backdrop-blur-sm text-espresso hover:bg-white'
            }`}
          >
            {isEditMode ? <Check size={13} strokeWidth={2.5} /> : <Pencil size={13} strokeWidth={2.5} />}
            {isEditMode ? 'Done' : 'Edit'}
          </button>
        </div>
      )}

      {/* Empty-state CTA for owners with nothing placed yet */}
      {!isLoading && isOwner && placedPanels.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6 pointer-events-none">
          <p className="text-espresso/50 text-sm font-medium">Your showcase is empty</p>
          <button
            onClick={handleNewCanvas}
            disabled={creatingCanvas}
            className="pointer-events-auto flex items-center gap-1.5 px-4 py-2 rounded-full bg-uci-gold text-espresso text-sm font-semibold shadow-md hover:brightness-105 transition-all disabled:opacity-50"
          >
            <Plus size={15} strokeWidth={2.5} />
            {creatingCanvas ? 'Creating…' : 'Create your first canvas'}
          </button>
        </div>
      )}


      {!isLoading &&
        placedPanels.map((panel) => {
          const others: Rect[] = placedPanels
            .filter((p) => p.id !== panel.id)
            .map(({ x, y, w, h }) => ({ x, y, w, h }));

          return (
            <PanelFrame
              key={panel.id}
              panel={panel}
              isOwner={isOwner}
              isWorkspaceEditMode={isEditMode}
              bounds={bounds}
              others={others}
              onUpdateRect={(id, rect) => updatePanelRect(id, rect)}
              onCommitRect={commitPanelRect}
              onFocus={focus}
              onBringToFront={(id) => bringToFront(id).catch(() => {})}
              onDelete={(id) => deletePanel(id).catch(() => {})}
              onRemoveFromWorkspace={(id) => removeFromWorkspace(id).catch(() => {})}
              onLock={(id, locked) => lockPanel(id, locked).catch(() => {})}
              onEnterEdit={(id) => {
                focus(id);
                bringToFront(id).catch(() => {});
                setEditingPanelId(id);
              }}
            >
              <PanelPreview panel={panel} />
            </PanelFrame>
          );
        })}



      {/* Canvas editor overlay */}
      {editingPanel !== null && isOwner && (
        <CanvasEditorOverlay
          panel={editingPanel}
          posts={posts}
          overrideInitialSize={pendingCanvasSizeRef.current ?? undefined}
          onClose={() => {
            const id = editingPanel.id;
            if (freshPanelIdRef.current === id) {
              freshPanelIdRef.current = null;
              pendingCanvasSizeRef.current = null;
              deletePanel(id).catch(() => {});
            }
            setEditingPanelId(null);
          }}
          onSaved={(updated) => {
            if (freshPanelIdRef.current === updated.id) {
              freshPanelIdRef.current = null;
              pendingCanvasSizeRef.current = null;
            }
            setPanelById(updated);
            setEditingPanelId(null);
            // C1: a freshly created canvas is a library panel (placed:false) and would
            // vanish from the showcase on save — auto-place it into a free spot so the
            // owner sees their work immediately instead of assuming it was lost.
            if (!updated.placed) {
              const occupied = placedPanels
                .filter((p) => p.id !== updated.id)
                .map(({ x, y, w, h }) => ({ x, y, w, h }));
              const spot = placementSpot(occupied, bounds, updated.w, updated.h);
              placePanel(updated.id, { x: spot.x, y: spot.y, w: updated.w, h: updated.h }).catch(() => {});
            }
          }}
        />
      )}
    </div>
  );
}
