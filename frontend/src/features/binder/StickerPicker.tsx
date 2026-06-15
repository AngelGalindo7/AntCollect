import { Package } from 'lucide-react';
import type { UserStickerOut } from './types';

interface StickerPickerProps {
  stickers: UserStickerOut[];
  selectedId: number | null;
  onSelect: (sticker: UserStickerOut | null) => void;
  onPlaceInNextSlot: () => void;
}

export default function StickerPicker({ stickers, selectedId, onSelect, onPlaceInNextSlot }: StickerPickerProps) {
  return (
    <div className="w-72 shrink-0 flex flex-col bg-[#2c2c2e] border-r border-white/10 overflow-hidden">
      <div className="px-4 pt-4 pb-3 shrink-0">
        <p className="text-white text-sm font-semibold">Your Stickers</p>
        <p className="text-[#8e8e93] text-xs mt-0.5">
          {selectedId ? 'Click a binder slot to place' : 'Select a sticker to place'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {stickers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[#8e8e93] text-xs text-center gap-2">
            <Package className="w-8 h-8 opacity-40" />
            No stickers yet
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {stickers.map(s => {
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
