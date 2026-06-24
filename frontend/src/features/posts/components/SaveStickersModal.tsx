import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import type { Post } from '@/shared/types/Types';
import { fetchWithAuth, API_BASE } from '@/shared/api/api';

interface SaveStickersModalProps {
  post: Post;
  onClose: () => void;
}

/**
 * Owner-only picker that promotes selected post images into the user's sticker
 * collection. Lives outside the post viewer so the act of choosing which images
 * to save gets its own focused surface rather than crowding the lightbox.
 */
const SaveStickersModal: React.FC<SaveStickersModalProps> = ({ post, onClose }) => {
  const queryClient = useQueryClient();
  const images = post.images ?? [];

  const [selectedIdxs, setSelectedIdxs] = useState<number[]>(() => images.map((_, i) => i));
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const allSelected = selectedIdxs.length === images.length;

  const toggleIdx = (i: number) =>
    setSelectedIdxs((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort((a, b) => a - b)
    );

  const toggleAll = () => setSelectedIdxs(allSelected ? [] : images.map((_, i) => i));

  const handleSave = async () => {
    if (!selectedIdxs.length || saving) return;
    setSaving(true);
    try {
      const groups = selectedIdxs.map((idx) => [idx + 1]);
      const res = await fetchWithAuth(`${API_BASE}/stickers/me/from-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.post_id, groups }),
      });
      if (res.ok) {
        const created = await res.json();
        setSavedCount(created.length);
        queryClient.invalidateQueries({ queryKey: ['my-stickers'] });
      }
    } finally {
      setSaving(false);
    }
  };

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-8"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-uci-navy/40 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-soft-white shadow-2xl flex flex-col max-h-[88vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {savedCount !== null ? (
          <div className="flex flex-col items-center text-center px-6 py-10 gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-emerald-600" strokeWidth={3} />
            </div>
            <p className="text-base font-semibold text-uci-navy">
              {savedCount} sticker{savedCount !== 1 ? 's' : ''} added
            </p>
            <p className="text-sm text-dark-text/60">They're in your collection now.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-uci-blue hover:bg-[#0072bb] transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 pt-5 pb-3 shrink-0">
              <h2 className="text-lg font-bold text-uci-navy font-display">Save as stickers</h2>
              <p className="text-sm text-dark-text/55 mt-0.5">
                {images.length > 1
                  ? 'Pick which images to add to your collection.'
                  : 'Add this image to your collection.'}
              </p>
            </div>

            {/* Selectable grid */}
            <div className="px-5 overflow-y-auto">
              <div className="grid grid-cols-3 gap-2.5">
                {images.map((img, i) => {
                  const thumb = img.paths?.thumbnail ?? img.paths?.original ?? post.image_paths[i];
                  const checked = selectedIdxs.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleIdx(i)}
                      className={`relative aspect-square rounded-xl overflow-hidden transition-all
                        ${checked
                          ? 'ring-2 ring-uci-blue'
                          : 'ring-1 ring-warm-gray opacity-60 hover:opacity-90'}`}
                      aria-label={`${checked ? 'Deselect' : 'Select'} image ${i + 1}`}
                      aria-pressed={checked}
                    >
                      {thumb && (
                        <img src={thumb} alt="" className="w-full h-full object-cover" draggable={false} />
                      )}
                      <span
                        className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-md flex items-center justify-center transition-all
                          ${checked
                            ? 'bg-uci-blue ring-1 ring-white/40'
                            : 'bg-white/80 ring-1 ring-warm-gray'}`}
                      >
                        {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 pt-3 pb-5 mt-1 shrink-0 flex flex-col gap-3">
              {images.length > 1 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-dark-text/55 font-medium tabular-nums">
                    {selectedIdxs.length} of {images.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-uci-blue hover:underline font-medium"
                  >
                    {allSelected ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
              )}
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-dark-text/70 bg-warm-cream hover:bg-warm-gray/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || selectedIdxs.length === 0}
                  className="flex-[1.6] py-2.5 rounded-xl text-sm font-semibold text-white bg-uci-blue hover:bg-[#0072bb] disabled:opacity-40 disabled:hover:bg-uci-blue transition-colors"
                >
                  {saving
                    ? 'Saving…'
                    : `Save ${selectedIdxs.length} sticker${selectedIdxs.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    modalRoot,
  );
};

export default SaveStickersModal;
