import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth, API_BASE } from '@/shared/api/api';

interface StickerDetails {
  id: number;
  title: string;
  petr_dropper: string | null;
  drop_date: string | null;
  description: string | null;
  images: any[];
  created_at: string;
  added_by: string;
}

interface Props {
  stickerId: number;
  onClose: () => void;
}

const StickerModal: React.FC<Props> = ({ stickerId, onClose }) => {
  const { data: sticker, isLoading } = useQuery<StickerDetails>({
    queryKey: ['sticker', stickerId],
    queryFn: () => fetchWithAuth(`${API_BASE}/library/${stickerId}`).then(res => res.json()),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]" style={{ background: 'var(--color-uci-cream)' }}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Image panel */}
        <div className="md:w-3/5 bg-warm-cream flex items-center justify-center overflow-hidden min-h-64 md:min-h-0">
          {isLoading ? (
            <div className="w-full h-full min-h-64 bg-warm-gray/30 animate-pulse" />
          ) : sticker?.images && sticker.images.length > 0 ? (
            <img
              src={sticker.images[0].paths.original}
              alt={sticker.title}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 p-12 text-warm-gray">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">No image</p>
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className="md:w-2/5 p-6 overflow-y-auto flex flex-col gap-5">
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-7 bg-warm-gray/40 rounded-lg w-3/4" />
              <div className="h-4 bg-warm-gray/30 rounded w-1/2" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-14 bg-warm-gray/30 rounded-xl" />
                <div className="h-14 bg-warm-gray/30 rounded-xl" />
              </div>
              <div className="h-20 bg-warm-gray/30 rounded-xl" />
            </div>
          ) : sticker ? (
            <>
              <div>
                <h2 className="text-2xl font-bold text-espresso leading-tight">{sticker.title}</h2>
                <p className="text-xs text-espresso/40 mt-1 uppercase tracking-widest font-medium">
                  Added by {sticker.added_by}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-warm-cream/60 p-3 rounded-xl border border-warm-gray/30">
                  <p className="text-[10px] font-bold text-espresso/40 uppercase tracking-widest mb-1">Petr Dropper</p>
                  <p className="text-sm font-semibold text-espresso">{sticker.petr_dropper || '—'}</p>
                </div>
                <div className="bg-warm-cream/60 p-3 rounded-xl border border-warm-gray/30">
                  <p className="text-[10px] font-bold text-espresso/40 uppercase tracking-widest mb-1">Drop Date</p>
                  <p className="text-sm font-semibold text-espresso">{sticker.drop_date || '—'}</p>
                </div>
              </div>

              {sticker.description && (
                <div>
                  <p className="text-[10px] font-bold text-espresso/40 uppercase tracking-widest mb-2">Description</p>
                  <p className="text-sm text-espresso/70 leading-relaxed whitespace-pre-wrap">
                    {sticker.description}
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default StickerModal;
