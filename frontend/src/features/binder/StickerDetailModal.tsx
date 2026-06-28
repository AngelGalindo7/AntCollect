import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { UserStickerOut } from './types';

interface StickerDetailModalProps {
  stickers: UserStickerOut[];
  activeIndex: number;
  onActiveIndexChange: (i: number) => void;
  onClose: () => void;
}

export default function StickerDetailModal({
  stickers,
  activeIndex,
  onActiveIndexChange,
  onClose,
}: StickerDetailModalProps) {
  const sticker = stickers[activeIndex];
  const canNav = stickers.length > 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowLeft') onActiveIndexChange(Math.max(0, activeIndex - 1));
      if (e.key === 'ArrowRight') onActiveIndexChange(Math.min(stickers.length - 1, activeIndex + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, activeIndex, stickers.length, onActiveIndexChange]);

  const imgUrl = sticker
    ? (sticker.bg_removed && sticker.bg_removed_file_url
        ? sticker.bg_removed_file_url
        : sticker.images[0]?.file_url ?? null)
    : null;

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot || !sticker) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4 py-8"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Card */}
      <div
        className="relative z-10 inline-flex flex-col min-w-[280px] max-w-[92vw] rounded-2xl overflow-hidden bg-[#15161a] ring-1 ring-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(sticker.sticker_name || sticker.note) && (
          <div className="px-4 pt-4 pb-3 shrink-0">
            {sticker.sticker_name && (
              <p className="text-sm font-semibold text-white/90">{sticker.sticker_name}</p>
            )}
            {sticker.note && (
              <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{sticker.note}</p>
            )}
          </div>
        )}

        {/* Image stage */}
        <div className="relative bg-black/30 flex items-center justify-center">
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={sticker.sticker_name ?? ''}
              className="max-w-[80vw] max-h-[62vh] w-auto h-auto object-contain select-none"
              draggable={false}
            />
          ) : (
            <div className="w-[min(80vw,420px)] h-[40vh] flex items-center justify-center text-white/30 text-sm">
              No image
            </div>
          )}

          {/* Counter */}
          {canNav && (
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 text-white/75 text-xs font-medium tabular-nums pointer-events-none">
              {activeIndex + 1} / {stickers.length}
            </div>
          )}

          {/* Left arrow */}
          {canNav && activeIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onActiveIndexChange(activeIndex - 1); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center transition-colors shadow-lg"
              aria-label="Previous sticker"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Right arrow */}
          {canNav && activeIndex < stickers.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onActiveIndexChange(activeIndex + 1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center transition-colors shadow-lg"
              aria-label="Next sticker"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Filmstrip */}
        {canNav && (
          <div className="border-t border-white/10 bg-white/[0.02] px-4 py-3 shrink-0">
            <div className="flex gap-2.5 overflow-x-auto p-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
              {stickers.map((s, i) => {
                const thumb = s.bg_removed && s.bg_removed_file_url
                  ? s.bg_removed_file_url
                  : s.images[0]?.file_url ?? null;
                const isActive = i === activeIndex;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onActiveIndexChange(i)}
                    className={`relative shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all duration-150
                      ${isActive
                        ? 'ring-2 ring-white opacity-100'
                        : 'ring-1 ring-white/10 opacity-55 hover:opacity-90'}`}
                    aria-label={`View sticker ${i + 1}`}
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="w-full h-full object-contain bg-black/20"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full bg-white/5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>,
    modalRoot,
  );
}
