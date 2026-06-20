import { useState, useRef, type ChangeEvent, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth, API_BASE } from '../../../shared/api/api';
import { uploadCanvasAsset } from '../api/canvasApi';
import type { CanvasNode, BackgroundConfig, HoloVariant } from '../types/canvas';
import { HOLO_VARIANTS } from '../types/canvas';
import { FadeImage } from '@/shared/components/FadeImage';

interface LibrarySticker {
  id: number;
  title: string;
  thumbnail: string | null;
  is_favorite?: boolean;
}

type RightTab = 'reposition' | 'replace';

interface RightPanelProps {
  selectedId: string | null;
  nodes: CanvasNode[];
  background: BackgroundConfig;
  onSelectNode: (id: string) => void;
  onReplaceNode: (id: string, newUrl: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onFlipHorizontal: () => void;
  onDelete: () => void;
  onChangeBackground: (bg: BackgroundConfig) => void;
  onStartBgImageEdit: (url: string) => void;
  onUploadBgImage?: (file: File) => Promise<string>;
  onChangeHoloVariant: (id: string, variant: HoloVariant) => void;
  onToggleRemoveBg: () => void;
  isRemovingBg: boolean;
}

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

const BG_COLOR_PRESETS = [
  '#f5f0e8',
  '#ffffff',
  '#f0f4f8',
  '#1c1a16',
  '#0064A4',
  '#FFD200',
  '#e8e0fa',
  '#fce4ef',
];

function cardColor(id: number) {
  return CARD_COLORS[id % CARD_COLORS.length];
}

const eyebrow: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--pw-ink3)',
  margin: 0,
};

const actionBtn = (danger = false): CSSProperties => ({
  width: '100%',
  height: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  fontWeight: 500,
  borderRadius: 8,
  border: danger ? 'none' : '1px solid var(--pw-line)',
  background: danger ? '#fce4ef' : 'var(--pw-surface2)',
  color: danger ? '#b03060' : 'var(--pw-ink)',
  cursor: 'pointer',
  transition: 'opacity 120ms ease',
});

export function StickerControls({
  selectedId,
  nodes,
  background,
  onSelectNode,
  onReplaceNode,
  onMoveUp,
  onMoveDown,
  onFlipHorizontal,
  onDelete,
  onChangeBackground,
  onStartBgImageEdit,
  onUploadBgImage,
  onChangeHoloVariant,
  onToggleRemoveBg,
  isRemovingBg,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<RightTab>('reposition');
  const [bgUploading, setBgUploading] = useState(false);
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  const { data: libraryStickers = [] } = useQuery<LibrarySticker[]>({
    queryKey: ['library', ''],
    queryFn: () => fetchWithAuth(`${API_BASE}/library/`).then((r) => r.json()),
    enabled: activeTab === 'replace',
  });

  const visibleLibrary = libraryStickers.filter((s) => s.thumbnail);
  const selectedLibrarySticker = selectedNode
    ? visibleLibrary.find((s) => s.thumbnail === selectedNode.image_url) ?? null
    : null;
  const selectedStickerTitle =
    selectedLibrarySticker?.title ??
    (selectedNode?.source === 'upload'
      ? 'Upload'
      : selectedNode?.source === 'post'
        ? 'Photo'
        : 'Sticker');

  const nodeIdx = nodes.findIndex((n) => n.id === selectedId);
  const isTop = nodeIdx === nodes.length - 1;
  const isBottom = nodeIdx === 0;

  const handleBgFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgUploading(true);
    try {
      const upload = onUploadBgImage ?? uploadCanvasAsset;
      const url = await upload(file);
      onStartBgImageEdit(url);
    } catch {
      // silent
    } finally {
      setBgUploading(false);
      if (bgFileInputRef.current) bgFileInputRef.current.value = '';
    }
  };

  const tabBtn = (tab: RightTab): CSSProperties => ({
    flex: 1,
    height: 44,
    fontSize: 13,
    fontWeight: activeTab === tab ? 600 : 400,
    color: activeTab === tab ? 'var(--pw-ink)' : 'var(--pw-ink3)',
    borderBottom: `2px solid ${activeTab === tab ? 'var(--pw-accent)' : 'transparent'}`,
    transition: 'color 120ms ease, border-color 120ms ease',
  });

  const stickerCard: CSSProperties = {
    aspectRatio: '1 / 1',
    background: 'var(--pw-surface2)',
    border: '1px solid var(--pw-line)',
    borderRadius: 10,
    padding: 6,
    cursor: 'pointer',
    transition: 'border-color 120ms ease, transform 120ms ease',
  };

  const onCanvasSection = (
    <div style={{ padding: '14px 16px 10px' }}>
      <p style={{ ...eyebrow, marginBottom: 10 }}>On Canvas</p>
      {nodes.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--pw-ink3)' }}>No stickers yet</p>
      ) : (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {nodes.map((node) => {
            const isSelected = node.id === selectedId;
            const libEntry = visibleLibrary.find((s) => s.thumbnail === node.image_url);
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectNode(node.id)}
                title="Select this sticker"
                style={{
                  width: 66,
                  height: 66,
                  flexShrink: 0,
                  borderRadius: 10,
                  overflow: 'hidden',
                  border: isSelected ? '2.5px solid var(--pw-accent)' : '1.5px solid var(--pw-line)',
                  background: libEntry ? cardColor(libEntry.id) : 'var(--pw-surface2)',
                  padding: 5,
                  transition: 'border-color 120ms ease',
                  cursor: 'pointer',
                }}
              >
                <FadeImage src={node.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const selectedSection = (
    <div style={{ padding: '10px 16px 12px', borderTop: '1px solid var(--pw-line)' }}>
      <p style={{ ...eyebrow, marginBottom: 10 }}>Selected</p>
      {selectedNode ? (
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            padding: '10px 12px',
            background: selectedLibrarySticker ? cardColor(selectedLibrarySticker.id) : 'var(--pw-surface2)',
            border: '2px solid var(--pw-accent)',
            borderRadius: 10,
          }}
        >
          <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', background: 'transparent', flexShrink: 0 }}>
            <FadeImage src={selectedNode.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pw-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedStickerTitle}
            </span>
            <span style={{ fontSize: 11, color: 'var(--pw-ink3)' }}>Click canvas to edit</span>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--pw-ink3)', padding: '4px 0' }}>
          Click a sticker on the canvas
        </p>
      )}
    </div>
  );

  const holoVariantSection = selectedNode?.holo ? (
    <div style={{ padding: '10px 16px 12px', borderTop: '1px solid var(--pw-line)' }}>
      <p style={{ ...eyebrow, marginBottom: 10 }}>Foil Style</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {HOLO_VARIANTS.map(({ value, label, hint }) => {
          const isActive = (selectedNode.holoVariant ?? 'regular') === value;
          return (
            <button
              key={value}
              type="button"
              title={hint}
              onClick={() => onChangeHoloVariant(selectedNode.id, value)}
              style={{
                height: 32,
                fontSize: 11,
                fontWeight: isActive ? 600 : 400,
                borderRadius: 7,
                border: `1.5px solid ${isActive ? 'var(--pw-accent)' : 'var(--pw-line)'}`,
                background: isActive ? 'var(--pw-accent-tint)' : 'var(--pw-surface2)',
                color: isActive ? 'var(--pw-accent)' : 'var(--pw-ink)',
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  const bgSection = (
    <div style={{ padding: '10px 16px 16px', borderTop: '1px solid var(--pw-line)' }}>
      <p style={{ ...eyebrow, marginBottom: 10 }}>Canvas Background</p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {BG_COLOR_PRESETS.map((color) => {
          const isActive = background.type === 'color' && background.value === color;
          return (
            <button
              key={color}
              type="button"
              title={color}
              onClick={() => onChangeBackground({ type: 'color', value: color })}
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: color,
                border: isActive ? '2.5px solid var(--pw-accent)' : '1.5px solid var(--pw-line)',
                cursor: 'pointer',
                boxShadow: isActive ? '0 0 0 2px var(--pw-accent-tint)' : 'none',
                transition: 'box-shadow 120ms ease, border-color 120ms ease',
                flexShrink: 0,
              }}
            />
          );
        })}
        <label
          title="Custom color"
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            border: '1.5px solid var(--pw-line)',
            cursor: 'pointer',
            overflow: 'hidden',
            position: 'relative',
            flexShrink: 0,
            background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
          }}
        >
          <input
            type="color"
            defaultValue={background.type === 'color' ? background.value : '#f5f0e8'}
            onChange={(e) => onChangeBackground({ type: 'color', value: e.target.value })}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
          />
        </label>
      </div>

      {background.type === 'image' && background.imageUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          <div style={{
            height: 48, borderRadius: 8, overflow: 'hidden',
            border: '1.5px solid var(--pw-line)', background: '#f0f0ee',
          }}>
            <img
              src={background.imageUrl}
              alt="Background"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => onStartBgImageEdit(background.imageUrl!)}
              style={{ ...actionBtn(), flex: 1, height: 32, fontSize: 12 }}
            >
              Reposition
            </button>
            <button
              type="button"
              onClick={() => onChangeBackground({ type: 'color', value: '#f5f0e8' })}
              style={{ ...actionBtn(true), flex: 1, height: 32, border: 'none', fontSize: 12 }}
            >
              Remove
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => bgFileInputRef.current?.click()}
        disabled={bgUploading}
        style={{ ...actionBtn(), height: 36, fontSize: 12, opacity: bgUploading ? 0.5 : 1 }}
      >
        {bgUploading ? 'Uploading…' : 'Set background image…'}
      </button>
      <input
        ref={bgFileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleBgFileChange}
      />
    </div>
  );

  return (
    <div
      className="paper-workshop pw-neutral"
      style={{
        width: 280,
        flexShrink: 0,
        background: 'var(--pw-paper)',
        borderLeft: '1px solid var(--pw-line)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', borderBottom: '1px solid var(--pw-line)', flexShrink: 0 }}>
        <button type="button" onClick={() => setActiveTab('reposition')} style={tabBtn('reposition')}>
          Reposition
        </button>
        <button type="button" onClick={() => setActiveTab('replace')} style={tabBtn('replace')}>
          Replace
        </button>
      </div>

      {activeTab === 'reposition' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {onCanvasSection}
          {selectedSection}

          {selectedNode ? (
            <>
              {holoVariantSection}
              <div style={{ padding: '10px 16px 20px', borderTop: '1px solid var(--pw-line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  onClick={onMoveUp}
                  disabled={isTop}
                  style={{ ...actionBtn(), opacity: isTop ? 0.4 : 1 }}
                >
                  Move Up
                </button>
                <button
                  type="button"
                  onClick={onMoveDown}
                  disabled={isBottom}
                  style={{ ...actionBtn(), opacity: isBottom ? 0.4 : 1 }}
                >
                  Move Down
                </button>
                <button type="button" onClick={onFlipHorizontal} style={actionBtn()}>
                  Flip Horizontal
                </button>
                <button
                  type="button"
                  onClick={onToggleRemoveBg}
                  disabled={isRemovingBg}
                  style={{ ...actionBtn(), opacity: isRemovingBg ? 0.5 : 1 }}
                >
                  {isRemovingBg
                    ? 'Removing…'
                    : selectedNode?.bgRemoved
                      ? 'Restore background'
                      : 'Remove background'}
                </button>
                <button type="button" onClick={onDelete} style={actionBtn(true)}>
                  Remove sticker
                </button>
              </div>
            </>
          ) : bgSection}
        </div>
      )}

      {activeTab === 'replace' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {onCanvasSection}
          {selectedSection}

          <div style={{ padding: '10px 16px 20px', borderTop: '1px solid var(--pw-line)' }}>
            <p style={{ ...eyebrow, marginBottom: 10 }}>Pick Replacement</p>
            {visibleLibrary.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--pw-ink3)' }}>Loading stickers…</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {visibleLibrary.map((s) => {
                  const isCurrent = selectedNode?.image_url === s.thumbnail;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      title={s.title}
                      onClick={() => { if (selectedNode && s.thumbnail) onReplaceNode(selectedNode.id, s.thumbnail); }}
                      disabled={!selectedNode}
                      style={{
                        ...stickerCard,
                        background: cardColor(s.id),
                        border: isCurrent ? '2.5px solid var(--pw-accent)' : '1px solid transparent',
                        opacity: selectedNode ? 1 : 0.45,
                        cursor: selectedNode ? 'pointer' : 'default',
                      }}
                    >
                      <FadeImage src={s.thumbnail!} alt={s.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
