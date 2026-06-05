import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { Panel } from '../types/workspace';
import { getPublicWorkspace } from '../api/workspaceApi';
import { PanelPreview } from './PanelPreview';

interface Props {
  username: string;
}

// Public showcase. Preserves the spatial composition the owner arranged and renders
// every panel live (holo panels shimmer on hover via PanelPreview) rather than as a
// flat screenshot. Scale is capped at 1 so a small showcase is never upscaled into a
// blurry giant; the stage is centered when it is narrower than the container.
export function SpotlightViewer({ username }: Props) {
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

  // H7: never scale above 1 — upscaling a small composition produces a blown-up,
  // blurry result. Scale down to fit wide compositions, leave small ones at 1:1.
  const scale = naturalW > 0 && containerW > 0 ? Math.min(1, containerW / naturalW) : 1;
  const scaledW = naturalW * scale;
  const scaledH = naturalH > 0 ? naturalH * scale : 400;

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height: 300 }}>
        <p className="text-neutral-400 text-sm">Loading showcase…</p>
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

  // H4: a visitor on an empty showcase should see an intentional empty state, not a
  // zero-height blank region that reads as a broken page.
  if (panels.length === 0) {
    return (
      <div
        className="w-full rounded-xl bg-[#F0EBE5] ring-1 ring-black/8 flex flex-col items-center justify-center gap-2 text-center px-6"
        style={{ minHeight: 320 }}
      >
        <Sparkles size={22} className="text-espresso/30" />
        <p className="text-espresso/50 text-sm font-medium">Nothing on display yet</p>
        <p className="text-espresso/35 text-xs max-w-xs">
          This collector hasn’t put anything in their showcase.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full" style={{ overflow: 'hidden' }}>
      <div style={{ position: 'relative', width: scaledW, height: scaledH, margin: '0 auto' }}>
        {panels.map((p) => (
          <div
            key={p.id}
            className="group"
            style={{
              position: 'absolute',
              left: p.x * scale,
              top: p.y * scale,
              width: p.w * scale,
              height: p.h * scale,
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <PanelPreview panel={p} />

            {/* H3: title revealed on hover so it never obscures the artwork at rest. */}
            {p.title && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 py-2 bg-linear-to-t from-black/55 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <p className="text-white text-xs font-medium truncate">{p.title}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
