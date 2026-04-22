import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth, API_BASE } from "@/shared/api/api";

interface UserResult {
  id: number;
  username: string;
  avatar_path?: string;
}

interface QuickSearchResponse {
  query: string;
  users: UserResult[];
  posts: null;
}

interface SearchProps {
  isHeaderSearch?: boolean;
}

const Search: React.FC<SearchProps> = ({ isHeaderSearch = false }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const quickSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
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
      setResults(data.users);
      setShowDropdown(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setResults([]);
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
      setResults([]);
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
    setResults([]);
    setShowDropdown(false);
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

  return (
    <div
      ref={searchRef}
      className={`relative w-full ${!isHeaderSearch ? 'p-5 max-w-[500px]' : ''}`}
    >
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Search stickers, users..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query && setShowDropdown(true)}
          className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-full text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
        />
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-[1000] overflow-hidden max-h-[400px] overflow-y-auto">
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

          {!loading && !error && results.length > 0 && (
            <ul className="py-2">
              <li className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Users
              </li>
              {results.map((user) => (
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
              <li 
                className="px-4 py-2 mt-1 border-t border-gray-50 hover:bg-gray-50 cursor-pointer text-xs text-blue-600 font-medium transition-colors"
                onClick={() => {
                  setShowDropdown(false);
                  navigate(`/search?q=${encodeURIComponent(query)}`);
                }}
              >
                Search all posts for "{query}"
              </li>
            </ul>
          )}

          {!loading && !error && results.length === 0 && query && (
            <div className="p-4 text-sm text-gray-500 text-center">
              No users found. <br />
              <button 
                className="mt-2 text-blue-600 font-medium hover:underline"
                onClick={() => {
                  setShowDropdown(false);
                  navigate(`/search?q=${encodeURIComponent(query)}`);
                }}
              >
                Search for posts instead
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
 
export default Search;
