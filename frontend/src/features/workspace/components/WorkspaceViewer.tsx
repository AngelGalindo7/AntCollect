import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Panel } from '../types/workspace';
import { getPublicWorkspace } from '../api/workspaceApi';

interface Props {
  username: string;
}

export function WorkspaceViewer({ username }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const [containerW, setContainerW] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPublicWorkspace(username)
      .then((data) => {
        if (cancelled) return;
        setPanels(data.panels);
        if (data.panels.length > 0) {
          const maxX = Math.max(...data.panels.map((p) => p.x + p.w));
          const maxY = Math.max(...data.panels.map((p) => p.y + p.h));
          setNaturalW(maxX + 20);
          setNaturalH(maxY + 20);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load workspace');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [username]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerW(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = naturalW > 0 && containerW > 0 ? containerW / naturalW : 1;
  const scaledH = naturalH > 0 ? naturalH * scale : 400;

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height: 300 }}>
        <p className="text-neutral-400 text-sm">Loading workspace…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height: 200 }}>
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: scaledH, overflow: 'hidden' }}
    >
      {panels
        .filter((p) => p.preview_path)
        .map((p) => (
          <img
            key={p.id}
            src={p.preview_path!}
            draggable={false}
            alt={p.title ?? ''}
            style={{
              position: 'absolute',
              left: p.x * scale,
              top: p.y * scale,
              width: p.w * scale,
              height: p.h * scale,
              objectFit: 'cover',
              borderRadius: 8,
            }}
          />
        ))}
    </div>
  );
}
