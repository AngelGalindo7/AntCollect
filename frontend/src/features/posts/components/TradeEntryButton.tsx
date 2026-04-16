import React from 'react';

interface TradeEntryButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

/**
 * Left-edge tab attached to the image frame inside PostDetailModal.
 * Toggles the TradeOfferPanel open/closed.
 * Uses the same arrows-swap icon as the sidebar trade button.
 */
const TradeEntryButton: React.FC<TradeEntryButtonProps> = ({ isOpen, onClick }) => {
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? 'Close trade panel' : 'Open trade panel'}
      className={`
        absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full
        flex items-center justify-center
        w-10 h-10 rounded-l-xl
        shadow-lg transition-colors duration-200
        ${isOpen
          ? 'bg-blue-500 text-white hover:bg-blue-600'
          : 'bg-white text-blue-500 hover:bg-blue-50 border border-gray-200'
        }
      `}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
        />
      </svg>
    </button>
  );
};

export default TradeEntryButton;
