import React from 'react';
import type { Post } from '@/shared/types/Types';
import OfferSlot from './OfferSlot';

interface OfferSlotGridProps {
  slots: (Post | null)[];
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
}

/**
 * Pure display grid for trade offer slots.
 * All slot state and expansion logic live in TradeOfferPanel.
 * Renders each slot and delegates selection/removal upward.
 */
const OfferSlotGrid: React.FC<OfferSlotGridProps> = ({ slots, onSelect, onRemove }) => {
  return (
    <div className="overflow-y-auto max-h-[55vh] pr-1">
      <div className="grid grid-cols-2 gap-3">
        {slots.map((post, i) => (
          <OfferSlot
            key={i}
            post={post}
            onSelect={() => onSelect(i)}
            onRemove={() => onRemove(i)}
          />
        ))}
      </div>
    </div>
  );
};

export default OfferSlotGrid;
