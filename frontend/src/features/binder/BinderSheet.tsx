import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Package } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import BinderViewer from './BinderViewer';
import StickerPicker from './StickerPicker';
import { getMyBinder, getPublicBinder, getUserStickers, assignSlot, createPage, updatePage, deletePage, removeStickerBg, toggleStickerBgRemoved } from './api/binderApi';
import type { BinderOut, BinderPageOut, UserStickerOut } from './types';

const PANEL_WIDTH = 288;

interface BinderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  username?: string;
  isOwner?: boolean;
  onBack?: () => void;
}

export default function BinderSheet({ isOpen, onClose, username, isOwner, onBack }: BinderSheetProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedSticker, setSelectedSticker] = useState<UserStickerOut | null>(null);
  const [pendingPlacement, setPendingPlacement] = useState<{
    pageId: number;
    slotIndex: number;
    occupant: UserStickerOut;
  } | null>(null);
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [pendingDeletePage, setPendingDeletePage] = useState<BinderPageOut | null>(null);
  const [isDeletingPage, setIsDeletingPage] = useState(false);

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
      queryClient.invalidateQueries({ queryKey: ['my-stickers'] });
      setSelectedSticker(null);
      setPendingPlacement(null);
    } catch (e) {
      console.error(e);
    }
  };

  const doUnfile = async () => {
    if (!selectedSticker) return;
    try {
      const updated = await assignSlot(selectedSticker.id, null, null);
      queryClient.setQueryData(['binder', username], updated);
      queryClient.invalidateQueries({ queryKey: ['my-stickers'] });
      setSelectedSticker(null);
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

  const patchStickerInCaches = (updated: UserStickerOut) => {
    setSelectedSticker(updated);
    queryClient.setQueryData(['my-stickers'], (old: UserStickerOut[] | undefined) =>
      old ? old.map(s => s.id === updated.id ? updated : s) : old
    );
    queryClient.setQueryData(['binder', username], (old: BinderOut | undefined) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map(p => ({
          ...p,
          stickers: p.stickers.map(s => s.id === updated.id ? updated : s),
        })),
      };
    });
  };

  const handleRemoveBg = async (stickerId: number) => {
    const updated = await removeStickerBg(stickerId);
    patchStickerInCaches(updated);
  };

  const handleToggleBg = async (stickerId: number, enabled: boolean) => {
    const updated = await toggleStickerBgRemoved(stickerId, enabled);
    patchStickerInCaches(updated);
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

  const handleRenamePage = async (pageId: number, newTitle: string) => {
    try {
      const updated = await updatePage(pageId, { title: newTitle || null });
      queryClient.setQueryData(['binder', username], (old: BinderOut) => ({
        ...old,
        pages: old.pages.map(p => p.id === pageId ? { ...p, title: updated.title } : p),
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePage = async () => {
    if (!pendingDeletePage) return;
    setIsDeletingPage(true);
    try {
      await deletePage(pendingDeletePage.id);
      queryClient.setQueryData(['binder', username], (old: BinderOut) => ({
        ...old,
        pages: old.pages.filter(p => p.id !== pendingDeletePage.id),
      }));
      queryClient.invalidateQueries({ queryKey: ['my-stickers'] });
      setPendingDeletePage(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeletingPage(false);
    }
  };

  const hasPages = (binder?.pages.length ?? 0) > 0;
  const isFiled = selectedSticker?.binder_page_id != null;

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
            {/* Floating overlay buttons — no header bar so binder fills the full screen */}
            <div className="absolute inset-0 z-10 pointer-events-none">
              {/* Top-left: Edit Binder / Done / +Page */}
              <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-auto">
                {isOwner && (
                  <>
                    {isEditMode ? (
                      <button
                        onClick={handleExitEdit}
                        style={{
                          height: 34,
                          padding: '0 18px',
                          background: '#FFD200',
                          color: '#332D2A',
                          fontSize: 13,
                          fontWeight: 700,
                          borderRadius: 8,
                          transition: 'opacity 120ms ease',
                        }}
                        className="hover:opacity-90"
                      >
                        Done
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsEditMode(true)}
                        className="px-4 py-1.5 rounded-full text-sm font-medium bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors backdrop-blur-sm"
                      >
                        Edit Binder
                      </button>
                    )}

                    <AnimatePresence>
                      {isEditMode && hasPages && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={{ duration: 0.15 }}
                          onClick={handleAddPage}
                          disabled={isCreatingPage}
                          style={{
                            height: 34,
                            padding: '0 14px',
                            fontSize: 13,
                            fontWeight: 500,
                            borderRadius: 8,
                            color: 'rgba(255,255,255,0.75)',
                            background: 'rgba(255,255,255,0.1)',
                            transition: 'background 120ms ease, color 120ms ease',
                          }}
                          className="hover:bg-white/20 hover:text-white! disabled:opacity-50 backdrop-blur-sm"
                        >
                          + Page
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>

              {/* Top-right: Close */}
              <div className="absolute top-4 right-4 pointer-events-auto">
                <button
                  onClick={onClose}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors backdrop-blur-sm"
                  aria-label="Close binder"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content — left panel (picker) + right (binder) */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left panel animates width 0 ↔ PANEL_WIDTH */}
              <motion.div
                initial={false}
                animate={{ width: isEditMode ? PANEL_WIDTH : 0 }}
                transition={{ duration: 0.35, ease: [0.45, 0, 0.55, 1] }}
                className="shrink-0 overflow-hidden flex"
              >
                {isOwner && (
                  <StickerPicker
                    stickers={myStickers}
                    selectedId={selectedSticker?.id ?? null}
                    isFiled={isFiled}
                    onSelect={setSelectedSticker}
                    onPlaceInNextSlot={handlePlaceInNextSlot}
                    onUnfile={doUnfile}
                    onRemoveBg={handleRemoveBg}
                    onToggleBg={handleToggleBg}
                    isLoading={stickersLoading}
                  />
                )}
              </motion.div>

              {/* Binder area */}
              <div className="flex-1 flex items-center justify-center px-6 pt-14 pb-14 overflow-hidden">
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
                    onRenamePage={handleRenamePage}
                    onDeletePage={setPendingDeletePage}
                  />
                )}
              </div>
            </div>

            {/* Footer hint — only in view mode */}
            <AnimatePresence>
            </AnimatePresence>
          </motion.div>

          {/* Delete page confirmation dialog */}
          {pendingDeletePage && (
            <div className="fixed inset-0 z-60 flex items-center justify-center pointer-events-none">
              <div className="bg-[#2c2c2e] rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 border border-white/10 pointer-events-auto">
                <p className="text-white font-semibold text-center mb-2">Delete this page?</p>
                <p className="text-[#8e8e93] text-sm text-center mb-6">
                  {pendingDeletePage.stickers.length > 0
                    ? `${pendingDeletePage.stickers.length} sticker${pendingDeletePage.stickers.length === 1 ? '' : 's'} will be unfile'd and returned to your collection.`
                    : 'This page is empty.'}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPendingDeletePage(null)}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeletePage}
                    disabled={isDeletingPage}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/90 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {isDeletingPage ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}

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
