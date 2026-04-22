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

      {/* Info row — positioned below the image in the gap */}
      <div className="absolute top-[calc(100%+8px)] left-[-3px] right-[-3px] z-10 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-soft-white border-2 border-warm-gray shadow-soft transform transition-all duration-300 ease-out translate-y-[-12px] group-hover:translate-y-0 pointer-events-auto">
        {user?.avatar_path ? (
          <img
            src={user.avatar_path}
            alt={user.username}
            className="w-9 h-9 rounded-full object-cover shrink-0 border-2 border-warm-gray shadow-sm"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-warm-cream border-2 border-warm-gray flex items-center justify-center shrink-0 text-espresso font-bold text-xs">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
        )}

        <span className="text-sm font-bold text-espresso truncate">@{user?.username}</span>

        <button
          onClick={onLikeClick}
          className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-warm-cream border border-warm-gray text-espresso hover:text-brick-red hover:bg-brick-red/5 transition-all"
          aria-label={isLiked ? 'Unlike post' : 'Like post'}
        >
          <svg
            className={`w-4 h-4 transition-colors duration-200 ${isLiked ? 'fill-brick-red text-brick-red' : 'fill-none text-espresso'}`}
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span className="text-sm font-black">{likeCount}</span>
        </button>
      </div>
    </div>
  );
};

export default PostCardOverlay;
