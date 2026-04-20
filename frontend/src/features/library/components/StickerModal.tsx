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

  if (isLoading) return null; // or a spinner

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl bg-white rounded-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Image Section */}
        <div className="md:w-3/5 bg-gray-100 flex items-center justify-center overflow-hidden">
          {sticker?.images && sticker.images.length > 0 ? (
             // Simple carousel or first image
            <img
              src={sticker.images[0].paths.medium}
              alt={sticker.title}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="p-12 text-gray-400">No images available</div>
          )}
        </div>

        {/* Info Section */}
        <div className="md:w-2/5 p-6 overflow-y-auto">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{sticker?.title}</h2>
              <p className="text-sm text-gray-500 mt-1">Added by {sticker?.added_by}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Petr Dropper</p>
                <p className="text-sm font-medium text-gray-700">{sticker?.petr_dropper || 'Unknown'}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Drop Date</p>
                <p className="text-sm font-medium text-gray-700">{sticker?.drop_date || 'N/A'}</p>
              </div>
            </div>

            {sticker?.description && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Description</p>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {sticker.description}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StickerModal;
