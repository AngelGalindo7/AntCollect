import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { CanvasNode } from '../types/canvas';

interface Props {
  currentWidth: number;
  currentHeight: number;
  nodes: CanvasNode[];
  onApply: (width: number, height: number) => void;
  onClose: () => void;
}

interface Preset {
  label: string;
  ratio: [number, number];
}

const PRESETS: Preset[] = [
  { label: '16:9', ratio: [16, 9] },
  { label: '4:3', ratio: [4, 3] },
  { label: '1:1', ratio: [1, 1] },
  { label: '3:4', ratio: [3, 4] },
  { label: '9:16', ratio: [9, 16] },
];

// Canvas long-edge baseline used to derive preset dimensions.
const PRESET_LONG_EDGE = 1440;
const MIN_DIMENSION = 200;
const MAX_DIMENSION = 4000;

function presetSize(ratio: [number, number]): { w: number; h: number } {
  const [a, b] = ratio;
  if (a >= b) {
    const w = PRESET_LONG_EDGE;
    return { w, h: Math.round((w * b) / a) };
  }
  const h = PRESET_LONG_EDGE;
  return { w: Math.round((h * a) / b), h };
}

const eyebrow: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--pw-ink3)',
  margin: 0,
};

export function CanvasSizePopover({ currentWidth, currentHeight, nodes, onApply, onClose }: Props) {
  const [w, setW] = useState<number>(Math.round(currentWidth));
  const [h, setH] = useState<number>(Math.round(currentHeight));
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const overflowingNodes = useMemo(() => {
    return nodes.filter((n) => n.x < 0 || n.y < 0 || n.x + n.width > w || n.y + n.height > h);
  }, [nodes, w, h]);

  const isValid =
    Number.isFinite(w) && Number.isFinite(h) &&
    w >= MIN_DIMENSION && w <= MAX_DIMENSION &&
    h >= MIN_DIMENSION && h <= MAX_DIMENSION;
  const blocked = overflowingNodes.length > 0;
  const unchanged = w === Math.round(currentWidth) && h === Math.round(currentHeight);

  const setPreset = (preset: Preset) => {
    const { w: pw, h: ph } = presetSize(preset.ratio);
    setW(pw);
    setH(ph);
  };

  const activePreset = PRESETS.find((p) => {
    const { w: pw, h: ph } = presetSize(p.ratio);
    return pw === w && ph === h;
  });

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        right: 0,
        width: 280,
        background: 'var(--pw-paper)',
        border: '1px solid var(--pw-line)',
        borderRadius: 10,
        boxShadow: '0 10px 32px rgba(0,0,0,.16)',
        padding: 14,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div>
        <p style={eyebrow}>Aspect ratio</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {PRESETS.map((preset) => {
            const isActive = activePreset?.label === preset.label;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => setPreset(preset)}
                className="pw-mono"
                style={{
                  height: 28,
                  padding: '0 10px',
                  fontSize: 11.5,
                  fontWeight: 500,
                  borderRadius: 6,
                  border: `1px solid ${isActive ? 'var(--pw-ink)' : 'var(--pw-line)'}`,
                  background: isActive ? 'var(--pw-ink)' : 'transparent',
                  color: isActive ? 'var(--pw-paper)' : 'var(--pw-ink2)',
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p style={eyebrow}>Custom size</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <input
            type="number"
            value={Number.isFinite(w) ? w : ''}
            min={MIN_DIMENSION}
            max={MAX_DIMENSION}
            onChange={(e) => setW(Number(e.target.value))}
            className="pw-mono"
            style={inputStyle}
          />
          <span style={{ fontSize: 12, color: 'var(--pw-ink3)' }}>×</span>
          <input
            type="number"
            value={Number.isFinite(h) ? h : ''}
            min={MIN_DIMENSION}
            max={MAX_DIMENSION}
            onChange={(e) => setH(Number(e.target.value))}
            className="pw-mono"
            style={inputStyle}
          />
          <span style={{ fontSize: 11, color: 'var(--pw-ink3)' }}>px</span>
        </div>
      </div>

      {blocked && (
        <div
          style={{
            fontSize: 11.5,
            lineHeight: 1.45,
            color: 'var(--pw-danger)',
            background: 'rgba(180,40,40,.06)',
            border: '1px solid rgba(180,40,40,.18)',
            borderRadius: 6,
            padding: '6px 8px',
          }}
        >
          {overflowingNodes.length} sticker{overflowingNodes.length === 1 ? '' : 's'} would fall outside the new canvas. Move or delete them, then crop.
        </div>
      )}
      {!blocked && !isValid && (
        <div style={{ fontSize: 11.5, color: 'var(--pw-danger)' }}>
          Width and height must be between {MIN_DIMENSION} and {MAX_DIMENSION} px.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            height: 28,
            padding: '0 12px',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--pw-ink2)',
            background: 'transparent',
            borderRadius: 6,
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onApply(w, h)}
          disabled={!isValid || blocked || unchanged}
          style={{
            height: 28,
            padding: '0 14px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--pw-paper)',
            background: 'var(--pw-ink)',
            borderRadius: 6,
            opacity: !isValid || blocked || unchanged ? 0.45 : 1,
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: 72,
  height: 28,
  padding: '0 8px',
  fontSize: 12,
  border: '1px solid var(--pw-line)',
  borderRadius: 6,
  background: 'var(--pw-surface)',
  color: 'var(--pw-ink)',
  outline: 'none',
};
