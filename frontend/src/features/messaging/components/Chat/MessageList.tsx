// STUB — renders messages from the Zustand store as plain bubbles.
// Phase 3 replaces this with:
//   - buildListItems() for date separators
//   - bubble grouping (same sender + within 60s = no avatar, reduced margin)
//   - useScrollAnchor (auto-scroll to bottom, scroll position preservation)
//   - Intersection Observer at top for upward pagination (Phase 8)
//   - MessageCell with status ticks, reply previews, deleted state
//
// Even as a stub this is production-correct in one important way:
// it reads from the Zustand store, NOT from useMessages' return value.
// This means WebSocket messages and HTTP history both appear here
// because both write into the same store.

import { useMessageStore } from '../../store/messageStore';

interface MessageListProps {
  conversationId: string;
  currentUserId: string;
}

export default function MessageList({ conversationId, currentUserId }: MessageListProps) {
  const messages = useMessageStore(
    (s) => s.messagesByConversation[conversationId] ?? []
  );

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">No messages yet. Say hello!</p>
      </div>
    );
  }

  return (
    // overflow-y-auto + h-full: this div scrolls, not the page.
    // The parent in ChatPage is overflow-hidden + flex-1, giving this
    // div a bounded height to scroll within.
    <div className="flex flex-col gap-1 p-4 overflow-y-auto h-full">
      {messages.map((message) => {
        const isOwn = message.sender === currentUserId;

        return (
          <div
            key={message.clientMessageId}
            className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`
                px-3 py-2 rounded-2xl text-sm max-w-xs lg:max-w-md break-words
                ${isOwn
                  ? 'bg-blue-500 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                }
                ${message.status === 'failed' ? 'opacity-50' : ''}
              `}
            >
              {message.deletedAt ? (
                <span className="italic text-xs opacity-60">
                  This message was deleted
                </span>
              ) : (
                message.content
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
