import React, { useState } from 'react';
import type { Post } from './Types';

/**
 * PostCard Component
 * 
 * PURPOSE:
 * - Individual post/metadata storage component
 * - Manages single post data and interaction state
 * - Serves as the base unit of the post grid
 * 
 * RESPONSIBILITIES:
 * - Display post metadata (caption, likes, images)
 * - Handle click interactions
 * - Manage hover state
 * 
 * PROPS:
 * @param {Post} post - Post object containing all metadata
 * @param {string|null} imagePath - URL of the image to display
 * @param {number} imageIndex - Index of this image in post's image_paths array
 * @param {Function} onClick - Handler for when post is clicked
 * 
 * DESIGN NOTES:
 * - Self-contained: manages its own hover state
 * - onClick handler does nothing by default (as requested)
 * - Can be extended to navigate to detail view, open modal, etc.
 */

interface PostCardProps {
  post: Post;
  imagePath: string | null;
  imageIndex: number;
  onClick?: (post: Post, imageIndex: number) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, imagePath, imageIndex, onClick }) => {

  const handleClick = () => {
    onClick?.(post, imageIndex);
  };

  return (
    <div
      className="relative aspect-square overflow-hidden bg-gray-100 cursor-pointer group"
      onClick={handleClick}
    >
      {imagePath ? (
        <>
          <img
            src={imagePath}
            alt={post.caption || `Post ${post.post_id}`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />

          
            <div className="absolute inset-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="text-white text-center p-4">
                <div className="flex items-center justify-center gap-4 mb-2">
                  <span className="flex items-center gap-1">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {post.total_likes}
                  </span>
                </div>
                {post.caption && <p className="text-sm line-clamp-2">{post.caption}</p>}
              </div>
            </div>
          
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-200">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}
    </div>
  );
};

export default PostCard;
