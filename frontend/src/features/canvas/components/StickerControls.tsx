import type { CSSProperties } from 'react';
import type { BackgroundConfig, CanvasNode } from '../types/canvas';
import { BACKGROUND_PRESETS } from '../constants/backgroundPresets';

interface RightPanelProps {
  background: BackgroundConfig;
  onChangeBackground: (bg: BackgroundConfig) => void;
  selectedId: string | null;
  nodes: CanvasNode[];
  isRemovingBg: boolean;
  removeBgError: string | null;
  onToggleRemoveBg: () => void;
  onToggleHolo: (id: string) => void;
}

const eyebrow: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--pw-ink3)',
  margin: 0,
};

function ToggleRow({
  label,
  hint,
  on,
  disabled,
  onToggle,
}: {
  label: string;
  hint: string;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '8px 10px',
        border: '1px solid var(--pw-line)',
        borderRadius: 8,
        background: on ? 'var(--pw-surface2)' : 'transparent',
        opacity: disabled ? 0.6 : 1,
        textAlign: 'left',
        transition: 'background 120ms ease',
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--pw-ink)' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--pw-ink3)' }}>{hint}</span>
      </span>
      <span
        aria-hidden
        style={{
          position: 'relative',
          width: 28,
          height: 16,
          borderRadius: 999,
          background: on ? 'var(--pw-ink)' : 'var(--pw-line2)',
          transition: 'background 120ms ease',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 14 : 2,
            width: 12,
            height: 12,
            background: '#fff',
            borderRadius: 999,
            boxShadow: '0 1px 2px rgba(0,0,0,.2)',
            transition: 'left 140ms ease',
          }}
        />
      </span>
    </button>
  );
}

export function StickerControls({
  background,
  onChangeBackground,
  selectedId,
  nodes,
  isRemovingBg,
  removeBgError,
  onToggleRemoveBg,
  onToggleHolo,
}: RightPanelProps) {
  const selectedNode = nodes.find((n) => n.id === selectedId);

  return (
    <div
      className="paper-workshop"
      style={{
        width: 280,
        flexShrink: 0,
        background: 'var(--pw-paper)',
        borderLeft: '1px solid var(--pw-line)',
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
        gap: 14,
        overflowY: 'auto',
      }}
    >
      <div>
        <p style={{ ...eyebrow, marginBottom: 10 }}>Background</p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: 6,
          }}
        >
          {BACKGROUND_PRESETS.map((p) => {
            const selected = background.value === p.bg.value;
            return (
              <button
                key={p.label}
                type="button"
                title={p.label}
                onClick={() => onChangeBackground(p.bg)}
                style={{
                  aspectRatio: '1 / 1',
                  borderRadius: 999,
                  border: selected ? '1.5px solid var(--pw-ink)' : '1px solid var(--pw-line2)',
                  outline: selected ? '2px solid var(--pw-ink)' : 'none',
                  outlineOffset: selected ? 2 : 0,
                  background: p.bg.value,
                  cursor: 'pointer',
                  transition: 'transform 120ms ease',
                }}
              />
            );
          })}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--pw-line)', paddingTop: 10 }}>
        <p style={{ ...eyebrow, marginBottom: 8 }}>Selected · {selectedNode ? 1 : 0}</p>
        {selectedNode ? (
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              padding: 10,
              background: 'var(--pw-surface2)',
              border: '1px solid var(--pw-line)',
              borderRadius: 10,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                background: 'var(--pw-paper)',
                border: '1px solid var(--pw-line)',
                borderRadius: 6,
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <img
                src={selectedNode.image_url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: 'var(--pw-ink)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedNode.source === 'library' ? 'Library sticker' : selectedNode.source === 'post' ? 'Post image' : 'Upload'}
              </span>
              <span className="pw-mono" style={{ fontSize: 11, color: 'var(--pw-ink3)' }}>
                {Math.round(selectedNode.x)}, {Math.round(selectedNode.y)} · {Math.round(selectedNode.width)}×{Math.round(selectedNode.height)}
              </span>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--pw-ink3)' }}>Click a sticker on the canvas to edit it.</p>
        )}
      </div>

      {selectedNode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={eyebrow}>Effects</p>
          <ToggleRow
            label="Holographic"
            hint="Iridescent foil"
            on={!!selectedNode.holo}
            onToggle={() => onToggleHolo(selectedNode.id)}
          />
          <ToggleRow
            label="Background removed"
            hint="Die-cut edge"
            on={!!selectedNode.bgRemoved}
            disabled={isRemovingBg}
            onToggle={onToggleRemoveBg}
          />
          {removeBgError && (
            <p style={{ fontSize: 11, color: 'var(--pw-danger)', margin: 0 }}>{removeBgError}</p>
          )}
        </div>
      )}
    </div>
  );
}
