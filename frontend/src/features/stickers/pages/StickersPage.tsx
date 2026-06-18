import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSession } from '@/shared/auth/session';
import type { UserStickerOut } from '@/features/binder/types';
import {
  listMyStickers,
  listUserStickers,
  deleteSticker,
  removeStickerBackground,
  updateSticker,
} from '../api/stickerApi';
import AddStickerModal from '../components/AddStickerModal';

const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const ScissorsIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

const StickersPage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = getSession();
  const isOwner = session?.username === username;

  const [showAddModal, setShowAddModal] = useState(false);
  const [bgBusyId, setBgBusyId] = useState<number | null>(null);

  const { data: stickers = [], isLoading: loading } = useQuery({
    queryKey: isOwner ? ['my-stickers'] : ['user-stickers', username],
    queryFn: isOwner ? listMyStickers : () => listUserStickers(username!),
  });

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this sticker from your collection?')) return;
    await deleteSticker(id);
    queryClient.invalidateQueries({ queryKey: ['my-stickers'] });
  };

  const handleToggleBg = async (sticker: UserStickerOut) => {
    setBgBusyId(sticker.id);
    try {
      const updated = sticker.bg_removed_file_url
        ? await updateSticker(sticker.id, { bg_removed: !sticker.bg_removed })
        : await removeStickerBackground(sticker.id);
      queryClient.setQueryData<UserStickerOut[]>(['my-stickers'], (prev = []) =>
        prev.map((s) => (s.id === updated.id ? updated : s)),
      );
    } finally {
      setBgBusyId(null);
    }
  };

  const primaryImage = (s: UserStickerOut) =>
    s.bg_removed && s.bg_removed_file_url
      ? s.bg_removed_file_url
      : s.images.find((i) => i.order_index === 1)?.file_url ?? s.images[0]?.file_url ?? null;

  return (
    <div className="px-10 py-7 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <button
            onClick={() => navigate(`/${username}`)}
            className="flex items-center gap-1.5 text-sm text-uci-blue/70 hover:text-uci-blue mb-2 transition-colors"
          >
            <BackIcon />
            {username}
          </button>
          <h1 className="text-2xl font-bold text-espresso">
            {isOwner ? 'My Stickers' : `${username}'s Stickers`}
            <span className="ml-2 text-base font-normal text-espresso/40">
              ({stickers.length})
            </span>
          </h1>
        </div>

        {isOwner && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-bold text-uci-navy shrink-0 transition-colors hover:brightness-105"
            style={{ background: 'var(--color-uci-gold)', boxShadow: 'var(--shadow-button-gold)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v14M5 12h14" />
            </svg>
            Track sticker
          </button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(8)].map((_, i) => (
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
          <p className="text-uci-navy font-bold tracking-wide">No stickers tracked yet</p>
          {isOwner && (
            <p className="text-uci-navy/50 text-sm mt-1">Hit &quot;Track sticker&quot; to add your first entry.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-10">
          {stickers.map((sticker) => {
            const img = primaryImage(sticker);
            return (
              <div
                key={sticker.id}
                className="group relative aspect-square bg-white rounded-sticker overflow-hidden border-2 border-transparent hover:border-uci-gold hover:-translate-y-0.75 transition-all duration-200"
                style={{ boxShadow: 'var(--shadow-card)' }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow-card)')}
              >
                {img ? (
                  <img src={img} alt="sticker" className="w-full h-full object-contain p-[10%]" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-warm-cream text-warm-gray text-xs font-semibold">
                    #{String(sticker.sticker_id ?? sticker.id).padStart(3, '0')}
                  </div>
                )}

                {/* Badges */}
                <div className="absolute top-2 left-2 flex gap-1">
                  {sticker.favorite && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-uci-gold text-uci-navy font-bold rounded-full">★</span>
                  )}
                  {sticker.for_trade && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-uci-blue text-white font-bold rounded-full">trade</span>
                  )}
                  {sticker.bg_removed && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-uci-navy text-white font-bold rounded-full">cut</span>
                  )}
                </div>

                {/* Owner: per-sticker actions */}
                {isOwner && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {sticker.images.length > 0 && (
                      <button
                        onClick={() => handleToggleBg(sticker)}
                        disabled={bgBusyId === sticker.id}
                        className="p-1.5 bg-white/80 text-uci-navy hover:text-uci-blue rounded-full disabled:opacity-50"
                        title={
                          sticker.bg_removed_file_url
                            ? sticker.bg_removed
                              ? 'Show original background'
                              : 'Show cut-out'
                            : 'Remove background'
                        }
                      >
                        {bgBusyId === sticker.id ? <SpinnerIcon /> : <ScissorsIcon />}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(sticker.id)}
                      className="p-1.5 bg-white/80 text-red-400 hover:text-red-600 rounded-full"
                      title="Remove"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                )}

                {/* Bottom info overlay */}
                {(sticker.condition || sticker.note || sticker.source_post_id !== null) && (
                  <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm">
                    {sticker.source_post_id !== null && (
                      <p className="text-[10px] text-uci-blue/70 truncate">from a post</p>
                    )}
                    {sticker.condition && (
                      <p className="text-[10px] text-uci-navy/70 font-semibold truncate">{sticker.condition}</p>
                    )}
                    {sticker.note && (
                      <p className="text-[10px] text-espresso/60 truncate">{sticker.note}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && <AddStickerModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
};

export default StickersPage;
