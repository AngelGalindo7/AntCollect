import { useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import type { BackgroundConfig, CanvasNode, HoloVariant } from '../types/canvas';
import { HOLO_VARIANTS } from '../types/canvas';

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
}

const eyebrow: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
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
}: RightPanelProps) {
  const selectedNode = nodes.find((n) => n.id === selectedId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  const handleEditPosition = () => {
    if (!background.imageUrl) return;
    onStartBackgroundEdit();
  };

  const handleRemoveBackgroundImage = () => {
    onChangeBackground({ type: 'color', value: '#f6f1e6' });
  };

  return (
    <div
      className="paper-workshop"
      style={{
        width: 280,
        flexShrink: 0,
        background: 'var(--pw-paper)',
        borderLeft: '1px solid var(--pw-line)',
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
        gap: 14,
        overflowY: 'auto',
      }}
    >
      <div>
        <p style={{ ...eyebrow, marginBottom: 10 }}>Background</p>
        {hasBgImage ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              onClick={handleEditPosition}
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
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(28,26,22,0)',
                  transition: 'background 120ms ease',
                }}
              />
            </button>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={handleEditPosition}
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
                onClick={handleRemoveBackgroundImage}
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
              transition: 'background 120ms ease',
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

      <div style={{ borderTop: '1px solid var(--pw-line)', paddingTop: 10 }}>
        <p style={{ ...eyebrow, marginBottom: 8 }}>Selected · {selectedNode ? 1 : 0}</p>
        {selectedNode ? (
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              padding: 10,
              background: 'var(--pw-surface2)',
              border: '1px solid var(--pw-line)',
              borderRadius: 10,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                background: 'var(--pw-paper)',
                border: '1px solid var(--pw-line)',
                borderRadius: 6,
                overflow: 'hidden',
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
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: 'var(--pw-ink)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedNode.source === 'library' ? 'Library sticker' : selectedNode.source === 'post' ? 'Post image' : 'Upload'}
              </span>
              <span className="pw-mono" style={{ fontSize: 11, color: 'var(--pw-ink3)' }}>
                {Math.round(selectedNode.x)}, {Math.round(selectedNode.y)} · {Math.round(selectedNode.width)}×{Math.round(selectedNode.height)}
              </span>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--pw-ink3)' }}>Click a sticker on the canvas to edit it.</p>
        )}
      </div>

      {selectedNode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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

    </div>
  );
}
