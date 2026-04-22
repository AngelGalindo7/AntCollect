import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { Post, FolderType } from '@/shared/types/Types';
import PostImageFrame from './PostImageFrame';
import TradeEntryButton from './TradeEntryButton';
import TradeOfferPanel from '@/features/trading/components/TradeOfferPanel';
import { fetchWithAuth, API_BASE } from '@/shared/api/api';

interface PostDetailModalProps {
  post: Post;
  onClose: () => void;
  onDeleteSuccess?: () => void;
  postOwnerId?: number;
  folderType?: FolderType;
}

/**
 * Full-screen post detail overlay.
 * Layout: [TradeOfferPanel?] [profile header → PostImageFrame → caption bar]
 * Trade button is shown only when viewing another user's post with a folder context.
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
  const [tradeOpen, setTradeOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentUserId = localStorage.getItem('userId');
  const isOwn = postOwnerId !== undefined && String(postOwnerId) === currentUserId;
  const canTrade = !isOwn && postOwnerId !== undefined && folderType !== undefined;
  // Only allow deletion if the callback is provided (intended for Profile page)
  const canDelete = isOwn && !!onDeleteSuccess;

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

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

  const imageData = post.images?.[0];
  const imageSrc = imageData?.paths?.original ?? post.image_paths[0] ?? null;

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" />

      {/* Content row: panel + image */}
      <div
        className="relative z-10 flex items-center gap-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Trade panel slides in to the left of the image */}
        {tradeOpen && canTrade && (
          <div className="bg-soft-white rounded-l-sticker shadow-soft h-full animate-slide-in-left">
            <TradeOfferPanel
              targetPost={post}
              postOwnerId={postOwnerId!}
              folderType={folderType}
            />
          </div>
        )}

        {/* Image + overlays */}
        <div className={`relative ${tradeOpen ? 'rounded-r-sticker' : 'rounded-sticker'} bg-soft-white overflow-hidden shadow-soft`}>
          {/* Profile header */}
          {post.user && (
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 bg-warm-cream/60 hover:bg-warm-cream transition-colors"
              onClick={() => { onClose(); navigate(`/${post.user!.username}`); }}
            >
              {post.user.avatar_path ? (
                <img
                  src={post.user.avatar_path}
                  alt={post.user.username}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-uci-gold/40 shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-warm-cream ring-2 ring-uci-gold/40 flex items-center justify-center text-espresso font-medium text-sm shrink-0">
                  {post.user.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col items-start min-w-0">
                <span className="text-xs text-espresso/50 font-medium leading-none mb-0.5">Posted by</span>
                <span className="text-sm font-medium text-espresso leading-none">@{post.user.username}</span>
              </div>
              <svg className="w-4 h-4 text-espresso/30 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          <PostImageFrame
            src={imageSrc}
            alt={post.caption || `Post ${post.post_id}`}
            originalWidth={imageData?.original_width}
            originalHeight={imageData?.original_height}
          >
            {canTrade && (
              <TradeEntryButton
                isOpen={tradeOpen}
                onClick={() => setTradeOpen((o) => !o)}
              />
            )}

            {/* Delete button overlay for owners on profile page — uses Brick Red */}
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="absolute top-4 left-4 bg-brick-red hover:bg-brick-red/90 text-white px-4 py-2 rounded-full text-xs font-medium uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2 shadow-soft"
                title="Delete Post"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </PostImageFrame>

          {/* Caption bar */}
          <div className="bg-warm-cream/60 px-6 py-4">
            <p className="text-espresso/70 text-sm leading-relaxed">
              {post.caption || 'Untitled Post'}
            </p>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/80 hover:text-white text-2xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>,
    modalRoot,
  );
};

export default PostDetailModal;
