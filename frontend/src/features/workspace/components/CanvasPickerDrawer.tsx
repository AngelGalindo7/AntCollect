import { useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import type { Panel, WorkspaceBounds } from '../types/workspace';

const GRID_STEP = 40;

function findFreeSpot(
  panels: { x: number; y: number; w: number; h: number }[],
  bounds: WorkspaceBounds,
  w: number,
  h: number,
): { x: number; y: number } | null {
  const maxX = bounds.w - w;
  const maxY = bounds.h - h;
  if (maxX < 0 || maxY < 0) return null;
  for (let fy = 0; fy <= maxY; fy += GRID_STEP) {
    for (let fx = 0; fx <= maxX; fx += GRID_STEP) {
      const blocked = panels.some(
        (p) => fx < p.x + p.w && fx + w > p.x && fy < p.y + p.h && fy + h > p.y,
      );
      if (!blocked) return { x: fx, y: fy };
    }
  }
  return null;
}

interface Props {
  libraryPanels: Panel[];
  placedPanels: Panel[];
  bounds: WorkspaceBounds;
  onPlace: (id: number, rect: { x: number; y: number; w: number; h: number }) => Promise<void>;
  onNewCanvas: () => Promise<void>;
  onClose: () => void;
}

export function CanvasPickerDrawer({
  libraryPanels, placedPanels, bounds, onPlace, onNewCanvas, onClose,
}: Props) {
  const [placingId, setPlacingId] = useState<number | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  const handlePlace = async (panel: Panel) => {
    const spot = findFreeSpot(placedPanels, bounds, panel.w, panel.h);
    if (!spot) return;
    setPlacingId(panel.id);
    try {
      await onPlace(panel.id, { x: spot.x, y: spot.y, w: panel.w, h: panel.h });
    } finally {
      setPlacingId(null);
    }
  };

  const handleNewCanvas = async () => {
    setCreatingNew(true);
    try {
      await onNewCanvas();
    } finally {
      setCreatingNew(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-[998]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed bottom-0 inset-x-0 z-[999] bg-white/90 backdrop-blur-xl rounded-t-2xl shadow-2xl"
        style={{ maxHeight: '40vh' }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-neutral-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <p className="text-sm font-semibold text-espresso">Your Canvases</p>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Canvas grid */}
        <div className="px-5 pb-6 overflow-x-auto">
          <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
            {/* Library canvas cards */}
            {libraryPanels.map((panel) => {
              const spot = findFreeSpot(placedPanels, bounds, panel.w, panel.h);
              const cantFit = spot === null;
              const isPlacing = placingId === panel.id;

              return (
                <button
                  key={panel.id}
                  onClick={() => !cantFit && handlePlace(panel)}
                  disabled={cantFit || isPlacing}
                  className={`relative w-36 h-28 rounded-xl overflow-hidden shadow-md shrink-0 transition-transform ${
                    cantFit
                      ? 'cursor-not-allowed opacity-60'
                      : 'hover:scale-[1.04] active:scale-[0.97] cursor-pointer'
                  }`}
                >
                  {panel.preview_path ? (
                    <img
                      src={panel.preview_path}
                      alt=""
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{ background: 'linear-gradient(135deg, #f5f0eb 0%, #e8e0d8 100%)' }}
                    />
                  )}

                  {/* Loading spinner */}
                  {isPlacing && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
                      <Loader2 size={20} className="text-white animate-spin" />
                    </div>
                  )}

                  {/* Can't fit overlay */}
                  {cantFit && !isPlacing && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1 rounded-xl">
                      <span className="text-white text-[10px] font-semibold tracking-wide px-2 text-center leading-tight">
                        Can't fit right now
                      </span>
                    </div>
                  )}

                  {/* Title label */}
                  {!cantFit && !isPlacing && (
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1.5">
                      <p className="text-white text-[10px] font-medium truncate">
                        {panel.title ?? 'Untitled'}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}

            {/* New canvas card */}
            <button
              onClick={handleNewCanvas}
              disabled={creatingNew}
              className="w-36 h-28 rounded-xl border-2 border-dashed border-neutral-300 hover:border-espresso/50 bg-neutral-50 hover:bg-neutral-100 shrink-0 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {creatingNew ? (
                <Loader2 size={20} className="text-neutral-400 animate-spin" />
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center">
                    <Plus size={16} className="text-neutral-500" />
                  </div>
                  <span className="text-xs font-medium text-neutral-500">New Canvas</span>
                </>
              )}
            </button>

            {/* Empty state when no library canvases */}
            {libraryPanels.length === 0 && (
              <p className="text-sm text-neutral-400 self-center pl-1">
                Create your first canvas →
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
