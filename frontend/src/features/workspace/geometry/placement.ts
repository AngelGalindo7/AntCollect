import type { Rect, WorkspaceBounds } from '../types/workspace';
import { GRID_STEP } from '../constants';
import { collidesAny } from './collision';

// Scan the workspace on a grid for the first slot that fits a w×h panel without
// overlapping any occupied rect. Returns null when nothing fits inside bounds.
export function findFreeSpot(
  occupied: Rect[],
  bounds: WorkspaceBounds,
  w: number,
  h: number,
): { x: number; y: number } | null {
  const maxX = bounds.w - w;
  const maxY = bounds.h - h;
  if (maxX < 0 || maxY < 0) return null;
  for (let fy = 0; fy <= maxY; fy += GRID_STEP) {
    for (let fx = 0; fx <= maxX; fx += GRID_STEP) {
      if (!collidesAny({ x: fx, y: fy, w, h }, occupied)) return { x: fx, y: fy };
    }
  }
  return null;
}

// Like findFreeSpot but always returns a position: when nothing fits inside the
// current bounds it stacks the panel below existing content (the workspace grows
// downward), so a save can never silently fail to place the panel.
export function placementSpot(
  occupied: Rect[],
  bounds: WorkspaceBounds,
  w: number,
  h: number,
): { x: number; y: number } {
  const spot = findFreeSpot(occupied, bounds, w, h);
  if (spot) return spot;
  const bottom = occupied.length > 0 ? Math.max(...occupied.map((p) => p.y + p.h)) : 0;
  return { x: 0, y: bottom + GRID_STEP };
}
