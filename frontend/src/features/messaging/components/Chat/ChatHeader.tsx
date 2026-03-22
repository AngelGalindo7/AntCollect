import { ChevronLeft } from 'lucide-react';

interface ChatHeaderProps {
  conversationId: string;
  isGroup: boolean;
  displayName: string;
  displayAvatar: string;
  participantId?: string;
  onBack: () => void;
  isLoading?: boolean;
}

export default function ChatHeader({
  displayName,
  displayAvatar,
  onBack,
  isLoading,
}: ChatHeaderProps) {
  return (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
      <button
        onClick={onBack}
        className="p-1 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Go back"
      >
        <ChevronLeft className="w-5 h-5 text-gray-600" />
      </button>

      {isLoading ? (
          <div className="flex items-center gap-2 flex-1">
          <div className="w-9 h-9 rounded-full bg-gray-200 animate-pulse" />
          <div className="h-4 w-32 bg-gray-200 animate-pulse rounded" />
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {displayAvatar ? (
            <img
              src={displayAvatar}
              alt={displayName}
              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="font-semibold text-sm text-gray-900 truncate">
            {displayName}
          </span>
        </div>
      )}
    </div>
  );
}
