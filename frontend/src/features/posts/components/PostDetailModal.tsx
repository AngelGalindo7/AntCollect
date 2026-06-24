import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { Post, FolderType } from '@/shared/types/Types';
// DECOMMISSIONED 2026-05-06: trading & messaging — see docs/RECOMMISSION_TRADING_MESSAGING.md
// import TradeEntryButton from './TradeEntryButton';
// import TradeOfferPanel from '@/features/trading/components/TradeOfferPanel';
import { fetchWithAuth, API_BASE } from '@/shared/api/api';
import { getSession } from '@/shared/auth/session';
import { canModeratePosts } from '@/shared/auth/permissions';

interface PostDetailModalProps {
  post: Post;
  onClose: () => void;
  onDeleteSuccess?: () => void;
  postOwnerId?: number;
  folderType?: FolderType;
}

/**
 * Pure viewer for a post: avatar/username/caption header, image stage with
 * carousel navigation, and a navigation filmstrip for multi-image posts.
 * Owner content actions (e.g. "Save as stickers") live in the post's options
 * menu, not here — this surface is read-only.
 */
const PostDetailModal: React.FC<PostDetailModalProps> = ({
  post,
  onClose,
  onDeleteSuccess,
  postOwnerId,
}) => {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);

  const images = post.images ?? [];

  const session = getSession();
  const isOwn = postOwnerId !== undefined && String(postOwnerId) === session?.userId;
  const canAdminDelete = !isOwn && canModeratePosts(session) && !!onDeleteSuccess;

  const [activeIdx, setActiveIdx] = useState(0);
  const currentImg = images[activeIdx];
  const canNav = images.length > 1;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setActiveIdx(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setActiveIdx(i => Math.min(images.length - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, images.length]);

  const handleAdminDelete = async () => {
    if (!window.confirm("You are deleting another user's post as a moderator. This action is irreversible. Continue?")) return;
    setIsDeleting(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/posts/${post.post_id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete post');
      onDeleteSuccess?.();
    } catch (err) {
      console.error('Error deleting post:', err);
      alert('Failed to delete post. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const imageSrc = currentImg?.paths?.original ?? post.image_paths[activeIdx] ?? null;

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl leading-none flex items-center justify-center transition-colors"
        aria-label="Close"
      >
        ×
      </button>

      {/* Viewer card — hugs the image so there is no dead side space */}
      <div
        className="relative z-10 inline-flex flex-col min-w-[320px] max-w-[92vw] rounded-2xl overflow-hidden bg-[#15161a] ring-1 ring-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: avatar + username + caption */}
        {post.user && (
          <div className="flex items-center gap-3 px-4 pt-4 pb-3 shrink-0">
            {post.user.avatar_path ? (
              <img
                src={post.user.avatar_path}
                alt={post.user.username}
                className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-white/20"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <button
                type="button"
                onClick={() => { onClose(); navigate(`/${post.user!.username}`); }}
                className="text-sm font-semibold text-white/90 hover:text-white hover:underline"
              >
                {post.user.username}
              </button>
              {post.caption && (
                <p className="text-xs text-white/50 line-clamp-2 mt-0.5 leading-snug">{post.caption}</p>
              )}
            </div>
          </div>
        )}

        {/* Image stage */}
        <div className="relative bg-black/30 flex items-center justify-center">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={post.caption || `Post ${post.post_id}`}
              className="max-w-[92vw] max-h-[62vh] w-auto h-auto object-contain select-none"
              draggable={false}
            />
          ) : (
            <div className="w-[min(80vw,420px)] h-[40vh] flex flex-col items-center justify-center text-white/40 gap-3">
              <svg className="w-16 h-16 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-medium uppercase tracking-wider">Image not found</span>
            </div>
          )}

          {/* "2 / 5" counter */}
          {canNav && (
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 text-white/75 text-xs font-medium tabular-nums pointer-events-none">
              {activeIdx + 1} / {images.length}
            </div>
          )}

          {/* Admin delete badge */}
          {canAdminDelete && (
            <button
              onClick={handleAdminDelete}
              disabled={isDeleting}
              className="absolute top-3 left-3 bg-red-700/90 hover:bg-red-800 text-white px-3 py-1.5 rounded-full text-[10px] font-medium uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-1.5 shadow"
              title="Delete as moderator"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
              </svg>
              {isDeleting ? 'Deleting...' : 'Delete (admin)'}
            </button>
          )}

          {/* Carousel arrows */}
          {canNav && activeIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setActiveIdx(i => i - 1); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center transition-colors shadow-lg"
              aria-label="Previous image"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {canNav && activeIdx < images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setActiveIdx(i => i + 1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center transition-colors shadow-lg"
              aria-label="Next image"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Navigation filmstrip — multi-image posts only */}
        {canNav && (
          <div className="border-t border-white/10 bg-white/2 px-4 py-3 shrink-0">
            <div className="flex gap-2.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
              {images.map((img, i) => {
                const thumbSrc = img.paths?.thumbnail ?? img.paths?.original ?? post.image_paths[i];
                const isActive = i === activeIdx;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    className={`relative shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all duration-150
                      ${isActive
                        ? 'ring-2 ring-white opacity-100'
                        : 'ring-1 ring-white/10 opacity-55 hover:opacity-90'}`}
                    aria-label={`View image ${i + 1}`}
                  >
                    <img
                      src={thumbSrc}
                      alt=""
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>,
    modalRoot,
  );
};

export default PostDetailModal;
