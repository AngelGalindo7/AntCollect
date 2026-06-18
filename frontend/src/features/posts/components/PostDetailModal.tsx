import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const images = post.images ?? [];
  const showPromote = (() => {
    const session = getSession();
    const own = postOwnerId !== undefined && String(postOwnerId) === session?.userId;
    return own && folderType !== 'looking_for' && images.length > 0;
  })();
  const [selectedIdxs, setSelectedIdxs] = useState<number[]>(() =>
    images.map((_, i) => i)
  );
  const [promoting, setPromoting] = useState(false);
  const [promotedCount, setPromotedCount] = useState<number | null>(null);

  const toggleIdx = (i: number) =>
    setSelectedIdxs((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort((a, b) => a - b)
    );

  const handlePromote = async () => {
    if (!selectedIdxs.length || promoting) return;
    setPromoting(true);
    try {
      const groups = selectedIdxs.map((idx) => [idx + 1]);
      const res = await fetchWithAuth(`${API_BASE}/stickers/me/from-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.post_id, groups }),
      });
      if (res.ok) {
        const created = await res.json();
        setPromotedCount(created.length);
        queryClient.invalidateQueries({ queryKey: ['my-stickers'] });
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setPromotedCount(null), 2500);
      }
    } finally {
      setPromoting(false);
    }
  };

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
    return () => { if (successTimerRef.current) clearTimeout(successTimerRef.current); };
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
        {/* User identity — top-left, above the image */}
        {post.user && (
          <div className="self-start flex items-center gap-2.5 mb-3">
            {post.user.avatar_path ? (
              <img
                src={post.user.avatar_path}
                alt={post.user.username}
                className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-white/30"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
            <button
              type="button"
              onClick={() => { onClose(); navigate(`/${post.user!.username}`); }}
              className="text-sm font-semibold text-white/90 hover:text-white hover:underline"
            >
              {post.user.username}
            </button>
          </div>
        )}

        {/* Image with carousel arrows + admin badge layered on top */}
        <div className="relative inline-flex">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={post.caption || `Post ${post.post_id}`}
              className={`${canNav ? 'max-h-[68vh]' : 'max-h-[80vh]'} max-w-[90vw] w-auto h-auto object-contain rounded-md shadow-2xl select-none`}
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

        {/* Thumbnail strip */}
        {canNav && (
          <div className="mt-4 flex gap-2 overflow-x-auto max-w-[90vw] px-1 py-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
            {images.map((img, i) => {
              const thumbSrc = img.paths?.thumbnail ?? img.paths?.original ?? post.image_paths[i];
              return (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className={`shrink-0 w-14 h-14 rounded-md overflow-hidden ring-2 transition-all ${i === activeIdx ? 'ring-white opacity-100' : 'ring-transparent opacity-50 hover:opacity-100'}`}
                  aria-label={`Image ${i + 1}`}
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
        )}

        {/* Caption */}
        {post.caption && (
          <p className="mt-3 text-center text-sm text-white/70 max-w-xl line-clamp-2 px-2">
            {post.caption}
          </p>
        )}

        {/* Promote to sticker — owner only, collection/trading only */}
        {showPromote && (
          <div className="mt-4 flex flex-col items-center gap-2.5 max-w-[90vw]">
            {promotedCount !== null ? (
              <p className="text-sm font-semibold text-emerald-400">
                ✓ {promotedCount} sticker{promotedCount !== 1 ? 's' : ''} added to your collection
              </p>
            ) : (
              <>
                {images.length > 1 && (
                  <div className="flex gap-2 flex-wrap justify-center">
                    {images.map((img, i) => {
                      const thumb = img.paths?.thumbnail ?? img.paths?.original;
                      const checked = selectedIdxs.includes(i);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleIdx(i)}
                          className={`relative w-12 h-12 rounded-md overflow-hidden ring-2 transition-all ${checked ? 'ring-uci-gold opacity-100' : 'ring-transparent opacity-40 hover:opacity-70'}`}
                          aria-label={`${checked ? 'Deselect' : 'Select'} image ${i + 1}`}
                        >
                          {thumb && <img src={thumb} alt="" className="w-full h-full object-cover" draggable={false} />}
                          {checked && (
                            <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-uci-gold flex items-center justify-center">
                              <svg className="w-2.5 h-2.5 text-uci-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handlePromote}
                  disabled={promoting || selectedIdxs.length === 0}
                  className="px-4 py-1.5 rounded-full text-xs font-bold text-uci-navy bg-uci-gold hover:brightness-105 disabled:opacity-40 transition-all"
                >
                  {promoting
                    ? 'Saving…'
                    : images.length > 1
                      ? `Save ${selectedIdxs.length} as individual sticker${selectedIdxs.length !== 1 ? 's' : ''}`
                      : 'Add to my stickers'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    modalRoot,
  );
};

export default PostDetailModal;
