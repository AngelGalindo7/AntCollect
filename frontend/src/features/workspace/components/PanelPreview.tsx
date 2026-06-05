import type { Panel } from '../types/workspace';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/features/canvas/hooks/useCanvasState';
import { CanvasDomPreview } from '@/features/canvas/components/CanvasDomPreview';

interface Props {
  panel: Panel;
}

export function PanelPreview({ panel }: Props) {
  const canvas = panel.canvas_json;
  const cw = canvas?.width ?? CANVAS_WIDTH;
  const ch = canvas?.height ?? CANVAS_HEIGHT;
  const pw = panel.w;
  const ph = panel.h;

  if (panel.preview_path) {
    const nodes = canvas?.nodes ?? [];
    const hasHolo = nodes.some((n) => n.holo);

    // Contain scale: fit the entire canvas inside the panel (same math as object-fit: contain).
    const scale = Math.min(pw / cw, ph / ch);
    const ox = (pw - cw * scale) / 2;
    const oy = (ph - ch * scale) / 2;

    const bg = canvas?.background;
    const letterboxColor = bg?.type === 'image' ? '#f6f1e6' : (bg?.value ?? '#f5f0e8');

    if (!hasHolo) {
      // No holo nodes — the rendered PNG is accurate and sufficient.
      return (
        <div className="w-full h-full relative overflow-hidden" style={{ background: letterboxColor }}>
          <img
            src={panel.preview_path}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'contain' }}
            alt=""
            draggable={false}
          />
        </div>
      );
    }

    // Has holo nodes — render nodes as live DOM so the shimmer sits at its correct layer
    // (a flat PNG can't host an overlay below other nodes).
    return (
      <div className="w-full h-full relative overflow-hidden" style={{ background: letterboxColor }}>
        <div style={{ position: 'absolute', left: ox, top: oy }}>
          <CanvasDomPreview width={cw} height={ch} background={bg} nodes={nodes} scale={scale} />
        </div>
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
