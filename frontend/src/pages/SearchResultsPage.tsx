import React, { useEffect, useState } from "react";
import PostGridLayout from "./PostGridLayout";
import type { Post } from "./Types";
import Search from './Search';
import { fetchWithAuth } from "../utils/api";
import { useSearchParams, useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:8000";

interface SearchUser {
  user_id: number;
  username: string;
  profile_picture?: string;
  post_count?: number;
}

interface SearchPost extends Post {
  username?: string;
}

interface SearchResults {
  users: SearchUser[];
  posts: SearchPost[];
}

const SearchResultsPage: React.FC = () => {
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";

  useEffect(() => {
    const fetchSearchResults = async () => {
      if (!query.trim()) {
        setResults(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithAuth(`${API_BASE}/users/search_user`, {
          method: "POST",
          headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: query, search_type: "full" }),
  });
        if (!res.ok) {
          throw new Error(`Search failed: ${res.status}`);
        }

        const data: SearchResults = await res.json();
        
        // Transform post image paths - same pattern as HomePage
        const transformedData = {
          ...data,
          posts: data.posts.map((post) => ({
            ...post,
            image_paths: post.images
              .filter(img => img && img.paths?.medium)
              .map((img) => `${API_BASE}/${img.paths.original}`),
          })),
        };

        setResults(transformedData);
      } catch (err) {
        console.error("Error fetching search results:", err);
        setError("Could not load search results.");
      } finally {
        setLoading(false);
      }
    };

    fetchSearchResults();
  }, [query]);

  const handlePostClick = (post: Post, imageIndex: number) => {
    console.log(`Clicked post ${post.post_id}, image index: ${imageIndex}`);
    // Add navigation logic here, e.g., navigate(`/post/${post.post_id}`)
  };

  const handleUserClick = (username: string) => {
    navigate(`/${username}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Searching...</div>
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
      {/* Search Bar - Kept consistent with HomePage and Profile view */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-6xl mx-auto">
          <Search />
        </div>
      </div>

      {/* Page Title / Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900">Search Results</h1>
          <p className="text-gray-600 mt-2">
            {query ? `Results for "${query}"` : "Enter a search query"}
          </p>
        </div>
      </div>

      {/* Matching Users Section */}
      {results && results.users.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-4 py-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">People</h2>
            <div className="space-y-3">
              {results.users.map((user) => (
                <div
                  key={user.user_id}
                  onClick={() => handleUserClick(user.username)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {user.profile_picture ? (
                      <img
                        src={`${API_BASE}/${user.profile_picture}`}
                        alt={user.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-500 text-lg font-semibold">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{user.username}</p>
                    {user.post_count !== undefined && (
                      <p className="text-sm text-gray-500">
                        {user.post_count} {user.post_count === 1 ? "post" : "posts"}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Posts Grid Layout */}
      {results && results.posts.length > 0 ? (
        <>
          <div className="bg-white border-b border-gray-200 px-4 py-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-xl font-semibold text-gray-900">Posts</h2>
            </div>
          </div>
          <PostGridLayout posts={results.posts} onPostClick={handlePostClick} />
        </>
      ) : (
        results && results.users.length === 0 && (
          <div className="flex justify-center py-10 text-gray-500">
            No results found for "{query}".
          </div>
        )
      )}
    </div>
  );
};

export default SearchResultsPage;
