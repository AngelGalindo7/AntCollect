import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ArrowLeft, Lock, Unlock } from 'lucide-react';

interface Props {
  onConfirm: (w: number, h: number) => void;
  onClose: () => void;
}

const MIN = 200;
const MAX = 4000;
const PRESET_LONG_EDGE = 1440;
const HANDLE_PX = 24;

// Mock showcase reference dimensions (logical px — same coordinate space as workspace panels)
const MOCK_W = 1440;
const MOCK_H = 900;
const MOCK_SIDEBAR_W = 64;
const MOCK_PROFILE_H = 196;
const MOCK_TABS_H = 44;
const WS_W = MOCK_W - MOCK_SIDEBAR_W;                   // 1376
const WS_H = MOCK_H - MOCK_PROFILE_H - MOCK_TABS_H;    // 660

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

export function CanvasSizeSetup({ onConfirm, onClose }: Props) {
  const [w, setW] = useState(1440);
  const [h, setH] = useState(810);
  const [lockAspect, setLockAspect] = useState(false);
  const [mockScale, setMockScale] = useState(0.35);
  const [panelX, setPanelX] = useState(() => centeredPos(1440, 810).px);
  const [panelY, setPanelY] = useState(() => centeredPos(1440, 810).py);
  const previewRef = useRef<HTMLDivElement>(null);

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

  const computeMockScale = useCallback(() => {
    const el = previewRef.current;
    if (!el) return;
    const { width: cw, height: ch } = el.getBoundingClientRect();
    const s = Math.min((cw - 48) / MOCK_W, (ch - 48) / MOCK_H);
    setMockScale(Math.max(0.1, s));
  }, []);

  useLayoutEffect(() => {
    computeMockScale();
    const el = previewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(computeMockScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, [computeMockScale]);

  // Clamp position when dimensions change (typed input or aspect-lock)
  useEffect(() => {
    setPanelX((px) => Math.max(0, Math.min(px, WS_W - w)));
    setPanelY((py) => Math.max(0, Math.min(py, WS_H - h)));
  }, [w, h]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const rd = resizeDragRef.current;
      if (rd) {
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

        // Position shifts by how much width/height actually changed on the left/top edges
        const npx = fromLeft ? Math.max(0, rd.startPX + (rd.startW - nw)) : rd.startPX;
        const npy = fromTop  ? Math.max(0, rd.startPY + (rd.startH - nh)) : rd.startPY;

        setW(Math.round(nw));
        setH(Math.round(nh));
        setPanelX(Math.round(npx));
        setPanelY(Math.round(npy));
      }

      const md = moveDragRef.current;
      if (md) {
        const dx = (e.clientX - md.startX) / mockScale;
        const dy = (e.clientY - md.startY) / mockScale;
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
  }, [lockAspect, mockScale, w, h]);

  const startResize = (dir: Handle) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeDragRef.current = {
      handle: dir,
      startX: e.clientX, startY: e.clientY,
      startW: w, startH: h,
      startPX: panelX, startPY: panelY,
      scaleAtStart: mockScale,
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

  const mkHandle = (dir: Handle, topCenter: number, leftCenter: number) => (
    <div
      key={dir}
      onMouseDown={startResize(dir)}
      style={{
        position: 'absolute',
        width: HANDLE_PX,
        height: HANDLE_PX,
        top: topCenter - hs,
        left: leftCenter - hs,
        borderRadius: 3,
        background: 'white',
        border: '2px solid #555',
        cursor: CURSORS[dir],
        zIndex: 10,
        boxShadow: '0 1px 8px rgba(0,0,0,0.28)',
      }}
    />
  );

  const activePreset = PRESETS.find((p) => {
    const d = presetDims(p.ratio);
    return d.w === w && d.h === h;
  });

  const overflows = w > WS_W || h > WS_H;

  const content = (
    <div
      className="paper-workshop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
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
          Create Canvas
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
          {/* Dimensions */}
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

            {/* Aspect lock */}
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

          {/* Presets */}
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
              Drag handles to resize · drag the canvas to reposition it in the preview.
            </p>
          </div>
        </div>

        {/* Preview area — scaled mock showcase */}
        <div
          ref={previewRef}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
            background: 'var(--pw-bg)',
          }}
        >
          {/* Label */}
          <span
            style={{
              position: 'absolute',
              top: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 11,
              color: 'var(--pw-ink3)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Showcase preview
          </span>

          {/* Outer wrapper — takes up the correct visual footprint after scaling */}
          <div
            style={{
              width: MOCK_W * mockScale,
              height: MOCK_H * mockScale,
              position: 'relative',
              flexShrink: 0,
              borderRadius: 6,
              overflow: 'hidden',
              boxShadow: '0 8px 48px rgba(0,0,0,0.22)',
            }}
          >
            {/* Full-size mock, scaled from top-left corner */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: MOCK_W,
                height: MOCK_H,
                transformOrigin: 'top left',
                transform: `scale(${mockScale})`,
                display: 'flex',
              }}
            >
              {/* Dark sidebar */}
              <div
                style={{
                  width: MOCK_SIDEBAR_W,
                  background: '#2C2016',
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  paddingTop: 24,
                  gap: 20,
                }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.15)', marginBottom: 8 }} />
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: i === 1 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)',
                    }}
                  />
                ))}
              </div>

              {/* Main content column */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Profile header skeleton */}
                <div
                  style={{
                    height: MOCK_PROFILE_H,
                    background: '#ffffff',
                    borderBottom: '1px solid #e5e0db',
                    padding: '32px 48px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 32,
                    flexShrink: 0,
                  }}
                >
                  <div style={{ width: 92, height: 92, borderRadius: '50%', background: '#ddd8d2', flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ width: 200, height: 24, borderRadius: 5, background: '#ccc8c2' }} />
                    <div style={{ width: 320, height: 14, borderRadius: 4, background: '#e8e3de' }} />
                    <div style={{ width: 260, height: 14, borderRadius: 4, background: '#e8e3de' }} />
                    <div style={{ display: 'flex', gap: 28, marginTop: 2 }}>
                      {[72, 54, 80].map((bw, i) => (
                        <div key={i} style={{ width: bw, height: 13, borderRadius: 3, background: '#eee9e4' }} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tab bar — Showcase active */}
                <div
                  style={{
                    height: MOCK_TABS_H,
                    background: '#ffffff',
                    borderBottom: '1px solid #e5e0db',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 48,
                    gap: 36,
                    flexShrink: 0,
                  }}
                >
                  {['Posts', 'Showcase', 'Trade'].map((tab) => {
                    const active = tab === 'Showcase';
                    return (
                      <span
                        key={tab}
                        style={{
                          fontSize: 26,
                          fontWeight: active ? 600 : 400,
                          color: active ? '#2C2016' : '#b8a99e',
                          paddingBottom: 4,
                          borderBottom: active ? '3px solid #2C2016' : '3px solid transparent',
                        }}
                      >
                        {tab}
                      </span>
                    );
                  })}
                </div>

                {/* Showcase / workspace area */}
                <div
                  style={{
                    flex: 1,
                    background: '#F0EBE5',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Canvas rectangle — draggable body, resizable via handles */}
                  <div
                    onMouseDown={startMove}
                    style={{
                      position: 'absolute',
                      left: panelX,
                      top: panelY,
                      width: w,
                      height: h,
                      background: '#ffffff',
                      boxShadow: '0 6px 36px rgba(0,0,0,0.16)',
                      cursor: 'grab',
                      userSelect: 'none',
                    }}
                  >
                    <span
                      className="pw-mono"
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: 38,
                        color: 'rgba(0,0,0,0.18)',
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {w} × {h}
                    </span>

                    {mkHandle('nw', 0,     0)}
                    {mkHandle('n',  0,     w / 2)}
                    {mkHandle('ne', 0,     w)}
                    {mkHandle('e',  h / 2, w)}
                    {mkHandle('se', h,     w)}
                    {mkHandle('s',  h,     w / 2)}
                    {mkHandle('sw', h,     0)}
                    {mkHandle('w',  h / 2, 0)}
                  </div>

                  <span
                    style={{
                      position: 'absolute',
                      bottom: 16,
                      right: 20,
                      fontSize: 20,
                      color: 'rgba(0,0,0,0.28)',
                      pointerEvents: 'none',
                    }}
                  >
                    drag to reposition
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
