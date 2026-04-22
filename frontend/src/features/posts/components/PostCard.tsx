import React, { useState } from 'react';
import PostCardOverlay from './PostCardOverlay';
import ReportModal from './ReportModal';
import type { Post } from '@/shared/types/Types';
import { fetchWithAuth, API_BASE } from '@/shared/api/api';

interface PostCardProps {
  post: Post;
  imagePath: string | null;
  imageIndex: number;
  onClick?: (post: Post, imageIndex: number) => void;
  onLikeToggle?: (postId: number, isLiked: boolean) => void;
  onDelete?: (postId: number) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, imagePath, imageIndex, onClick, onLikeToggle, onDelete }) => {
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.total_likes || 0);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const currentUserId = localStorage.getItem('userId');
  const isOwner = post.user?.user_id !== undefined && String(post.user.user_id) === currentUserId;

  const handleClick = () => {
    onClick?.(post, imageIndex);
  };

  const handleReportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setReportModalOpen(true);
  };

  const handlePostDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this post?')) return;

    try {
      const response = await fetchWithAuth(`${API_BASE}/posts/${post.post_id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        onDelete?.(post.post_id);
      } else {
        const data = await response.json();
        alert(data.detail || 'Failed to delete post');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('An error occurred while deleting the post');
    }
  };

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const previousLikedState = isLiked;
    const previousLikeCount = likeCount;
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikeCount((prev) => (newLikedState ? prev + 1 : prev - 1));

    try {
      const response = await fetchWithAuth(`${API_BASE}/posts/like_image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ post_id: post.post_id }),
      });
      const data = await response.json();
      const expectedStatus = newLikedState ? 'Liked' : 'Unliked';
      if (!response.ok || data.message !== expectedStatus) {
        setIsLiked(previousLikedState);
        setLikeCount(previousLikeCount);
      } else {
        onLikeToggle?.(post.post_id, newLikedState);
      }
    } catch {
      setIsLiked(previousLikedState);
      setLikeCount(previousLikeCount);
    }
  };

  return (
    <div
      className="relative cursor-pointer group bg-soft-white rounded-sticker border-[3px] border-warm-gray overflow-visible shadow-card transition-all duration-300 hover:scale-[1.02] hover:border-campus-gold/30"
      onClick={handleClick}
    >
      <div className="rounded-[calc(0.75rem-3px)] overflow-hidden">
        {imagePath ? (
          <img
            src={imagePath}
            alt={post.caption || `Post ${post.post_id}`}
            className="w-full h-auto block"
          />
        ) : (
          <div className="w-full min-h-30 bg-warm-cream flex items-center justify-center">
            <svg className="w-12 h-12 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      <PostCardOverlay
        user={post.user}
        isLiked={isLiked}
        likeCount={likeCount}
        onLikeClick={handleLikeClick}
        isOwner={isOwner}
        onDeleteClick={handlePostDelete}
        onReportClick={handleReportClick}
      />

      {reportModalOpen && (
        <ReportModal
          postId={post.post_id}
          onClose={() => setReportModalOpen(false)}
        />
      )}

      {/* Trade button — uncomment block + re-enable state + restore folderType/postOwnerId props to restore
      {tradeLabel && !tradeSent && (
        ...
      )}
      */}
    </div>
  );
};

export default PostCard;
