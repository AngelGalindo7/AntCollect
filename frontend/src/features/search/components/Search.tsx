import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth, API_BASE } from "@/shared/api/api";
import PostDetailModal from "@/features/posts/components/PostDetailModal";
import type { Post, FolderType } from "@/shared/types/Types";

interface UserResult {
  id: number;
  username: string;
  avatar_path?: string;
}

interface QuickSearchResponse {
  query: string;
  users: UserResult[];
  posts: Post[] | null;
}

interface SearchProps {
  isHeaderSearch?: boolean;
  className?: string;
}

const Search: React.FC<SearchProps> = ({ isHeaderSearch = false, className = "" }) => {
  const [query, setQuery] = useState("");
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [postResults, setPostResults] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const quickSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setUserResults([]);
      setPostResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth(`${API_BASE}/users/search_user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ query: searchQuery, search_type: "quick" }),
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data: QuickSearchResponse = await response.json();
      
      // Transform post image paths
      const transformedPosts = (data.posts ?? []).map((post) => ({
        ...post,
        image_paths: (post.images ?? [])
          .filter(img => img && img.paths?.medium)
          .map((img) => img.paths.original),
      }));

      setUserResults(data.users);
      setPostResults(transformedPosts);
      setShowDropdown(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setUserResults([]);
      setPostResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    if (query.trim()) {
      debounceTimeout.current = setTimeout(() => {
        quickSearch(query);
      }, 300);
    } else {
      setUserResults([]);
      setPostResults([]);
      setShowDropdown(false);
    }

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [query, quickSearch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim()) {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
      setShowDropdown(false);
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  const handleUserClick = (username: string) => {
    navigate(`/${username}`);
    setQuery("");
    setUserResults([]);
    setPostResults([]);
    setShowDropdown(false);
  };

  const handlePostClick = (post: Post) => {
    setSelectedPost(post);
    setShowDropdown(false);
    setQuery("");
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside); 
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasResults = userResults.length > 0 || postResults.length > 0;

  return (
    <div
      ref={searchRef}
      className={`relative w-full h-full ${className} ${!isHeaderSearch && !className ? 'p-5 max-w-[500px]' : ''}`}
    >
      <div className="relative h-full">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query && setShowDropdown(true)}
          className={`w-full h-full pl-12 pr-4 bg-white border-none placeholder-gray-400 focus:outline-none ${isHeaderSearch ? 'py-2 text-base focus:bg-gray-50' : 'py-4 text-lg rounded-xl border-2 border-warm-gray shadow-soft'} transition-all`}
        />
      </div>

      {showDropdown && (
        <div className={`absolute top-full left-0 right-0 ${isHeaderSearch ? 'mt-0 border-t-0 rounded-b-xl' : 'mt-2 rounded-xl'} bg-white border border-gray-200 shadow-2xl z-[1000] overflow-hidden max-h-[500px] overflow-y-auto`}>
          {loading && (
            <div className="p-4 text-center text-sm text-gray-500">
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600 mr-2" />
              Searching...
            </div>
          )}
          
          {error && !loading && (
            <div className="p-4 text-sm text-red-500">
              {error}
            </div>
          )}

          {!loading && !error && hasResults && (
            <ul className="py-2">
              {userResults.length > 0 && (
                <>
                  <li className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Users
                  </li>
                  {userResults.map((user) => (
                    <li
                      key={user.id}
                      className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-3 transition-colors"
                      onClick={() => handleUserClick(user.username)}
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden shrink-0">
                        {user.avatar_path ? (
                          <img 
                            src={user.avatar_path} 
                            alt={user.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-blue-600 text-xs font-bold">
                            {user.username.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-900">@{user.username}</span>
                    </li>
                  ))}
                </>
              )}

              {postResults.length > 0 && (
                <>
                  <li className="px-4 py-1 mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-t border-gray-50">
                    Posts
                  </li>
                  {postResults.map((post) => (
                    <li
                      key={post.post_id}
                      className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-3 transition-colors"
                      onClick={() => handlePostClick(post)}
                    >
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                        {post.image_paths[0] ? (
                          <img 
                            src={post.image_paths[0]} 
                            alt={post.caption || "Post"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {post.caption || "Untitled Post"}
                        </span>
                        {post.user && (
                          <span className="text-[11px] text-gray-500">by @{post.user.username}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </>
              )}

              <li 
                className="px-4 py-2 mt-1 border-t border-gray-50 hover:bg-gray-50 cursor-pointer text-xs text-blue-600 font-medium transition-colors"
                onClick={() => {
                  setShowDropdown(false);
                  navigate(`/search?q=${encodeURIComponent(query)}`);
                }}
              >
                Search all results for "{query}"
              </li>
            </ul>
          )}

          {!loading && !error && !hasResults && query && (
            <div className="p-4 text-sm text-gray-500 text-center">
              No results found. <br />
              <button 
                className="mt-2 text-blue-600 font-medium hover:underline"
                onClick={() => {
                  setShowDropdown(false);
                  navigate(`/search?q=${encodeURIComponent(query)}`);
                }}
              >
                Search full results for "{query}"
              </button>
            </div>
          )}
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
 
export default Search;

