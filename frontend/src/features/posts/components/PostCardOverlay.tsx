import React from 'react';
import PostOptionsMenu from './PostOptionsMenu';

interface PostCardOverlayProps {
  user?: { username: string; avatar_path: string | null } | null;
  isLiked: boolean;
  likeCount: number;
  onLikeClick: (e: React.MouseEvent) => void;
  isOwner?: boolean;
  onDeleteClick?: (e: React.MouseEvent) => void;
  onReportClick?: (e: React.MouseEvent) => void;
}

const PostCardOverlay: React.FC<PostCardOverlayProps> = ({
  user,
  isLiked,
  likeCount,
  onLikeClick,
  isOwner,
  onDeleteClick,
  onReportClick,
}) => {
  return (
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease">
      {/* Dark gradient rising from bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent pointer-events-none" />

      {/* Options Menu — top right */}
      <div className="absolute top-[10px] right-[10px] z-20">
        <PostOptionsMenu
          isOwner={isOwner}
          onDeleteClick={onDeleteClick}
          onReportClick={onReportClick}
        />
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
