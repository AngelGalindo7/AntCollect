import type { CSSProperties } from 'react';
import type { Panel } from '../types/workspace';
import type { CanvasState } from '@/features/canvas/types/canvas';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/features/canvas/hooks/useCanvasState';
import { HoloStickerEffect } from '@/features/canvas/components/HoloStickerEffect';

interface Props {
  panel: Panel;
}

function backgroundStyle(canvas: CanvasState): CSSProperties {
  const { background } = canvas;
  if (background.type === 'gradient') {
    const angle = background.angle ?? 135;
    return {
      background: `linear-gradient(${angle}deg, ${background.value}, ${background.gradientEnd ?? background.value})`,
    };
  }
  return { backgroundColor: background.value };
}

export function PanelPreview({ panel }: Props) {
  const canvas = panel.canvas_json as CanvasState | null;

  if (canvas && canvas.nodes.length > 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#f5f0e8]">
        <div
          className="relative"
          style={{ aspectRatio: '16 / 9', maxWidth: '100%', maxHeight: '100%', width: '100%', ...backgroundStyle(canvas) }}
        >
          {canvas.nodes.map((node) => {
            const left = (node.x / CANVAS_WIDTH) * 100;
            const top = (node.y / CANVAS_HEIGHT) * 100;
            const width = (node.width / CANVAS_WIDTH) * 100;
            const height = (node.height / CANVAS_HEIGHT) * 100;

            const img = (
              <img
                src={node.image_url}
                alt=""
                draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />
            );

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
                {node.holo ? <HoloStickerEffect maskUrl={node.bgRemoved ? node.image_url : undefined}>{img}</HoloStickerEffect> : img}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (panel.preview_path) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#f5f0e8]">
        <img
          src={panel.preview_path}
          className="w-full h-full object-contain"
          alt=""
          draggable={false}
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
