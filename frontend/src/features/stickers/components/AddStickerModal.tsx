import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CropModal } from '@/features/canvas/components/CropModal';
import { uploadSticker } from '../api/stickerApi';

interface Props {
  onClose: () => void;
}

const AddStickerModal: React.FC<Props> = ({ onClose }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rawUrl, setRawUrl] = useState<string | null>(null);
  const [showCrop, setShowCrop] = useState(false);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [condition, setCondition] = useState('');
  const [note, setNote] = useState('');
  const [acquiredAt, setAcquiredAt] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [forTrade, setForTrade] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setRawUrl(url);
    setShowCrop(true);
    e.target.value = '';
  };

  // CropModal calls onUpload with the cropped File; we store it and return a local blob URL.
  // Actual upload happens on form submit, not here.
  const handleCropUpload = async (file: File): Promise<string> => {
    setCroppedFile(file);
    return URL.createObjectURL(file);
  };

  const handleCropConfirm = (url: string) => {
    setPreviewUrl(url);
    setShowCrop(false);
  };

  const handleCropCancel = () => {
    setShowCrop(false);
    if (!croppedFile) {
      setRawUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!croppedFile) return;
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', croppedFile, 'sticker.png');
      if (condition) formData.append('condition', condition);
      if (note) formData.append('note', note);
      if (acquiredAt) formData.append('acquired_at', new Date(acquiredAt).toISOString());
      formData.append('favorite', String(favorite));
      formData.append('for_trade', String(forTrade));

      await uploadSticker(formData);
      queryClient.invalidateQueries({ queryKey: ['my-stickers'] });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sticker');
    } finally {
      setSubmitting(false);
    }
  };

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40 flex items-center justify-center px-4 py-10"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        <form
          onSubmit={handleSubmit}
          className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-warm-gray/20">
            <h2 className="text-base font-bold text-espresso">Add sticker to collection</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-warm-cream text-espresso/60 hover:text-espresso transition-colors text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Two-panel body */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-warm-gray/20">
            {/* Left: image picker / preview */}
            <div className="sm:w-2/5 p-5 flex flex-col items-center justify-center gap-3">
              {previewUrl ? (
                <>
                  <img
                    src={previewUrl}
                    alt="Cropped sticker preview"
                    className="w-full max-h-44 object-contain rounded-xl bg-warm-cream/50"
                  />
                  <button
                    type="button"
                    onClick={() => rawUrl && setShowCrop(true)}
                    className="text-xs text-uci-blue hover:underline"
                  >
                    Re-crop
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-square max-h-44 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-warm-gray/40 rounded-xl hover:border-uci-blue/50 hover:bg-warm-cream/30 transition-colors text-warm-gray"
                  >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-medium">Choose image</span>
                    <span className="text-[10px] text-warm-gray/60">PNG · JPG · WEBP</span>
                  </button>
                  <p className="text-[11px] text-espresso/40 text-center">
                    You&apos;ll crop the image before saving
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleFileChange}
              />
            </div>

            {/* Right: metadata */}
            <div className="sm:w-3/5 p-5 space-y-3">
              <div>
                <label className="block text-xs text-espresso/60 mb-1">Condition</label>
                <input
                  type="text"
                  maxLength={100}
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  placeholder="mint, worn, near mint…"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-warm-gray/40 bg-white outline-none focus:border-uci-blue"
                />
              </div>

              <div>
                <label className="block text-xs text-espresso/60 mb-1">Note</label>
                <textarea
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Any notes about this sticker…"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-warm-gray/40 bg-white outline-none focus:border-uci-blue resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-espresso/60 mb-1">Acquired date</label>
                <input
                  type="date"
                  value={acquiredAt}
                  onChange={(e) => setAcquiredAt(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-warm-gray/40 bg-white outline-none focus:border-uci-blue"
                />
              </div>

              <div className="flex items-center gap-5 pt-1">
                <label className="flex items-center gap-2 text-sm text-espresso cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={favorite}
                    onChange={(e) => setFavorite(e.target.checked)}
                    className="rounded accent-uci-gold"
                  />
                  Favorite
                </label>
                <label className="flex items-center gap-2 text-sm text-espresso cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={forTrade}
                    onChange={(e) => setForTrade(e.target.checked)}
                    className="rounded accent-uci-gold"
                  />
                  Available to trade
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          {error && <p className="px-6 pb-1 text-red-500 text-xs">{error}</p>}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-warm-gray/20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-espresso/60 hover:text-espresso transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!croppedFile || submitting}
              className="px-5 py-2 text-sm font-semibold rounded-full text-uci-navy disabled:opacity-40 hover:brightness-105 transition-all"
              style={{
                background: 'var(--color-uci-gold)',
                boxShadow: croppedFile ? 'var(--shadow-button-gold)' : undefined,
              }}
            >
              {submitting ? 'Saving…' : 'Save sticker'}
            </button>
          </div>
        </form>
      </div>

      {showCrop && rawUrl && (
        <CropModal
          imageUrl={rawUrl}
          onUpload={handleCropUpload}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </>,
    modalRoot,
  );
};

export default AddStickerModal;
