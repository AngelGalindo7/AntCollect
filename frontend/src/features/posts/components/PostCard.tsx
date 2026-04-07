import React, { useState } from 'react';
import type { Post } from '@/shared/types/Types';
import type { FolderType } from '@/shared/types/Types';
import { fetchWithAuth } from '@/shared/api/api';
import { createTradeRequest } from '@/features/trading/api/tradeRequestApi';
import type { TradeRequestType } from '@/features/trading/types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

interface PostCardProps {
  post: Post;
  imagePath: string | null;
  imageIndex: number;
  onClick?: (post: Post, imageIndex: number) => void;
  onLikeToggle?: (postId: number, isLiked: boolean) => void;
  folderType?: FolderType;
  postOwnerId?: number;
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  imagePath,
  imageIndex,
  onClick,
  onLikeToggle,
  folderType,
  postOwnerId,
}) => {
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.total_likes || 0);

  // Trade popover state
  const [tradeOpen, setTradeOpen] = useState(false);
  const [tradeSent, setTradeSent] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeBusy, setTradeBusy] = useState(false);

  const currentUserId = localStorage.getItem('userId');
  const isOwnPost = postOwnerId !== undefined && String(postOwnerId) === currentUserId;

  // Determine trade button label and request type based on folder context.
  let tradeLabel: string | null = null;
  let tradeRequestType: TradeRequestType | null = null;
  if (folderType && !isOwnPost && postOwnerId !== undefined) {
    if (folderType === 'looking_for') {
      tradeLabel = 'I have this';
      tradeRequestType = 'HAVE_WHAT_YOU_NEED';
    } else {
      tradeLabel = 'Interested';
      tradeRequestType = 'WANT_TO_TRADE';
    }
  }

  const handleClick = () => {
    onClick?.(post, imageIndex);
  };

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const previousLikedState = isLiked;
    const previousLikeCount = likeCount;
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikeCount((prev) => (newLikedState ? prev + 1 : prev - 1));

    try {
      const response = await fetchWithAuth(`${BACKEND_URL}/posts/like_image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ post_id: post.post_id }),
      });
      const data = await response.json();
      const expectedStatus = newLikedState ? 'Liked' : 'Unliked';
      if (!response.ok || data.message !== expectedStatus) {
        setIsLiked(previousLikedState);
        setLikeCount(previousLikeCount);
      } else {
        onLikeToggle?.(post.post_id, newLikedState);
      }
    } catch {
      setIsLiked(previousLikedState);
      setLikeCount(previousLikeCount);
    }
  };

  const handleSendTrade = async () => {
    if (!tradeRequestType || postOwnerId === undefined) return;
    setTradeBusy(true);
    setTradeError(null);
    try {
      await createTradeRequest({
        target_post_id: post.post_id,
        recipient_id: postOwnerId,
        request_type: tradeRequestType,
      });
      setTradeSent(true);
      setTradeOpen(false);
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail;
      if (detail?.includes('already have a pending')) {
        setTradeError('You already have a pending request for this post');
      } else if (detail?.includes('Too many declined')) {
        setTradeError('Too many declined requests to this user');
      } else {
        setTradeError('Failed to send request');
      }
    } finally {
      setTradeBusy(false);
    }
  };

  const getPostTypeLetter = (type: string) => type.charAt(0).toUpperCase();

  return (
    <div className="relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
      {/* Top: caption + type badge */}
      <div className="px-3 py-2 bg-white border-b border-gray-200 flex items-start justify-between">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1 pr-2">
          {post.caption || 'Untitled Post'}
        </h3>
        <div className="shrink-0 w-7 h-7 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-bold">
          {getPostTypeLetter(post.type)}
        </div>
      </div>

      {/* Image */}
      <div
        className="relative aspect-square overflow-hidden bg-gray-100 cursor-pointer group"
        onClick={handleClick}
      >
        {imagePath ? (
          <img
            src={imagePath}
            alt={post.caption || `Post ${post.post_id}`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Bottom bar: like + optional trade button */}
      <div className="px-3 py-2 bg-white border-t border-gray-200 flex items-center justify-between">
        <button
          onClick={handleLikeClick}
          className="flex items-center gap-2 text-sm font-medium transition-colors duration-200 hover:opacity-80"
          aria-label={isLiked ? 'Unlike post' : 'Like post'}
        >
          <svg
            className={`w-5 h-5 transition-colors duration-200 ${isLiked ? 'text-red-500 fill-red-500' : 'text-gray-400 fill-none'}`}
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span className={isLiked ? 'text-red-500' : 'text-gray-700'}>{likeCount}</span>
        </button>

        {/* Trade button — only when folderType is set and post belongs to another user */}
        {tradeLabel && !tradeSent && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setTradeOpen((o) => !o); setTradeError(null); }}
              className="flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-700 transition-colors"
              title={tradeLabel}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              {tradeLabel}
            </button>

            {tradeOpen && (
              <div
                className="absolute bottom-full right-0 mb-2 w-52 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-30 text-sm space-y-2"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="font-medium text-gray-800">Send trade request?</p>
                {tradeError && <p className="text-xs text-red-500">{tradeError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSendTrade}
                    disabled={tradeBusy}
                    className="flex-1 rounded bg-blue-500 text-white text-xs font-semibold py-1 hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    {tradeBusy ? 'Sending…' : 'Send'}
                  </button>
                  <button
                    onClick={() => setTradeOpen(false)}
                    className="flex-1 rounded bg-gray-200 text-gray-700 text-xs font-semibold py-1 hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tradeSent && (
          <span className="text-xs text-green-600 font-medium">Request sent</span>
        )}
      </div>
    </div>
  );
};

export default PostCard;
