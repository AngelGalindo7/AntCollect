import type { Rect, WorkspaceBounds, DragMode } from '../types/workspace';
import { MIN_W, MIN_H, BISECTION_ITERATIONS } from '../constants';

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function collidesAny(target: Rect, others: Rect[]): boolean {
  return others.some((o) => rectsOverlap(target, o));
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function clampRect(target: Rect, bounds: WorkspaceBounds, mode: DragMode): Rect {
  let { x, y, w, h } = target;
  if (mode === 'move') {
    x = clamp(x, 0, bounds.w - w);
    y = Math.max(0, y); // no lower clamp — workspace grows downward as panels are dragged
  } else {
    if (mode.includes('e')) w = Math.min(w, bounds.w - x);
    if (mode.includes('s')) h = Math.min(h, bounds.h - y);
    if (mode.includes('w')) {
      if (x < 0) {
        w -= -x;
        x = 0;
      }
    }
    if (mode.includes('n')) {
      if (y < 0) {
        h -= -y;
        y = 0;
      }
    }
    w = Math.max(MIN_W, w);
    h = Math.max(MIN_H, h);
  }
  return { x, y, w, h };
}

export function resolveCollision(
  orig: Rect,
  target: Rect,
  others: Rect[],
  bounds: WorkspaceBounds,
  mode: DragMode,
): Rect {
  const candidate = clampRect(target, bounds, mode);
  if (!collidesAny(candidate, others)) return candidate;

  const dx = candidate.x - orig.x;
  const dy = candidate.y - orig.y;
  const dw = candidate.w - orig.w;
  const dh = candidate.h - orig.h;

  // Bisect along orig -> candidate to find the furthest collision-free t in [0, 1].
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < BISECTION_ITERATIONS; i++) {
    const m = (lo + hi) / 2;
    const test: Rect = {
      x: orig.x + dx * m,
      y: orig.y + dy * m,
      w: orig.w + dw * m,
      h: orig.h + dh * m,
    };
    if (collidesAny(test, others)) hi = m;
    else lo = m;
  }
  return {
    x: orig.x + dx * lo,
    y: orig.y + dy * lo,
    w: orig.w + dw * lo,
    h: orig.h + dh * lo,
  };
}
