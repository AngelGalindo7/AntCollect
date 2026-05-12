import { useLayoutEffect, useRef, useState } from 'react';
import { PenLine } from 'lucide-react';
import type { Post } from '@/shared/types/Types';
import type { WorkspaceBounds, Rect } from '../types/workspace';
import { useWorkspaceState } from '../hooks/useWorkspaceState';
import { PanelFrame } from './PanelFrame';
import { PanelPreview } from './PanelPreview';
import { CanvasEditorOverlay } from './CanvasEditorOverlay';
import { CanvasPickerDrawer } from './CanvasPickerDrawer';
import { CanvasSizeSetup } from './CanvasSizeSetup';

interface Props {
  username: string;
  posts: Post[];
  isOwner: boolean;
}

export function Workspace({ posts, isOwner }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<WorkspaceBounds>({ w: 800, h: 600 });
  const [isWorkspaceEditMode, setIsWorkspaceEditMode] = useState(false);
  const [workspaceH, setWorkspaceH] = useState(600);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSizeSetupOpen, setIsSizeSetupOpen] = useState(false);
  const [editingPanelId, setEditingPanelId] = useState<number | null>(null);
  const freshPanelIdRef = useRef<number | null>(null);
  const pendingCanvasSizeRef = useRef<{ w: number; h: number } | null>(null);

  const {
    panels,
    placedPanels,
    libraryPanels,
    focus,
    blur,
    createLibraryCanvas,
    placePanel,
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

  const editingPanel = panels.find((p) => p.id === editingPanelId) ?? null;

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-xl bg-[#F0EBE5] overflow-hidden ${isWorkspaceEditMode ? 'ring-2 ring-dashed ring-espresso/30' : 'ring-1 ring-black/8 shadow-sm'}`}
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

      {!isLoading && placedPanels.length === 0 && !isWorkspaceEditMode && isOwner && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-espresso/50 text-sm font-medium">This is your Showcase</p>
            <p className="text-espresso/35 text-xs max-w-xs">
              Add canvases here to display your work on your profile.
            </p>
          </div>
          <button
            onClick={() => setIsWorkspaceEditMode(true)}
            className="px-5 py-2 rounded-full bg-espresso text-white text-xs font-semibold shadow-md hover:bg-espresso/90 transition-colors"
          >
            + Add your first canvas
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
              isWorkspaceEditMode={isWorkspaceEditMode}
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

      {/* Owner toolbar */}
      {isOwner && (
        <div
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 9999 }}
          className="flex items-center gap-2"
        >
          {isWorkspaceEditMode ? (
            <>
              <button
                onClick={() => setIsPickerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-espresso text-white text-xs font-semibold shadow-md hover:bg-espresso/90 transition-colors"
              >
                + Add Canvas
              </button>
              <button
                onClick={() => {
                  setIsWorkspaceEditMode(false);
                  setIsPickerOpen(false);
                }}
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

      {/* Canvas size setup — shown before creating a new canvas */}
      {isSizeSetupOpen && isOwner && (
        <CanvasSizeSetup
          onClose={() => setIsSizeSetupOpen(false)}
          onConfirm={async (w, h) => {
            pendingCanvasSizeRef.current = { w, h };
            const panel = await createLibraryCanvas();
            freshPanelIdRef.current = panel.id;
            setIsSizeSetupOpen(false);
            setEditingPanelId(panel.id);
          }}
        />
      )}

      {/* Canvas picker drawer */}
      {isPickerOpen && isOwner && (
        <CanvasPickerDrawer
          libraryPanels={libraryPanels}
          placedPanels={placedPanels}
          bounds={bounds}
          onPlace={async (id, rect) => {
            await placePanel(id, rect);
            setIsPickerOpen(false);
          }}
          onNewCanvas={() => {
            setIsPickerOpen(false);
            setIsSizeSetupOpen(true);
          }}
          onClose={() => setIsPickerOpen(false)}
        />
      )}

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
          }}
        />
      )}
    </div>
  );
}
