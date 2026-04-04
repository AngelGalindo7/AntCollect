import React, { useState } from 'react';
import type { Post } from '@/shared/types/Types';
import { fetchWithAuth } from '@/shared/api/api';
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
  onLikeToggle?: (postId: number, isLiked: boolean) => void;

}



const PostCard: React.FC<PostCardProps> = ({ post, imagePath, imageIndex, onClick, onLikeToggle }) => {
  

  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.total_likes || 0);
  
  console.log("is_liked " , post.is_liked)
  console.log("")
  
//useEffect(() => {
 // setIsLiked(post.is_liked);
 // setLikeCount(post.total_likes || 0);
 //, [post.post_id]);


  const handleClick = () => {
    onClick?.(post, imageIndex);
  };

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const previousLikedState = isLiked;
    const previousLikeCount = likeCount;
  


  console.log("Previous liked state:", previousLikedState);
  const newLikedState= !isLiked;
  setIsLiked(newLikedState);
  console.log("New liked state:", newLikedState);

  setLikeCount(prev => newLikedState ? prev + 1 : prev -1);

  //onLikeToggle?.(post.post_id, newLikedState);
  
  
    try {

      //console.log("post id being liked:", post.post_id);
      const API_BASE = "http://localhost:8000";
      const response = await fetchWithAuth(`${API_BASE}/posts/like_image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Add auth headers if needed
        },
        credentials: "include",
        
        body: JSON.stringify({
          post_id: post.post_id,
        })
      });


      const data = await response.json()
      const expectedStatus = newLikedState ? "Liked" : "Unliked";

      if (!response.ok || data.message !== expectedStatus) {
      setIsLiked(previousLikedState);
      setLikeCount(previousLikeCount);
      
    }
      else{
        onLikeToggle?.(post.post_id, newLikedState);
      }
    }catch (error) {
      // If API fails, revert the optimistic update
      setIsLiked(previousLikedState);
      setLikeCount(previousLikeCount);
      console.error("Error calling like API:", error);
    }
  };
  
  const getPostTypeLetter = (type: string): string => {
  

    return type.charAt(0).toUpperCase();

  };
  return (

 
    <div className="relative bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
      {/* ADDED: Top section - Title and Type Badge */}
      <div className="px-3 py-2 bg-white border-b border-gray-200 flex items-start justify-between">
        {/* Title - left side, truncated to 2 lines */}
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1 pr-2">
          {post.caption || 'Untitled Post'}
        </h3>
        
        {/* ADDED: Type badge - top right corner */}
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-bold">
          {getPostTypeLetter(post.type)}
        </div>
      </div>

      {/* Image section - clickable to view post details */}
      <div
        className="relative aspect-square overflow-hidden bg-gray-100 cursor-pointer group"
        onClick={handleClick}
      >
        {imagePath ? (
          <img
            src={imagePath}
            alt={post.caption || `Post ${post.post_id}`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
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

      <div className="px-3 py-2 bg-white border-t border-gray-200">
        <button
          onClick={handleLikeClick}
          className="flex items-center gap-2 text-sm font-medium transition-colors duration-200 hover:opacity-80"
          aria-label={isLiked ? "Unlike post" : "Like post"}
        >
          {/* Heart icon - red if liked, gray if not */}
          <svg 
            className={`w-5 h-5 transition-colors duration-200 ${
              isLiked ? 'text-red-500 fill-red-500' : 'text-gray-400 fill-none'
            }`}
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
          
          {/* Like count */}
          <span className={`${isLiked ? 'text-red-500' : 'text-gray-700'}`}>
            {likeCount}
          </span>
        </button>
      </div>
    </div>
  );
}; 
export default PostCard;
