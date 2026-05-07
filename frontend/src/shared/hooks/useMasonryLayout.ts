import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

export interface MasonryItemDims {
  aspectRatio: number;
  extraHeight?: number;
}

export interface MasonryBreakpoint {
  minWidth: number;
  cols: number;
}

export interface MasonryConfig {
  gap: number;
  breakpoints: MasonryBreakpoint[];
}

export interface MasonryPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MasonryLayout {
  containerRef: (node: HTMLDivElement | null) => void;
  positions: MasonryPosition[];
  containerHeight: number;
  columnWidth: number;
  ready: boolean;
}

function pickColumnCount(width: number, breakpoints: MasonryBreakpoint[]): number {
  let cols = 1;
  for (const bp of breakpoints) {
    if (width >= bp.minWidth && bp.cols > cols) cols = bp.cols;
  }
  return Math.max(cols, 1);
}

export function useMasonryLayout(
  items: MasonryItemDims[],
  config: MasonryConfig,
): MasonryLayout {
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Callback ref fires whenever the element mounts or unmounts, so the effect
  // below correctly re-runs even when PostGridLayout transitions from its
  // empty-state early-return (no element attached) to a real masonry container.
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainerEl(node);
  }, []);

  useLayoutEffect(() => {
    if (!containerEl) return;
    setContainerWidth(containerEl.getBoundingClientRect().width);

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(w);
    });
    ro.observe(containerEl);
    return () => ro.disconnect();
  }, [containerEl]);

  const cols = useMemo(
    () => pickColumnCount(containerWidth, config.breakpoints),
    [containerWidth, config.breakpoints],
  );

  const layout = useMemo(() => {
    if (containerWidth <= 0) {
      return { positions: [] as MasonryPosition[], containerHeight: 0, columnWidth: 0 };
    }
    const colWidth = (containerWidth - config.gap * (cols - 1)) / cols;
    const colHeights = new Array<number>(cols).fill(0);
    const positions: MasonryPosition[] = items.map((item) => {
      const aspect = item.aspectRatio > 0 ? item.aspectRatio : 1;
      const itemHeight = colWidth * aspect + (item.extraHeight ?? 0);
      let target = 0;
      for (let i = 1; i < cols; i++) {
        if (colHeights[i] < colHeights[target]) target = i;
      }
      const pos: MasonryPosition = {
        x: target * (colWidth + config.gap),
        y: colHeights[target],
        width: colWidth,
        height: itemHeight,
      };
      colHeights[target] += itemHeight + config.gap;
      return pos;
    });
    const tallest = colHeights.reduce((m, h) => (h > m ? h : m), 0);
    return {
      positions,
      containerHeight: Math.max(0, tallest - config.gap),
      columnWidth: colWidth,
    };
  }, [items, containerWidth, cols, config.gap]);

  return {
    containerRef,
    positions: layout.positions,
    containerHeight: layout.containerHeight,
    columnWidth: layout.columnWidth,
    ready: containerWidth > 0,
  };
}
