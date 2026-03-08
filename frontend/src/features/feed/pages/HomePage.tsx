import React, { useEffect, useState } from "react";
import PostGridLayout from "@/features/posts/components/PostGridLayout";
import Search from "@/features/search/components/Search";
import type { Post, TopPostResponse, PostWithEngagement } from "@/shared/types/Types";
import { fetchWithAuth } from "@/shared/api/api";

const API_BASE = "http://localhost:8000";

const HomePage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [posts, setPosts] = useState<PostWithEngagement[]>([]);
    const [error, setError] = useState<string | null>(null);

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
                const data: TopPostResponse  = await res.json();
                //console.log(data)

                //const transformedPosts = postsArray.map((post: any) => ({
                //    ...post,
                //    // Safety check: ensure image_paths exists before mapping
                //    image_paths: (post.image_paths || []).map((path: string) => {
                //        if (!path) return null;
                //        const parts = path.split(/\\|\//);
                //        const filename = parts[parts.length - 1];
                //        return `${API_BASE}/uploads/${encodeURIComponent(filename)}`;
                //    }),
                //}));
                const transformedData = {
				        ...data,
				        posts: data.posts.map((post) => ({
					      ...post,
					      image_paths: post.images
                .filter(img => img && img.paths?.medium)
                .map((img) => `${API_BASE}/${img.paths.original}`),
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

    // Placeholder for post interaction
    const handlePostClick = (post: PostWithEngagement, imageIndex: number) => {
        console.log(`Clicked post ${post.post_id}, image index: ${imageIndex}`);
        // Add navigation logic here, e.g., navigate(`/post/${post.post_id}`)
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
            {/* Search Bar - Kept consistent with Profile view */}
            <div className="bg-white border-b border-gray-200 px-4 py-4">
                <div className="max-w-6xl mx-auto">
                    <Search />
                </div>
            </div>

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
                posts={posts}
                onPostClick={handlePostClick}
                onLikeToggle={handleLikeToggle}
                />
            ) : (
                <div className="flex justify-center py-10 text-gray-500">
                    No posts found.
                </div>
            )}
        </div>
    );
};

export default HomePage;
