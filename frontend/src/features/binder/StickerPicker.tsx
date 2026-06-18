import { useEffect, useState } from 'react';
import { Package, Check, Trash2 } from 'lucide-react';
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
  isLoading,
}: StickerPickerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('unfiled');

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
          </>
        )}
      </div>
    </div>
  );
}
