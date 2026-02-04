import React, { useEffect, useState } from "react";
import PostGridLayout from "./PostGridLayout";
import Search from "./Search";
import type { Post } from "./Types";

const API_BASE = "http://localhost:8000";

const HomePage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [posts, setPosts] = useState<Post[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPosts = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API_BASE}/posts/top`, {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                });

                const rawData = await res.json();
                
                // DEBUG LOG: See exactly what the API returns

                // Check if the API returns an array directly, or an object like { posts: [...] }
                let postsArray = [];
                if (Array.isArray(rawData)) {
                    postsArray = rawData;
                } else if (rawData.posts && Array.isArray(rawData.posts)) {
                    postsArray = rawData.posts;
                } else {
                    setPosts([]);
                    return;
                }


                const transformedPosts = postsArray.map((post: any) => ({
                    ...post,
                    // Safety check: ensure image_paths exists before mapping
                    image_paths: (post.image_paths || []).map((path: string) => {
                        if (!path) return null;
                        const parts = path.split(/\\|\//);
                        const filename = parts[parts.length - 1];
                        return `${API_BASE}/uploads/${encodeURIComponent(filename)}`;
                    }),
                }));
                
                setPosts(transformedPosts);

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
    const handlePostClick = (post: Post, imageIndex: number) => {
        console.log(`Clicked post ${post.post_id}, image index: ${imageIndex}`);
        // Add navigation logic here, e.g., navigate(`/post/${post.post_id}`)
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
                <PostGridLayout posts={posts} onPostClick={handlePostClick} />
            ) : (
                <div className="flex justify-center py-10 text-gray-500">
                    No posts found.
                </div>
            )}
        </div>
    );
};

export default HomePage;