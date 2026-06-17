import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Sparkles, Package } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import BinderViewer from './BinderViewer';
import StickerPicker from './StickerPicker';
import { getMyBinder, getPublicBinder, getUserStickers, assignSlot, createPage } from './api/binderApi';
import type { BinderOut, BinderPageOut, UserStickerOut } from './types';

const PANEL_WIDTH = 288;

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
  const [isCreatingPage, setIsCreatingPage] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

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

  const { data: myStickers = [], isLoading: stickersLoading } = useQuery<UserStickerOut[]>({
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
      if (occupant) setSelectedSticker(occupant);
      return;
    }

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

  const handleAddPage = async () => {
    setIsCreatingPage(true);
    try {
      const newPage = await createPage(3, 3);
      queryClient.setQueryData(['binder', username], (old: BinderOut) => ({
        ...old,
        pages: [...old.pages, newPage],
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreatingPage(false);
    }
  };

  const hasPages = (binder?.pages.length ?? 0) > 0;

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
            {/* Header row */}
            <div className="shrink-0 h-16 flex items-center px-6 gap-3 border-b border-white/10">
              {isOwner && (
                <>
                  <button
                    onClick={isEditMode ? handleExitEdit : () => setIsEditMode(true)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      isEditMode
                        ? 'bg-amber-500 hover:bg-amber-400 text-white'
                        : 'bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white'
                    }`}
                  >
                    {isEditMode ? 'Done' : 'Edit Binder'}
                  </button>

                  <AnimatePresence>
                    {isEditMode && hasPages && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        transition={{ duration: 0.15 }}
                        onClick={handleAddPage}
                        disabled={isCreatingPage}
                        className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                      >
                        + Page
                      </motion.button>
                    )}
                  </AnimatePresence>
                </>
              )}

              <div className="flex-1" />

              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-slate-300 hover:text-white"
                aria-label="Close binder"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content — single layout with animated left panel */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left panel animates width 0 ↔ PANEL_WIDTH */}
              <motion.div
                initial={false}
                animate={{ width: isEditMode ? PANEL_WIDTH : 0 }}
                transition={{ duration: 0.35, ease: [0.45, 0, 0.55, 1] }}
                className="shrink-0 overflow-hidden"
              >
                {isOwner && (
                  <StickerPicker
                    stickers={myStickers}
                    selectedId={selectedSticker?.id ?? null}
                    onSelect={setSelectedSticker}
                    onPlaceInNextSlot={handlePlaceInNextSlot}
                    isLoading={stickersLoading}
                  />
                )}
              </motion.div>

              {/* Right area */}
              <div className="flex-1 flex items-center justify-center px-6 py-6 overflow-hidden">
                {isEditMode && !hasPages ? (
                  <div className="flex flex-col items-center gap-4 text-center">
                    <Package className="w-12 h-12 text-white/20" />
                    <div>
                      <p className="text-white text-sm font-medium mb-1">No pages yet</p>
                      <p className="text-[#8e8e93] text-xs">Create a page to start filing stickers</p>
                    </div>
                    <button
                      onClick={handleAddPage}
                      disabled={isCreatingPage}
                      className="px-5 py-2 rounded-full bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {isCreatingPage ? 'Creating…' : 'Add Page'}
                    </button>
                  </div>
                ) : (
                  <BinderViewer
                    binder={binder}
                    isEditMode={isEditMode}
                    selectedStickerId={selectedSticker?.id ?? null}
                    onSlotClick={handleSlotClick}
                  />
                )}
              </div>
            </div>

            {/* Footer hint — fades out in edit mode */}
            <AnimatePresence>
              {!isEditMode && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.7 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="shrink-0 pb-5 flex items-center justify-center gap-2 text-[#8e8e93] text-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Swipe or click the corners to turn pages
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Swap confirmation dialog */}
          {pendingPlacement && (
            <div className="fixed inset-0 z-60 flex items-center justify-center pointer-events-none">
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
