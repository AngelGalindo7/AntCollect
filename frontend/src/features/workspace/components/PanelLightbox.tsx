import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Panel } from '../types/workspace';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/features/canvas/hooks/useCanvasState';
import { InteractiveOverlay } from './InteractiveOverlay';
import { CanvasDomPreview } from '@/features/canvas/components/CanvasDomPreview';

interface Props {
  panel: Panel;
  onClose: () => void;
  onOpenPost?: (postId: number) => void;
}

// Full-screen expansion of a single showcase panel. Primary render: baked PNG + live
// InteractiveOverlay (holo shimmer + post hotspots). CanvasDomPreview is a fallback
// for the rare case where canvas_json exists but preview upload failed mid-save.
export function PanelLightbox({ panel, onClose, onOpenPost }: Props) {
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

  const contentW = cw * scale;
  const contentH = ch * scale;

  let content: React.ReactNode = null;
  if (panel.preview_path) {
    content = (
      <div style={{ position: 'relative', width: contentW, height: contentH }}>
        <img
          src={panel.preview_path}
          alt={panel.title ?? ''}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
        <InteractiveOverlay
          nodes={nodes}
          canvasW={cw}
          canvasH={ch}
          onOpenPost={onOpenPost}
        />
      </div>
    );
  } else if (nodes.length > 0) {
    // Fallback: canvas JSON present but preview not yet uploaded.
    content = (
      <CanvasDomPreview width={cw} height={ch} background={canvas?.background} nodes={nodes} scale={scale} />
    );
  }

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

      {content && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}
        >
          {content}
        </div>
      )}

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
