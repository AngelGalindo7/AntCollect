import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchPublic, fetchWithAuth } from '@/shared/api/api';
import PostGridLayout from '@/features/posts/components/PostGridLayout';
import PostDetailModal from '@/features/posts/components/PostDetailModal';
import AddStickersModal from '@/features/create/components/AddStickersModal';
import type { GridItem, Post, FolderType } from '@/shared/types/Types';
import type { MasonryConfig } from '@/shared/hooks/useMasonryLayout';

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
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentUserId = parseInt(localStorage.getItem('userId') ?? '0', 10);
  const isOwner = !!folder && folder.user_id === currentUserId;

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const fetchFolder = useCallback(async () => {
    if (!folderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPublic(`${API_BASE}/folders/${folderId}`);
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
  }, [folderId]);

  useEffect(() => {
    fetchFolder();
  }, [fetchFolder]);

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

  const handleDeleteFolder = async () => {
    if (!folder) return;
    if (!window.confirm(`Delete "${folder.name}"? The folder will be removed but the posts inside will remain in your library. This action cannot be undone.`)) return;

    setDeleting(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/folders/${folder.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok && res.status !== 204) throw new Error(`Delete failed: ${res.status}`);
      const username = localStorage.getItem('username');
      if (username) {
        navigate(`/${username}`, { state: { tab: folder.folder_type } });
      } else {
        navigate(-1);
      }
    } catch (err) {
      console.error(err);
      setDeleting(false);
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

  const previewImages = folder.posts
    .slice(0, 4)
    .map((p) => p.image_paths?.[0])
    .filter((s): s is string => !!s);
  const coverTiles = [...previewImages];
  while (coverTiles.length < 4) coverTiles.push('');

  const gridItems: GridItem[] = folder.posts.map((p): GridItem => ({ kind: 'post', data: p }));

  const FOLDER_MASONRY_CONFIG: MasonryConfig = {
    gap: 10,
    breakpoints: [
      { minWidth: 0, cols: 3 },
      { minWidth: 640, cols: 4 },
      { minWidth: 1024, cols: 5 },
      { minWidth: 1280, cols: 6 },
    ],
  };

  return (
    <div className="w-full">
      {/* ── Folder header ── */}
      <div className="bg-white border-b border-warm-gray/40">
        <div className="max-w-6xl mx-auto px-8 py-8 flex items-start gap-7">
          {/* Cover — mirrors FolderCard tile */}
          <div className="shrink-0 w-44 h-44 rounded-2xl overflow-hidden bg-white border border-black/5 shadow-sm relative">
            {folder.avatar_path ? (
              <img
                src={folder.avatar_path}
                alt={folder.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : previewImages.length > 0 ? (
              <div className="grid grid-cols-2 grid-rows-2 gap-px w-full h-full bg-black/5">
                {coverTiles.map((src, i) =>
                  src ? (
                    <img key={i} src={src} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div key={i} className="w-full h-full bg-soft-white" />
                  )
                )}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-soft-white">
                <svg className="w-16 h-16 text-warm-gray/60" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
              </div>
            )}
          </div>

          {isOwner && (
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
          )}

          {/* Folder info */}
          <div className="flex-1 min-w-0 pt-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-espresso tracking-tight">{folder.name}</h1>
              <span className="text-xs font-semibold text-espresso bg-uci-gold/30 rounded-full px-2.5 py-0.5">
                {FOLDER_TYPE_LABELS[folder.folder_type]}
              </span>
            </div>

            {folder.description && (
              <p className="text-sm text-espresso/60 mt-2">{folder.description}</p>
            )}

            <p className="text-sm text-espresso/45 mt-2">
              {folder.posts.length} {folder.posts.length === 1 ? 'post' : 'posts'}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2 pt-2">
            {isOwner && (
              <>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold text-espresso bg-uci-gold/95 hover:bg-uci-gold shadow-button-gold transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v14M5 12h14" />
                  </svg>
                  Add Stickers
                </button>

                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen((o) => !o)}
                    className="p-2 rounded-full text-espresso/60 hover:text-espresso hover:bg-warm-cream transition-colors"
                    aria-label="More actions"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="5" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="12" cy="19" r="2" />
                    </svg>
                  </button>

                  {menuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-2 z-20 min-w-44 rounded-xl bg-white border border-warm-gray/40 shadow-lg overflow-hidden"
                    >
                      <button
                        role="menuitem"
                        onClick={() => { setMenuOpen(false); avatarInputRef.current?.click(); }}
                        disabled={uploadingAvatar}
                        className="w-full text-left px-4 py-2.5 text-sm text-espresso hover:bg-warm-cream/70 transition-colors flex items-center gap-2.5 disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {uploadingAvatar ? 'Uploading…' : 'Edit cover'}
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => { setMenuOpen(false); handleDeleteFolder(); }}
                        disabled={deleting}
                        className="w-full text-left px-4 py-2.5 text-sm text-brick-red hover:bg-brick-red/10 transition-colors flex items-center gap-2.5 disabled:opacity-50 border-t border-warm-gray/30"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M3 7h18M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3" />
                        </svg>
                        {deleting ? 'Deleting…' : 'Delete folder'}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
            <button
              onClick={() => navigate(-1)}
              className="text-sm text-espresso/45 hover:text-espresso transition-colors px-2"
            >
              ← Back
            </button>
          </div>
        </div>
      </div>

      {/* ── Posts grid ── */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <PostGridLayout
          items={gridItems}
          onPostClick={(post) => setSelectedPost(post)}
          onPostDelete={handlePostDelete}
          folderType={folder.folder_type}
          postOwnerId={folder.user_id}
          masonryConfig={FOLDER_MASONRY_CONFIG}
        />
      </div>

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

      {showAddModal && (
        <AddStickersModal
          folderId={folder.id}
          folderType={folder.folder_type}
          onClose={() => setShowAddModal(false)}
          onUploaded={() => {
            fetchFolder();
          }}
        />
      )}
    </div>
  );
};

export default FolderPage;
