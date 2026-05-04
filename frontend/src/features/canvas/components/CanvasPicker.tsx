import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth, API_BASE } from '../../../shared/api/api';
import { uploadCanvasAsset } from '../api/canvasApi';
import type { Post } from '../../../shared/types/Types';
import type { NodeSource } from '../types/canvas';

interface LibrarySticker {
  id: number;
  title: string;
  thumbnail: string | null;
}

type Tab = 'library' | 'posts' | 'upload';

interface Props {
  posts: Post[];
  onNodeAdd: (imageUrl: string, source: NodeSource) => void;
}

export function CanvasPicker({ posts, onNodeAdd }: Props) {
  const [tab, setTab] = useState<Tab>('library');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stickers = [], isLoading } = useQuery<LibrarySticker[]>({
    queryKey: ['library', search],
    queryFn: () =>
      fetchWithAuth(`${API_BASE}/library/?search=${encodeURIComponent(search)}`).then((r) =>
        r.json(),
      ),
  });

  const postImages = posts.flatMap((p) =>
    (p.images ?? []).map((img) => ({ url: img.paths.medium, caption: p.caption })),
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadCanvasAsset(file);
      onNodeAdd(url, 'upload');
    } catch {
      // silent — user can retry
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
        tab === t ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-full w-64 bg-neutral-900 border-r border-neutral-700 shrink-0">
      <div className="p-3 border-b border-neutral-700">
        <div className="flex bg-neutral-800 rounded p-0.5 gap-0.5">
          {tabBtn('library', 'Library')}
          {tabBtn('posts', 'Posts')}
          {tabBtn('upload', 'Upload')}
        </div>
      </div>

      {tab === 'library' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-2">
            <input
              type="text"
              placeholder="Search stickers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-neutral-800 text-neutral-200 rounded border border-neutral-700 placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-neutral-800 animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {stickers.map((s) =>
                  s.thumbnail ? (
                    <button
                      key={s.id}
                      onClick={() => onNodeAdd(s.thumbnail!, 'library')}
                      className="aspect-square rounded overflow-hidden border border-neutral-700 hover:border-neutral-400 transition-colors focus:outline-none"
                      title={s.title}
                    >
                      <img src={s.thumbnail} alt={s.title} className="w-full h-full object-cover" />
                    </button>
                  ) : null,
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'posts' && (
        <div className="flex-1 overflow-y-auto p-2">
          {postImages.length === 0 ? (
            <p className="text-neutral-500 text-xs text-center mt-8">No post images yet</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {postImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => onNodeAdd(img.url, 'post')}
                  className="aspect-square rounded overflow-hidden border border-neutral-700 hover:border-neutral-400 transition-colors focus:outline-none"
                  title={img.caption ?? undefined}
                >
                  <img src={img.url} alt={img.caption ?? 'Post image'} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'upload' && (
        <div className="flex flex-col items-center justify-center flex-1 p-4 gap-3">
          <p className="text-neutral-400 text-xs text-center">Upload any image directly to your canvas</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white text-xs rounded transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Choose image'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}
    </div>
  );
}
