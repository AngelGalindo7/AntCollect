import { describe, it, expect } from 'vitest';
import {
  rectsOverlap,
  collidesAny,
  clamp,
  clampRect,
  resolveCollision,
} from '../collision';
import { MIN_W, MIN_H } from '../../constants';
import type { Rect, WorkspaceBounds } from '../../types/workspace';

const bounds: WorkspaceBounds = { w: 2000, h: 2000 };

describe('rectsOverlap', () => {
  it('returns false for fully disjoint rects', () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const b: Rect = { x: 200, y: 200, w: 100, h: 100 };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it('returns true when one rect is fully contained in another', () => {
    const a: Rect = { x: 0, y: 0, w: 200, h: 200 };
    const b: Rect = { x: 50, y: 50, w: 50, h: 50 };
    expect(rectsOverlap(a, b)).toBe(true);
  });

  it('returns false for edge-touching rects (strict <)', () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const b: Rect = { x: 100, y: 0, w: 100, h: 100 };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it('returns false for corner-touching rects', () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const b: Rect = { x: 100, y: 100, w: 100, h: 100 };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it('returns true for identical rects', () => {
    const a: Rect = { x: 10, y: 10, w: 100, h: 100 };
    expect(rectsOverlap(a, { ...a })).toBe(true);
  });
});

describe('collidesAny', () => {
  const target: Rect = { x: 0, y: 0, w: 100, h: 100 };

  it('returns false when others is empty', () => {
    expect(collidesAny(target, [])).toBe(false);
  });

  it('returns true when at least one rect overlaps', () => {
    const others: Rect[] = [
      { x: 500, y: 500, w: 50, h: 50 },
      { x: 50, y: 50, w: 100, h: 100 },
    ];
    expect(collidesAny(target, others)).toBe(true);
  });

  it('returns false when no rects overlap', () => {
    const others: Rect[] = [
      { x: 500, y: 500, w: 50, h: 50 },
      { x: 1000, y: 1000, w: 50, h: 50 },
    ];
    expect(collidesAny(target, others)).toBe(false);
  });
});

describe('clamp', () => {
  it('returns value unchanged when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('returns lo when below range', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it('returns hi when above range', () => {
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it('returns lo when lo > hi (Math.min beats Math.max)', () => {
    expect(clamp(5, 10, 0)).toBe(10);
  });
});

describe('clampRect — move mode', () => {
  it('keeps a rect at the origin unchanged', () => {
    const r: Rect = { x: 0, y: 0, w: 300, h: 250 };
    expect(clampRect(r, bounds, 'move')).toEqual(r);
  });

  it('clamps x past the right edge but leaves y unclamped (workspace grows downward)', () => {
    const r: Rect = { x: 1900, y: 1900, w: 300, h: 250 };
    const out = clampRect(r, bounds, 'move');
    expect(out.x).toBe(bounds.w - r.w); // clamped to right edge
    expect(out.y).toBe(r.y);            // y has no upper bound — panels can go below viewport
    expect(out.w).toBe(300);
    expect(out.h).toBe(250);
  });

  it('clamps negative origin to zero without changing size', () => {
    const r: Rect = { x: -50, y: -80, w: 300, h: 250 };
    const out = clampRect(r, bounds, 'move');
    expect(out.x).toBe(0);
    expect(out.y).toBe(0);
    expect(out.w).toBe(300);
    expect(out.h).toBe(250);
  });
});

describe('clampRect — resize modes', () => {
  it("'e' shrinks w when escaping right bound", () => {
    const r: Rect = { x: 1500, y: 100, w: 800, h: 300 };
    const out = clampRect(r, bounds, 'e');
    expect(out.x).toBe(1500);
    expect(out.w).toBe(bounds.w - 1500);
  });

  it("'e' enforces MIN_W floor", () => {
    const r: Rect = { x: 100, y: 100, w: 50, h: 300 };
    const out = clampRect(r, bounds, 'e');
    expect(out.w).toBe(MIN_W);
  });

  it("'s' enforces MIN_H floor", () => {
    const r: Rect = { x: 100, y: 100, w: 400, h: 50 };
    const out = clampRect(r, bounds, 's');
    expect(out.h).toBe(MIN_H);
  });

  it("'w' dragging past origin sets x=0 and reduces w", () => {
    const r: Rect = { x: -40, y: 100, w: 400, h: 300 };
    const out = clampRect(r, bounds, 'w');
    expect(out.x).toBe(0);
    expect(out.w).toBe(360);
  });

  it("'n' dragging past origin sets y=0 and reduces h", () => {
    const r: Rect = { x: 100, y: -30, w: 400, h: 300 };
    const out = clampRect(r, bounds, 'n');
    expect(out.y).toBe(0);
    expect(out.h).toBe(270);
  });

  it("'se' adjusts both axes", () => {
    const r: Rect = { x: 1700, y: 1700, w: 600, h: 600 };
    const out = clampRect(r, bounds, 'se');
    expect(out.w).toBe(bounds.w - 1700);
    expect(out.h).toBe(bounds.h - 1700);
  });

  it("'nw' adjusts both axes when crossing origin", () => {
    const r: Rect = { x: -50, y: -60, w: 500, h: 500 };
    const out = clampRect(r, bounds, 'nw');
    expect(out.x).toBe(0);
    expect(out.y).toBe(0);
    expect(out.w).toBe(450);
    expect(out.h).toBe(440);
  });
});

describe('resolveCollision', () => {
  it('returns the clamped target when there is no collision', () => {
    const orig: Rect = { x: 0, y: 0, w: 300, h: 250 };
    const target: Rect = { x: 500, y: 500, w: 300, h: 250 };
    const out = resolveCollision(orig, target, [], bounds, 'move');
    expect(out).toEqual(target);
  });

  it('when orig is flush with an obstacle, rect cannot move toward it', () => {
    const obstacle: Rect = { x: 100, y: 0, w: 200, h: 200 };
    const orig: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const target: Rect = { x: 150, y: 0, w: 100, h: 100 };
    const out = resolveCollision(orig, target, [obstacle], bounds, 'move');
    expect(out.x).toBeCloseTo(orig.x, 1);
    expect(out.y).toBeCloseTo(orig.y, 1);
    expect(rectsOverlap(out, obstacle)).toBe(false);
  });

  it('diagonal slide stops adjacent to the obstacle', () => {
    const orig: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const target: Rect = { x: 200, y: 200, w: 100, h: 100 };
    const obstacle: Rect = { x: 100, y: 100, w: 200, h: 200 };
    const out = resolveCollision(orig, target, [obstacle], bounds, 'move');
    const rightEdge = out.x + out.w;
    const bottomEdge = out.y + out.h;
    const adjacentX = Math.abs(rightEdge - obstacle.x) < 0.01;
    const adjacentY = Math.abs(bottomEdge - obstacle.y) < 0.01;
    expect(adjacentX || adjacentY).toBe(true);
    expect(rectsOverlap(out, obstacle)).toBe(false);
  });

  it("resize 'e' that grows into a neighbor is blocked at the boundary", () => {
    const orig: Rect = { x: 0, y: 0, w: 300, h: 250 };
    const target: Rect = { x: 0, y: 0, w: 800, h: 250 };
    const obstacle: Rect = { x: 500, y: 0, w: 300, h: 250 };
    const out = resolveCollision(orig, target, [obstacle], bounds, 'e');
    expect(out.x).toBe(0);
    expect(out.y).toBe(0);
    expect(out.h).toBe(250);
    expect(out.w).toBeLessThanOrEqual(500);
    expect(out.w).toBeGreaterThanOrEqual(orig.w);
    expect(rectsOverlap(out, obstacle)).toBe(false);
  });

  it("resize 'e' that only shrinks (no collision) returns the clamped target", () => {
    const orig: Rect = { x: 0, y: 0, w: 600, h: 250 };
    const target: Rect = { x: 0, y: 0, w: 400, h: 250 };
    const obstacle: Rect = { x: 700, y: 0, w: 200, h: 250 };
    const out = resolveCollision(orig, target, [obstacle], bounds, 'e');
    expect(out).toEqual(target);
  });
});
