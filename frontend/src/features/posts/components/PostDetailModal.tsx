import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
 * Layout: [TradeOfferPanel?] [PostImageFrame + TradeEntryButton] [caption/likes]
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
          <div className="bg-soft-white rounded-l-sticker shadow-soft border-2 border-warm-gray border-r-0 h-full animate-slide-in-left">
            <TradeOfferPanel
              targetPost={post}
              postOwnerId={postOwnerId!}
              folderType={folderType}
            />
          </div>
        )}

        {/* Image + overlays */}
        <div className={`relative ${tradeOpen ? 'rounded-r-sticker' : 'rounded-sticker'} border-[3px] border-warm-gray bg-soft-white overflow-hidden shadow-soft`}>
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
                className="absolute top-4 left-4 bg-brick-red hover:bg-brick-red/90 text-white px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2 shadow-soft"
                title="Delete Post"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </PostImageFrame>

          {/* Caption + likes bar below image — using espresso text on soft-white */}
          <div className="bg-soft-white border-t border-warm-gray px-6 py-4">
            <p className="text-espresso text-lg font-black uppercase tracking-tight truncate">
              {post.caption || 'Untitled Post'}
            </p>
            <div className="flex items-center justify-between mt-1">
                <p className="text-espresso/50 text-xs font-bold uppercase tracking-widest">
                {post.total_likes ?? 0} {post.total_likes === 1 ? 'Collector Liked' : 'Collectors Liked'}
                </p>
                <div className="flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-campus-gold" />
                     <span className="text-[10px] text-espresso/40 font-bold uppercase">Ready to Trade</span>
                </div>
            </div>
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
