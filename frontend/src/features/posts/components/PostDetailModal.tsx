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
 * Full-screen image lightbox for a post.
 * Image floats on a dark blurred backdrop; metadata (avatar/@username, caption,
 * "Open original" link) renders below the image as muted text.
 * Portals to #modal-root to escape layout stacking contexts.
 */
const PostDetailModal: React.FC<PostDetailModalProps> = ({
  post,
  onClose,
  onDeleteSuccess,
  postOwnerId,
  folderType,
}) => {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);

  const session = getSession();
  const isOwn = postOwnerId !== undefined && String(postOwnerId) === session?.userId;
  void folderType;
  const canAdminDelete = !isOwn && canModeratePosts(session) && !!onDeleteSuccess;

  const images = post.images ?? [];
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

  const performDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/posts/${post.post_id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete post');
      }

      onDeleteSuccess?.();
    } catch (err) {
      console.error('Error deleting post:', err);
      alert('Failed to delete post. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAdminDelete = async () => {
    if (!window.confirm("You are deleting another user's post as a moderator. This action is irreversible. Continue?")) {
      return;
    }
    await performDelete();
  };

  const imageSrc = currentImg?.paths?.original ?? post.image_paths[activeIdx] ?? null;

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10"
      onClick={onClose}
    >
      {/* Dark blurred backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

      {/* Close button — fixed to viewport top-right */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl leading-none flex items-center justify-center backdrop-blur transition-colors"
        aria-label="Close"
      >
        ×
      </button>

      {/* Stage: image + metadata */}
      <div
        className="relative z-10 flex flex-col items-center max-w-full max-h-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image with carousel arrows + admin badge layered on top */}
        <div className="relative inline-flex">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={post.caption || `Post ${post.post_id}`}
              className="max-h-[80vh] max-w-[90vw] w-auto h-auto object-contain rounded-md shadow-2xl select-none"
              draggable={false}
            />
          ) : (
            <div className="w-[min(85vw,500px)] h-[min(60vh,500px)] flex flex-col items-center justify-center text-white/40 gap-3 rounded-md bg-white/5">
              <svg className="w-16 h-16 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-medium uppercase tracking-wider">Image not found</span>
            </div>
          )}

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

          {canNav && activeIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setActiveIdx(i => i - 1); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
              aria-label="Previous image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {canNav && activeIdx < images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setActiveIdx(i => i + 1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
              aria-label="Next image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Metadata row */}
        <div className="mt-4 flex flex-col items-center gap-2 max-w-[90vw]">
          {post.user && (
            <button
              type="button"
              onClick={() => { onClose(); navigate(`/${post.user!.username}`); }}
              className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
            >
              {post.user.avatar_path ? (
                <img
                  src={post.user.avatar_path}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover ring-1 ring-white/20"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center text-[10px] font-medium">
                  {post.user.username.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium">@{post.user.username}</span>
            </button>
          )}

          {post.caption && (
            <p className="text-center text-white/60 text-xs leading-relaxed line-clamp-3 max-w-md">
              {post.caption}
            </p>
          )}

          {canNav && (
            <div className="flex gap-1.5 mt-1">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activeIdx ? 'bg-white' : 'bg-white/30 hover:bg-white/60'}`}
                  aria-label={`Image ${i + 1}`}
                />
              ))}
            </div>
          )}

          {imageSrc && (
            <a
              href={imageSrc}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-white/50 hover:text-white/90 hover:underline transition-colors"
            >
              Open original
            </a>
          )}
        </div>
      </div>
    </div>,
    modalRoot,
  );
};

export default PostDetailModal;
