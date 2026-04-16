import React, { useState, useRef, useEffect } from 'react';
import type { Post } from '@/shared/types/Types';
import type { FolderType } from '@/shared/types/Types';
import { fetchWithAuth } from '@/shared/api/api';

interface DropdownOption {
  icon: React.ReactNode;
  label: string;
}

const DROPDOWN_OPTIONS: DropdownOption[] = [
  {
    label: 'Add to folder',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    label: 'Share',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
    ),
  },
  {
    label: 'View details',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    label: 'Report',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
      </svg>
    ),
  },
];

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
}) => {
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.total_likes || 0);

  // Options dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [dropdownOpen]);

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

  return (
    <div className="relative bg-white rounded-2xl overflow-hidden shadow-sm hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
      {/* Image — leads the card */}
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

        {/* Three-dot options button */}
        <div
          ref={dropdownRef}
          className="absolute top-2 right-2 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors backdrop-blur-sm"
            aria-label="Post options"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="5" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute top-full right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1 overflow-hidden">
              {DROPDOWN_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setDropdownOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-gray-500">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Caption below image */}
      <div className="px-3 pt-2 pb-1">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
          {post.caption || 'Untitled Post'}
        </h3>
      </div>

      {/* Bottom bar: like only */}
      <div className="px-3 py-2">
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
      </div>
    </div>
  );
};

export default PostCard;
