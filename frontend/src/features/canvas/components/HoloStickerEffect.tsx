import { useRef, useCallback } from 'react';
import { DEFAULT_HOLO_VARIANT, type HoloVariant } from '../types/canvas';

// Math helpers — ported verbatim from simeydotme/pokemon-cards-css Math.js
const round = (value: number, precision = 3) => parseFloat(value.toFixed(precision));
const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max);
const adjust = (value: number, fromMin: number, fromMax: number, toMin: number, toMax: number) =>
  round(toMin + (toMax - toMin) * ((value - fromMin) / (fromMax - fromMin)));

interface Props {
  children: React.ReactNode;
  maskUrl?: string;
  variant?: HoloVariant;
}

export function HoloStickerEffect({ children, maskUrl, variant }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = elRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const px = clamp(round((100 / rect.width) * (e.clientX - rect.left)));
    const py = clamp(round((100 / rect.height) * (e.clientY - rect.top)));
    const cx = px - 50;
    const cy = py - 50;

    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      el.style.setProperty('--pointer-x', `${px}%`);
      el.style.setProperty('--pointer-y', `${py}%`);
      el.style.setProperty('--bg-x', `${adjust(px, 0, 100, 37, 63)}%`);
      el.style.setProperty('--bg-y', `${adjust(py, 0, 100, 33, 67)}%`);
      el.style.setProperty('--rotate-x', `${round(-(cx / 3.5))}deg`);
      el.style.setProperty('--rotate-y', `${round(cy / 3.5)}deg`);
      el.style.setProperty('--card-opacity', '1');
      rafId.current = null;
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    el.style.setProperty('--card-opacity', '0');
    el.style.setProperty('--rotate-x', '0deg');
    el.style.setProperty('--rotate-y', '0deg');
  }, []);

  return (
    <div
      ref={elRef}
      className="holo-sticker"
      data-holo={variant ?? DEFAULT_HOLO_VARIANT}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="holo-rotator">
        {children}
        <div
          className="holo-shine"
          style={maskUrl ? {
            maskImage: `url(${maskUrl})`,
            WebkitMaskImage: `url(${maskUrl})`,
            maskSize: '100% 100%',
            WebkitMaskSize: '100% 100%',
          } : undefined}
        />
        <div
          className="holo-glare"
          style={maskUrl ? {
            maskImage: `url(${maskUrl})`,
            WebkitMaskImage: `url(${maskUrl})`,
            maskSize: '100% 100%',
            WebkitMaskSize: '100% 100%',
          } : undefined}
        />
      </div>
    </div>
  );
}
