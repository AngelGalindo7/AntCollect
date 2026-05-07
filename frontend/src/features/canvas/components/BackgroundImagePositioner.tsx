import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

export interface BackgroundImagePosition {
  offsetX: number;
  offsetY: number;
  scale: number;
}

interface Props {
  imageUrl: string;
  frameWidth: number;
  frameHeight: number;
  initial?: BackgroundImagePosition;
  title?: string;
  onCancel: () => void;
  onApply: (position: BackgroundImagePosition) => void;
}

const PREVIEW_MAX_WIDTH = 720;
const PREVIEW_MAX_HEIGHT = 480;

export function BackgroundImagePositioner({
  imageUrl,
  frameWidth,
  frameHeight,
  initial,
  title = 'Position background image',
  onCancel,
  onApply,
}: Props) {
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [offsetX, setOffsetX] = useState(initial?.offsetX ?? 0);
  const [offsetY, setOffsetY] = useState(initial?.offsetY ?? 0);
  const [scale, setScale] = useState(initial?.scale ?? 1);
  const previewRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const [previewBox, setPreviewBox] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
  }, [imageUrl]);

  useLayoutEffect(() => {
    const aspect = frameWidth / frameHeight;
    let w = PREVIEW_MAX_WIDTH;
    let h = w / aspect;
    if (h > PREVIEW_MAX_HEIGHT) {
      h = PREVIEW_MAX_HEIGHT;
      w = h * aspect;
    }
    setPreviewBox({ width: w, height: h });
  }, [frameWidth, frameHeight]);

  const previewToFrame = previewBox.width / frameWidth;

  const cover = useMemo(() => {
    if (!naturalSize) return 1;
    return Math.max(frameWidth / naturalSize.w, frameHeight / naturalSize.h);
  }, [naturalSize, frameWidth, frameHeight]);

  const drawW = naturalSize ? naturalSize.w * cover * scale : 0;
  const drawH = naturalSize ? naturalSize.h * cover * scale : 0;

  const maxOffsetX = Math.max(0, (drawW - frameWidth) / 2);
  const maxOffsetY = Math.max(0, (drawH - frameHeight) / 2);
  const clampedOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX));
  const clampedOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY));

  const previewDrawW = drawW * previewToFrame;
  const previewDrawH = drawH * previewToFrame;
  const previewLeft = (previewBox.width - previewDrawW) / 2 + clampedOffsetX * previewToFrame;
  const previewTop = (previewBox.height - previewDrawH) / 2 + clampedOffsetY * previewToFrame;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      ox: clampedOffsetX,
      oy: clampedOffsetY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = (e.clientX - dragRef.current.startX) / previewToFrame;
    const dy = (e.clientY - dragRef.current.startY) / previewToFrame;
    setOffsetX(dragRef.current.ox + dx);
    setOffsetY(dragRef.current.oy + dy);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      dragRef.current = null;
    }
  };

  const handleApply = () => {
    onApply({
      offsetX: clampedOffsetX,
      offsetY: clampedOffsetY,
      scale,
    });
  };

  const overlay: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 10000,
    background: 'rgba(28, 26, 22, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  };

  const panel: CSSProperties = {
    background: 'var(--pw-paper)',
    border: '1px solid var(--pw-line)',
    borderRadius: 14,
    boxShadow: '0 30px 80px rgba(0,0,0,.25)',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    maxWidth: PREVIEW_MAX_WIDTH + 48,
    width: '100%',
  };

  const content = (
    <div className="paper-workshop" style={overlay} onClick={onCancel}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="pw-display" style={{ fontSize: 18, color: 'var(--pw-ink)' }}>
              {title}
            </span>
            <span style={{ fontSize: 12, color: 'var(--pw-ink3)' }}>
              Drag to reposition · use the slider to zoom
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              color: 'var(--pw-ink2)',
            }}
            title="Cancel"
          >
            <X size={16} strokeWidth={1.6} />
          </button>
        </div>

        <div
          ref={previewRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            position: 'relative',
            width: previewBox.width,
            height: previewBox.height,
            margin: '0 auto',
            background: '#f6f1e6',
            border: '1px solid var(--pw-line)',
            borderRadius: 6,
            overflow: 'hidden',
            cursor: dragRef.current ? 'grabbing' : 'grab',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          {naturalSize && (
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                left: previewLeft,
                top: previewTop,
                width: previewDrawW,
                height: previewDrawH,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              boxShadow: 'inset 0 0 0 1px rgba(28,26,22,0.06)',
              pointerEvents: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--pw-ink2)', fontWeight: 500 }}>Zoom</span>
            <span className="pw-mono" style={{ fontSize: 11, color: 'var(--pw-ink3)' }}>
              {scale.toFixed(2)}×
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              height: 34,
              padding: '0 14px',
              background: 'transparent',
              color: 'var(--pw-ink2)',
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 8,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!naturalSize}
            style={{
              height: 34,
              padding: '0 18px',
              background: 'var(--pw-ink)',
              color: 'var(--pw-paper)',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              opacity: naturalSize ? 1 : 0.5,
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
