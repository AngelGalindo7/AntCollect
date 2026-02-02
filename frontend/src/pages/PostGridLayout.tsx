import React from 'react';
import PostCard from './PostCard';
import type { Post } from './Types';

/**
 * PostGridLayout Component
 * 
 * PURPOSE:
 * - Handles grid layout and positioning of posts
 * - Orchestrates rendering of PostCard components
 * 
 * - Pass through onClick handlers to child PostCards
 * 
 * PROPS:
 * @param {Post[]} posts - Array of posts to display
 * @param {Function} onPostClick - Callback when a post is clicked
 * 
 * FUTURE ENHANCEMENTS:
 * - Add columns prop to make layout configurable
 *   (e.g., <PostGridLayout posts={posts} columns={4} /> for 4-column layout)
 * - Add responsive configuration for different screen sizes
 * - Add lazy loading for images
 * - Add virtualization for large lists (react-window)
 * 
 * CUSTOMIZATION INSTRUCTIONS:
 * - To adjust column count: Change `lg:grid-cols-3` to desired number
 * - To adjust gap between posts: Change `gap-4` to `gap-2` (smaller) or `gap-6` (larger)
 * - To adjust max-width: Change `max-w-6xl` to `max-w-4xl` (narrower) or `max-w-7xl` (wider)
 */

interface PostGridLayoutProps {
  posts: Post[];
  onPostClick?: (post: Post, imageIndex: number) => void;
}

const PostGridLayout: React.FC<PostGridLayoutProps> = ({ posts, onPostClick }) => {
  if (!posts || posts.length === 0) {
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

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      {/* Grid: 3 columns for laptop, 2 for tablet, 1 for mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post) => (
            
              <PostCard
                key={post.post_id}
                post={post}
                imagePath={post.image_paths[0]}
                imageIndex={0}
                onClick={onPostClick}
              />
            ))}
      </div>
    </div>
  );
};

export default PostGridLayout;
