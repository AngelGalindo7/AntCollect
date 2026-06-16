import { useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImagePlus, Trash2 } from 'lucide-react';
import { fetchWithAuth, API_BASE } from '../../../shared/api/api';
import type { BackgroundConfig, CanvasNode, HoloVariant } from '../types/canvas';
import { HOLO_VARIANTS } from '../types/canvas';

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

type RightTab = 'reposition' | 'replace';

interface RightPanelProps {
  background: BackgroundConfig;
  onChangeBackground: (bg: BackgroundConfig) => void;
  onStartBackgroundEdit: (newImageUrl?: string) => void;
  isEditingBackground: boolean;
  selectedId: string | null;
  nodes: CanvasNode[];
  isRemovingBg: boolean;
  removeBgError: string | null;
  onToggleRemoveBg: () => void;
  onToggleHolo: (id: string) => void;
  onChangeHoloVariant: (id: string, variant: HoloVariant) => void;
  onUploadAsset: (file: File) => Promise<string>;
  frameWidth: number;
  frameHeight: number;
  onSelectNode: (id: string) => void;
  onReplaceNode: (id: string, newUrl: string) => void;
}

const eyebrow: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--pw-ink3)',
  margin: 0,
};

function ToggleRow({
  label,
  hint,
  on,
  disabled,
  onToggle,
}: {
  label: string;
  hint: string;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '8px 10px',
        border: '1px solid var(--pw-line)',
        borderRadius: 8,
        background: on ? 'var(--pw-surface2)' : 'transparent',
        opacity: disabled ? 0.6 : 1,
        textAlign: 'left',
        transition: 'background 120ms ease',
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--pw-ink)' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--pw-ink3)' }}>{hint}</span>
      </span>
      <span
        aria-hidden
        style={{
          position: 'relative',
          width: 28,
          height: 16,
          borderRadius: 999,
          background: on ? 'var(--pw-ink)' : 'var(--pw-line2)',
          transition: 'background 120ms ease',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 14 : 2,
            width: 12,
            height: 12,
            background: '#fff',
            borderRadius: 999,
            boxShadow: '0 1px 2px rgba(0,0,0,.2)',
            transition: 'left 140ms ease',
          }}
        />
      </span>
    </button>
  );
}

export function StickerControls({
  background,
  onChangeBackground,
  onStartBackgroundEdit,
  isEditingBackground,
  selectedId,
  nodes,
  isRemovingBg,
  removeBgError,
  onToggleRemoveBg,
  onToggleHolo,
  onChangeHoloVariant,
  onUploadAsset,
  frameWidth,
  frameHeight,
  onSelectNode,
  onReplaceNode,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<RightTab>('replace');
  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  const hasBgImage = background.type === 'image' && !!background.imageUrl;

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const url = await onUploadAsset(file);
      onStartBackgroundEdit(url);
    } catch {
      setUploadError('Upload failed. Try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--pw-line)',
          flexShrink: 0,
        }}
      >
        <button type="button" onClick={() => setActiveTab('reposition')} style={tabBtn('reposition')}>
          Reposition
        </button>
        <button type="button" onClick={() => setActiveTab('replace')} style={tabBtn('replace')}>
          Replace
        </button>
      </div>

      {/* Reposition tab — background + effects */}
      {activeTab === 'reposition' && (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div>
            <p style={{ ...eyebrow, marginBottom: 10 }}>Background</p>
            {hasBgImage ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => !isEditingBackground && onStartBackgroundEdit()}
                  disabled={isEditingBackground}
                  style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: `${frameWidth} / ${frameHeight}`,
                    background: '#f6f1e6',
                    border: '1px solid var(--pw-line)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    cursor: isEditingBackground ? 'default' : 'pointer',
                    padding: 0,
                    opacity: isEditingBackground ? 0.6 : 1,
                  }}
                  title={isEditingBackground ? 'Editing in canvas' : 'Reposition background image'}
                >
                  <img
                    src={background.imageUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </button>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => onStartBackgroundEdit()}
                    disabled={isEditingBackground}
                    style={{
                      flex: 1,
                      height: 30,
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--pw-ink)',
                      background: 'var(--pw-surface2)',
                      border: '1px solid var(--pw-line)',
                      borderRadius: 7,
                      opacity: isEditingBackground ? 0.5 : 1,
                    }}
                  >
                    {isEditingBackground ? 'Editing…' : 'Reposition'}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || isEditingBackground}
                    style={{
                      flex: 1,
                      height: 30,
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--pw-ink)',
                      background: 'var(--pw-surface2)',
                      border: '1px solid var(--pw-line)',
                      borderRadius: 7,
                      opacity: uploading || isEditingBackground ? 0.5 : 1,
                    }}
                  >
                    {uploading ? 'Uploading…' : 'Replace'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeBackground({ type: 'color', value: '#f6f1e6' })}
                    disabled={isEditingBackground}
                    title="Remove background image"
                    style={{
                      width: 30,
                      height: 30,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--pw-danger)',
                      background: 'transparent',
                      border: '1px solid var(--pw-line)',
                      borderRadius: 7,
                      opacity: isEditingBackground ? 0.5 : 1,
                    }}
                  >
                    <Trash2 size={14} strokeWidth={1.6} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || isEditingBackground}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--pw-surface2)',
                  border: '1px dashed var(--pw-line)',
                  borderRadius: 8,
                  color: 'var(--pw-ink)',
                  fontSize: 12.5,
                  fontWeight: 500,
                  opacity: uploading || isEditingBackground ? 0.6 : 1,
                }}
              >
                <ImagePlus size={14} strokeWidth={1.6} />
                {uploading ? 'Uploading…' : 'Add background image'}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {uploadError && (
              <p style={{ fontSize: 11, color: 'var(--pw-danger)', margin: '6px 0 0' }}>{uploadError}</p>
            )}
          </div>

          {selectedNode && (
            <div
              style={{
                borderTop: '1px solid var(--pw-line)',
                paddingTop: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <p style={eyebrow}>Effects</p>
              <ToggleRow
                label="Holographic"
                hint="Iridescent foil"
                on={!!selectedNode.holo}
                onToggle={() => onToggleHolo(selectedNode.id)}
              />
              {selectedNode.holo && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0 2px' }}>
                  <p style={{ ...eyebrow, marginBottom: 4 }}>Foil style</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {HOLO_VARIANTS.map((v) => {
                      const active = (selectedNode.holoVariant ?? 'regular') === v.value;
                      return (
                        <button
                          key={v.value}
                          type="button"
                          title={v.hint}
                          onClick={() => onChangeHoloVariant(selectedNode.id, v.value)}
                          style={{
                            padding: '6px 4px',
                            fontSize: 11,
                            fontWeight: active ? 600 : 500,
                            color: active ? 'var(--pw-ink)' : 'var(--pw-ink2)',
                            background: active ? 'var(--pw-surface2)' : 'transparent',
                            border: active ? '1.5px solid var(--pw-ink)' : '1px solid var(--pw-line)',
                            borderRadius: 7,
                            textTransform: 'capitalize',
                          }}
                        >
                          {v.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <ToggleRow
                label="Background removed"
                hint="Die-cut edge"
                on={!!selectedNode.bgRemoved}
                disabled={isRemovingBg}
                onToggle={onToggleRemoveBg}
              />
              {removeBgError && (
                <p style={{ fontSize: 11, color: 'var(--pw-danger)', margin: 0 }}>{removeBgError}</p>
              )}
            </div>
          )}

          {!selectedNode && (
            <p style={{ fontSize: 12, color: 'var(--pw-ink3)' }}>
              Click a sticker on the canvas to edit it.
            </p>
          )}
        </div>
      )}

      {/* Replace tab */}
      {activeTab === 'replace' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* ON CANVAS */}
          <div style={{ padding: '14px 16px 10px' }}>
            <p style={{ ...eyebrow, marginBottom: 10 }}>On Canvas</p>
            {nodes.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--pw-ink3)' }}>No stickers yet</p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  overflowX: 'auto',
                  paddingBottom: 4,
                }}
              >
                {nodes.map((node) => {
                  const isSelected = node.id === selectedId;
                  const nodeLibEntry = visibleLibrary.find((s) => s.thumbnail === node.image_url);
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
                        border: isSelected
                          ? '2.5px solid var(--pw-accent)'
                          : '1.5px solid var(--pw-line)',
                        background: nodeLibEntry ? cardColor(nodeLibEntry.id) : 'var(--pw-surface2)',
                        padding: 5,
                        transition: 'border-color 120ms ease',
                        cursor: 'pointer',
                      }}
                    >
                      <img
                        src={node.image_url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* SELECTED */}
          <div
            style={{
              padding: '10px 16px 12px',
              borderTop: '1px solid var(--pw-line)',
            }}
          >
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
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: 'transparent',
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={selectedNode.image_url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--pw-ink)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
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

          {/* PICK REPLACEMENT */}
          <div
            style={{
              padding: '10px 16px 20px',
              borderTop: '1px solid var(--pw-line)',
            }}
          >
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
                      onClick={() => {
                        if (selectedNode && s.thumbnail) {
                          onReplaceNode(selectedNode.id, s.thumbnail);
                        }
                      }}
                      disabled={!selectedNode}
                      style={{
                        ...stickerCard,
                        background: cardColor(s.id),
                        border: isCurrent
                          ? '2.5px solid var(--pw-accent)'
                          : '1px solid transparent',
                        opacity: selectedNode ? 1 : 0.45,
                        cursor: selectedNode ? 'pointer' : 'default',
                      }}
                    >
                      <img
                        src={s.thumbnail!}
                        alt={s.title}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
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
