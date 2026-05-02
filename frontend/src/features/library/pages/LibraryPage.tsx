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
  const [search, setSearch] = useState('');
  const [selectedStickerId, setSelectedStickerId] = useState<number | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const { data: stickers = [], isLoading } = useQuery<LibrarySticker[]>({
    queryKey: ['library', search],
    queryFn: () => fetchWithAuth(`${API_BASE}/library/?search=${search}`).then(res => res.json()),
  });

  return (
    <div className="space-y-6 px-4 py-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-espresso">Sticker Library</h1>
          <p className="text-sm text-espresso/50 mt-0.5">Petr Sticker Catalog</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              placeholder="Search stickers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-soft-white border border-warm-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-uci-gold focus:border-transparent text-sm text-espresso placeholder-warm-gray transition-all"
            />
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-campus-blue text-white rounded-lg hover:bg-campus-blue/90 transition-colors text-sm font-semibold flex items-center gap-2 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Sticker
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-square bg-warm-cream animate-pulse rounded-sticker" />
          ))}
        </div>
      ) : stickers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-warm-gray/40 rounded-sticker">
          <div className="w-16 h-16 rounded-full bg-warm-cream flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-espresso font-bold tracking-wide">
            {search ? `No stickers found for "${search}"` : 'No stickers in the library yet'}
          </p>
          <p className="text-espresso/50 text-sm mt-1">
            {search ? 'Try a different search term' : 'Be the first to add one!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {stickers.map((sticker) => (
            <div
              key={sticker.id}
              onClick={() => setSelectedStickerId(sticker.id)}
              className="group relative aspect-square bg-soft-white rounded-sticker border border-warm-gray overflow-hidden cursor-pointer shadow-card hover:shadow-lg hover:scale-[1.03] transition-all duration-200"
            >
              {sticker.thumbnail ? (
                <img
                  src={sticker.thumbnail}
                  alt={sticker.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-warm-cream text-warm-gray">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}

              <div className="absolute inset-x-0 bottom-0 bg-espresso/80 translate-y-full group-hover:translate-y-0 transition-transform duration-200 p-2">
                <p className="text-soft-white text-xs font-semibold truncate">{sticker.title}</p>
                {sticker.petr_dropper && (
                  <p className="text-soft-white/60 text-[10px] truncate">{sticker.petr_dropper}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedStickerId !== null && (
        <StickerModal
          stickerId={selectedStickerId}
          onClose={() => setSelectedStickerId(null)}
        />
      )}

      {isAddModalOpen && (
        <AddStickerModal
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => setIsAddModalOpen(false)}
        />
      )}
    </div>
  );
};

export default LibraryPage;
