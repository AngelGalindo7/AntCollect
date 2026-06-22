import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreVertical } from 'lucide-react';
import { deletePanel } from '@/features/workspace/api/workspaceApi';
import type { Panel } from '@/features/workspace/types/workspace';

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  if (days < 365) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

interface Props {
  panel: Panel;
  index: number;
  onDeleted: () => void;
}

export function StudioPanelCard({ panel, index, onDeleted }: Props) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasHolo = (panel.canvas_json?.nodes ?? []).some((n) => n.holo);
  const stickerCount = panel.canvas_json?.nodes?.length ?? 0;
  const tilt = index % 2 === 0 ? '-rotate-[1.5deg]' : 'rotate-[1.5deg]';

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this canvas? This cannot be undone.')) return;
    setDeleting(true);
    setMenuOpen(false);
    try {
      await deletePanel(panel.id);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div
      className={`group relative rounded-2xl shadow-md hover:shadow-xl transition-all duration-200 ease-out cursor-pointer ${tilt} hover:rotate-0 hover:scale-[1.02]`}
      onClick={() => navigate(`/studio/canvas/${panel.id}`)}
    >
      {/* Thumbnail */}
      <div
        className="w-full rounded-t-2xl overflow-hidden bg-warm-gray/20"
        style={{ aspectRatio: `${panel.w} / ${panel.h}` }}
      >
        {panel.preview_path ? (
          <img
            src={panel.preview_path}
            alt={panel.title ?? 'Canvas'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-espresso/20 text-xs font-mono">
              {panel.w}×{panel.h}
            </span>
          </div>
        )}
      </div>

      {/* Holo badge */}
      {hasHolo && (
        <div
          className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white pointer-events-none"
          style={{ background: 'linear-gradient(135deg, #667eea, #764ba2, #f5576c)' }}
        >
          ✦ Holo
        </div>
      )}

      {/* Three-dot menu */}
      <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
        <button
          className="w-7 h-7 rounded-full bg-white/85 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity shadow-sm"
          onClick={() => setMenuOpen((v) => !v)}
          title="More options"
        >
          <MoreVertical className="w-3.5 h-3.5 text-espresso" />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-xl border border-warm-gray/30 overflow-hidden min-w-[140px]">
              <button
                className="w-full text-left px-4 py-2.5 text-sm text-espresso hover:bg-warm-cream/70 transition-colors"
                onClick={() => { setMenuOpen(false); navigate(`/studio/canvas/${panel.id}`); }}
              >
                Edit
              </button>
              <button
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-b-2xl px-4 py-3">
        <p className="text-sm font-bold text-espresso truncate">
          {panel.title ?? 'Untitled Canvas'}
        </p>
        <p className="text-xs text-espresso/50 mt-0.5 truncate">
          {panel.w}×{panel.h} · {stickerCount} sticker{stickerCount !== 1 ? 's' : ''} ·{' '}
          {relativeDate(panel.created_at)}
        </p>
      </div>
    </div>
  );
}
