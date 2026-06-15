import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Sparkles } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import BinderViewer from './BinderViewer';
import StickerPicker from './StickerPicker';
import { getMyBinder, getPublicBinder, getUserStickers, assignSlot } from './api/binderApi';
import type { BinderOut, BinderPageOut, UserStickerOut } from './types';

interface BinderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  username?: string;
  isOwner?: boolean;
}

export default function BinderSheet({ isOpen, onClose, username, isOwner }: BinderSheetProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedSticker, setSelectedSticker] = useState<UserStickerOut | null>(null);
  const [pendingPlacement, setPendingPlacement] = useState<{
    pageId: number;
    slotIndex: number;
    occupant: UserStickerOut;
  } | null>(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Reset edit state when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setIsEditMode(false);
      setSelectedSticker(null);
      setPendingPlacement(null);
    }
  }, [isOpen]);

  const { data: binder } = useQuery<BinderOut>({
    queryKey: ['binder', username],
    queryFn: () => isOwner ? getMyBinder() : getPublicBinder(username!),
    enabled: isOpen && !!username,
  });

  const { data: myStickers = [] } = useQuery<UserStickerOut[]>({
    queryKey: ['my-stickers'],
    queryFn: getUserStickers,
    enabled: isOpen && !!isOwner && isEditMode,
  });

  const doAssignSlot = async (pageId: number, slotIndex: number) => {
    if (!selectedSticker) return;
    try {
      const updated = await assignSlot(selectedSticker.id, pageId, slotIndex);
      queryClient.setQueryData(['binder', username], updated);
      setSelectedSticker(null);
      setPendingPlacement(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePlaceInNextSlot = async () => {
    if (!selectedSticker || !binder) return;
    for (const page of binder.pages) {
      const occupied = new Set(page.stickers.map(s => s.slot_index));
      for (let i = 0; i < page.rows * page.cols; i++) {
        if (!occupied.has(i)) {
          await doAssignSlot(page.id, i);
          return;
        }
      }
    }
  };

  const handleSlotClick = (page: BinderPageOut, slotIndex: number, occupant: UserStickerOut | null) => {
    if (!isEditMode) return;

    if (!selectedSticker) {
      // Clicking an occupied slot selects that sticker for moving
      if (occupant) setSelectedSticker(occupant);
      return;
    }

    // Clicking the sticker's own slot deselects it
    if (occupant?.id === selectedSticker.id) {
      setSelectedSticker(null);
      return;
    }

    if (occupant) {
      setPendingPlacement({ pageId: page.id, slotIndex, occupant });
    } else {
      doAssignSlot(page.id, slotIndex);
    }
  };

  const handleExitEdit = () => {
    setIsEditMode(false);
    setSelectedSticker(null);
    setPendingPlacement(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.45, ease: [0.45, 0, 0.55, 1] }}
            className="fixed inset-0 z-50 bg-[#1c1c1e] flex flex-col overflow-hidden"
          >
            {/* Edit Binder / Done button — owner only */}
            {isOwner && (
              <button
                onClick={isEditMode ? handleExitEdit : () => setIsEditMode(true)}
                className={`absolute top-5 left-6 z-50 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isEditMode
                    ? 'bg-amber-500 hover:bg-amber-400 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white'
                }`}
              >
                {isEditMode ? 'Done' : 'Edit Binder'}
              </button>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-6 z-50 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-slate-300 hover:text-white"
              aria-label="Close binder"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content area — layout shifts when editing */}
            {isEditMode ? (
              <div className="flex-1 flex overflow-hidden">
                <StickerPicker
                  stickers={myStickers}
                  selectedId={selectedSticker?.id ?? null}
                  onSelect={setSelectedSticker}
                  onPlaceInNextSlot={handlePlaceInNextSlot}
                />
                <div className="flex-1 flex items-center justify-center px-6 py-6 overflow-hidden">
                  <BinderViewer
                    binder={binder}
                    isEditMode
                    selectedStickerId={selectedSticker?.id ?? null}
                    onSlotClick={handleSlotClick}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center px-8 py-6 overflow-hidden">
                <BinderViewer binder={binder} />
              </div>
            )}

            {/* Footer hint — hidden in edit mode to save space */}
            {!isEditMode && (
              <div className="shrink-0 pb-5 flex items-center justify-center gap-2 text-[#8e8e93] text-sm opacity-70">
                <Sparkles className="w-4 h-4" />
                Swipe or click the corners to turn pages
              </div>
            )}
          </motion.div>

          {/* Confirmation dialog for occupied slots */}
          {pendingPlacement && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
              <div className="bg-[#2c2c2e] rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 border border-white/10 pointer-events-auto">
                <p className="text-white font-semibold text-center mb-2">Slot is occupied</p>
                <p className="text-[#8e8e93] text-sm text-center mb-6">
                  Replace the existing sticker with your selection?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPendingPlacement(null)}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => doAssignSlot(pendingPlacement.pageId, pendingPlacement.slotIndex)}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-400 transition-colors"
                  >
                    Replace
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
