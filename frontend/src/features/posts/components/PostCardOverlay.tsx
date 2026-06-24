import React from 'react';
import PostOptionsMenu from './PostOptionsMenu';

interface PostCardOverlayProps {
  postType?: string;
  isLiked: boolean;
  likeCount: number;
  onLikeClick: (e: React.MouseEvent) => void;
  isOwner?: boolean;
  canModerate?: boolean;
  onSaveStickersClick?: (e: React.MouseEvent) => void;
  onDeleteClick?: (e: React.MouseEvent) => void;
  onAdminDeleteClick?: (e: React.MouseEvent) => void;
  onReportClick?: (e: React.MouseEvent) => void;
}

const typeConfig: Record<string, { dot: string; label: string }> = {
  trading:     { dot: 'bg-emerald-500', label: 'Trading' },
  collection:  { dot: 'bg-uci-gold',   label: 'Collectible' },
  looking_for: { dot: 'bg-sky-500',     label: 'Looking For' },
};

const PostCardOverlay: React.FC<PostCardOverlayProps> = ({
  postType,
  isLiked,
  likeCount,
  onLikeClick,
  isOwner,
  canModerate,
  onSaveStickersClick,
  onDeleteClick,
  onAdminDeleteClick,
  onReportClick,
}) => {
  const badge = postType ? typeConfig[postType] : undefined;

  return (
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out pointer-events-none">
      {/* Bottom gradient */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/60 to-transparent pointer-events-none" />

      {/* Options menu — top right */}
      <div className="absolute top-2 right-2 z-20 pointer-events-auto">
        <PostOptionsMenu
          isOwner={isOwner}
          canModerate={canModerate}
          onSaveStickersClick={onSaveStickersClick}
          onDeleteClick={onDeleteClick}
          onAdminDeleteClick={onAdminDeleteClick}
          onReportClick={onReportClick}
        />
      </div>

      {/* Bottom row: like button left, type dot right */}
      <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-3 pb-2.5 pointer-events-auto">
        <button
          onClick={onLikeClick}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-all"
          aria-label={isLiked ? 'Unlike post' : 'Like post'}
        >
          <svg
            className={`w-3.5 h-3.5 transition-colors duration-200 ${isLiked ? 'fill-brick-red text-brick-red' : 'fill-none text-white'}`}
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span className="text-xs font-medium">{likeCount}</span>
        </button>

        {badge && (
          <span
            className={`w-3 h-3 rounded-full ${badge.dot} ring-2 ring-white/60 shadow`}
            title={badge.label}
            aria-label={badge.label}
          />
        )}
      </div>
    </div>
  );
};

export default PostCardOverlay;
