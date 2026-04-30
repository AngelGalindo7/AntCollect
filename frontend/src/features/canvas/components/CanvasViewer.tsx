import React from 'react';
import { HoloStickerEffect } from './HoloStickerEffect';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../hooks/useCanvasState';
import type { CanvasState } from '../types/canvas';

interface Props {
  canvasData: CanvasState | null;
  previewPath: string | null;
  isOwner?: boolean;
  onEditClick?: () => void;
}

function getBackground(canvasData: CanvasState): React.CSSProperties {
  const { background } = canvasData;
  if (background.type === 'gradient') {
    const angle = background.angle ?? 135;
    return { background: `linear-gradient(${angle}deg, ${background.value}, ${background.gradientEnd ?? background.value})` };
  }
  return { backgroundColor: background.value };
}

export function CanvasViewer({ canvasData, previewPath, isOwner, onEditClick }: Props) {
  if (!canvasData && !previewPath && !isOwner) return null;

  const editButton = isOwner && onEditClick ? (
    <button
      onClick={onEditClick}
      className="absolute top-3 right-3 z-10 bg-white/80 hover:bg-white text-espresso text-xs font-semibold px-3 py-1.5 rounded-lg shadow transition-colors"
    >
      Edit Canvas
    </button>
  ) : null;

  if (canvasData) {
    const bgStyle = getBackground(canvasData);
    return (
      <div
        className="relative w-full flex flex-col justify-center overflow-hidden"
        style={{ height: '100vh', ...bgStyle }}
      >
        <div className="relative w-full" style={{ aspectRatio: '16/9', ...bgStyle }}>
          {canvasData.nodes.map((node) => {
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
                {node.holo ? <HoloStickerEffect>{img}</HoloStickerEffect> : img}
              </div>
            );
          })}
        </div>
        {editButton}
      </div>
    );
  }

  if (previewPath) {
    return (
      <div className="relative w-full overflow-hidden" style={{ height: '100vh' }}>
        <img src={previewPath} alt="Sticker showcase" className="w-full h-full object-cover" />
        {editButton}
      </div>
    );
  }

  // Owner, no canvas yet
  return (
    <button
      onClick={onEditClick}
      className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-warm-gray/40 hover:border-warm-gray/70 text-warm-gray/60 hover:text-warm-gray/90 transition-colors"
      style={{ height: '100vh' }}
    >
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
      </svg>
      <span className="text-sm font-medium">Create your showcase</span>
      <span className="text-xs">Arrange your stickers into a canvas</span>
    </button>
  );
}
