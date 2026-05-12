import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ArrowLeft, Lock, Unlock } from 'lucide-react';

interface Props {
  onConfirm: (w: number, h: number) => void;
  onClose: () => void;
  initialW?: number;
  initialH?: number;
  confirmLabel?: string;
}

const MIN = 200;
const MAX = 4000;
const PRESET_LONG_EDGE = 1440;
const HANDLE_PX = 10; // fixed screen pixels regardless of zoom

// Reference dimensions of the showcase workspace area on a typical 1440-wide screen.
// Used to compute the proportion of the canvas relative to the showcase.
const WS_W = 1376; // 1440 - 64px sidebar
const WS_H = 660;  // 900 - 196px profile header - 44px tabs

const PRESETS: { label: string; ratio: [number, number] }[] = [
  { label: '16:9', ratio: [16, 9] },
  { label: '4:3',  ratio: [4, 3] },
  { label: '1:1',  ratio: [1, 1] },
  { label: '3:4',  ratio: [3, 4] },
  { label: '9:16', ratio: [9, 16] },
];

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const CURSORS: Record<Handle, string> = {
  nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
  e: 'e-resize',   se: 'se-resize', s: 's-resize',
  sw: 'sw-resize', w: 'w-resize',
};

function presetDims(ratio: [number, number]): { w: number; h: number } {
  const [a, b] = ratio;
  if (a >= b) return { w: PRESET_LONG_EDGE, h: Math.round(PRESET_LONG_EDGE * b / a) };
  return { w: Math.round(PRESET_LONG_EDGE * a / b), h: PRESET_LONG_EDGE };
}

function clamp(v: number) { return Math.max(MIN, Math.min(MAX, v)); }

function centeredPos(canvasW: number, canvasH: number) {
  return {
    px: Math.max(0, Math.round((WS_W - canvasW) / 2)),
    py: Math.max(0, Math.round((WS_H - canvasH) / 2)),
  };
}

const eyebrow: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--pw-ink3)',
  margin: 0,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  height: 30,
  padding: '0 8px',
  fontSize: 12,
  border: '1px solid var(--pw-line)',
  borderRadius: 6,
  background: 'var(--pw-surface)',
  color: 'var(--pw-ink)',
  outline: 'none',
};

export function CanvasSizeSetup({
  onConfirm,
  onClose,
  initialW = 1440,
  initialH = 810,
  confirmLabel = 'Create Canvas',
}: Props) {
  const [w, setW] = useState(initialW);
  const [h, setH] = useState(initialH);
  const [lockAspect, setLockAspect] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.5);
  const [panelX, setPanelX] = useState(() => centeredPos(initialW, initialH).px);
  const [panelY, setPanelY] = useState(() => centeredPos(initialW, initialH).py);

  // Ref on the beige workspace area so scale is relative to that, not the whole right panel
  const wsAreaRef = useRef<HTMLDivElement>(null);

  const resizeDragRef = useRef<{
    handle: Handle;
    startX: number; startY: number;
    startW: number; startH: number;
    startPX: number; startPY: number;
    scaleAtStart: number;
    aspectAtStart: number;
  } | null>(null);

  const moveDragRef = useRef<{
    startX: number; startY: number;
    startPX: number; startPY: number;
  } | null>(null);

  const computeScale = useCallback(() => {
    const el = wsAreaRef.current;
    if (!el) return;
    const { width: cw, height: ch } = el.getBoundingClientRect();
    const s = Math.min((cw - 80) / WS_W, (ch - 80) / WS_H);
    setPreviewScale(Math.max(0.1, s));
  }, []);

  useLayoutEffect(() => {
    computeScale();
    const el = wsAreaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(computeScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, [computeScale]);

  // Clamp position when dimensions change
  useEffect(() => {
    setPanelX((px) => Math.max(0, Math.min(px, WS_W - w)));
    setPanelY((py) => Math.max(0, Math.min(py, WS_H - h)));
  }, [w, h]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const rd = resizeDragRef.current;
      if (rd) {
        // Convert screen-pixel delta to reference-pixel delta
        const dx = (e.clientX - rd.startX) / rd.scaleAtStart;
        const dy = (e.clientY - rd.startY) / rd.scaleAtStart;

        const fromLeft = rd.handle === 'w' || rd.handle === 'nw' || rd.handle === 'sw';
        const fromTop  = rd.handle === 'n' || rd.handle === 'ne' || rd.handle === 'nw';

        let nw = rd.startW;
        let nh = rd.startH;

        if (rd.handle === 'e' || rd.handle === 'ne' || rd.handle === 'se') nw = rd.startW + dx;
        if (fromLeft) nw = rd.startW - dx;
        if (rd.handle === 's' || rd.handle === 'se' || rd.handle === 'sw') nh = rd.startH + dy;
        if (fromTop) nh = rd.startH - dy;

        if (lockAspect) {
          const a = rd.aspectAtStart;
          const pureVert = rd.handle === 'n' || rd.handle === 's';
          if (pureVert) { nh = clamp(nh); nw = clamp(nh * a); }
          else { nw = clamp(nw); nh = clamp(nw / a); }
        } else {
          nw = clamp(nw);
          nh = clamp(nh);
        }

        // Anchor the opposite edge: left/top shift by actual size change
        const npx = fromLeft ? Math.max(0, rd.startPX + (rd.startW - nw)) : rd.startPX;
        const npy = fromTop  ? Math.max(0, rd.startPY + (rd.startH - nh)) : rd.startPY;

        setW(Math.round(nw));
        setH(Math.round(nh));
        setPanelX(Math.round(npx));
        setPanelY(Math.round(npy));
      }

      const md = moveDragRef.current;
      if (md) {
        const dx = (e.clientX - md.startX) / previewScale;
        const dy = (e.clientY - md.startY) / previewScale;
        setPanelX(Math.round(Math.max(0, Math.min(WS_W - w, md.startPX + dx))));
        setPanelY(Math.round(Math.max(0, Math.min(WS_H - h, md.startPY + dy))));
      }
    };

    const onUp = () => {
      resizeDragRef.current = null;
      moveDragRef.current = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [lockAspect, previewScale, w, h]);

  const startResize = (dir: Handle) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeDragRef.current = {
      handle: dir,
      startX: e.clientX, startY: e.clientY,
      startW: w, startH: h,
      startPX: panelX, startPY: panelY,
      scaleAtStart: previewScale,
      aspectAtStart: w / h,
    };
  };

  const startMove = (e: React.MouseEvent) => {
    e.preventDefault();
    moveDragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startPX: panelX, startPY: panelY,
    };
  };

  const handleWidthChange = (raw: number) => {
    const nw = clamp(raw);
    setW(nw);
    if (lockAspect) setH(Math.round(clamp(nw / (w / h))));
  };

  const handleHeightChange = (raw: number) => {
    const nh = clamp(raw);
    setH(nh);
    if (lockAspect) setW(Math.round(clamp(nh * (w / h))));
  };

  const hs = HANDLE_PX / 2;

  // Handle positions are given in screen pixels (reference × previewScale)
  const mkHandle = (dir: Handle, topScreen: number, leftScreen: number) => (
    <div
      key={dir}
      onMouseDown={startResize(dir)}
      style={{
        position: 'absolute',
        width: HANDLE_PX,
        height: HANDLE_PX,
        top: topScreen - hs,
        left: leftScreen - hs,
        borderRadius: 2,
        background: 'white',
        border: '1.5px solid #555',
        cursor: CURSORS[dir],
        zIndex: 10,
        boxShadow: '0 1px 6px rgba(0,0,0,0.28)',
      }}
    />
  );

  const activePreset = PRESETS.find((p) => {
    const d = presetDims(p.ratio);
    return d.w === w && d.h === h;
  });

  const overflows = w > WS_W || h > WS_H;

  // Screen-pixel dimensions of canvas and workspace
  const canvasVisW = w * previewScale;
  const canvasVisH = h * previewScale;
  const wsVisW = WS_W * previewScale;
  const wsVisH = WS_H * previewScale;

  const content = (
    <div
      className="paper-workshop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--pw-bg)',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          height: 56,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--pw-paper)',
          borderBottom: '1px solid var(--pw-line)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 32,
            color: 'var(--pw-ink2)',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={16} strokeWidth={1.6} />
          Back
        </button>

        <div style={{ flex: 1 }} />

        <span className="pw-mono" style={{ fontSize: 12, color: 'var(--pw-ink3)' }}>
          {w} × {h} px
        </span>

        <button
          type="button"
          onClick={() => onConfirm(w, h)}
          style={{
            height: 34,
            padding: '0 18px',
            background: 'var(--pw-ink)',
            color: 'var(--pw-paper)',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
          }}
        >
          {confirmLabel}
        </button>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left sidebar — controls */}
        <div
          style={{
            width: 196,
            borderRight: '1px solid var(--pw-line)',
            background: 'var(--pw-paper)',
            padding: '20px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
            flexShrink: 0,
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={eyebrow}>Dimensions</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11, color: 'var(--pw-ink3)' }}>Width</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <input
                  type="number"
                  value={w}
                  min={MIN}
                  max={MAX}
                  onChange={(e) => handleWidthChange(Number(e.target.value))}
                  className="pw-mono"
                  style={inputStyle}
                />
                <span style={{ fontSize: 11, color: 'var(--pw-ink3)' }}>px</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11, color: 'var(--pw-ink3)' }}>Height</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <input
                  type="number"
                  value={h}
                  min={MIN}
                  max={MAX}
                  onChange={(e) => handleHeightChange(Number(e.target.value))}
                  className="pw-mono"
                  style={inputStyle}
                />
                <span style={{ fontSize: 11, color: 'var(--pw-ink3)' }}>px</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLockAspect((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 28,
                padding: '0 8px',
                fontSize: 12,
                color: lockAspect ? 'var(--pw-ink)' : 'var(--pw-ink3)',
                background: lockAspect ? 'var(--pw-surface2)' : 'transparent',
                border: '1px solid var(--pw-line)',
                borderRadius: 6,
                cursor: 'pointer',
                marginTop: 2,
              }}
            >
              {lockAspect ? <Lock size={12} strokeWidth={2} /> : <Unlock size={12} strokeWidth={2} />}
              <span>{lockAspect ? 'Uniform' : 'Freeform'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={eyebrow}>Presets</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {PRESETS.map((preset) => {
                const isActive = activePreset?.label === preset.label;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      const d = presetDims(preset.ratio);
                      const c = centeredPos(d.w, d.h);
                      setW(d.w);
                      setH(d.h);
                      setPanelX(c.px);
                      setPanelY(c.py);
                    }}
                    className="pw-mono"
                    style={{
                      height: 26,
                      padding: '0 9px',
                      fontSize: 11,
                      fontWeight: 500,
                      borderRadius: 5,
                      border: `1px solid ${isActive ? 'var(--pw-ink)' : 'var(--pw-line)'}`,
                      background: isActive ? 'var(--pw-ink)' : 'transparent',
                      color: isActive ? 'var(--pw-paper)' : 'var(--pw-ink2)',
                      cursor: 'pointer',
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {overflows && (
              <p style={{ fontSize: 11, color: '#b45309', lineHeight: 1.55 }}>
                Canvas exceeds the showcase area — it will scroll on the profile.
              </p>
            )}
            <p style={{ fontSize: 11, color: 'var(--pw-ink3)', lineHeight: 1.55 }}>
              Drag handles to resize · drag the canvas to reposition in the showcase.
            </p>
          </div>
        </div>

        {/* Right panel — context strip + live showcase preview */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Compact profile context strip */}
          <div
            style={{
              flexShrink: 0,
              background: '#ffffff',
              borderBottom: '1px solid #e5e0db',
            }}
          >
            {/* Micro profile row */}
            <div
              style={{
                height: 40,
                display: 'flex',
                alignItems: 'center',
                padding: '0 20px',
                gap: 10,
                borderBottom: '1px solid #f0ebe5',
              }}
            >
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#ddd8d2', flexShrink: 0 }} />
              <div style={{ width: 88, height: 9, borderRadius: 3, background: '#ccc8c2' }} />
              <div style={{ width: 140, height: 7, borderRadius: 3, background: '#e8e3de' }} />
            </div>

            {/* Tab bar — Showcase active */}
            <div
              style={{
                height: 36,
                display: 'flex',
                alignItems: 'center',
                padding: '0 20px',
                gap: 20,
              }}
            >
              {['Posts', 'Showcase', 'Trade'].map((tab) => {
                const active = tab === 'Showcase';
                return (
                  <span
                    key={tab}
                    style={{
                      fontSize: 12,
                      fontWeight: active ? 600 : 400,
                      color: active ? '#2C2016' : '#b8a99e',
                      paddingBottom: 3,
                      borderBottom: active ? '2px solid #2C2016' : '2px solid transparent',
                      lineHeight: 1,
                    }}
                  >
                    {tab}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Beige showcase workspace — fills the rest, this is the interactive area */}
          <div
            ref={wsAreaRef}
            style={{
              flex: 1,
              background: '#F0EBE5',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Workspace boundary box — dashed outline shows the showcase extent */}
            <div
              style={{
                position: 'relative',
                width: wsVisW,
                height: wsVisH,
                flexShrink: 0,
                // overflow visible so handles on overflowing canvas aren't clipped
                overflow: 'visible',
              }}
            >
              {/* Dashed boundary indicator */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  border: '1.5px dashed rgba(44,32,22,0.20)',
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              />

              {/* Canvas rectangle — draggable, resizable */}
              <div
                onMouseDown={startMove}
                style={{
                  position: 'absolute',
                  left: panelX * previewScale,
                  top: panelY * previewScale,
                  width: canvasVisW,
                  height: canvasVisH,
                  background: '#ffffff',
                  boxShadow: '0 4px 28px rgba(0,0,0,0.15)',
                  cursor: 'grab',
                  userSelect: 'none',
                  zIndex: 1,
                }}
              >
                {/* Dimension label — only shows when canvas is large enough to fit it */}
                {canvasVisW > 80 && canvasVisH > 32 && (
                  <span
                    className="pw-mono"
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: 12,
                      color: 'rgba(0,0,0,0.22)',
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {w} × {h}
                  </span>
                )}

                {mkHandle('nw', 0,             0)}
                {mkHandle('n',  0,             canvasVisW / 2)}
                {mkHandle('ne', 0,             canvasVisW)}
                {mkHandle('e',  canvasVisH / 2, canvasVisW)}
                {mkHandle('se', canvasVisH,    canvasVisW)}
                {mkHandle('s',  canvasVisH,    canvasVisW / 2)}
                {mkHandle('sw', canvasVisH,    0)}
                {mkHandle('w',  canvasVisH / 2, 0)}
              </div>
            </div>

            {/* Showcase scale label */}
            <span
              style={{
                position: 'absolute',
                bottom: 10,
                right: 12,
                fontSize: 10,
                color: 'rgba(0,0,0,0.30)',
                pointerEvents: 'none',
              }}
            >
              {Math.round(previewScale * 100)}% · drag canvas to reposition
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
