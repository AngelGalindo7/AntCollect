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
const HANDLE_SIZE = 10;

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
  const [scale, setScale] = useState(0.5);
  const previewRef = useRef<HTMLDivElement>(null);

  const dragRef = useRef<{
    handle: Handle;
    startX: number; startY: number;
    startW: number; startH: number;
    scaleAtStart: number;
    aspectAtStart: number;
  } | null>(null);

  const computeScale = useCallback((canvasW: number, canvasH: number) => {
    const el = previewRef.current;
    if (!el) return;
    const { width: cw, height: ch } = el.getBoundingClientRect();
    const s = Math.min(1, (cw - 80) / canvasW, (ch - 80) / canvasH);
    setScale(s);
  }, []);

  useLayoutEffect(() => {
    computeScale(w, h);
    const el = previewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => computeScale(w, h));
    ro.observe(el);
    return () => ro.disconnect();
  }, [computeScale, w, h]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / d.scaleAtStart;
      const dy = (e.clientY - d.startY) / d.scaleAtStart;
      let nw = d.startW;
      let nh = d.startH;

      if (d.handle === 'e'  || d.handle === 'ne' || d.handle === 'se') nw = d.startW + dx;
      if (d.handle === 'w'  || d.handle === 'nw' || d.handle === 'sw') nw = d.startW - dx;
      if (d.handle === 's'  || d.handle === 'se' || d.handle === 'sw') nh = d.startH + dy;
      if (d.handle === 'n'  || d.handle === 'ne' || d.handle === 'nw') nh = d.startH - dy;

      if (lockAspect) {
        const a = d.aspectAtStart;
        const pureVertical = d.handle === 'n' || d.handle === 's';
        if (pureVertical) {
          nh = clamp(nh);
          nw = clamp(nh * a);
        } else {
          nw = clamp(nw);
          nh = clamp(nw / a);
        }
      } else {
        nw = clamp(nw);
        nh = clamp(nh);
      }

      setW(Math.round(nw));
      setH(Math.round(nh));
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [lockAspect]);

  const startDrag = (handle: Handle) => (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      handle,
      startX: e.clientX, startY: e.clientY,
      startW: w, startH: h,
      scaleAtStart: scale,
      aspectAtStart: w / h,
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

  const hs = HANDLE_SIZE / 2;
  const visW = Math.round(w * scale);
  const visH = Math.round(h * scale);

  const handle = (h: Handle, topCenter: number, leftCenter: number) => (
    <div
      onMouseDown={startDrag(h)}
      style={{
        position: 'absolute',
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        top: topCenter - hs,
        left: leftCenter - hs,
        borderRadius: 2,
        background: 'white',
        border: '1.5px solid #888',
        cursor: CURSORS[h],
        zIndex: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
      }}
    />
  );

  const activePreset = PRESETS.find((p) => {
    const d = presetDims(p.ratio);
    return d.w === w && d.h === h;
  });

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

        {/* Left sidebar */}
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

            {/* Aspect lock toggle */}
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
                      setW(d.w);
                      setH(d.h);
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

          <p style={{ fontSize: 11, color: 'var(--pw-ink3)', lineHeight: 1.55, marginTop: 'auto' }}>
            Drag the handles or type pixel values to set canvas size.
          </p>
        </div>

        {/* Preview area — showcase background */}
        <div
          ref={previewRef}
          style={{
            flex: 1,
            background: '#F0EBE5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Canvas rectangle */}
          <div
            style={{
              position: 'relative',
              width: visW,
              height: visH,
              background: '#ffffff',
              boxShadow: '0 4px 28px rgba(0,0,0,0.14)',
              userSelect: 'none',
              flexShrink: 0,
            }}
          >
            {/* Centered dimension label */}
            <span
              className="pw-mono"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: 13,
                color: 'rgba(0,0,0,0.22)',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {w} × {h}
            </span>

            {/* 8 resize handles */}
            {handle('nw', 0,         0)}
            {handle('n',  0,         visW / 2)}
            {handle('ne', 0,         visW)}
            {handle('e',  visH / 2,  visW)}
            {handle('se', visH,      visW)}
            {handle('s',  visH,      visW / 2)}
            {handle('sw', visH,      0)}
            {handle('w',  visH / 2,  0)}
          </div>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
