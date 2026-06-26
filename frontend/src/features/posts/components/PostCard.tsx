import React, { useState } from 'react';
import PostCardOverlay from './PostCardOverlay';
import ReportModal from './ReportModal';
import SaveStickersModal from './SaveStickersModal';
import type { Post, FolderType } from '@/shared/types/Types';
import { fetchWithAuth, API_BASE } from '@/shared/api/api';
import { getSession } from '@/shared/auth/session';
import { canModeratePosts } from '@/shared/auth/permissions';
import { useGuestGate } from '@/shared/hooks/useGuestGate';

interface PostCardProps {
  post: Post;
  imagePath: string | null;
  imageIndex: number;
  folderType?: FolderType;
  onClick?: (post: Post, imageIndex: number) => void;
  onLikeToggle?: (postId: number, isLiked: boolean) => void;
  onDelete?: (postId: number) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, imagePath, imageIndex, folderType, onClick, onLikeToggle, onDelete }) => {
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.total_likes || 0);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [saveStickersOpen, setSaveStickersOpen] = useState(false);

  const { guard } = useGuestGate();
  const session = getSession();
  const isOwner = post.user?.user_id !== undefined && String(post.user.user_id) === session?.userId;
  const canModerate = !isOwner && canModeratePosts(session);
  const canSaveStickers =
    isOwner && folderType !== 'looking_for' && (post.images?.length ?? post.image_paths.length) > 0;

  const handleSaveStickersClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaveStickersOpen(true);
  };

  const imageMeta = post.images?.[imageIndex];
  const imageWidth = imageMeta?.original_width;
  const imageHeight = imageMeta?.original_height;
  const imageAspectRatio =
    imageWidth && imageHeight && imageWidth > 0 && imageHeight > 0
      ? `${imageWidth} / ${imageHeight}`
      : undefined;

  const handleClick = () => {
    onClick?.(post, imageIndex);
  };

  const handleReportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    guard(() => setReportModalOpen(true));
  };

  const deletePost = async () => {
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

  const handlePostDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    await deletePost();
  };

  const handleAdminDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("You are deleting another user's post as a moderator. This action is irreversible. Continue?")) return;
    await deletePost();
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    guard(() => performLike());
  };

  const performLike = async () => {
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
      className="relative cursor-pointer group bg-soft-white rounded-sticker overflow-hidden shadow-card transition-all duration-300 hover:scale-[1.02]"
      onClick={handleClick}
    >
      {post.image_paths.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-1 pointer-events-none">
          {Array.from({ length: Math.min(post.image_paths.length, 3) }, (_, i) => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === Math.min(imageIndex, 2) ? 'bg-white' : 'bg-white/40'}`} />
          ))}
        </div>
      )}

      {imagePath ? (
        <img
          src={imagePath}
          alt={post.caption || `Post ${post.post_id}`}
          width={imageWidth}
          height={imageHeight}
          loading="lazy"
          decoding="async"
          className="w-full h-auto block"
          style={imageAspectRatio ? { aspectRatio: imageAspectRatio } : undefined}
        />
      ) : (
        <div className="w-full min-h-30 bg-warm-cream flex items-center justify-center">
          <svg className="w-12 h-12 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      <PostCardOverlay
        postType={post.type}
        isLiked={isLiked}
        likeCount={likeCount}
        onLikeClick={handleLikeClick}
        isOwner={isOwner}
        canModerate={canModerate}
        onSaveStickersClick={canSaveStickers ? handleSaveStickersClick : undefined}
        onDeleteClick={handlePostDelete}
        onAdminDeleteClick={handleAdminDelete}
        onReportClick={handleReportClick}
      />

      {reportModalOpen && (
        <ReportModal
          postId={post.post_id}
          onClose={() => setReportModalOpen(false)}
        />
      )}

      {saveStickersOpen && (
        <SaveStickersModal
          post={post}
          onClose={() => setSaveStickersOpen(false)}
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
