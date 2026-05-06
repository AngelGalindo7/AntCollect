import { useRef, useEffect } from 'react';
import type { Rect, WorkspaceBounds, ResizeMode, DragMode } from '../types/workspace';
import { resolveCollision } from '../geometry/collision';

interface UseDragResizeOptions {
  panelId: number;
  rect: Rect;
  locked: boolean;
  others: Rect[];
  bounds: WorkspaceBounds;
  uniform?: boolean;
  onRectChange: (id: number, rect: Rect) => void;
  onCommit: (id: number) => void;
  onFocus: (id: number) => void;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startRect: Rect;
  mode: DragMode;
  element: Element;
}

export function useDragResize(opts: UseDragResizeOptions): {
  dragHandleProps: React.PointerEventHandler<HTMLElement>;
  resizeHandleProps: (mode: ResizeMode) => React.PointerEventHandler<HTMLElement>;
} {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const dragStateRef = useRef<DragState | null>(null);

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const state = dragStateRef.current;
      if (!state || e.pointerId !== state.pointerId) return;

      const { panelId, others, bounds, onRectChange, uniform } = optsRef.current;
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      const { startRect, mode } = state;

      let candidate: Rect;
      if (mode === 'move') {
        candidate = { x: startRect.x + dx, y: startRect.y + dy, w: startRect.w, h: startRect.h };
      } else {
        const aspect = uniform ? startRect.w / startRect.h : undefined;
        candidate = applyResizeDelta(startRect, dx, dy, mode, aspect);
      }

      const resolved = resolveCollision(startRect, candidate, others, bounds, mode);
      onRectChange(panelId, resolved);
    }

    function onPointerUp(e: PointerEvent) {
      const state = dragStateRef.current;
      if (!state || e.pointerId !== state.pointerId) return;

      try {
        state.element.releasePointerCapture(state.pointerId);
      } catch {
        // pointer may have already been released
      }

      dragStateRef.current = null;
      optsRef.current.onCommit(optsRef.current.panelId);
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  function beginDrag(e: React.PointerEvent<HTMLElement>, mode: DragMode) {
    const { locked, panelId, rect, onFocus } = optsRef.current;
    if (locked) return;

    onFocus(panelId);
    e.currentTarget.setPointerCapture(e.pointerId);

    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...rect },
      mode,
      element: e.currentTarget,
    };
  }

  const dragHandleProps: React.PointerEventHandler<HTMLElement> = (e) => {
    beginDrag(e, 'move');
  };

  const resizeHandleProps = (mode: ResizeMode): React.PointerEventHandler<HTMLElement> =>
    (e) => {
      beginDrag(e, mode);
    };

  return { dragHandleProps, resizeHandleProps };
}

function applyResizeDelta(base: Rect, dx: number, dy: number, mode: ResizeMode, aspect?: number): Rect {
  let { x, y, w, h } = base;

  if (aspect !== undefined) {
    // Proportional resize: average the scale factor across both axes, then enforce aspect ratio.
    let scale = 1;
    if (mode === 'se') scale = ((base.w + dx) / base.w + (base.h + dy) / base.h) / 2;
    else if (mode === 'sw') scale = ((base.w - dx) / base.w + (base.h + dy) / base.h) / 2;
    else if (mode === 'ne') scale = ((base.w + dx) / base.w + (base.h - dy) / base.h) / 2;
    else if (mode === 'nw') scale = ((base.w - dx) / base.w + (base.h - dy) / base.h) / 2;
    w = base.w * scale;
    h = base.h * scale;
    if (mode.includes('w')) x = base.x + base.w - w;
    if (mode.includes('n')) y = base.y + base.h - h;
  } else {
    if (mode.includes('e')) w += dx;
    if (mode.includes('s')) h += dy;
    if (mode.includes('w')) { x += dx; w -= dx; }
    if (mode.includes('n')) { y += dy; h -= dy; }
  }

  return { x, y, w, h };
}
