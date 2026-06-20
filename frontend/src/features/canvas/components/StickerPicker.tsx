import { useRef, useState, type CSSProperties } from 'react';
import { Upload } from 'lucide-react';
import type { Post } from '../../../shared/types/Types';
import type { NodeSource } from '../types/canvas';
import { FadeImage } from '@/shared/components/FadeImage';

export function StickerPicker({
  posts,
  onNodeAdd,
  onUpload,
}: {
  posts: Post[];
  onNodeAdd: (url: string, source: NodeSource, opts?: { postId?: number }) => void;
  onUpload?: (file: File) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const postImages = posts.flatMap((p) =>
    ((p as any).images ?? [])
      .filter((img: any) => img?.paths?.medium)
      .map((img: any) => ({ url: img.paths.medium as string, caption: p.caption, postId: p.post_id })),
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    setIsUploading(true);
    try {
      await onUpload(file);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

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
          style={{ fontSize: 20, lineHeight: 1.1, margin: '0 0 4px', color: 'var(--pw-ink)' }}
        >
          Add to canvas
        </p>
        <p style={{ fontSize: 12, color: 'var(--pw-ink3)', margin: 0 }}>
          Choose from your posts or upload a decoration
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 12px' }}>
        {onUpload && (
          <>
            <p style={eyebrow}>Decoration</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              style={{
                ...stickerCard,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                aspectRatio: undefined,
                padding: '12px 0',
                marginBottom: 12,
                opacity: isUploading ? 0.5 : 1,
              }}
            >
              <Upload size={18} color="var(--pw-ink3)" />
              <span style={{ fontSize: 12, color: 'var(--pw-ink3)' }}>
                {isUploading ? 'Uploading…' : 'Upload image'}
              </span>
            </button>
          </>
        )}

        {postImages.length === 0 ? (
          <p style={{ color: 'var(--pw-ink3)', fontSize: 12, textAlign: 'center', padding: '32px 0' }}>
            No post images yet
          </p>
        ) : (
          <>
            <p style={eyebrow}>Your Posts</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {postImages.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onNodeAdd(img.url, 'post', { postId: img.postId })}
                  title={img.caption}
                  style={stickerCard}
                >
                  <FadeImage src={img.url} alt={img.caption} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }} />
                </button>
              ))}
            </div>
          </>
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
