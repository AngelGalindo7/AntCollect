import React, { useState, useCallback } from 'react';
import type { Post, FolderType } from '@/shared/types/Types';
import { createTradeRequest } from '@/features/trading/api/tradeRequestApi';
import type { TradeRequestType } from '@/features/trading/types';
import OfferSlotGrid from './OfferSlotGrid';
import PostPickerModal from './PostPickerModal';

interface TradeOfferPanelProps {
  targetPost: Post;
  postOwnerId: number;
  folderType?: FolderType;
}

const INITIAL_SLOT_COUNT = 4;
const EXPANSION_STEP = 2;

/**
 * The slide-in panel to the left of the image in PostDetailModal.
 * Owns slot state and expansion logic.
 * Coordinates PostPickerModal open/close and slot filling.
 */
const TradeOfferPanel: React.FC<TradeOfferPanelProps> = ({
  targetPost,
  postOwnerId,
  folderType,
}) => {
  const [slots, setSlots] = useState<(Post | null)[]>(Array(INITIAL_SLOT_COUNT).fill(null));
  const [pickerSlotIndex, setPickerSlotIndex] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestType: TradeRequestType =
    folderType === 'looking_for' ? 'HAVE_WHAT_YOU_NEED' : 'WANT_TO_TRADE';

  const filledPosts = slots.filter((p): p is Post => p !== null);
  const excludedPostIds = filledPosts.map((p) => p.post_id);

  const handleSelect = useCallback((index: number) => {
    setPickerSlotIndex(index);
  }, []);

  const handleRemove = useCallback((index: number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }, []);

  const handlePickerSelect = useCallback((post: Post) => {
    if (pickerSlotIndex === null) return;
    setSlots((prev) => {
      const next = [...prev];
      next[pickerSlotIndex] = post;
      // Expand if the last slot is now filled
      const lastFilled = next[next.length - 1] !== null;
      return lastFilled ? [...next, ...Array(EXPANSION_STEP).fill(null)] : next;
    });
    setPickerSlotIndex(null);
  }, [pickerSlotIndex]);

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      await createTradeRequest({
        target_post_id: targetPost.post_id,
        recipient_id: postOwnerId,
        request_type: requestType,
        offered_post_ids: filledPosts.length > 0 ? filledPosts.map((p) => p.post_id) : undefined,
      });
      setSent(true);
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail;
      if (detail?.includes('already have a pending')) {
        setError('You already have a pending request for this post');
      } else if (detail?.includes('Too many declined')) {
        setError('Too many declined requests to this user');
      } else {
        setError('Failed to send request');
      }
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="w-64 flex flex-col items-center justify-center gap-3 py-8 px-4">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-800 text-center">Request sent!</p>
        <p className="text-xs text-gray-500 text-center">
          {filledPosts.length > 0
            ? `Offering ${filledPosts.length} sticker${filledPosts.length > 1 ? 's' : ''}`
            : 'Showing interest'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="w-64 flex flex-col gap-4 py-4 px-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Your offer</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Add stickers you're willing to trade, or send with none.
          </p>
        </div>

        <OfferSlotGrid
          slots={slots}
          onSelect={handleSelect}
          onRemove={handleRemove}
        />

        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}

        <button
          onClick={handleSend}
          disabled={sending}
          className="w-full py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {sending ? 'Sending…' : 'Send Request'}
        </button>
      </div>

      {pickerSlotIndex !== null && (
        <PostPickerModal
          excludedPostIds={excludedPostIds}
          onSelect={handlePickerSelect}
          onClose={() => setPickerSlotIndex(null)}
        />
      )}
    </>
  );
};

export default TradeOfferPanel;
