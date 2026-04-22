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
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out">
      {/* Dark gradient rising from bottom — more subtle now, only for top options */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none rounded-xl" />

      {/* Options Menu — top right */}
      <div className="absolute top-[10px] right-[10px] z-20">
        <PostOptionsMenu
          isOwner={isOwner}
          onDeleteClick={onDeleteClick}
          onReportClick={onReportClick}
        />
      </div>

      {/* Info row — positioned below the image */}
      <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-10 flex items-center gap-2 px-1 py-1 transform transition-transform duration-300 ease-out translate-y-[-8px] group-hover:translate-y-0">
        {user?.avatar_path ? (
          <img
            src={user.avatar_path}
            alt={user.username}
            className="w-5 h-5 rounded-full object-cover shrink-0 border border-gray-100 shadow-sm"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-gray-200 shrink-0" />
        )}

        <span className="text-xs font-semibold text-gray-800 truncate">{user?.username}</span>

        <button
          onClick={onLikeClick}
          className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-50 border border-gray-100 text-gray-700 hover:text-red-500 hover:bg-red-50 transition-all"
          aria-label={isLiked ? 'Unlike post' : 'Like post'}
        >
          <svg
            className={`w-3.5 h-3.5 transition-colors duration-200 ${isLiked ? 'fill-red-500 text-red-500' : 'fill-none text-gray-500'}`}
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span className="text-xs font-bold">{likeCount}</span>
        </button>
      </div>
    </div>
  );
};

export default PostCardOverlay;
