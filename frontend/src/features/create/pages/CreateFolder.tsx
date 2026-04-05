import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '@/shared/api/api';
import type { Post } from '@/shared/types/Types';

const API_BASE = 'http://localhost:8000';

const CreateFolder: React.FC = () => {
  const navigate = useNavigate();
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the current user's username from localStorage, then their posts
  useEffect(() => {
    const username = localStorage.getItem('username');
    if (!username) return;

    const fetchPosts = async () => {
      setLoadingPosts(true);
      try {
        const res = await fetchWithAuth(`${API_BASE}/users/get_user_`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username }),
        });
        if (!res.ok) throw new Error('Failed to load posts');
        const data = await res.json();
        const transformed: Post[] = (data.posts ?? []).map((post: any) => ({
          ...post,
          image_paths:
            post.images
              ?.filter((img: any) => img?.paths?.medium)
              .map((img: any) => `${API_BASE}/${img.paths.original}`) ?? [],
        }));
        setPosts(transformed);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingPosts(false);
      }
    };

    fetchPosts();
    nameInputRef.current?.focus();
  }, []);

  const togglePost = (postId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(postId) ? next.delete(postId) : next.add(postId);
      return next;
    });
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a folder name.');
      nameInputRef.current?.focus();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Step 1: create the folder
      const createRes = await fetchWithAuth(`${API_BASE}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: trimmed, description: null, is_public: true }),
      });
      if (!createRes.ok) throw new Error('Failed to create folder');
      const folder = await createRes.json();

      // Step 2: add selected posts sequentially (backend adds order_index per call)
      for (const postId of selectedIds) {
        await fetchWithAuth(`${API_BASE}/folders/${folder.id}/posts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ post_id: postId }),
        });
      }

      const username = localStorage.getItem('username');
      navigate(username ? `/${username}` : '/');
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-gray-700 transition-colors"
          aria-label="Go back"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">New Folder</h1>
      </div>

      {/* Folder identity row */}
      <div className="flex items-center gap-5 mb-8">
        {/* Avatar placeholder — blank circle, wire upload later */}
        <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
          <svg className="w-9 h-9 text-purple-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
        </div>

        {/* Name input */}
        <div className="flex-1">
          <input
            ref={nameInputRef}
            type="text"
            placeholder="Folder name"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            className="w-full text-lg font-semibold bg-transparent border-b-2 border-gray-200 focus:border-purple-400 outline-none py-1 placeholder-gray-300 transition-colors"
            maxLength={80}
          />
          {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
        </div>
      </div>

      {/* Post selection grid */}
      <p className="text-sm text-gray-500 mb-4">
        Select posts to add — {selectedIds.size} selected
      </p>

      {loadingPosts ? (
        <div className="text-center py-16 text-gray-400">Loading your posts…</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No posts yet.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-10">
          {posts.map((post) => {
            const selected = selectedIds.has(post.post_id);
            const thumb = post.image_paths[0];
            return (
              <button
                key={post.post_id}
                onClick={() => togglePost(post.post_id)}
                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                  selected
                    ? 'border-purple-500 ring-2 ring-purple-300'
                    : 'border-transparent hover:border-gray-300'
                }`}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt={post.caption || `Post ${post.post_id}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01" />
                    </svg>
                  </div>
                )}

                {/* Caption overlay on hover */}
                <div className="absolute inset-x-0 bottom-0 bg-black/50 px-2 py-1 opacity-0 hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs truncate">{post.caption || 'Untitled'}</p>
                </div>

                {/* Checkmark when selected */}
                {selected && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Save bar */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          disabled={saving}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 text-sm font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Folder'}
        </button>
      </div>
    </div>
  );
};

export default CreateFolder;
