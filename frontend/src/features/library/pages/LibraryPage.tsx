import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth, API_BASE } from '@/shared/api/api';
import StickerModal from '../components/StickerModal';
import AddStickerModal from '../components/AddStickerModal';

interface LibrarySticker {
  id: number;
  title: string;
  petr_dropper: string | null;
  drop_date: string | null;
  thumbnail: string | null;
}

const LibraryPage: React.FC = () => {
  const [selectedStickerId, setSelectedStickerId] = useState<number | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const { data: stickers = [], isLoading } = useQuery<LibrarySticker[]>({
    queryKey: ['library'],
    queryFn: () => fetchWithAuth(`${API_BASE}/library/`).then(res => res.json()),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Sticker Library</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Sticker
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-square bg-gray-200 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {stickers.map((sticker) => (
            <div
              key={sticker.id}
              onClick={() => setSelectedStickerId(sticker.id)}
              className="group relative aspect-square bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
            >
              {sticker.thumbnail ? (
                <img
                  src={sticker.thumbnail}
                  alt={sticker.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-400">
                  No Image
                </div>
              )}
              
              <div className="absolute inset-x-0 bottom-0 bg-black/60 translate-y-full group-hover:translate-y-0 transition-transform p-2">
                <p className="text-white text-xs font-medium truncate">{sticker.title}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedStickerId && (
        <StickerModal
          stickerId={selectedStickerId}
          onClose={() => setSelectedStickerId(null)}
        />
      )}

      {isAddModalOpen && (
        <AddStickerModal
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => {
            setIsAddModalOpen(false);
            // Query will refetch automatically if we invalidate it elsewhere, 
            // but for now simple state is fine
          }}
        />
      )}
    </div>
  );
};

export default LibraryPage;
