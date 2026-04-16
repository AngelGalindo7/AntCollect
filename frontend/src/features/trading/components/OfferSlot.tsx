import React from 'react';
import type { Post } from '@/shared/types/Types';

interface OfferSlotProps {
  post: Post | null;
  onSelect: () => void;
  onRemove: () => void;
}

/**
 * A single trade offer slot.
 * Empty: shows a "+" button that triggers the post picker.
 * Filled: shows the post thumbnail with a remove "×" button.
 * No knowledge of the slot array or grid expansion logic.
 */
const OfferSlot: React.FC<OfferSlotProps> = ({ post, onSelect, onRemove }) => {
  if (post) {
    const thumb = post.images?.[0]?.paths?.medium ?? post.image_paths[0] ?? null;
    return (
      <div className="relative w-full aspect-square rounded-xl overflow-hidden border-2 border-blue-400 bg-gray-100 group">
        {thumb ? (
          <img
            src={thumb}
            alt={post.caption || `Post ${post.post_id}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        <button
          onClick={onRemove}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Remove offered post"
        >
          ×
        </button>
        <p className="absolute bottom-0 left-0 right-0 text-[10px] text-white bg-black/50 px-1 py-0.5 truncate">
          {post.caption || 'Untitled'}
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={onSelect}
      className="w-full aspect-square rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50 flex items-center justify-center transition-colors group"
      aria-label="Add post to offer"
    >
      <svg
        className="w-8 h-8 text-gray-300 group-hover:text-blue-400 transition-colors"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  );
};

export default OfferSlot;
