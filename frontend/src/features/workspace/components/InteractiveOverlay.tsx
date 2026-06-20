import { useLayoutEffect, useRef, useState } from 'react';
import type { CanvasNode } from '@/features/canvas/types/canvas';
import { HoloStickerEffect } from '@/features/canvas/components/HoloStickerEffect';

interface Props {
  nodes: CanvasNode[];
  canvasW: number;
  canvasH: number;
  // Omit to suppress post hotspots (e.g. owner workspace where panel click = open editor).
  onOpenPost?: (postId: number) => void;
}

// Sits over the baked panel PNG and adds only what a PNG can't carry:
//   • holo shimmer (CSS animation responding to mouse position)
//   • clickable hotspots for post-backed stickers
//
// Uses ResizeObserver to measure its own rendered size so the contain-math is correct
// regardless of workspace zoom — no coordinate system assumptions from the parent.
export function InteractiveOverlay({ nodes, canvasW, canvasH, onOpenPost }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Only render nodes that have holo shimmer OR a post hotspot when a handler is given.
  const interactive = nodes.filter(
    (n) => n.holo === true || (n.postId != null && onOpenPost != null),
  );

  let items: React.ReactNode = null;
  if (size && interactive.length > 0) {
    const scale = Math.min(size.w / canvasW, size.h / canvasH);
    const ox = (size.w - canvasW * scale) / 2;
    const oy = (size.h - canvasH * scale) / 2;

    items = interactive.map((node) => {
      const left = ox + node.x * scale;
      const top = oy + node.y * scale;
      const width = node.width * scale;
      const height = node.height * scale;
      const flip = node.flipX ? ' scaleX(-1)' : '';
      const baseStyle: React.CSSProperties = {
        position: 'absolute',
        left,
        top,
        width,
        height,
        transformOrigin: 'top left',
        transform: `rotate(${node.rotation}deg)${flip}`,
        pointerEvents: 'auto',
      };

      const holoChild = (
        <HoloStickerEffect maskUrl={node.image_url} variant={node.holoVariant}>
          <img
            src={node.image_url}
            alt=""
            draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
          />
        </HoloStickerEffect>
      );

      if (node.holo && node.postId != null && onOpenPost) {
        return (
          <div key={node.id} style={baseStyle}>
            <button
              type="button"
              style={{ display: 'block', width: '100%', height: '100%', padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onOpenPost(node.postId!); }}
            >
              {holoChild}
            </button>
          </div>
        );
      }

      if (node.holo) {
        return <div key={node.id} style={baseStyle}>{holoChild}</div>;
      }

      // Post-only hotspot — transparent clickable region over the baked sticker.
      return (
        <button
          key={node.id}
          type="button"
          aria-label="Open post"
          style={{ ...baseStyle, padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onOpenPost!(node.postId!); }}
        />
      );
    });
  }

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {items}
    </div>
  );
}
