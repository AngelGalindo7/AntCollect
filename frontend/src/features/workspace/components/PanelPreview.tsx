import type { Panel } from '../types/workspace';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/features/canvas/hooks/useCanvasState';
import { InteractiveOverlay } from './InteractiveOverlay';

interface Props {
  panel: Panel;
  onOpenPost?: (postId: number) => void;
}

// Renders the panel thumbnail as a single baked PNG request (no per-sticker fetches).
// InteractiveOverlay sits on top and adds holo shimmer + post hotspots from canvas_json
// geometry — it carries no images, so the PNG is never double-fetched.
export function PanelPreview({ panel, onOpenPost }: Props) {
  const canvas = panel.canvas_json;
  const cw = canvas?.width ?? CANVAS_WIDTH;
  const ch = canvas?.height ?? CANVAS_HEIGHT;

  if (panel.preview_path) {
    const bg = canvas?.background;
    const letterboxColor = bg?.type === 'image' ? '#f6f1e6' : (bg?.value ?? '#f5f0e8');

    return (
      <div className="w-full h-full relative overflow-hidden" style={{ background: letterboxColor }}>
        <img
          src={panel.preview_path}
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'contain' }}
          alt=""
          draggable={false}
        />
        <InteractiveOverlay
          nodes={canvas?.nodes ?? []}
          canvasW={cw}
          canvasH={ch}
          onOpenPost={onOpenPost}
        />
      </div>
    );
  }

  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #f5f0eb 0%, #e8e0d8 100%)' }}
    >
      <p className="text-neutral-300 text-xs select-none">No preview yet</p>
    </div>
  );
}
