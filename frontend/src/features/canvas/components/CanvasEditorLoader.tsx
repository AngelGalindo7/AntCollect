import { useEffect, useState } from 'react';
import { CanvasEditor } from './CanvasEditor';
import { getMyCanvas } from '../api/canvasApi';
import { fetchWithAuth, API_BASE } from '../../../shared/api/api';
import type { CanvasState } from '../types/canvas';
import type { Post } from '../../../shared/types/Types';

interface Props {
  onClose: () => void;
}

export function CanvasEditorLoader({ onClose }: Props) {
  const [initialState, setInitialState] = useState<CanvasState | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [canvasRes, meRes] = await Promise.all([
          getMyCanvas().catch(() => null),
          fetchWithAuth(`${API_BASE}/users/me`).then((r) => r.ok ? r.json() : null),
        ]);

        if (meRes?.username) {
          const profileRes = await fetchWithAuth(`${API_BASE}/users/get_user_`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username: meRes.username }),
          });
          if (profileRes.ok) {
            const data = await profileRes.json();
            const postUser = { user_id: data.user_id, username: data.username, avatar_path: data.avatar_path };
            setPosts(
              (data.posts ?? []).map((post: any) => ({
                ...post,
                image_paths: (post.images ?? [])
                  .filter((img: any) => img?.paths?.medium)
                  .map((img: any) => img.paths.original),
                user: postUser,
              }))
            );
          }
        }

        setInitialState(canvasRes?.canvas_json ?? null);
      } finally {
        setReady(true);
      }
    };
    load();
  }, []);

  if (!ready) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950">
        <p className="text-neutral-400 text-sm">Loading canvas…</p>
      </div>
    );
  }

  return (
    <CanvasEditor
      initialState={initialState}
      posts={posts}
      onClose={onClose}
      onSaveSuccess={onClose}
    />
  );
}
