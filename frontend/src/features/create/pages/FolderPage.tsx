import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '@/shared/api/api';
import PostGridLayout from '@/features/posts/components/PostGridLayout';
import type { GridItem, Post, FolderType } from '@/shared/types/Types';

const API_BASE = 'http://localhost:8000';

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
  is_public: boolean;
  folder_type: FolderType;
  posts: Post[];
}

const FolderPage: React.FC = () => {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const [folder, setFolder] = useState<FolderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
              .map((img: any) => `${API_BASE}/${img.paths.original}`),
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
  const coverImageUrl = coverPost?.image_paths?.[0] ?? null;

  const gridItems: GridItem[] = folder.posts.map((p): GridItem => ({ kind: 'post', data: p }));

  return (
    <div className="w-full">
      {/* ── Folder header ── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-8 py-6 flex items-start gap-6">
          {/* Cover image or placeholder */}
          <div className="shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-purple-50 flex items-center justify-center">
            {coverImageUrl ? (
              <img src={coverImageUrl} alt={folder.name} className="w-full h-full object-cover" />
            ) : (
              <svg className="w-12 h-12 text-purple-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
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
      <PostGridLayout items={gridItems} />
    </div>
  );
};

export default FolderPage;
