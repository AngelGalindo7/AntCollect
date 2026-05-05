import React, { useMemo } from 'react';
import PostCard from './PostCard';
import FolderCard from '@/features/create/components/FolderCard';
import type { GridItem, Post, Folder, FolderType } from '@/shared/types/Types';
import { useMasonryLayout, type MasonryItemDims } from '@/shared/hooks/useMasonryLayout';

interface PostGridLayoutProps {
  items: GridItem[];
  onPostClick?: (post: Post, imageIndex: number) => void;
  onLikeToggle?: (postId: number, isLiked: boolean) => void;
  onPostDelete?: (postId: number) => void;
  onFolderClick?: (folder: Folder) => void;
  folderType?: FolderType;
  postOwnerId?: number;
}

const MASONRY_CONFIG = {
  gap: 24,
  breakpoints: [
    { minWidth: 0, cols: 2 },
    { minWidth: 768, cols: 3 },
    { minWidth: 1100, cols: 4 },
  ],
};

const FOLDER_LABEL_HEIGHT = 32;

function dimsForItem(item: GridItem): MasonryItemDims {
  if (item.kind === 'folder') {
    return { aspectRatio: 1, extraHeight: FOLDER_LABEL_HEIGHT };
  }
  const meta = item.data.images?.[0];
  if (meta && meta.original_width > 0 && meta.original_height > 0) {
    return { aspectRatio: meta.original_height / meta.original_width };
  }
  return { aspectRatio: 1 };
}

const PostGridLayout: React.FC<PostGridLayoutProps> = ({
  items,
  onPostClick,
  onLikeToggle,
  onPostDelete,
  onFolderClick,
}) => {
  const safeItems = items ?? [];
  const dims = useMemo(() => safeItems.map(dimsForItem), [safeItems]);
  const { containerRef, positions, containerHeight, ready } = useMasonryLayout(dims, MASONRY_CONFIG);

  if (safeItems.length === 0) {
    return (
      <div data-testid="post-grid-empty" className="text-center py-12 text-gray-500">
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
        return <FolderCard folder={item.data} onClick={onFolderClick} />;
      case 'post':
        return (
          <PostCard
            post={item.data}
            imagePath={item.data.image_paths[0]}
            imageIndex={0}
            onClick={onPostClick}
            onLikeToggle={onLikeToggle}
            onDelete={onPostDelete}
          />
        );
    }
  };

  return (
    <div
      ref={containerRef}
      data-testid="post-grid-masonry"
      className="relative w-full"
      style={{ height: ready ? containerHeight : undefined }}
    >
      {ready &&
        safeItems.map((item, idx) => {
          const pos = positions[idx];
          if (!pos) return null;
          const key = item.kind === 'folder' ? `folder-${item.data.id}` : `post-${item.data.post_id}`;
          return (
            <div
              key={key}
              data-testid="post-grid-item"
              className="absolute"
              style={{
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                width: pos.width,
                height: pos.height,
              }}
            >
              {renderItem(item)}
            </div>
          );
        })}
    </div>
  );
};

export default PostGridLayout;
