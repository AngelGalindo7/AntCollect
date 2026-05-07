import { useState } from 'react';
import { Lock, Unlock, Trash2, Pencil, LogOut } from 'lucide-react';
import type { Panel, WorkspaceBounds, Rect, ResizeMode } from '../types/workspace';
import { useDragResize } from '../hooks/useDragResize';

interface Props {
  panel: Panel;
  isOwner: boolean;
  isWorkspaceEditMode: boolean;
  bounds: WorkspaceBounds;
  others: Rect[];
  onUpdateRect: (id: number, rect: Partial<Pick<Panel, 'x' | 'y' | 'w' | 'h'>>) => void;
  onCommitRect: (id: number) => void;
  onFocus: (id: number) => void;
  onBringToFront: (id: number) => void;
  onDelete: (id: number) => void;
  onRemoveFromWorkspace: (id: number) => void;
  onLock: (id: number, locked: boolean) => void;
  onEnterEdit: (id: number) => void;
  children: React.ReactNode;
}

const RESIZE_MODES: { mode: ResizeMode; cursor: string; style: React.CSSProperties }[] = [
  { mode: 'ne', cursor: 'nesw-resize', style: { top: -6, right: -6, width: 14, height: 14 } },
  { mode: 'nw', cursor: 'nwse-resize', style: { top: -6, left: -6, width: 14, height: 14 } },
  { mode: 'se', cursor: 'nwse-resize', style: { bottom: -6, right: -6, width: 14, height: 14 } },
  { mode: 'sw', cursor: 'nesw-resize', style: { bottom: -6, left: -6, width: 14, height: 14 } },
];

export function PanelFrame({
  panel, isOwner, isWorkspaceEditMode, bounds, others,
  onUpdateRect, onCommitRect, onFocus, onBringToFront,
  onDelete, onRemoveFromWorkspace, onLock, onEnterEdit, children,
}: Props) {
  const [isHovered, setIsHovered] = useState(false);

  const isDraggable = isOwner && isWorkspaceEditMode && !panel.locked;
  const showControls = isOwner && isWorkspaceEditMode && isHovered;

  const { dragHandleProps, resizeHandleProps } = useDragResize({
    panelId: panel.id,
    rect: { x: panel.x, y: panel.y, w: panel.w, h: panel.h },
    locked: panel.locked || !isWorkspaceEditMode,
    others,
    bounds,
    uniform: true,
    onRectChange: (id, rect) => onUpdateRect(id, rect),
    onCommit: onCommitRect,
    onFocus,
  });

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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={() => {
        onFocus(panel.id);
        onBringToFront(panel.id);
      }}
    >
      {/* Canvas content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: isWorkspaceEditMode
            ? '0 0 0 2px rgba(74,55,40,0.15), 0 4px 16px rgba(0,0,0,0.12)'
            : '0 2px 12px rgba(0,0,0,0.08)',
          transition: 'box-shadow 200ms',
        }}
      >
        {children}
      </div>

      {/* Drag overlay */}
      {isDraggable && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 12,
            zIndex: 2,
            cursor: 'grab',
          }}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('[data-panel-ctrl]')) return;
            dragHandleProps(e);
          }}
        />
      )}

      {/* Hover controls */}
      {showControls && (
        <div
          data-panel-ctrl
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onEnterEdit(panel.id); }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-espresso text-xs font-semibold shadow-md hover:bg-white transition-colors"
          >
            <Pencil size={11} strokeWidth={2.5} />
            Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onLock(panel.id, !panel.locked); }}
            title={panel.locked ? 'Unlock canvas' : 'Lock canvas'}
            className="flex items-center justify-center w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm text-espresso shadow-md hover:bg-white transition-colors"
          >
            {panel.locked ? <Unlock size={12} /> : <Lock size={12} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemoveFromWorkspace(panel.id); }}
            title="Remove from workspace (keeps canvas in library)"
            className="flex items-center justify-center w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm text-neutral-500 shadow-md hover:bg-white transition-colors"
          >
            <LogOut size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('Delete this canvas permanently? This cannot be undone.')) {
                onDelete(panel.id);
              }
            }}
            title="Delete permanently"
            className="flex items-center justify-center w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm text-red-400 shadow-md hover:bg-white transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {/* Locked badge */}
      {panel.locked && isWorkspaceEditMode && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 5,
            background: 'rgba(255,255,255,0.80)',
            borderRadius: 20,
            padding: '2px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            pointerEvents: 'none',
          }}
        >
          <Lock size={9} style={{ color: 'rgba(51,45,42,0.5)' }} />
          <span style={{ fontSize: 10, color: 'rgba(51,45,42,0.5)', fontWeight: 500 }}>Locked</span>
        </div>
      )}

      {/* Resize handles */}
      {isOwner && isWorkspaceEditMode && !panel.locked &&
        RESIZE_MODES.map(({ mode, cursor, style }) => (
          <div
            key={mode}
            style={{ position: 'absolute', cursor, zIndex: 10, ...style }}
            onPointerDown={resizeHandleProps(mode)}
          />
        ))}
    </div>
  );
}
