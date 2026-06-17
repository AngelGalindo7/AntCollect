import { useState } from 'react';
import { Package, Check } from 'lucide-react';
import type { UserStickerOut } from './types';

interface StickerPickerProps {
  stickers: UserStickerOut[];
  selectedId: number | null;
  onSelect: (sticker: UserStickerOut | null) => void;
  onPlaceInNextSlot: () => void;
}

type Tab = 'unfiled' | 'all';

export default function StickerPicker({ stickers, selectedId, onSelect, onPlaceInNextSlot }: StickerPickerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('unfiled');

  const filtered = activeTab === 'unfiled'
    ? stickers.filter(s => s.binder_page_id === null)
    : stickers;

  return (
    <div className="w-72 shrink-0 flex flex-col bg-[#2c2c2e] border-r border-white/10 overflow-hidden">
      <div className="px-4 pt-4 shrink-0">
        <p className="text-white text-sm font-semibold mb-3">Your Stickers</p>

        {/* Tab bar */}
        <div className="flex border-b border-white/10">
          {(['unfiled', 'all'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-amber-400 text-white'
                  : 'border-transparent text-[#8e8e93] hover:text-white'
              }`}
            >
              {tab === 'unfiled' ? 'Unfiled' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Section header */}
      <div className="px-4 pt-2 pb-1 shrink-0">
        <p className="text-[#8e8e93] text-xs">{filtered.length} stickers</p>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[#8e8e93] text-xs text-center gap-2">
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
          <div className="grid grid-cols-2 gap-2">
            {filtered.map(s => {
              const imgUrl = s.bg_removed && s.bg_removed_file_url
                ? s.bg_removed_file_url
                : s.images[0]?.file_url ?? null;
              const isSelected = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  onClick={() => onSelect(isSelected ? null : s)}
                  className={`
                    aspect-square rounded-lg overflow-hidden border-2 transition-all bg-white/5
                    ${isSelected
                      ? 'border-amber-400 shadow-[0_0_0_2px_rgba(251,191,36,0.3)]'
                      : 'border-transparent hover:border-white/30'
                    }
                  `}
                >
                  {imgUrl ? (
                    <img src={imgUrl} alt="" className="w-full h-full object-contain p-1" draggable={false} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-white/20" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedId !== null && (
        <div className="shrink-0 p-3 border-t border-white/10">
          <button
            onClick={onPlaceInNextSlot}
            className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold transition-colors"
          >
            Place in next open slot
          </button>
        </div>
      )}
    </div>
  );
}
