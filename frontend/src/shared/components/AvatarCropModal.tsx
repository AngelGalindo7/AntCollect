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

const WORKING = 380;
const FRAME_PX = 220;
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
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  const workingRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number; ratio: number } | null>(null);

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
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const coverCircle = natural ? FRAME_PX / Math.min(natural.w, natural.h) : 1;
  const fitWorking = natural ? WORKING / Math.max(natural.w, natural.h) : 1;
  const drawScale = Math.max(coverCircle, fitWorking);
  const drawW = natural ? natural.w * drawScale : 0;
  const drawH = natural ? natural.h * drawScale : 0;

  const maxOffsetX = Math.max(0, (drawW - FRAME_PX) / 2);
  const maxOffsetY = Math.max(0, (drawH - FRAME_PX) / 2);
  const clampedOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX));
  const clampedOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY));

  const stateRef = useRef({ offsetX: clampedOffsetX, offsetY: clampedOffsetY });
  stateRef.current = { offsetX: clampedOffsetX, offsetY: clampedOffsetY };

  useEffect(() => {
    const el = workingRef.current;
    if (!el || !natural) return;

    const computeRatio = () => {
      const rect = el.getBoundingClientRect();
      return rect.width === 0 ? 1 : WORKING / rect.width;
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        ox: stateRef.current.offsetX,
        oy: stateRef.current.offsetY,
        ratio: computeRatio(),
      };
      setIsDragging(true);
    };

    const onPointerMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setOffsetX(d.ox + (e.clientX - d.startX) * d.ratio);
      setOffsetY(d.oy + (e.clientY - d.startY) * d.ratio);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragRef.current) return;
      try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      dragRef.current = null;
      setIsDragging(false);
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
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

      const imageLeft = (WORKING - drawW) / 2 + clampedOffsetX;
      const imageTop = (WORKING - drawH) / 2 + clampedOffsetY;
      const circleLeft = (WORKING - FRAME_PX) / 2;
      const circleTop = (WORKING - FRAME_PX) / 2;
      const srcX = (circleLeft - imageLeft) / drawScale;
      const srcY = (circleTop - imageTop) / drawScale;
      const srcSize = FRAME_PX / drawScale;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, outputSize, outputSize);

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

  const imageLeft = (WORKING - drawW) / 2 + clampedOffsetX;
  const imageTop = (WORKING - drawH) / 2 + clampedOffsetY;
  const overlayLeft = (WORKING - FRAME_PX) / 2;
  const overlayTop = (WORKING - FRAME_PX) / 2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl p-5 max-w-[calc(100vw-2rem)] overflow-auto">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{title}</h2>

        <div
          ref={workingRef}
          className="relative mx-auto overflow-hidden bg-white rounded-lg select-none"
          style={{
            width: WORKING,
            height: WORKING,
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
            className="pointer-events-none absolute"
            style={{
              left: overlayLeft,
              top: overlayTop,
              width: FRAME_PX,
              height: FRAME_PX,
              background: 'rgba(31, 41, 55, 0.55)',
              WebkitMask: 'radial-gradient(circle closest-side, transparent 99.5%, black 100%)',
              mask: 'radial-gradient(circle closest-side, transparent 99.5%, black 100%)',
            }}
          />
          <div
            className="pointer-events-none absolute rounded-full border border-white/80"
            style={{
              left: overlayLeft,
              top: overlayTop,
              width: FRAME_PX,
              height: FRAME_PX,
            }}
          />
        </div>

        <p className="mt-3 text-xs text-gray-500 text-center">Drag the picture to position it inside the circle</p>

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
