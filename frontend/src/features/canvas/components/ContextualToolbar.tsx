import { ChevronUp, ChevronDown, Copy, Crop, Wand2, Sparkles, Lock, Unlock, Trash2, RotateCcw, RotateCw } from 'lucide-react';
import type { CSSProperties } from 'react';

interface Props {
  style: CSSProperties;
  isTop: boolean;
  isBottom: boolean;
  bgRemoved: boolean;
  holoOn: boolean;
  keepRatio: boolean;
  isRemovingBg: boolean;
  rotation: number;
  onLayerUp: () => void;
  onLayerDown: () => void;
  onDuplicate: () => void;
  onCrop: () => void;
  onToggleRemoveBg: () => void;
  onToggleHolo: () => void;
  onToggleKeepRatio: () => void;
  onRotate: (deg: number) => void;
  onDelete: () => void;
}

export function ContextualToolbar({
  style,
  isTop,
  isBottom,
  bgRemoved,
  holoOn,
  keepRatio,
  isRemovingBg,
  rotation,
  onLayerUp,
  onLayerDown,
  onDuplicate,
  onCrop,
  onToggleRemoveBg,
  onToggleHolo,
  onToggleKeepRatio,
  onRotate,
  onDelete,
}: Props) {
  const baseBtn: CSSProperties = {
    width: 30,
    height: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    background: 'transparent',
    color: 'var(--pw-ink2)',
    transition: 'background 120ms ease, color 120ms ease',
  };

  const activeStyle: CSSProperties = {
    color: 'var(--pw-accent)',
    background: 'var(--pw-accent-tint)',
  };

  const dangerStyle: CSSProperties = {
    color: 'var(--pw-danger)',
  };

  const divider: CSSProperties = {
    width: 1,
    height: 16,
    background: 'var(--pw-line)',
    margin: '0 4px',
  };

  return (
    <div
      className="paper-workshop pw-toolbar-shadow"
      style={{
        position: 'absolute',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: 4,
        background: 'var(--pw-paper)',
        border: '1px solid var(--pw-line)',
        borderRadius: 10,
        zIndex: 30,
        ...style,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        title="Bring forward"
        disabled={isTop}
        onClick={onLayerUp}
        style={{ ...baseBtn, opacity: isTop ? 0.35 : 1 }}
      >
        <ChevronUp size={16} strokeWidth={1.6} />
      </button>
      <button
        type="button"
        title="Send backward"
        disabled={isBottom}
        onClick={onLayerDown}
        style={{ ...baseBtn, opacity: isBottom ? 0.35 : 1 }}
      >
        <ChevronDown size={16} strokeWidth={1.6} />
      </button>

      <span style={divider} />

      <button type="button" title="Duplicate" onClick={onDuplicate} style={baseBtn}>
        <Copy size={16} strokeWidth={1.6} />
      </button>
      <button type="button" title="Crop" onClick={onCrop} style={baseBtn}>
        <Crop size={16} strokeWidth={1.6} />
      </button>
      <button
        type="button"
        title={bgRemoved ? 'Background removed' : 'Remove background'}
        disabled={isRemovingBg}
        onClick={onToggleRemoveBg}
        style={{ ...baseBtn, ...(bgRemoved ? activeStyle : {}), opacity: isRemovingBg ? 0.5 : 1 }}
      >
        <Wand2 size={16} strokeWidth={1.6} />
      </button>
      <button
        type="button"
        title={holoOn ? 'Holographic on' : 'Holographic off'}
        onClick={onToggleHolo}
        style={{ ...baseBtn, ...(holoOn ? activeStyle : {}) }}
      >
        <Sparkles size={16} strokeWidth={1.6} />
      </button>

      <span style={divider} />

      <button
        type="button"
        title={keepRatio ? 'Aspect ratio locked — uniform resize' : 'Aspect ratio free — drag any of 8 handles'}
        onClick={onToggleKeepRatio}
        style={{ ...baseBtn, ...(keepRatio ? activeStyle : {}) }}
      >
        {keepRatio ? <Lock size={16} strokeWidth={1.6} /> : <Unlock size={16} strokeWidth={1.6} />}
      </button>

      <span style={divider} />

      <button
        type="button"
        title="Rotate −15°"
        onClick={() => onRotate(rotation - 15)}
        style={baseBtn}
      >
        <RotateCcw size={16} strokeWidth={1.6} />
      </button>
      <span
        className="pw-mono"
        style={{ fontSize: 11, minWidth: 34, textAlign: 'center', color: 'var(--pw-ink2)', userSelect: 'none' }}
      >
        {Math.round(((rotation % 360) + 360) % 360)}°
      </span>
      <button
        type="button"
        title="Rotate +15°"
        onClick={() => onRotate(rotation + 15)}
        style={baseBtn}
      >
        <RotateCw size={16} strokeWidth={1.6} />
      </button>

      <span style={divider} />

      <button type="button" title="Delete" onClick={onDelete} style={{ ...baseBtn, ...dangerStyle }}>
        <Trash2 size={16} strokeWidth={1.6} />
      </button>
    </div>
  );
}
