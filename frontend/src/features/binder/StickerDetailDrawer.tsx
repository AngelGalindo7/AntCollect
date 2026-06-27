import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Scissors, Loader2 } from 'lucide-react';
import type { UserStickerOut } from './types';

interface Props {
  sticker: UserStickerOut | null;
  onClose: () => void;
  onUpdate: (updated: UserStickerOut) => void;
  onRemoveBg: (stickerId: number) => Promise<UserStickerOut>;
  onToggle: (stickerId: number, enabled: boolean) => Promise<UserStickerOut>;
}

export default function StickerDetailDrawer({ sticker, onClose, onUpdate, onRemoveBg, onToggle }: Props) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setError(null); }, [sticker?.id]);

  const hasBgAsset = !!sticker?.bg_removed_file_url;
  const imgUrl = sticker
    ? (sticker.bg_removed && sticker.bg_removed_file_url
        ? sticker.bg_removed_file_url
        : sticker.images[0]?.file_url ?? null)
    : null;

  const handleRemoveBg = async () => {
    if (!sticker || isRemoving) return;
    setIsRemoving(true);
    setError(null);
    try {
      const updated = await onRemoveBg(sticker.id);
      onUpdate(updated);
    } catch {
      setError('Background removal failed — try again shortly.');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleToggle = async () => {
    if (!sticker || !hasBgAsset || isToggling) return;
    setIsToggling(true);
    setError(null);
    try {
      const updated = await onToggle(sticker.id, !sticker.bg_removed);
      onUpdate(updated);
    } catch {
      setError('Could not update sticker.');
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <AnimatePresence>
      {sticker && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-60"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.3, ease: [0.45, 0, 0.55, 1] }}
            className="fixed bottom-0 left-0 right-0 z-70 bg-[#2c2c2e] rounded-t-2xl border-t border-white/10 shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/5">
              <p className="text-white font-semibold text-sm truncate max-w-[75%]">
                {sticker.sticker_name ?? 'Sticker'}
              </p>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 flex gap-4 items-center">
              <div className="w-24 h-24 shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                {imgUrl
                  ? <img src={imgUrl} alt="" className="w-full h-full object-contain" />
                  : <div className="w-10 h-10 rounded-full bg-white/10" />
                }
              </div>

              <div className="flex-1 flex flex-col gap-3">
                {!hasBgAsset ? (
                  <button
                    onClick={handleRemoveBg}
                    disabled={isRemoving}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                  >
                    {isRemoving
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Scissors className="w-4 h-4" />
                    }
                    {isRemoving ? 'Removing…' : 'Remove Background'}
                  </button>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-300 text-sm">No background</span>
                    <button
                      onClick={handleToggle}
                      disabled={isToggling}
                      role="switch"
                      aria-checked={sticker.bg_removed}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 disabled:opacity-60 shrink-0 ${sticker.bg_removed ? 'bg-violet-500' : 'bg-white/20'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${sticker.bg_removed ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                )}
                {error && <p className="text-red-400 text-xs">{error}</p>}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
