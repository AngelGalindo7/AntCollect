import { useState } from 'react';
import { Package, Check } from 'lucide-react';
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
  onSelect: (sticker: UserStickerOut | null) => void;
  onPlaceInNextSlot: () => void;
  isLoading?: boolean;
}

type Tab = 'unfiled' | 'all';

export default function StickerPicker({ stickers, selectedId, onSelect, onPlaceInNextSlot, isLoading }: StickerPickerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('unfiled');

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

        {/* Pill segment control */}
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
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelect(isSelected ? null : s)}
                  style={{
                    position: 'relative',
                    aspectRatio: '1 / 1',
                    background: cardColor(s.id),
                    border: `2px solid ${isSelected ? 'var(--pw-accent)' : 'var(--pw-line)'}`,
                    borderRadius: 10,
                    padding: 6,
                    cursor: 'pointer',
                    transition: 'transform 120ms ease, border-color 120ms ease',
                    boxShadow: isSelected ? '0 0 0 2px rgba(0,100,164,0.2)' : 'none',
                  }}
                >
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
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer — instruction state + action */}
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
              <span style={{ fontWeight: 500 }}>→ Tap a binder slot to place it</span>
            </>
          ) : (
            <span>Tap a sticker to select it</span>
          )}
        </div>

        {selectedId !== null && (
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
            Place in next open slot
          </button>
        )}
      </div>
    </div>
  );
}
