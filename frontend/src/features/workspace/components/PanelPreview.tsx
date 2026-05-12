import type { Panel } from '../types/workspace';
import type { BackgroundConfig } from '@/features/canvas/types/canvas';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/features/canvas/hooks/useCanvasState';
import { HoloStickerEffect } from '@/features/canvas/components/HoloStickerEffect';

interface Props {
  panel: Panel;
}

function bgToCss(bg: BackgroundConfig | undefined): React.CSSProperties {
  if (!bg) return { background: '#f5f0e8' };
  if (bg.type === 'gradient') {
    return { background: `linear-gradient(135deg, ${bg.value}, ${bg.gradientEnd ?? '#ffffff'})` };
  }
  if (bg.type === 'image') return { background: '#f6f1e6' };
  return { background: bg.value };
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
      // No holo nodes — PNG is accurate and sufficient.
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

    // Has holo nodes — skip the PNG and render all nodes as DOM elements in z-order.
    // This is the only way to place the holo shimmer effect at its correct layer:
    // the PNG is a flat image, so any overlay always ends up above everything in it.
    return (
      <div className="w-full h-full relative overflow-hidden" style={{ background: letterboxColor }}>
        <div
          style={{
            position: 'absolute',
            left: ox,
            top: oy,
            width: cw * scale,
            height: ch * scale,
            overflow: 'hidden',
            ...bgToCss(bg),
          }}
        >
          {bg?.type === 'image' && bg.imageUrl && (
            <img
              src={bg.imageUrl}
              alt=""
              draggable={false}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
          {nodes.map((node) => (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                left: node.x * scale,
                top: node.y * scale,
                width: node.width * scale,
                height: node.height * scale,
                transformOrigin: 'top left',
                transform: `rotate(${node.rotation}deg)`,
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.18))',
              }}
            >
              {node.holo ? (
                <HoloStickerEffect maskUrl={node.image_url} variant={node.holoVariant}>
                  <img
                    src={node.image_url}
                    alt=""
                    draggable={false}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  />
                </HoloStickerEffect>
              ) : (
                <img
                  src={node.image_url}
                  alt=""
                  draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                />
              )}
            </div>
          ))}
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
