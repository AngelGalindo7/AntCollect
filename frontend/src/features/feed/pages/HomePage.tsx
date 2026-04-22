import React, { useEffect, useState } from "react";
import PostGridLayout from "@/features/posts/components/PostGridLayout";
import PostDetailModal from "@/features/posts/components/PostDetailModal";
import type { Post, TopPostsResponse, PostWithEngagement, GridItem, FolderType } from "@/shared/types/Types";
import { fetchWithAuth } from "@/shared/api/api";
import Search from "@/features/search/components/Search";

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
        <div className="w-full space-y-8">
            {/* Posts Grid Layout */}
            <div className="bg-transparent">
                {posts.length > 0 ? (
                    <PostGridLayout
                        items={posts.map((p): GridItem => ({ kind: 'post', data: p }))}
                        onPostClick={handlePostClick}
                        onLikeToggle={handleLikeToggle}
                        onPostDelete={handlePostDelete}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-soft-white rounded-sticker border-2 border-warm-gray border-dashed">
                        <div className="w-16 h-16 rounded-full bg-warm-cream flex items-center justify-center text-warm-gray mb-4">
                           <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                           </svg>
                        </div>
                        <p className="text-espresso font-bold uppercase tracking-widest">No stickers found in the hub yet.</p>
                        <p className="text-espresso/50 text-sm mt-1">Be the first to share your collection!</p>
                    </div>
                )}
            </div>

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
