import React, { useEffect, useState } from "react";
import PostGridLayout from "@/features/posts/components/PostGridLayout";
import PostDetailModal from "@/features/posts/components/PostDetailModal";
import type { Post, TopPostsResponse, PostWithEngagement, GridItem, FolderType } from "@/shared/types/Types";
import { fetchWithAuth } from "@/shared/api/api";

import { API_BASE } from '@/shared/api/api';

const HomePage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [posts, setPosts] = useState<PostWithEngagement[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);

    useEffect(() => {
        const fetchPosts = async () => {
            setLoading(true);
            try {
                const res = await fetchWithAuth(`${API_BASE}/posts/top`, {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                });
                

                if (!res.ok) {
                throw new Error(`Failed to load feed: ${res.status}`);
        }
                const data: TopPostsResponse = await res.json();
                //console.log(data)

                const transformedData = {
				        ...data,
				        posts: data.posts.map((post) => ({
					      ...post,
					      image_paths: (post.images ?? [])
                .filter(img => img && img.paths?.medium)
                .map((img) => img.paths.original),
                  })),
                  };
                        
                setPosts(transformedData.posts);

              } catch (err) {
                console.error("Error fetching home posts:", err);
                setError("Could not load the feed.");
              } finally {
                setLoading(false);
              }
        };

        fetchPosts();
    }, []);

    const handlePostClick = (post: Post) => {
        setSelectedPost(post);
    };
    

    const handleLikeToggle = (postId: number, isLiked: boolean) => {
        // Update the posts array with the new like count
        setPosts((prevPosts) => 
            prevPosts.map((post) => {
                if (post.post_id === postId) {
                    // If liked, increment count; if unliked, decrement count
                    return {
                        ...post,
                        total_likes: isLiked 
                            ? post.total_likes + 1 
                            : post.total_likes - 1
                    };
                }
                return post;
            })
        );
    }

    const handlePostDelete = (postId: number) => {
        setPosts((prevPosts) => prevPosts.filter((post) => post.post_id !== postId));
    };
    
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg text-gray-600">Loading feed...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-red-500">{error}</div>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Page Title / Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-6">
                <div className="max-w-6xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900">Explore</h1>
                    <p className="text-gray-600 mt-2">
                        Top trending posts today
                    </p>
                </div>
            </div>

            {/* Posts Grid Layout */}
            {posts.length > 0 ? (
                <PostGridLayout
                    items={posts.map((p): GridItem => ({ kind: 'post', data: p }))}
                    onPostClick={handlePostClick}
                    onLikeToggle={handleLikeToggle}
                    onPostDelete={handlePostDelete}
                />
            ) : (
                <div className="flex justify-center py-10 text-gray-500">
                    No posts found.
                </div>
            )}

            {selectedPost && (
                <PostDetailModal
                    post={selectedPost}
                    onClose={() => setSelectedPost(null)}
                    postOwnerId={selectedPost.user?.user_id}
                    folderType={selectedPost.type as FolderType}
                />
            )}
        </div>
    );
};

export default HomePage;
