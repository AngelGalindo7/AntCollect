import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '@/shared/api/api';
import PostGridLayout from '@/features/posts/components/PostGridLayout';
import PostDetailModal from '@/features/posts/components/PostDetailModal';
import type { GridItem, Post, FolderType } from '@/shared/types/Types';

import { API_BASE } from '@/shared/api/api';

const FOLDER_TYPE_LABELS: Record<FolderType, string> = {
  collection: 'Collection',
  looking_for: 'Looking For',
  trading: 'Trading Away',
};

interface FolderDetail {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  cover_post_id: number | null;
  avatar_path: string | null;
  is_public: boolean;
  folder_type: FolderType;
  posts: Post[];
}

const FolderPage: React.FC = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [folder, setFolder] = useState<FolderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const currentUserId = parseInt(localStorage.getItem('userId') ?? '0', 10);
  const isOwner = !!folder && folder.user_id === currentUserId;

  useEffect(() => {
    const fetchFolder = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithAuth(`${API_BASE}/folders/${folderId}`, {
          credentials: 'include',
        });
        if (res.status === 403) { setError('This folder is private.'); return; }
        if (res.status === 404) { setError('Folder not found.'); return; }
        if (!res.ok) throw new Error(`Error ${res.status}`);

        const data = await res.json();
        const transformed: FolderDetail = {
          ...data,
          posts: (data.posts ?? []).map((post: any) => ({
            ...post,
            image_paths: (post.images ?? [])
              .filter((img: any) => img && img.paths?.original)
              .map((img: any) => img.paths.original),
          })),
        };
        setFolder(transformed);
      } catch (err) {
        console.error(err);
        setError('Failed to load folder.');
      } finally {
        setLoading(false);
      }
    };

    if (folderId) fetchFolder();
  }, [folderId]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !folder) return;

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetchWithAuth(`${API_BASE}/folders/${folder.id}/avatar`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const updated = await res.json();
      setFolder((prev) => prev ? { ...prev, avatar_path: updated.avatar_path } : prev);
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingAvatar(false);
      // reset so the same file can be re-selected
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handlePostDelete = (postId: number) => {
    setFolder((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        posts: prev.posts.filter((p) => p.post_id !== postId),
      };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error || !folder) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-lg text-gray-600">{error ?? 'Something went wrong.'}</p>
        <button onClick={() => navigate(-1)} className="text-sm text-blue-500 hover:underline">
          Go back
        </button>
      </div>
    );
  }

  const coverPost = folder.cover_post_id
    ? folder.posts.find((p) => p.post_id === folder.cover_post_id)
    : null;
  const coverImageUrl = folder.avatar_path ?? coverPost?.image_paths?.[0] ?? null;

  const gridItems: GridItem[] = folder.posts.map((p): GridItem => ({ kind: 'post', data: p }));

  return (
    <div className="w-full">
      {/* ── Folder header ── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-8 py-6 flex items-start gap-6">
          {/* Avatar / cover image */}
          <div className="shrink-0 relative group/avatar w-24 h-24">
            <div className="w-24 h-24 rounded-lg overflow-hidden bg-purple-50 flex items-center justify-center">
              {coverImageUrl ? (
                <img src={coverImageUrl} alt={folder.name} className="w-full h-full object-cover" />
              ) : (
                <svg className="w-12 h-12 text-purple-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
              )}
            </div>

            {isOwner && (
              <>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 rounded-lg bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center disabled:cursor-not-allowed"
                  aria-label="Upload folder avatar"
                >
                  {uploadingAvatar ? (
                    <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </>
            )}
          </div>

          {/* Folder info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{folder.name}</h1>
              <span className="text-xs font-medium text-purple-600 bg-purple-50 rounded-full px-2 py-0.5">
                {FOLDER_TYPE_LABELS[folder.folder_type]}
              </span>
            </div>

            {folder.description && (
              <p className="text-sm text-gray-500 mt-1">{folder.description}</p>
            )}

            <p className="text-sm text-gray-400 mt-2">
              {folder.posts.length} {folder.posts.length === 1 ? 'post' : 'posts'}
            </p>
          </div>

          <button
            onClick={() => navigate(-1)}
            className="shrink-0 text-sm text-gray-400 hover:text-gray-600"
          >
            ← Back
          </button>
        </div>
      </div>

      {/* ── Posts grid ── */}
      <PostGridLayout
        items={gridItems}
        onPostClick={(post) => setSelectedPost(post)}
        onPostDelete={handlePostDelete}
        folderType={folder.folder_type}
        postOwnerId={folder.user_id}
      />

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onDeleteSuccess={() => {
            handlePostDelete(selectedPost.post_id);
            setSelectedPost(null);
          }}
          postOwnerId={folder.user_id}
          folderType={folder.folder_type}
        />
      )}
    </div>
  );
};

export default FolderPage;
