import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '@/shared/api/api';
import type { FolderType, Post } from '@/shared/types/Types';

const FOLDER_TYPES: { value: FolderType; label: string }[] = [
  { value: 'collection', label: 'Collection' },
  { value: 'looking_for', label: 'Looking For' },
  { value: 'trading', label: 'Trading Away' },
];

import { API_BASE } from '@/shared/api/api';

const CreateFolder: React.FC = () => {
  const navigate = useNavigate();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [folderType, setFolderType] = useState<FolderType>('collection');
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

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

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

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
        body: JSON.stringify({ name: trimmed, description: null, is_public: true, folder_type: folderType }),
      });
      if (!createRes.ok) throw new Error('Failed to create folder');
      const folder = await createRes.json();

      // Step 2: upload avatar if one was selected
      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);
        await fetchWithAuth(`${API_BASE}/folders/${folder.id}/avatar`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
      }

      // Step 3: add selected posts sequentially (backend adds order_index per call)
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
        {/* Avatar — click to select image */}
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          className="relative w-20 h-20 rounded-full overflow-hidden bg-purple-100 flex items-center justify-center shrink-0 group hover:ring-2 hover:ring-purple-400 transition-all"
          aria-label="Choose folder avatar"
        >
          {avatarPreview ? (
            <img src={avatarPreview} alt="Folder avatar" className="w-full h-full object-cover" />
          ) : (
            <svg className="w-9 h-9 text-purple-300" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
          )}
          {/* Camera overlay on hover */}
          <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
        </button>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleAvatarSelect}
        />

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

      {/* Folder type selector */}
      <div className="mb-8">
        <p className="text-sm font-medium text-gray-700 mb-3">Folder type</p>
        <div className="flex gap-3">
          {FOLDER_TYPES.map((ft) => (
            <button
              key={ft.value}
              type="button"
              onClick={() => setFolderType(ft.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                folderType === ft.value
                  ? 'bg-purple-600 border-purple-600 text-white'
                  : 'bg-white border-gray-300 text-gray-600 hover:border-purple-400 hover:text-purple-600'
              }`}
            >
              {ft.label}
            </button>
          ))}
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
