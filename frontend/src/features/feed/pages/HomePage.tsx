import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import PostGridLayout from "@/features/posts/components/PostGridLayout";
import PostDetailModal from "@/features/posts/components/PostDetailModal";
import type { Post, TopPostsResponse, PostWithEngagement, GridItem, FolderType } from "@/shared/types/Types";
import { fetchWithAuth, API_BASE } from "@/shared/api/api";

const PAGE_SIZE = 20;
const HOME_FEED_KEY = ["homeFeed"] as const;

async function fetchHomeFeedPage({ pageParam }: { pageParam: string | null }): Promise<TopPostsResponse> {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (pageParam) params.set("cursor", pageParam);

    const res = await fetchWithAuth(`${API_BASE}/posts/top?${params.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`Failed to load feed: ${res.status}`);
    return res.json();
}

const HomePage: React.FC = () => {
    const queryClient = useQueryClient();
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    const {
        data,
        error,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
    } = useInfiniteQuery<TopPostsResponse, Error>({
        queryKey: HOME_FEED_KEY,
        queryFn: fetchHomeFeedPage,
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    });

    const posts: PostWithEngagement[] = useMemo(
        () =>
            (data?.pages ?? []).flatMap((page) =>
                page.posts.map((post) => ({
                    ...post,
                    image_paths: (post.images ?? [])
                        .filter((img) => img && img.paths?.medium)
                        .map((img) => img.paths.original),
                }))
            ),
        [data?.pages]
    );

    useEffect(() => {
        const node = sentinelRef.current;
        if (!node || !hasNextPage) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting && !isFetchingNextPage) {
                    fetchNextPage();
                }
            },
            { rootMargin: "400px 0px" }
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const updatePostInCache = useCallback(
        (postId: number, updater: (post: PostWithEngagement) => PostWithEngagement) => {
            queryClient.setQueryData<InfiniteData<TopPostsResponse>>(HOME_FEED_KEY, (old) => {
                if (!old) return old;
                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        posts: page.posts.map((p) => (p.post_id === postId ? updater(p) : p)),
                    })),
                };
            });
        },
        [queryClient]
    );

    const handlePostClick = (post: Post) => setSelectedPost(post);

    const handleLikeToggle = (postId: number, isLiked: boolean) => {
        updatePostInCache(postId, (post) => ({
            ...post,
            total_likes: isLiked ? post.total_likes + 1 : post.total_likes - 1,
        }));
    };

    const handlePostDelete = (postId: number) => {
        queryClient.setQueryData<InfiniteData<TopPostsResponse>>(HOME_FEED_KEY, (old) => {
            if (!old) return old;
            return {
                ...old,
                pages: old.pages.map((page) => ({
                    ...page,
                    posts: page.posts.filter((p) => p.post_id !== postId),
                })),
            };
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg text-gray-600">Loading feed...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-red-500">Could not load the feed.</div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="bg-transparent">
                {posts.length > 0 ? (
                    <>
                        <PostGridLayout
                            items={posts.map((p): GridItem => ({ kind: 'post', data: p }))}
                            onPostClick={handlePostClick}
                            onLikeToggle={handleLikeToggle}
                            onPostDelete={handlePostDelete}
                        />
                        <div ref={sentinelRef} className="h-12 flex items-center justify-center">
                            {isFetchingNextPage && (
                                <span className="text-warm-gray text-sm">Loading more…</span>
                            )}
                        </div>
                    </>
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
