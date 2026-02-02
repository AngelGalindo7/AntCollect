import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:8000";

interface SearchResponse {
  id: number;
  username: string;
  email?: string;
  // Add other user fields as needed
}

const Search: React.FC = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  
  // Ref to store the timeout ID
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Function to search users
  const searchUsers = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/users/search_user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data: SearchResponse[] = await response.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search effect
  useEffect(() => {
    // Clear the previous timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    // Only search if there's a query
    if (query.trim()) {
      debounceTimeout.current = setTimeout(() => {
        searchUsers(query);
      }, 300);
    } else {
      setResults([]); // Clear results if query is empty
    }

    // Cleanup function
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [query, searchUsers]);

  // Handle user click
  const handleUserClick = (username: string) => {
    navigate(`/${username}`);
    // Clear search after navigation
    setQuery("");
    setResults([]);
  };

  return (
    <div className="search-container" style={{ padding: "20px", maxWidth: "500px" }}>
      <input
        type="text"
        placeholder="Search users..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: "100%",
          padding: "10px",
          fontSize: "16px",
          border: "1px solid #ccc",
          borderRadius: "4px",
        }}
      />

      {loading && <div style={{ marginTop: "10px" }}>Searching...</div>}
      
      {error && (
        <div style={{ marginTop: "10px", color: "red" }}>
          Error: {error}
        </div>
      )}

      {results.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: "10px" }}>
          {results.map((user) => (
            <li
              key={user.id}
              style={{
                padding: "10px",
                borderBottom: "1px solid #eee",
                cursor: "pointer",
              }}
              onClick={() => handleUserClick(user.username)}
            >
              <strong>{user.username}</strong>
              {user.email && <div style={{ fontSize: "14px", color: "#666" }}>{user.email}</div>}
            </li>
          ))}
        </ul>
      )}

      {query && !loading && results.length === 0 && !error && (
        <div style={{ marginTop: "10px", color: "#666" }}>
          No users found
        </div>
      )}
    </div>
  );
};

export default Search;