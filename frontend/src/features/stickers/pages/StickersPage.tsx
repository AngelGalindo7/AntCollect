import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchPublic, fetchWithAuth, API_BASE } from '@/shared/api/api';
import { getSession } from '@/shared/auth/session';
import type { UserSticker } from '@/shared/types/Types';

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

interface TrackFormState {
  sticker_id: string;
  condition: string;
  note: string;
  acquired_at: string;
  favorite: boolean;
  for_trade: boolean;
}

const EMPTY_FORM: TrackFormState = {
  sticker_id: '',
  condition: '',
  note: '',
  acquired_at: '',
  favorite: false,
  for_trade: false,
};

const StickersPage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const session = getSession();
  const isOwner = session?.username === username;

  const [stickers, setStickers] = useState<UserSticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TrackFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [bgBusyId, setBgBusyId] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const url = isOwner
          ? `${API_BASE}/stickers/me`
          : `${API_BASE}/stickers/${username}`;
        const res = isOwner
          ? await fetchWithAuth(url)
          : await fetchPublic(url);
        if (res.ok) {
          setStickers(await res.json());
        }
      } catch {
        // show empty state
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [username, isOwner]);

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this sticker from your collection?')) return;
    const res = await fetchWithAuth(`${API_BASE}/stickers/me/${id}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) {
      setStickers((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const handleToggleBg = async (sticker: UserSticker) => {
    setBgBusyId(sticker.id);
    try {
      // First time cuts the image (heavy rembg call, persisted server-side); afterwards
      // the cut-out is cached, so we just flip which image the card displays via PATCH.
      const res = sticker.bg_removed_file_url
        ? await fetchWithAuth(`${API_BASE}/stickers/me/${sticker.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bg_removed: !sticker.bg_removed }),
          })
        : await fetchWithAuth(`${API_BASE}/stickers/me/${sticker.id}/remove-bg`, { method: 'POST' });
      if (res.ok) {
        const updated: UserSticker = await res.json();
        setStickers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      }
    } finally {
      setBgBusyId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const stickerId = form.sticker_id ? parseInt(form.sticker_id, 10) : null;
    setSubmitting(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/stickers/me`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sticker_id: stickerId,
          condition: form.condition || null,
          note: form.note || null,
          acquired_at: form.acquired_at ? new Date(form.acquired_at).toISOString() : null,
          favorite: form.favorite,
          for_trade: form.for_trade,
          asset_ids: [],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setFormError(body?.error?.message ?? body?.detail ?? 'Failed to track sticker.');
        return;
      }
      const created: UserSticker = await res.json();
      setStickers((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  const primaryImage = (s: UserSticker) =>
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
            onClick={() => { setShowForm(true); setFormError(null); }}
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

      {/* Inline track form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 p-5 rounded-xl border border-warm-gray/30 bg-white/60 backdrop-blur-sm space-y-3"
        >
          <h2 className="font-semibold text-espresso text-sm">Track from library</h2>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-espresso/60 mb-1">Library sticker ID</label>
              <input
                type="number"
                min={1}
                value={form.sticker_id}
                onChange={(e) => setForm((f) => ({ ...f, sticker_id: e.target.value }))}
                placeholder="optional"
                className="w-full px-3 py-2 text-sm rounded-lg border border-warm-gray/40 bg-white outline-none focus:border-uci-blue"
              />
            </div>

            <div>
              <label className="block text-xs text-espresso/60 mb-1">Condition</label>
              <input
                type="text"
                maxLength={100}
                value={form.condition}
                onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
                placeholder="mint, worn…"
                className="w-full px-3 py-2 text-sm rounded-lg border border-warm-gray/40 bg-white outline-none focus:border-uci-blue"
              />
            </div>

            <div>
              <label className="block text-xs text-espresso/60 mb-1">Acquired</label>
              <input
                type="date"
                value={form.acquired_at}
                onChange={(e) => setForm((f) => ({ ...f, acquired_at: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-warm-gray/40 bg-white outline-none focus:border-uci-blue"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-espresso/60 mb-1">Note</label>
            <textarea
              maxLength={500}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-warm-gray/40 bg-white outline-none focus:border-uci-blue resize-none"
            />
          </div>

          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2 text-sm text-espresso cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.favorite}
                onChange={(e) => setForm((f) => ({ ...f, favorite: e.target.checked }))}
                className="rounded accent-uci-gold"
              />
              Favorite
            </label>
            <label className="flex items-center gap-2 text-sm text-espresso cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.for_trade}
                onChange={(e) => setForm((f) => ({ ...f, for_trade: e.target.checked }))}
                className="rounded accent-uci-gold"
              />
              Available to trade
            </label>
          </div>

          {formError && <p className="text-red-500 text-xs">{formError}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-semibold rounded-full text-uci-navy disabled:opacity-50 hover:brightness-105 transition-all"
              style={{ background: 'var(--color-uci-gold)' }}
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
              className="px-4 py-2 text-sm text-espresso/60 hover:text-espresso transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

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
            <p className="text-uci-navy/50 text-sm mt-1">Hit "Track sticker" to add your first entry.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-10">
          {stickers.map((sticker) => {
            const img = primaryImage(sticker);
            return (
              <div
                key={sticker.id}
                className="group relative aspect-square bg-white rounded-sticker overflow-hidden border-2 border-transparent hover:border-uci-gold hover:-translate-y-[3px] transition-all duration-200"
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
                {(sticker.condition || sticker.note) && (
                  <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm">
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
    </div>
  );
};

export default StickersPage;
