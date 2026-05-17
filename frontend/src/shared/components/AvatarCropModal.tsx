import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  file: File;
  onConfirm: (cropped: File) => void;
  onCancel: () => void;
  outputSize?: number;
  title?: string;
}

interface NaturalSize {
  w: number;
  h: number;
}

const FRAME_PX = 320;
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DEFAULT_OUTPUT = 512;

export function AvatarCropModal({
  file,
  onConfirm,
  onCancel,
  outputSize = DEFAULT_OUTPUT,
  title = 'Position your photo',
}: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<NaturalSize | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  const frameRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number; pxToFrame: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      setOffsetX(0);
      setOffsetY(0);
      setScale(1);
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const cover = natural ? Math.max(FRAME_PX / natural.w, FRAME_PX / natural.h) : 1;
  const drawScale = cover * scale;
  const drawW = natural ? natural.w * drawScale : 0;
  const drawH = natural ? natural.h * drawScale : 0;
  const maxOffsetX = Math.max(0, (drawW - FRAME_PX) / 2);
  const maxOffsetY = Math.max(0, (drawH - FRAME_PX) / 2);
  const clampedOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX));
  const clampedOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY));

  const stateRef = useRef({ scale, offsetX: clampedOffsetX, offsetY: clampedOffsetY, cover, natural });
  stateRef.current = { scale, offsetX: clampedOffsetX, offsetY: clampedOffsetY, cover, natural };

  useEffect(() => {
    const el = frameRef.current;
    if (!el || !natural) return;

    const pxToFrame = () => {
      const rect = el.getBoundingClientRect();
      return rect.width === 0 ? 1 : FRAME_PX / rect.width;
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        ox: stateRef.current.offsetX,
        oy: stateRef.current.offsetY,
        pxToFrame: pxToFrame(),
      };
      setIsDragging(true);
    };

    const onPointerMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setOffsetX(d.ox + (e.clientX - d.startX) * d.pxToFrame);
      setOffsetY(d.oy + (e.clientY - d.startY) * d.pxToFrame);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragRef.current) return;
      try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      dragRef.current = null;
      setIsDragging(false);
    };

    const onWheel = (e: WheelEvent) => {
      const s = stateRef.current;
      if (!s.natural) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;
      const ratio = FRAME_PX / rect.width;
      const cx = (e.clientX - rect.left) * ratio;
      const cy = (e.clientY - rect.top) * ratio;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s.scale * factor));
      if (next === s.scale) return;
      const oldDrawW = s.natural.w * s.cover * s.scale;
      const oldDrawH = s.natural.h * s.cover * s.scale;
      const newDrawW = s.natural.w * s.cover * next;
      const newDrawH = s.natural.h * s.cover * next;
      const oldLeft = (FRAME_PX - oldDrawW) / 2 + s.offsetX;
      const oldTop = (FRAME_PX - oldDrawH) / 2 + s.offsetY;
      const fracX = (cx - oldLeft) / oldDrawW;
      const fracY = (cy - oldTop) / oldDrawH;
      setScale(next);
      setOffsetX(cx - fracX * newDrawW - (FRAME_PX - newDrawW) / 2);
      setOffsetY(cy - fracY * newDrawH - (FRAME_PX - newDrawH) / 2);
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [natural]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleSave = useCallback(async () => {
    const img = imgRef.current;
    if (!img || !natural || saving) return;
    setSaving(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      const frameLeftNat = -((FRAME_PX - drawW) / 2 + clampedOffsetX) / drawScale;
      const frameTopNat = -((FRAME_PX - drawH) / 2 + clampedOffsetY) / drawScale;
      const frameSizeNat = FRAME_PX / drawScale;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        img,
        frameLeftNat,
        frameTopNat,
        frameSizeNat,
        frameSizeNat,
        0,
        0,
        outputSize,
        outputSize,
      );

      const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const ext = mime === 'image/png' ? 'png' : 'jpg';
      const blob: Blob | null = await new Promise((res) =>
        canvas.toBlob(res, mime, mime === 'image/jpeg' ? 0.92 : undefined),
      );
      if (!blob) throw new Error('Failed to encode cropped image');

      const baseName = file.name.replace(/\.[^.]+$/, '') || 'avatar';
      const cropped = new File([blob], `${baseName}-cropped.${ext}`, { type: mime });
      onConfirm(cropped);
    } finally {
      setSaving(false);
    }
  }, [clampedOffsetX, clampedOffsetY, drawH, drawScale, drawW, file, natural, onConfirm, outputSize, saving]);

  const imageLeft = (FRAME_PX - drawW) / 2 + clampedOffsetX;
  const imageTop = (FRAME_PX - drawH) / 2 + clampedOffsetY;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{title}</h2>

        <div
          ref={frameRef}
          className="relative mx-auto overflow-hidden rounded-lg bg-gray-100 select-none"
          style={{
            width: FRAME_PX,
            height: FRAME_PX,
            cursor: natural ? (isDragging ? 'grabbing' : 'grab') : 'default',
            touchAction: 'none',
          }}
        >
          {imageUrl && natural && (
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                left: imageLeft,
                top: imageTop,
                width: drawW,
                height: drawH,
                pointerEvents: 'none',
              }}
            />
          )}

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'rgba(31, 41, 55, 0.55)',
              WebkitMask: 'radial-gradient(circle at center, transparent 49.7%, black 50%)',
              mask: 'radial-gradient(circle at center, transparent 49.7%, black 50%)',
            }}
          />

          <div
            className="pointer-events-none absolute inset-0 rounded-full border border-white/70"
            style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.15) inset' }}
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-gray-500" aria-hidden>−</span>
          <input
            type="range"
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.01}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="flex-1 accent-blue-500"
            aria-label="Zoom"
            disabled={!natural}
          />
          <span className="text-xs text-gray-500" aria-hidden>+</span>
        </div>

        <p className="mt-2 text-xs text-gray-500 text-center">Drag to move · scroll or slide to zoom</p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-gray-600 hover:text-gray-800 font-medium px-3 py-1.5 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!natural || saving}
            className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-md transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
