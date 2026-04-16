import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Post, FolderType } from '@/shared/types/Types';
import PostImageFrame from './PostImageFrame';
import TradeEntryButton from './TradeEntryButton';
import TradeOfferPanel from '@/features/trading/components/TradeOfferPanel';

interface PostDetailModalProps {
  post: Post;
  onClose: () => void;
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
  postOwnerId,
  folderType,
}) => {
  const [tradeOpen, setTradeOpen] = useState(false);

  const currentUserId = localStorage.getItem('userId');
  const isOwn = postOwnerId !== undefined && String(postOwnerId) === currentUserId;
  const canTrade = !isOwn && postOwnerId !== undefined && folderType !== undefined;

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

  const imageSrc = post.images?.[0]?.paths?.original ?? post.image_paths[0] ?? null;

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
          <div className="bg-white rounded-l-2xl shadow-2xl border-r border-gray-100 h-full animate-slide-in-left">
            <TradeOfferPanel
              targetPost={post}
              postOwnerId={postOwnerId!}
              folderType={folderType}
            />
          </div>
        )}

        {/* Image + overlays */}
        <div className={`relative ${tradeOpen ? 'rounded-r-lg' : 'rounded-lg'}`}>
          <PostImageFrame
            src={imageSrc}
            alt={post.caption || `Post ${post.post_id}`}
          >
            {canTrade && (
              <TradeEntryButton
                isOpen={tradeOpen}
                onClick={() => setTradeOpen((o) => !o)}
              />
            )}
          </PostImageFrame>

          {/* Caption + likes bar below image */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 rounded-b-lg">
            <p className="text-white text-sm font-medium truncate">
              {post.caption || 'Untitled Post'}
            </p>
            <p className="text-white/70 text-xs mt-0.5">
              {post.total_likes ?? 0} {post.total_likes === 1 ? 'like' : 'likes'}
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
