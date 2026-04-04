import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "@/shared/api/api";

const API_BASE = "http://localhost:8000";


interface UserResult {
  id: number;
  username: string;
  profile_image?: string;
}
interface QuickSearchResponse {
  query: string;
  users: UserResult[];
  posts: null;
}

const Search: React.FC = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  
  // Ref to store the timeout ID
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  


  // Function to search users
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

  // Debounced search while typing
  useEffect(() => {
    // Clear the previous timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    // Only search if there's a query
    if (query.trim()) {
      debounceTimeout.current = setTimeout(() => {
        quickSearch(query);
      }, 300);
    } else {
      setResults([]); // Clear results if query is empty
      setShowDropdown(false);
    }

    // Cleanup function
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [query, quickSearch]);

  
  // Handle Enter - Navigate to search results page
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim()) {
      // Clear debounce and dropdown
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
      setShowDropdown(false);
      
      // Navigate to search results page with query param
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  // Handle user click
  const handleUserClick = (username: string) => {
    console.log(username)
    navigate(`/${username}`);
    // Clear search after navigation
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
      style={{ position: "relative", padding: "20px", maxWidth: "500px" }}
    >
      <input
        type="text"
        placeholder="Search users..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => query && setShowDropdown(true)}
        style={{
          width: "100%",
          padding: "10px",
          fontSize: "16px",
          border: "1px solid #ccc",
          borderRadius: "4px",
        }}
      />
      

      {showDropdown && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          backgroundColor: "white",
          border: "1px solid #ccc",
          borderRadius: "4px",
          marginTop: "4px",
          maxHeight: "300px",
          overflowY: "auto",
          zIndex: 1000,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>

      {loading && (<div style={{ marginTop: "10px" }}>Searching...</div>
      )}
      
      {error && !loading && (
        <div style={{ padding: "10px", color: "red" }}>
          Error: {error}
        </div>
      )}

      {!loading && !error && results.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {results.map((user) => (
            <li
              key={user.id}
              style={{
                padding: "10px",
                borderBottom: "1px solid #eee",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
              onClick={() => handleUserClick(user.username)}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f5f5f5"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
            >
            {user.profile_image && (
                    <img 
                      src={user.profile_image} 
                      alt={user.username}
                      style={{ width: "32px", height: "32px", borderRadius: "50%" }}
                    />
                  )}
              <strong>{user.username}</strong>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && results.length === 0 && query && (
        <div style={{ padding: "10px", color: "#666" }}>
          No users found. Press Enter to search posts.
        </div>
      )}
    </div>
  )}
  </div>
  );
};
 
export default Search;
