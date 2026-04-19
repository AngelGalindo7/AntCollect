import React from 'react';
import PostCard from './PostCard';
import FolderCard from '@/features/create/components/FolderCard';
import type { GridItem, Post, Folder, FolderType } from '@/shared/types/Types';

interface PostGridLayoutProps {
  items: GridItem[];
  onPostClick?: (post: Post, imageIndex: number) => void;
  onLikeToggle?: (postId: number, isLiked: boolean) => void;
  onFolderClick?: (folder: Folder) => void;
  folderType?: FolderType;
  postOwnerId?: number;
}

const PostGridLayout: React.FC<PostGridLayoutProps> = ({
  items,
  onPostClick,
  onLikeToggle,
  onFolderClick,
  // folderType and postOwnerId reserved for trade button re-enable
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
            folder={item.data}
            onClick={onFolderClick}
          />
        );
      case 'post':
        return (
          <PostCard
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
    <div className="columns-2 min-[768px]:columns-3 min-[1100px]:columns-4 gap-6">
      {items.map((item) => {
        const key = item.kind === 'folder' ? `folder-${item.data.id}` : `post-${item.data.post_id}`;
        return (
          <div key={key} className="break-inside-avoid mb-6">
            {renderItem(item)}
          </div>
        );
      })}
    </div>
  );
};

export default PostGridLayout;
