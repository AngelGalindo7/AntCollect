import { useState, useRef, type ChangeEvent } from 'react';
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

export function StickerPicker({
  posts,
  onNodeAdd,
  onUploadAsset,
}: {
  posts: Post[];
  onNodeAdd: (url: string, source: NodeSource) => void;
  onUploadAsset?: (file: File) => Promise<string>;
}) {
  const [tab, setTab] = useState<'library' | 'posts' | 'upload'>('library');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stickers = [], isLoading } = useQuery<LibrarySticker[]>({
    queryKey: ['library', search],
    queryFn: () =>
      fetchWithAuth(`${API_BASE}/library/?search=${encodeURIComponent(search)}`).then((r) => r.json()),
    enabled: tab === 'library',
  });

  const postImages = posts.flatMap((p) =>
    ((p as any).images ?? [])
      .filter((img: any) => img?.paths?.medium)
      .map((img: any) => ({ url: img.paths.medium as string, caption: p.caption })),
  );

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const upload = onUploadAsset ?? uploadCanvasAsset;
      const url = await upload(file);
      onNodeAdd(url, 'upload');
    } catch {
      // silent — user can retry
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const tabCls = (t: string) =>
    `flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
      tab === t ? 'bg-espresso text-white' : 'text-neutral-500 hover:text-espresso'
    }`;

  const thumbCls =
    'aspect-square rounded-lg overflow-hidden border border-neutral-200 hover:border-neutral-400 hover:scale-[1.04] active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-uci-gold/60 bg-neutral-100';

  return (
    <div className="w-64 shrink-0 bg-white border-r border-neutral-200 flex flex-col">
      <div className="p-3 border-b border-neutral-100 shrink-0">
        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-2">Add to Canvas</p>
        <div className="flex bg-neutral-100 rounded-lg p-0.5 gap-0.5">
          <button onClick={() => setTab('library')} className={tabCls('library')}>Library</button>
          <button onClick={() => setTab('posts')} className={tabCls('posts')}>Posts</button>
          <button onClick={() => setTab('upload')} className={tabCls('upload')}>Upload</button>
        </div>
      </div>

      {tab === 'library' && (
        <div className="px-3 py-2 border-b border-neutral-100 shrink-0">
          <input
            type="text"
            placeholder="Search stickers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-lg placeholder-neutral-400 focus:outline-none focus:border-neutral-400"
          />
        </div>
      )}

      {tab === 'upload' && (
        <div className="px-3 py-2 border-b border-neutral-100 shrink-0">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full py-2 bg-espresso hover:bg-espresso/90 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : '+ Upload image'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2.5">
        {tab === 'library' && (
          isLoading ? (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-square bg-neutral-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : stickers.length === 0 ? (
            <p className="text-neutral-400 text-xs text-center py-8">No stickers found</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {stickers.filter((s) => s.thumbnail).map((s) => (
                <button key={s.id} onClick={() => onNodeAdd(s.thumbnail!, 'library')} title={s.title} className={thumbCls}>
                  <img src={s.thumbnail!} alt={s.title} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )
        )}

        {tab === 'posts' && (
          postImages.length === 0 ? (
            <p className="text-neutral-400 text-xs text-center py-8">No post images yet</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {postImages.map((img, i) => (
                <button key={i} onClick={() => onNodeAdd(img.url, 'post')} title={img.caption} className={thumbCls}>
                  <img src={img.url} alt={img.caption} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )
        )}

        {tab === 'upload' && (
          <p className="text-neutral-400 text-xs text-center py-8">
            Click <span className="text-neutral-600 font-medium">+ Upload image</span> above to add from your device
          </p>
        )}
      </div>
    </div>
  );
}
