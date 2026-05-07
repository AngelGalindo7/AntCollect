import { useCallback, useEffect, useRef, useState } from 'react';
import type { BackgroundImagePosition } from '@/shared/utils/profileBackground';

interface NaturalSize {
  w: number;
  h: number;
}

interface Options {
  imageUrl: string;
  frameWidth: number;
  frameHeight: number;
  enabled: boolean;
  initial?: BackgroundImagePosition;
}

interface Result {
  attachFrameRef: (el: HTMLElement | null) => void;
  naturalSize: NaturalSize | null;
  position: BackgroundImagePosition;
  isDragging: boolean;
}

const MIN_SCALE = 1;
const MAX_SCALE = 3;

export function useBackgroundPositioning({
  imageUrl,
  frameWidth,
  frameHeight,
  enabled,
  initial,
}: Options): Result {
  const [naturalSize, setNaturalSize] = useState<NaturalSize | null>(null);
  const [offsetX, setOffsetX] = useState(initial?.offsetX ?? 0);
  const [offsetY, setOffsetY] = useState(initial?.offsetY ?? 0);
  const [scale, setScale] = useState(initial?.scale ?? 1);
  const [isDragging, setIsDragging] = useState(false);

  const frameElRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number; pxToFrame: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!cancelled) setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const cover = naturalSize
    ? Math.max(frameWidth / naturalSize.w, frameHeight / naturalSize.h)
    : 1;

  const drawW = naturalSize ? naturalSize.w * cover * scale : 0;
  const drawH = naturalSize ? naturalSize.h * cover * scale : 0;
  const maxOffsetX = Math.max(0, (drawW - frameWidth) / 2);
  const maxOffsetY = Math.max(0, (drawH - frameHeight) / 2);
  const clampedOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX));
  const clampedOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY));

  const stateRef = useRef({
    scale,
    offsetX: clampedOffsetX,
    offsetY: clampedOffsetY,
    cover,
    naturalSize,
    frameWidth,
    frameHeight,
  });
  stateRef.current = {
    scale,
    offsetX: clampedOffsetX,
    offsetY: clampedOffsetY,
    cover,
    naturalSize,
    frameWidth,
    frameHeight,
  };

  useEffect(() => {
    const el = frameElRef.current;
    if (!el || !enabled) return;

    const pxToFrame = () => {
      const rect = el.getBoundingClientRect();
      return rect.width === 0 ? 1 : frameWidth / rect.width;
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
      const drag = dragRef.current;
      if (!drag) return;
      const dx = (e.clientX - drag.startX) * drag.pxToFrame;
      const dy = (e.clientY - drag.startY) * drag.pxToFrame;
      setOffsetX(drag.ox + dx);
      setOffsetY(drag.oy + dy);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (dragRef.current) {
        try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        dragRef.current = null;
        setIsDragging(false);
      }
    };

    const onWheel = (e: WheelEvent) => {
      const s = stateRef.current;
      if (!s.naturalSize) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;
      const ratio = s.frameWidth / rect.width;
      const cursorFrameX = (e.clientX - rect.left) * ratio;
      const cursorFrameY = (e.clientY - rect.top) * ratio;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s.scale * factor));
      if (nextScale === s.scale) return;
      const oldDrawW = s.naturalSize.w * s.cover * s.scale;
      const oldDrawH = s.naturalSize.h * s.cover * s.scale;
      const newDrawW = s.naturalSize.w * s.cover * nextScale;
      const newDrawH = s.naturalSize.h * s.cover * nextScale;
      const oldImageLeft = (s.frameWidth - oldDrawW) / 2 + s.offsetX;
      const oldImageTop = (s.frameHeight - oldDrawH) / 2 + s.offsetY;
      const fracX = (cursorFrameX - oldImageLeft) / oldDrawW;
      const fracY = (cursorFrameY - oldImageTop) / oldDrawH;
      setScale(nextScale);
      setOffsetX(cursorFrameX - fracX * newDrawW - (s.frameWidth - newDrawW) / 2);
      setOffsetY(cursorFrameY - fracY * newDrawH - (s.frameHeight - newDrawH) / 2);
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
  }, [enabled, frameWidth, frameHeight]);

  const attachFrameRef = useCallback((el: HTMLElement | null) => {
    frameElRef.current = el;
  }, []);

  return {
    attachFrameRef,
    naturalSize,
    position: { offsetX: clampedOffsetX, offsetY: clampedOffsetY, scale },
    isDragging,
  };
}
