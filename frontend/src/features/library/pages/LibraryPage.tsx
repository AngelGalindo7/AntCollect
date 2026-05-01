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
  const [searchQuery, setSearchQuery] = useState('');

  const { data: stickers = [], isLoading } = useQuery<LibrarySticker[]>({
    queryKey: ['library'],
    queryFn: () => fetchWithAuth(`${API_BASE}/library/`).then(res => res.json()),
  });

  const filteredStickers = stickers.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pl-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 shrink-0">Sticker Library</h1>
        <div className="flex items-center gap-3 ml-auto">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search stickers..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-56"
            />
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium flex items-center gap-2 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Sticker
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-square bg-gray-200 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredStickers.map((sticker) => (
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
