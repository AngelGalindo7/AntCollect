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

export function CanvasBottomTray({ posts, onNodeAdd }: Props) {
  const [tab, setTab] = useState<Tab>('library');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stickers = [], isLoading } = useQuery<LibrarySticker[]>({
    queryKey: ['library', search],
    queryFn: () =>
      fetchWithAuth(`${API_BASE}/library/?search=${encodeURIComponent(search)}`).then((r) => r.json()),
  });

  const postImages = posts.flatMap((p) =>
    ((p as any).images ?? [])
      .filter((img: any) => img?.paths?.medium)
      .map((img: any) => ({ url: img.paths.medium, caption: p.caption })),
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

  const tabCls = (t: Tab) =>
    `px-3 py-1 text-xs font-medium rounded transition-colors ${
      tab === t ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
    }`;

  const thumbCls =
    'w-[72px] h-[72px] rounded-xl overflow-hidden border border-neutral-700 hover:border-neutral-400 hover:scale-105 active:scale-95 transition-all shrink-0 focus:outline-none focus:ring-2 focus:ring-uci-gold/60';

  return (
    <div className="bg-neutral-900 border-t border-neutral-700 shrink-0" style={{ height: '152px' }}>
      {/* Tab bar */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-1.5 border-b border-neutral-800">
        <div className="flex bg-neutral-800 rounded-lg p-0.5 gap-0.5 shrink-0">
          <button onClick={() => setTab('library')} className={tabCls('library')}>Library</button>
          <button onClick={() => setTab('posts')} className={tabCls('posts')}>My Posts</button>
          <button onClick={() => setTab('upload')} className={tabCls('upload')}>Upload</button>
        </div>

        {tab === 'library' && (
          <input
            type="text"
            placeholder="Search stickers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1 text-xs bg-neutral-800 text-neutral-200 rounded-lg border border-neutral-700 placeholder-neutral-500 focus:outline-none focus:border-neutral-500 w-44"
          />
        )}

        {tab === 'upload' && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : '+ Add image'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </>
        )}
      </div>

      {/* Horizontal scroll */}
      <div
        className="flex gap-2.5 px-3 py-2.5 overflow-x-auto items-center"
        style={{ height: '104px', scrollbarWidth: 'none' }}
      >
        {tab === 'library' && (
          isLoading
            ? Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="w-[72px] h-[72px] bg-neutral-800 animate-pulse rounded-xl shrink-0" />
              ))
            : stickers.length === 0
            ? <p className="text-neutral-500 text-xs px-1">No stickers found</p>
            : stickers.filter((s) => s.thumbnail).map((s) => (
                <button key={s.id} onClick={() => onNodeAdd(s.thumbnail!, 'library')} title={s.title} className={thumbCls}>
                  <img src={s.thumbnail!} alt={s.title} className="w-full h-full object-cover" />
                </button>
              ))
        )}

        {tab === 'posts' && (
          postImages.length === 0
            ? <p className="text-neutral-500 text-xs px-1">No post images yet</p>
            : postImages.map((img, i) => (
                <button key={i} onClick={() => onNodeAdd(img.url, 'post')} title={img.caption} className={thumbCls}>
                  <img src={img.url} alt={img.caption} className="w-full h-full object-cover" />
                </button>
              ))
        )}

        {tab === 'upload' && (
          <p className="text-neutral-500 text-xs px-1">
            Click <span className="text-neutral-300 font-medium">+ Add image</span> above to upload from your device
          </p>
        )}
      </div>
    </div>
  );
}
