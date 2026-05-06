import { Lock, Unlock, Trash2 } from 'lucide-react';
import type { Panel, WorkspaceBounds, Rect, ResizeMode } from '../types/workspace';
import { useDragResize } from '../hooks/useDragResize';

const TITLE_H = 28;

interface Props {
  panel: Panel;
  isOwner: boolean;
  isEditing: boolean;
  isFocused: boolean;
  bounds: WorkspaceBounds;
  others: Rect[];
  onUpdateRect: (id: number, rect: Partial<Pick<Panel, 'x' | 'y' | 'w' | 'h'>>) => void;
  onCommitRect: (id: number) => void;
  onFocus: (id: number) => void;
  onBringToFront: (id: number) => void;
  onDelete: (id: number) => void;
  onLock: (id: number, locked: boolean) => void;
  onEnterEdit: (id: number) => void;
  children: React.ReactNode;
}

const RESIZE_MODES: { mode: ResizeMode; cursor: string; style: React.CSSProperties }[] = [
  { mode: 'n',  cursor: 'ns-resize',   style: { top: -4, left: 8, right: 8, height: 8 } },
  { mode: 's',  cursor: 'ns-resize',   style: { bottom: -4, left: 8, right: 8, height: 8 } },
  { mode: 'e',  cursor: 'ew-resize',   style: { right: -4, top: 8, bottom: 8, width: 8 } },
  { mode: 'w',  cursor: 'ew-resize',   style: { left: -4, top: 8, bottom: 8, width: 8 } },
  { mode: 'ne', cursor: 'nesw-resize', style: { top: -4, right: -4, width: 12, height: 12 } },
  { mode: 'nw', cursor: 'nwse-resize', style: { top: -4, left: -4, width: 12, height: 12 } },
  { mode: 'se', cursor: 'nwse-resize', style: { bottom: -4, right: -4, width: 12, height: 12 } },
  { mode: 'sw', cursor: 'nesw-resize', style: { bottom: -4, left: -4, width: 12, height: 12 } },
];

export function PanelFrame({
  panel, isOwner, isEditing, isFocused, bounds, others,
  onUpdateRect, onCommitRect, onFocus, onBringToFront,
  onDelete, onLock, onEnterEdit, children,
}: Props) {
  const { dragHandleProps, resizeHandleProps } = useDragResize({
    panelId: panel.id,
    rect: { x: panel.x, y: panel.y, w: panel.w, h: panel.h },
    locked: panel.locked,
    others,
    bounds,
    onRectChange: (id, rect) => onUpdateRect(id, rect),
    onCommit: onCommitRect,
    onFocus,
  });

  const accent = panel.accent ?? '#FFD200';

  return (
    <div
      style={{
        position: 'absolute',
        left: panel.x,
        top: panel.y,
        width: panel.w,
        height: panel.h,
        zIndex: panel.z,
      }}
      className="group"
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-title-bar]')) return;
        if (!isEditing && isOwner) onEnterEdit(panel.id);
      }}
    >
      {/* Title bar */}
      <div
        data-title-bar
        style={{ height: TITLE_H, background: accent }}
        className="flex items-center px-2 gap-1 select-none rounded-t-lg cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button')) return;
          dragHandleProps(e);
          onBringToFront(panel.id);
        }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          onBringToFront(panel.id);
        }}
      >
        <span
          className="flex-1 truncate text-xs font-semibold"
          style={{ color: '#332D2A' }}
        >
          {panel.title ?? 'Panel'}
        </span>

        {isOwner && (
          <>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onLock(panel.id, !panel.locked); }}
              className="p-0.5 rounded hover:bg-black/10 transition-colors shrink-0"
              title={panel.locked ? 'Unlock' : 'Lock'}
            >
              {panel.locked
                ? <Lock size={12} className="text-espresso" />
                : <Unlock size={12} className="text-espresso" />
              }
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDelete(panel.id); }}
              className="p-0.5 rounded hover:bg-red-100 transition-colors shrink-0"
              title="Delete panel"
            >
              <Trash2 size={12} className="text-red-500" />
            </button>
          </>
        )}
      </div>

      {/* Body */}
      <div
        style={{
          position: 'absolute',
          top: TITLE_H,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          pointerEvents: isEditing ? 'auto' : 'none',
        }}
      >
        {children}
      </div>

      {/* Lock overlay */}
      {panel.locked && (
        <div
          style={{
            position: 'absolute',
            top: TITLE_H,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(51,45,42,0.08)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Size badge */}
      <div
        className="absolute bottom-1.5 right-1.5 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
      >
        {Math.round(panel.w)}×{Math.round(panel.h)}
      </div>

      {/* Resize handles */}
      {isOwner && !panel.locked && RESIZE_MODES.map(({ mode, cursor, style }) => (
        <div
          key={mode}
          style={{
            position: 'absolute',
            cursor,
            zIndex: 10,
            ...style,
          }}
          onPointerDown={resizeHandleProps(mode)}
        />
      ))}

      {/* Panel border — only visible when focused/dragging */}
      {isFocused && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            border: `2px solid ${accent}`,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
