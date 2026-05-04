import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Post } from '@/shared/types/Types';
import { fetchWithAuth, API_BASE } from '@/shared/api/api';

interface PostPickerModalProps {
  onSelect: (post: Post) => void;
  onClose: () => void;
  excludedPostIds?: number[];
}

/**
 * Overlay that fetches the current user's posts and lets them pick one.
 * Portals to #modal-root to escape z-index stacking from PostDetailModal.
 * excludedPostIds prevents re-selecting an already-slotted post.
 */
const PostPickerModal: React.FC<PostPickerModalProps> = ({ onSelect, onClose, excludedPostIds = [] }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const username = localStorage.getItem('username');
    if (!username) { setLoading(false); return; }

    fetchWithAuth(`${API_BASE}/users/get_user_`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })
      .then((res) => res.json())
      .then((data) => {
        const mapped: Post[] = (data.posts ?? []).map((p: any) => ({
          ...p,
          image_paths: (p.images ?? [])
            .filter((img: any) => img?.paths?.original)
            .map((img: any) => img.paths.original),
        }));
        setPosts(mapped);
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-[520px] max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Select a post to offer</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close picker"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {loading && (
            <p className="text-sm text-gray-500 text-center py-8">Loading your posts…</p>
          )}
          {!loading && posts.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">No posts found.</p>
          )}
          {!loading && posts.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {posts.map((post) => {
                const thumb = post.images?.[0]?.paths?.medium ?? post.image_paths[0] ?? null;
                const excluded = excludedPostIds.includes(post.post_id);
                return (
                  <button
                    key={post.post_id}
                    onClick={() => !excluded && onSelect(post)}
                    disabled={excluded}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                      excluded
                        ? 'border-gray-200 opacity-40 cursor-not-allowed'
                        : 'border-transparent hover:border-blue-400 hover:scale-105'
                    }`}
                  >
                    {thumb ? (
                      <img src={thumb} alt={post.caption ?? `Post ${post.post_id}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-200" />
                    )}
                    <span className="absolute bottom-0 left-0 right-0 text-[10px] text-white bg-black/50 px-1 py-0.5 truncate text-left">
                      {post.caption || 'Untitled'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    modalRoot,
  );
};

export default PostPickerModal;
