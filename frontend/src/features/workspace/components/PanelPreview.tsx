import type { Panel } from '../types/workspace';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/features/canvas/hooks/useCanvasState';
import { HoloStickerEffect } from '@/features/canvas/components/HoloStickerEffect';

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
    const overlayNodes = nodes.filter((n) => n.holo);

    // Contain scale: fit the entire canvas inside the panel (same math as object-fit: contain).
    // Using cover here would crop content that is visible in the editor — use contain to match.
    const scale = Math.min(pw / cw, ph / ch);
    const ox = (pw - cw * scale) / 2;
    const oy = (ph - ch * scale) / 2;

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
        {overlayNodes.map((node) => {
          const left = ((node.x * scale + ox) / pw) * 100;
          const top = ((node.y * scale + oy) / ph) * 100;
          const width = (node.width * scale / pw) * 100;
          const height = (node.height * scale / ph) * 100;

          return (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
                transformOrigin: 'top left',
                transform: `rotate(${node.rotation}deg)`,
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
          );
        })}
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
