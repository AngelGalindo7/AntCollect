import React from 'react';
import PostCard from './PostCard';
import FolderCard from '@/features/create/components/FolderCard';
import type { GridItem, Post, Folder } from '@/shared/types/Types';

/**
 * PostGridLayout
 *
 * Renders a mixed grid of folders and posts from a GridItem[] array.
 * Callers control ordering — pass folders first to pin them at the top.
 *
 * To add a new grid entity type later:
 *   1. Add a new `kind` to the GridItem union in Types.tsx
 *   2. Add a matching case in the renderItem switch below
 */

interface PostGridLayoutProps {
  items: GridItem[];
  onPostClick?: (post: Post, imageIndex: number) => void;
  onLikeToggle?: (postId: number, isLiked: boolean) => void;
  onFolderClick?: (folder: Folder) => void;
}

const PostGridLayout: React.FC<PostGridLayoutProps> = ({
  items,
  onPostClick,
  onLikeToggle,
  onFolderClick,
}) => {
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg
          className="w-16 h-16 mx-auto mb-4 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-lg">No posts yet</p>
      </div>
    );
  }

  const renderItem = (item: GridItem) => {
    switch (item.kind) {
      case 'folder':
        return (
          <FolderCard
            key={`folder-${item.data.id}`}
            folder={item.data}
            onClick={onFolderClick}
          />
        );
      case 'post':
        return (
          <PostCard
            key={`post-${item.data.post_id}`}
            post={item.data}
            imagePath={item.data.image_paths[0]}
            imageIndex={0}
            onClick={onPostClick}
            onLikeToggle={onLikeToggle}
          />
        );
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(renderItem)}
      </div>
    </div>
  );
};

export default PostGridLayout;
