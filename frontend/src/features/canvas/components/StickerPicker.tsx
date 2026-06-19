import { type CSSProperties } from 'react';
import type { Post } from '../../../shared/types/Types';
import type { NodeSource } from '../types/canvas';

export function StickerPicker({
  posts,
  onNodeAdd,
}: {
  posts: Post[];
  onNodeAdd: (url: string, source: NodeSource) => void;
}) {
  const postImages = posts.flatMap((p) =>
    ((p as any).images ?? [])
      .filter((img: any) => img?.paths?.medium)
      .map((img: any) => ({ url: img.paths.medium as string, caption: p.caption })),
  );

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
          Choose from your posts
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 12px' }}>
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
                  onClick={() => onNodeAdd(img.url, 'post')}
                  title={img.caption}
                  style={stickerCard}
                >
                  <img src={img.url} alt={img.caption} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }} />
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
