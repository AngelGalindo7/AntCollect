import type { Panel, WorkspaceBounds } from '../types/workspace';
import { MINIMAP_W } from '../constants';

interface Props {
  panels: Panel[];
  bounds: WorkspaceBounds;
  focusedId: number | null;
  onFocus: (id: number) => void;
}

export function Minimap({ panels, bounds, focusedId, onFocus }: Props) {
  if (bounds.w === 0 || bounds.h === 0) return null;

  const aspectH = MINIMAP_W * (bounds.h / bounds.w);
  const scaleX = MINIMAP_W / bounds.w;
  const scaleY = aspectH / bounds.h;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        width: MINIMAP_W,
        height: aspectH,
        background: 'rgba(51,45,42,0.08)',
        border: '1px solid rgba(51,45,42,0.15)',
        borderRadius: 8,
        overflow: 'hidden',
        pointerEvents: 'auto',
      }}
    >
      {panels.map((panel) => (
        <div
          key={panel.id}
          onClick={() => onFocus(panel.id)}
          title={panel.title ?? 'Panel'}
          style={{
            position: 'absolute',
            left: panel.x * scaleX,
            top: panel.y * scaleY,
            width: Math.max(panel.w * scaleX, 4),
            height: Math.max(panel.h * scaleY, 4),
            background: panel.accent ?? '#FFD200',
            borderRadius: 2,
            border: focusedId === panel.id
              ? '1.5px solid #332D2A'
              : '1px solid rgba(51,45,42,0.2)',
            cursor: 'pointer',
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}
