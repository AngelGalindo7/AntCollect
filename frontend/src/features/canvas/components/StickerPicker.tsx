import { useState, useRef, type ChangeEvent, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { fetchWithAuth, API_BASE } from '../../../shared/api/api';
import { uploadCanvasAsset } from '../api/canvasApi';
import type { Post } from '../../../shared/types/Types';
import type { NodeSource } from '../types/canvas';

const CARD_COLORS = [
  '#e8e0fa',
  '#fef5cc',
  '#cff5ec',
  '#fce4ef',
  '#dceeff',
  '#f3e0fa',
  '#fdebd0',
  '#d5f5e3',
];

function cardColor(id: number) {
  return CARD_COLORS[id % CARD_COLORS.length];
}

interface LibrarySticker {
  id: number;
  title: string;
  thumbnail: string | null;
  is_favorite?: boolean;
}

type Tab = 'library' | 'photo' | 'upload';

export function StickerPicker({
  posts,
  onNodeAdd,
  onUploadAsset,
}: {
  posts: Post[];
  onNodeAdd: (url: string, source: NodeSource) => void;
  onUploadAsset?: (file: File) => Promise<string>;
}) {
  const [tab, setTab] = useState<Tab>('library');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stickers = [], isLoading } = useQuery<LibrarySticker[]>({
    queryKey: ['library', ''],
    queryFn: () =>
      fetchWithAuth(`${API_BASE}/library/`).then((r) => r.json()),
    enabled: tab === 'library',
  });

  const visibleStickers = stickers.filter((s) => s.thumbnail);
  const favorites = visibleStickers.filter((s) => s.is_favorite).slice(0, 6);
  const allStickers = visibleStickers;

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
      // silent
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const segmentTrack: CSSProperties = {
    display: 'flex',
    background: 'var(--pw-surface2)',
    border: '1px solid var(--pw-line)',
    borderRadius: 9,
    padding: 2,
    gap: 2,
  };

  const segmentBtn = (active: boolean): CSSProperties => ({
    flex: 1,
    height: 28,
    padding: '0 14px',
    borderRadius: 7,
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    color: active ? '#fff' : 'var(--pw-ink3)',
    background: active ? 'var(--pw-accent)' : 'transparent',
    boxShadow: active ? '0 1px 0 rgba(0,0,0,.04), 0 1px 3px rgba(0,0,0,.08)' : 'none',
    transition: 'background 120ms ease, color 120ms ease',
  });

  const stickerCard: CSSProperties = {
    position: 'relative',
    aspectRatio: '1 / 1',
    background: 'var(--pw-surface2)',
    border: '1px solid var(--pw-line)',
    borderRadius: 10,
    padding: 6,
    cursor: 'pointer',
    transition: 'transform 120ms ease, border-color 120ms ease',
  };

  const eyebrow: CSSProperties = {
    fontSize: 10.5,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--pw-ink3)',
    margin: '4px 0 8px',
  };

  return (
    <div
      className="paper-workshop pw-neutral"
      style={{
        width: 280,
        flexShrink: 0,
        background: 'var(--pw-paper)',
        borderRight: '1px solid var(--pw-line)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '16px 16px 12px' }}>
        <p
          className="pw-display"
          style={{ fontSize: 20, lineHeight: 1.1, margin: '0 0 10px', color: 'var(--pw-ink)' }}
        >
          Add to canvas
        </p>
        <div style={segmentTrack}>
          <button type="button" onClick={() => setTab('library')} style={segmentBtn(tab === 'library')}>
            Library
          </button>
          <button type="button" onClick={() => setTab('photo')} style={segmentBtn(tab === 'photo')}>
            Photo
          </button>
          <button type="button" onClick={() => setTab('upload')} style={segmentBtn(tab === 'upload')}>
            Upload
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 12px' }}>
        {tab === 'library' && (
          isLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    aspectRatio: '1 / 1',
                    background: 'var(--pw-surface2)',
                    border: '1px solid var(--pw-line)',
                    borderRadius: 10,
                    opacity: 0.6,
                  }}
                />
              ))}
            </div>
          ) : visibleStickers.length === 0 ? (
            <p style={{ color: 'var(--pw-ink3)', fontSize: 12, textAlign: 'center', padding: '32px 0' }}>
              No stickers found
            </p>
          ) : (
            <>
              {favorites.length > 0 && (
                <>
                  <p style={eyebrow}>Favorites</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
                    {favorites.map((s) => (
                      <button
                        key={`fav-${s.id}`}
                        type="button"
                        onClick={() => onNodeAdd(s.thumbnail!, 'library')}
                        title={s.title}
                        style={{ ...stickerCard, background: cardColor(s.id) }}
                      >
                        <img src={s.thumbnail!} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        <span
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            width: 18,
                            height: 18,
                            background: 'var(--pw-accent)',
                            borderRadius: 4,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Star size={10} fill="#fff" stroke="#fff" strokeWidth={1.6} />
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <p style={{ ...eyebrow, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>All Stickers</span>
                <span style={{ fontWeight: 400, fontSize: 11, letterSpacing: 0 }}>▾</span>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {allStickers.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onNodeAdd(s.thumbnail!, 'library')}
                    title={s.title}
                    style={{ ...stickerCard, background: cardColor(s.id) }}
                  >
                    <img src={s.thumbnail!} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </button>
                ))}
              </div>
            </>
          )
        )}

        {tab === 'photo' && (
          postImages.length === 0 ? (
            <p style={{ color: 'var(--pw-ink3)', fontSize: 12, textAlign: 'center', padding: '32px 0' }}>
              No post images yet
            </p>
          ) : (
            <>
              <p style={eyebrow}>Your Photos</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {postImages.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onNodeAdd(img.url, 'post')}
                    title={img.caption}
                    style={stickerCard}
                  >
                    <img src={img.url} alt={img.caption} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }} />
                  </button>
                ))}
              </div>
            </>
          )
        )}

        {tab === 'upload' && (
          <div style={{ padding: '8px 0' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: '#FFD200',
                color: '#332D2A',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                opacity: uploading ? 0.5 : 1,
                transition: 'opacity 120ms ease',
              }}
            >
              {uploading ? 'Uploading…' : '+ Upload image'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
            <p style={{ color: 'var(--pw-ink3)', fontSize: 11, textAlign: 'center', marginTop: 12 }}>
              Choose an image from your device
            </p>
          </div>
        )}
      </div>

      <div
        style={{
          padding: '10px 16px',
          background: 'var(--pw-surface2)',
          borderTop: '1px solid var(--pw-line)',
          fontSize: 11,
          color: 'var(--pw-ink3)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        Drag onto canvas, or
        <span className="pw-kbd">↵</span>
        to add
      </div>
    </div>
  );
}
