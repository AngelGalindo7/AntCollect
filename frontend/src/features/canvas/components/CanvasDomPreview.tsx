import { useEffect, useState, type CSSProperties } from 'react';
import type { BackgroundConfig, CanvasNode } from '../types/canvas';
import { HoloStickerEffect } from './HoloStickerEffect';

// Replicates BackgroundImageLayer's cover+offset+scale math in DOM/CSS space.
// panelScale converts bg.imageOffsetX/Y from canvas logical pixels to container CSS pixels.
// Loads natural size via new Image() so we don't miss the load event for cached images
// (React's onLoad on <img> can fire before the handler attaches when the resource is cached).
function ImageBg({ bg, containerW, containerH, panelScale }: {
  bg: BackgroundConfig;
  containerW: number;
  containerH: number;
  panelScale: number;
}) {
  const [nat, setNat] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!bg.imageUrl) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!cancelled) setNat([img.naturalWidth, img.naturalHeight]);
    };
    img.src = bg.imageUrl;
    if (img.complete && img.naturalWidth > 0) {
      setNat([img.naturalWidth, img.naturalHeight]);
    }
    return () => { cancelled = true; };
  }, [bg.imageUrl]);

  if (!bg.imageUrl) return null;

  if (!nat) {
    return (
      <img
        src={bg.imageUrl}
        alt=""
        draggable={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
    );
  }

  const [natW, natH] = nat;
  const imgScale = bg.imageScale ?? 1;
  const cover = Math.max(containerW / natW, containerH / natH);
  const drawW = natW * cover * imgScale;
  const drawH = natH * cover * imgScale;
  const left = (containerW - drawW) / 2 + (bg.imageOffsetX ?? 0) * panelScale;
  const top = (containerH - drawH) / 2 + (bg.imageOffsetY ?? 0) * panelScale;
  return (
    <img
      src={bg.imageUrl}
      alt=""
      draggable={false}
      style={{ position: 'absolute', left, top, width: drawW, height: drawH }}
    />
  );
}

function bgToCss(bg: BackgroundConfig | undefined): CSSProperties {
  if (!bg) return { background: '#f5f0e8' };
  if (bg.type === 'gradient') {
    return { background: `linear-gradient(135deg, ${bg.value}, ${bg.gradientEnd ?? '#ffffff'})` };
  }
  if (bg.type === 'image') return { background: '#f6f1e6' };
  return { background: bg.value };
}

interface Props {
  width: number;
  height: number;
  background: BackgroundConfig | undefined;
  nodes: CanvasNode[];
  scale: number;
}

// Renders a canvas's background + nodes as live DOM, sized width*scale × height*scale.
// Holo nodes are wrapped in HoloStickerEffect so the shimmer responds to hover — this is
// the only way to place the effect at its correct z-layer (a flat PNG can't), and it lets
// the editor and the public showcase share one renderer.
export function CanvasDomPreview({ width, height, background, nodes, scale }: Props) {
  const w = width * scale;
  const h = height * scale;
  return (
    <div style={{ position: 'relative', width: w, height: h, overflow: 'hidden', ...bgToCss(background) }}>
      {background?.type === 'image' && background.imageUrl && (
        <ImageBg bg={background} containerW={w} containerH={h} panelScale={scale} />
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
                style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
              />
            </HoloStickerEffect>
          ) : (
            <img
              src={node.image_url}
              alt=""
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
