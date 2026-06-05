import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Panel } from '../types/workspace';
import { CanvasDomPreview } from '@/features/canvas/components/CanvasDomPreview';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/features/canvas/hooks/useCanvasState';

interface Props {
  panel: Panel;
  onClose: () => void;
}

// Full-screen expansion of a single showcase canvas. Renders via CanvasDomPreview at
// large scale so the holo shimmer + tilt are live here — this is the payoff that turns
// the public showcase from a flat screenshot into something you interact with.
export function PanelLightbox({ panel, onClose }: Props) {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const canvas = panel.canvas_json;
  const cw = canvas?.width ?? CANVAS_WIDTH;
  const ch = canvas?.height ?? CANVAS_HEIGHT;
  const nodes = canvas?.nodes ?? [];

  // Fit the canvas inside the viewport, never upscaling past its natural pixel size.
  const scale = Math.min((vp.w * 0.92) / cw, (vp.h * 0.86) / ch, 1);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(20,18,15,0.82)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 38,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.12)',
          color: '#fff',
        }}
      >
        <X size={18} />
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}
      >
        {nodes.length > 0 ? (
          <CanvasDomPreview width={cw} height={ch} background={canvas?.background} nodes={nodes} scale={scale} />
        ) : panel.preview_path ? (
          <img
            src={panel.preview_path}
            alt={panel.title ?? ''}
            draggable={false}
            style={{ width: cw * scale, height: ch * scale, objectFit: 'contain', display: 'block' }}
          />
        ) : null}
      </div>

      {panel.title && (
        <p
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 22,
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {panel.title}
        </p>
      )}
    </div>,
    document.body,
  );
}
