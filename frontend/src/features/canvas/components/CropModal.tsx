import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Check } from 'lucide-react';

type DragHandle = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface CropRect { x: number; y: number; w: number; h: number; }

interface Props {
  imageUrl: string;
  onConfirm: (newUrl: string) => void;
  onCancel: () => void;
  onUpload: (file: File) => Promise<string>;
}

const MAX_W = 720;
const MAX_H = 480;
const MIN_CROP = 20;

const HANDLE_CURSORS: Record<DragHandle, string> = {
  move: 'move',
  nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize',
  e: 'ew-resize', se: 'nwse-resize', s: 'ns-resize',
  sw: 'nesw-resize', w: 'ew-resize',
};

const HANDLES: { id: DragHandle; style: React.CSSProperties }[] = [
  { id: 'nw', style: { top: -5, left: -5 } },
  { id: 'n',  style: { top: -5, left: '50%', transform: 'translateX(-50%)' } },
  { id: 'ne', style: { top: -5, right: -5 } },
  { id: 'e',  style: { top: '50%', right: -5, transform: 'translateY(-50%)' } },
  { id: 'se', style: { bottom: -5, right: -5 } },
  { id: 's',  style: { bottom: -5, left: '50%', transform: 'translateX(-50%)' } },
  { id: 'sw', style: { bottom: -5, left: -5 } },
  { id: 'w',  style: { top: '50%', left: -5, transform: 'translateY(-50%)' } },
];

export function CropModal({ imageUrl, onConfirm, onCancel, onUpload }: Props) {
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number } | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [cropRect, setCropRect] = useState<CropRect>({ x: 0, y: 0, w: 0, h: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dragRef = useRef<{ handle: DragHandle; startX: number; startY: number; initRect: CropRect } | null>(null);
  const displaySizeRef = useRef<{ w: number; h: number } | null>(null);
  const cropRectRef = useRef<CropRect>({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => { displaySizeRef.current = displaySize; }, [displaySize]);
  useEffect(() => { cropRectRef.current = cropRect; }, [cropRect]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current || !displaySizeRef.current) return;
      const { handle, startX, startY, initRect } = dragRef.current;
      const { w: maxW, h: maxH } = displaySizeRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let left = initRect.x;
      let top  = initRect.y;
      let right  = initRect.x + initRect.w;
      let bottom = initRect.y + initRect.h;

      if (handle === 'move') {
        left  = Math.max(0, Math.min(initRect.x + dx, maxW - initRect.w));
        top   = Math.max(0, Math.min(initRect.y + dy, maxH - initRect.h));
        right  = left + initRect.w;
        bottom = top  + initRect.h;
      } else {
        if (handle.includes('n')) top    = Math.max(0,    Math.min(initRect.y + dy,           bottom - MIN_CROP));
        if (handle.includes('s')) bottom = Math.min(maxH, Math.max(initRect.y + initRect.h + dy, top + MIN_CROP));
        if (handle.includes('w')) left   = Math.max(0,    Math.min(initRect.x + dx,           right - MIN_CROP));
        if (handle.includes('e')) right  = Math.min(maxW, Math.max(initRect.x + initRect.w + dx, left + MIN_CROP));
      }

      setCropRect({ x: left, y: top, w: right - left, h: bottom - top });
    };

    const onUp = () => { dragRef.current = null; };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    setNaturalSize({ w: natW, h: natH });
    const scale = Math.min(MAX_W / natW, MAX_H / natH, 1);
    const dispW = Math.round(natW * scale);
    const dispH = Math.round(natH * scale);
    setDisplaySize({ w: dispW, h: dispH });
    setCropRect({ x: 0, y: 0, w: dispW, h: dispH });
  };

  const handlePointerDown = (e: React.PointerEvent, handle: DragHandle) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      initRect: { ...cropRectRef.current },
    };
  };

  const handleConfirm = async () => {
    if (!naturalSize || !displaySize) return;
    setIsProcessing(true);
    setError(null);
    try {
      const scaleX = naturalSize.w / displaySize.w;
      const scaleY = naturalSize.h / displaySize.h;
      const srcX = Math.round(cropRect.x * scaleX);
      const srcY = Math.round(cropRect.y * scaleY);
      const srcW = Math.max(1, Math.round(cropRect.w * scaleX));
      const srcH = Math.max(1, Math.round(cropRect.h * scaleY));

      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image failed to load — CORS may be blocking it'));
        img.src = imageUrl;
      });

      const offCanvas = document.createElement('canvas');
      offCanvas.width  = srcW;
      offCanvas.height = srcH;
      const ctx = offCanvas.getContext('2d')!;
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

      const blob = await new Promise<Blob>((resolve, reject) => {
        offCanvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to produce image data'));
        }, 'image/png');
      });

      const file = new File([blob], 'cropped.png', { type: 'image/png' });
      const newUrl = await onUpload(file);
      onConfirm(newUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Crop failed — try again');
    } finally {
      setIsProcessing(false);
    }
  };

  const content = (
    <div className="fixed inset-0 z-[99999] bg-black/65 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col gap-4 p-5 max-w-[90vw]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-700">Crop Image</h2>
          <button
            onClick={onCancel}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Image + crop overlay */}
        <div
          style={{
            position: 'relative',
            width: displaySize?.w ?? 240,
            height: displaySize?.h ?? 160,
            background: '#e5e5e5',
            borderRadius: 8,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <img
            src={imageUrl}
            crossOrigin="anonymous"
            onLoad={handleImageLoad}
            style={{
              display: 'block',
              width: displaySize?.w,
              height: displaySize?.h,
              userSelect: 'none',
              pointerEvents: 'none',
            }}
            alt="Crop preview"
          />

          {displaySize && (
            <>
              {/* Dimmed regions outside crop */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: cropRect.y, background: 'rgba(0,0,0,0.45)' }} />
                <div style={{ position: 'absolute', top: cropRect.y + cropRect.h, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)' }} />
                <div style={{ position: 'absolute', top: cropRect.y, left: 0, width: cropRect.x, height: cropRect.h, background: 'rgba(0,0,0,0.45)' }} />
                <div style={{ position: 'absolute', top: cropRect.y, left: cropRect.x + cropRect.w, right: 0, height: cropRect.h, background: 'rgba(0,0,0,0.45)' }} />
              </div>

              {/* Crop rectangle */}
              <div
                style={{
                  position: 'absolute',
                  left: cropRect.x, top: cropRect.y,
                  width: cropRect.w, height: cropRect.h,
                  border: '1.5px solid white',
                  boxSizing: 'border-box',
                  cursor: 'move',
                }}
                onPointerDown={(e) => handlePointerDown(e, 'move')}
              >
                {/* Rule-of-thirds lines */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: '33.33%', width: 1, background: 'rgba(255,255,255,0.3)' }} />
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: '66.66%', width: 1, background: 'rgba(255,255,255,0.3)' }} />
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '33.33%', height: 1, background: 'rgba(255,255,255,0.3)' }} />
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '66.66%', height: 1, background: 'rgba(255,255,255,0.3)' }} />
                </div>

                {/* Resize handles */}
                {HANDLES.map(({ id, style }) => (
                  <div
                    key={id}
                    style={{
                      position: 'absolute',
                      width: 10, height: 10,
                      background: 'white',
                      border: '1.5px solid rgba(0,0,0,0.25)',
                      borderRadius: 2,
                      cursor: HANDLE_CURSORS[id],
                      ...style,
                    }}
                    onPointerDown={(e) => handlePointerDown(e, id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {error && <p className="text-red-500 text-xs">{error}</p>}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded-full text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing || !displaySize}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-espresso text-white text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
          >
            {isProcessing ? 'Cropping…' : (
              <>
                <Check size={13} />
                Apply Crop
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
