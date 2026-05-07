import type { Panel } from '../types/workspace';
import type { CanvasState } from '@/features/canvas/types/canvas';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/features/canvas/hooks/useCanvasState';
import { HoloStickerEffect } from '@/features/canvas/components/HoloStickerEffect';

interface Props {
  panel: Panel;
}

export function PanelPreview({ panel }: Props) {
  const canvas = panel.canvas_json as CanvasState | null;
  const holoNodes = canvas?.nodes.filter((n) => n.holo) ?? [];
  const cw = canvas?.width ?? CANVAS_WIDTH;
  const ch = canvas?.height ?? CANVAS_HEIGHT;

  if (panel.preview_path) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#f5f0e8]">
        <div
          className="relative"
          style={{ aspectRatio: `${cw} / ${ch}`, maxWidth: '100%', maxHeight: '100%', width: '100%' }}
        >
          <img
            src={panel.preview_path}
            className="absolute inset-0 w-full h-full"
            alt=""
            draggable={false}
          />
          {holoNodes.map((node) => {
            const left = (node.x / cw) * 100;
            const top = (node.y / ch) * 100;
            const width = (node.width / cw) * 100;
            const height = (node.height / ch) * 100;

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
                <HoloStickerEffect maskUrl={node.image_url} variant={node.holoVariant}>
                  <img
                    src={node.image_url}
                    alt=""
                    draggable={false}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  />
                </HoloStickerEffect>
              </div>
            );
          })}
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
