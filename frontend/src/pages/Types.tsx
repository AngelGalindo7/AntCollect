/**
 * Type Definitions
 * 
 * PURPOSE:
 * - Defines the data structure contracts for the post grid system
 * - Ensures type safety across components
 * - Documents expected data shapes
 * 
 * DESIGN DECISIONS:
 * 1. Matches your existing backend structure exactly
 *    - WHY: Seamless integration with API responses
 *    - CONSIDERATION: If backend changes, update these types
 * 
 * 2. Uses (string | null)[] for image_paths
 *    - WHY: Handles cases where images fail to upload or are deleted
 *    - TRADEOFF: Requires null checking in components
 * 
 * 3. Includes public and is_published fields
 *    - WHY: Backend sends these in response for ALL viewers
 *    - NOTE: Backend filters what posts to return based on viewer permissions:
 *      - Regular viewers: Only see posts where public=true AND is_published=true
 *      - Post owner: Sees all their posts regardless of public/published status
 *    - CLIENT USAGE: These fields are available in the data structure but client
 *      doesn't need to filter on them since backend already did
 *    - FUTURE: Could use these fields to show edit UI elements for owner's unpublished posts
 * 
 * FUTURE WORK:
 * - Add image metadata types (dimensions, file size, format)
 * - Add user profile type (username, avatar, bio)
 * - Add comment/engagement types if needed
 * - Consider separating API response types from component prop types
 * - Add viewer context type (isOwner, permissions, etc.)
 */

export type Post = {
  post_id: number;
  caption: string;
  image_paths: (string | null)[];
  total_likes: number;
  public: boolean;
  is_published: boolean;
  type: string;
  updated_at: string;
};

export type ProfileResponse = {
  user_id: number;
  posts: Post[];
};

/**
 * Component-specific prop types
 * 
 * WHY SEPARATE: Components may not need full types, allows for flexibility
 */

export interface PostImageProps {
  post: Post;
  imagePath: string | null;
  imageIndex: number;
  // Future: Add onClick, onLike, etc.
}

export interface PostGridProps {
  profileData: ProfileResponse;
  // Future: Add onPostClick, loading, error, etc.
}