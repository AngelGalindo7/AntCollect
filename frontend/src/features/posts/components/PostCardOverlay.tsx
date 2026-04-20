import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Trash2 } from 'lucide-react';

interface PostCardOverlayProps {
  user?: { username: string; avatar_path: string | null } | null;
  isLiked: boolean;
  likeCount: number;
  onLikeClick: (e: React.MouseEvent) => void;
  isOwner?: boolean;
  onDeleteClick?: (e: React.MouseEvent) => void;
}

const PostCardOverlay: React.FC<PostCardOverlayProps> = ({ 
  user, 
  isLiked, 
  likeCount, 
  onLikeClick,
  isOwner,
  onDeleteClick 
}) => {
  const [showOptions, setShowOptions] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Close options menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
        setShowOptions(false);
      }
    };
    if (showOptions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOptions]);

  const handleToggleOptions = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowOptions(!showOptions);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowOptions(false);
    onDeleteClick?.(e);
  };

  return (
    <div className={`absolute inset-0 transition-opacity duration-200 ease ${showOptions ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
      {/* Dark gradient rising from bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent pointer-events-none" />

      {/* Options Menu — top right */}
      <div className="absolute top-[10px] right-[10px] z-20" ref={optionsRef}>
        <button
          onClick={handleToggleOptions}
          className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors flex items-center justify-center"
          aria-label="Options"
        >
          <MoreVertical className="w-5 h-5" />
        </button>

        {showOptions && (
          <div className="absolute top-full right-0 mt-2 w-36 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-30 animate-in fade-in zoom-in duration-100">
            {isOwner && (
              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setShowOptions(false); }}
              className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Glassmorphism pill — bottom */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center gap-2 px-3 py-2 rounded-full backdrop-blur-[10px] bg-white/10 border border-white/20">
        {user?.avatar_path ? (
          <img
            src={user.avatar_path}
            alt={user.username}
            className="w-6 h-6 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-400 shrink-0" />
        )}

        <button
          onClick={onLikeClick}
          className="ml-auto flex items-center gap-1 text-white text-sm"
          aria-label={isLiked ? 'Unlike post' : 'Like post'}
        >
          <svg
            className={`w-4 h-4 transition-colors duration-200 ${isLiked ? 'fill-red-500 text-red-400' : 'fill-none text-white'}`}
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span>{likeCount}</span>
        </button>
      </div>
    </div>
  );
};

export default PostCardOverlay;
