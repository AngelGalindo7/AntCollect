import { useEffect, useRef, useState } from 'react';
import { Package, Check, Trash2, Upload, Scissors, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { CropModal } from '@/features/canvas/components/CropModal';
import { uploadSticker } from '@/features/stickers/api/stickerApi';
import type { UserStickerOut } from './types';

const CARD_COLORS = [
  '#e8e0fa', '#fef5cc', '#cff5ec',
  '#fce4ef', '#dceeff', '#f3e0fa',
  '#fdebd0', '#d5f5e3',
];

function cardColor(id: number) {
  return CARD_COLORS[id % CARD_COLORS.length];
}

interface StickerPickerProps {
  stickers: UserStickerOut[];
  selectedId: number | null;
  isFiled?: boolean;
  onSelect: (sticker: UserStickerOut | null) => void;
  onPlaceInNextSlot: () => void;
  onUnfile?: () => void;
  onRemoveBg: (stickerId: number) => Promise<void>;
  onToggleBg: (stickerId: number, enabled: boolean) => Promise<void>;
  isLoading?: boolean;
}

type Tab = 'unfiled' | 'all';

export default function StickerPicker({
  stickers,
  selectedId,
  isFiled,
  onSelect,
  onPlaceInNextSlot,
  onUnfile,
  onRemoveBg,
  onToggleBg,
  isLoading,
}: StickerPickerProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const croppedFileRef = useRef<File | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>('unfiled');
  const [bgRemoving, setBgRemoving] = useState(false);
  const [bgToggling, setBgToggling] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);
  const [rawUrl, setRawUrl] = useState<string | null>(null);
  const [showCrop, setShowCrop] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleCropUpload = async (file: File): Promise<string> => {
    croppedFileRef.current = file;
    return URL.createObjectURL(file);
  };

  const handleCropConfirm = async (_url: string) => {
    const file = croppedFileRef.current;
    if (!file) return;
    setShowCrop(false);
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file, 'sticker.png');
      await uploadSticker(formData);
      queryClient.invalidateQueries({ queryKey: ['my-stickers'] });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      croppedFileRef.current = null;
      setRawUrl(null);
    }
  };

  const handleCropCancel = () => {
    setShowCrop(false);
    croppedFileRef.current = null;
    setRawUrl(null);
  };

  useEffect(() => { setBgError(null); }, [selectedId]);

  // When a filed sticker is picked up from the binder, switch to All so it shows highlighted.
  useEffect(() => {
    if (isFiled) setActiveTab('all');
  }, [isFiled]);

  const filtered = activeTab === 'unfiled'
    ? stickers.filter(s => s.binder_page_id === null)
    : stickers;

  const selectedSticker = selectedId !== null ? stickers.find(s => s.id === selectedId) ?? null : null;
  const selectedImgUrl = selectedSticker
    ? (selectedSticker.bg_removed && selectedSticker.bg_removed_file_url
        ? selectedSticker.bg_removed_file_url
        : selectedSticker.images[0]?.file_url ?? null)
    : null;

  return (
    <>
    <div
      className="paper-workshop pw-neutral w-72 h-full shrink-0 flex flex-col overflow-hidden"
      style={{ background: 'var(--pw-paper)', borderRight: '1px solid var(--pw-line)' }}
    >
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--pw-line)' }}>
        <p
          className="pw-display"
          style={{ fontSize: 20, lineHeight: 1.1, margin: '0 0 10px', color: 'var(--pw-ink)' }}
        >
          Add to binder
        </p>

        {/* Segment control */}
        <div style={{
          display: 'flex',
          background: 'var(--pw-surface2)',
          border: '1px solid var(--pw-line)',
          borderRadius: 9,
          padding: 2,
          gap: 2,
        }}>
          {(['unfiled', 'all'] as Tab[]).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                height: 28,
                borderRadius: 7,
                fontSize: 12,
                fontWeight: activeTab === tab ? 600 : 500,
                color: activeTab === tab ? '#fff' : 'var(--pw-ink3)',
                background: activeTab === tab ? 'var(--pw-accent)' : 'transparent',
                boxShadow: activeTab === tab
                  ? '0 1px 0 rgba(0,0,0,.04), 0 1px 3px rgba(0,0,0,.08)'
                  : 'none',
                transition: 'background 120ms ease, color 120ms ease',
              }}
            >
              {tab === 'unfiled' ? 'Unfiled' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 pt-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-[10px]"
                style={{ background: 'var(--pw-surface2)', border: '1px solid var(--pw-line)' }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-32 text-xs text-center gap-2"
            style={{ color: 'var(--pw-ink3)' }}
          >
            {activeTab === 'unfiled' ? (
              <>
                <Check className="w-8 h-8 opacity-40" />
                All stickers are filed
              </>
            ) : (
              <>
                <Package className="w-8 h-8 opacity-40" />
                No stickers yet
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-3">
            {filtered.map(s => {
              const imgUrl = s.bg_removed && s.bg_removed_file_url
                ? s.bg_removed_file_url
                : s.images[0]?.file_url ?? null;
              const isSelected = s.id === selectedId;
              const isInBinder = s.binder_page_id !== null;
              return (
                <button
                  key={s.id}
                  type="button"
                  title={s.sticker_name ?? s.note ?? undefined}
                  onClick={() => onSelect(isSelected ? null : s)}
                  style={{
                    position: 'relative',
                    aspectRatio: '1 / 1',
                    background: cardColor(s.id),
                    border: `2px solid ${isSelected ? 'var(--pw-accent)' : 'var(--pw-line)'}`,
                    borderRadius: 10,
                    padding: 6,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    transition: 'transform 120ms ease, border-color 120ms ease',
                    boxShadow: isSelected ? '0 0 0 2px rgba(0,100,164,0.2)' : 'none',
                  }}
                >
                  {/* Badge: blue checkmark when the sticker is already filed in the binder */}
                  {isInBinder && (
                    <div style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      background: 'var(--pw-accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1,
                    }}>
                      <Check size={9} strokeWidth={2.5} color="#fff" />
                    </div>
                  )}
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-6 h-6" style={{ color: 'var(--pw-ink3)' }} />
                    </div>
                  )}
                  {s.sticker_name && (
                    <span style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      padding: '2px 4px',
                      fontSize: 8,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--pw-ink3)',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      pointerEvents: 'none',
                    }}>
                      {s.sticker_name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer — adapts to selection state */}
      <div style={{
        background: 'var(--pw-surface2)',
        borderTop: '1px solid var(--pw-line)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{
          fontSize: 11,
          color: selectedId !== null ? 'var(--pw-accent)' : 'var(--pw-ink3)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          {selectedId !== null ? (
            <>
              {selectedImgUrl && (
                <div style={{
                  width: 22, height: 22, flexShrink: 0,
                  borderRadius: 4, overflow: 'hidden',
                  border: '1px solid var(--pw-line)',
                  background: selectedSticker ? cardColor(selectedSticker.id) : 'var(--pw-surface2)',
                }}>
                  <img src={selectedImgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} />
                </div>
              )}
              <span style={{ fontWeight: 500 }}>
                {isFiled ? '→ Tap a slot to move it' : '→ Tap a slot to place it'}
              </span>
            </>
          ) : (
            <span>Tap a sticker to select it</span>
          )}
        </div>

        {selectedId !== null && (
          <>
            <button
              type="button"
              onClick={onPlaceInNextSlot}
              style={{
                width: '100%',
                padding: '8px 14px',
                background: 'var(--pw-accent)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                transition: 'opacity 120ms ease',
              }}
            >
              {isFiled ? 'Move to next open slot' : 'Place in next open slot'}
            </button>

            {isFiled && onUnfile && (
              <button
                type="button"
                onClick={onUnfile}
                style={{
                  width: '100%',
                  padding: '8px 14px',
                  background: 'transparent',
                  border: '1px solid rgba(180,49,15,0.25)',
                  color: 'var(--pw-danger)',
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  transition: 'opacity 120ms ease',
                }}
              >
                <Trash2 size={13} strokeWidth={1.8} />
                Remove from binder
              </button>
            )}

            {/* Background removal */}
            {selectedSticker && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {!selectedSticker.bg_removed_file_url ? (
                  <button
                    type="button"
                    disabled={bgRemoving}
                    onClick={async () => {
                      setBgRemoving(true);
                      setBgError(null);
                      try { await onRemoveBg(selectedSticker.id); }
                      catch { setBgError('Removal failed — try again.'); }
                      finally { setBgRemoving(false); }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      background: 'transparent',
                      border: '1px solid rgba(124,58,237,0.35)',
                      color: '#7c3aed',
                      fontSize: 13,
                      fontWeight: 500,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      cursor: bgRemoving ? 'not-allowed' : 'pointer',
                      opacity: bgRemoving ? 0.6 : 1,
                      transition: 'opacity 120ms ease',
                    }}
                  >
                    {bgRemoving
                      ? <Loader2 size={13} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
                      : <Scissors size={13} strokeWidth={1.8} />
                    }
                    {bgRemoving ? 'Removing…' : 'Remove background'}
                  </button>
                ) : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 2px',
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--pw-ink)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Scissors size={12} strokeWidth={1.8} style={{ color: '#7c3aed' }} />
                      No background
                    </span>
                    <button
                      type="button"
                      disabled={bgToggling}
                      onClick={async () => {
                        setBgToggling(true);
                        setBgError(null);
                        try { await onToggleBg(selectedSticker.id, !selectedSticker.bg_removed); }
                        catch { setBgError('Could not update.'); }
                        finally { setBgToggling(false); }
                      }}
                      role="switch"
                      aria-checked={selectedSticker.bg_removed}
                      style={{
                        position: 'relative',
                        width: 40,
                        height: 22,
                        borderRadius: 11,
                        background: selectedSticker.bg_removed ? '#7c3aed' : 'var(--pw-surface2)',
                        border: '1px solid var(--pw-line)',
                        cursor: bgToggling ? 'not-allowed' : 'pointer',
                        opacity: bgToggling ? 0.6 : 1,
                        transition: 'background 200ms ease',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{
                        position: 'absolute',
                        top: 2,
                        left: selectedSticker.bg_removed ? 18 : 2,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: '#fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        transition: 'left 200ms ease',
                      }} />
                    </button>
                  </div>
                )}
                {bgError && (
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--pw-danger)', textAlign: 'center' }}>{bgError}</p>
                )}
              </div>
            )}
          </>
        )}

        {/* Upload entry point */}
        <div style={{ borderTop: '1px solid var(--pw-line)', paddingTop: 8 }}>
          <button
            type="button"
            onClick={() => !uploading && fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              width: '100%',
              padding: '7px 14px',
              background: 'transparent',
              border: '1px solid var(--pw-line)',
              color: 'var(--pw-ink)',
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.55 : 1,
              transition: 'opacity 120ms ease',
            }}
          >
            <Upload size={12} strokeWidth={2} />
            {uploading ? 'Uploading…' : 'Upload sticker'}
          </button>
          {uploadError && (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--pw-danger)', textAlign: 'center' }}>
              {uploadError}
            </p>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setRawUrl(URL.createObjectURL(file));
            setUploadError(null);
            setShowCrop(true);
            e.target.value = '';
          }}
        />
      </div>
    </div>

    {showCrop && rawUrl && (
      <CropModal
        imageUrl={rawUrl}
        onUpload={handleCropUpload}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />
    )}
    </>
  );
}
