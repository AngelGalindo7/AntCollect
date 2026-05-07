import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth, API_BASE } from '@/shared/api/api';
import PageHeader from '@/shared/components/PageHeader';
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
    <div className="px-10 py-7">
      {/* Header row: eyebrow + display headline on left, search + action on right */}
      <div className="flex items-end justify-between mb-6">
        <PageHeader
          eyebrow="◆ ZOT! ZOT! ZOT!"
          title="Petr Stickers."
        />

        <div className="flex items-center gap-3 pb-1">
          {/* Search pill */}
          <div className="relative flex items-center">
            <svg
              className="absolute left-3 w-3.5 h-3.5 pointer-events-none"
              style={{ color: 'rgba(0,100,164,0.55)' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" strokeWidth={2} strokeLinecap="round" />
              <path d="M21 21l-4.3-4.3" strokeWidth={2} strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search stickers…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-52 pl-9 pr-4 py-2.5 rounded-full text-sm text-uci-navy placeholder-uci-blue/40 outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(0,100,164,0.18)',
                backdropFilter: 'blur(6px)',
              }}
            />
          </div>

          {/* Gold "New sticker" button */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-bold text-uci-navy shrink-0 transition-colors hover:brightness-105"
            style={{
              background: 'var(--color-uci-gold)',
              boxShadow: 'var(--shadow-button-gold)',
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v14M5 12h14" />
            </svg>
            New sticker
          </button>
        </div>
      </div>

      {/* Sticker grid */}
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
          <p className="text-uci-navy font-bold tracking-wide">
            {search ? `No stickers found for "${search}"` : 'No stickers in the library yet'}
          </p>
          <p className="text-uci-navy/50 text-sm mt-1">
            {search ? 'Try a different search term' : 'Be the first to add one!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-10">
          {stickers.map((sticker) => (
            <div
              key={sticker.id}
              onClick={() => setSelectedStickerId(sticker.id)}
              className="group relative aspect-square bg-white rounded-sticker overflow-hidden cursor-pointer border-2 border-transparent hover:border-uci-gold hover:-translate-y-[3px] transition-all duration-200"
              style={{ boxShadow: 'var(--shadow-card)' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-card)')}
            >
              {sticker.thumbnail ? (
                <img
                  src={sticker.thumbnail}
                  alt={sticker.title}
                  className="w-full h-full object-contain p-[10%]"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-warm-cream text-warm-gray">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}

              {/* Hover overlay: title + #ID, fades in */}
              <div className="absolute inset-x-0 bottom-0 px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="flex items-end justify-between gap-1">
                  <p
                    className="text-uci-blue text-[11px] font-semibold truncate leading-tight"
                    style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
                  >
                    {sticker.title}
                  </p>
                  <p className="text-uci-navy/55 text-[10px] font-bold shrink-0">
                    #{String(sticker.id).padStart(3, '0')}
                  </p>
                </div>
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
