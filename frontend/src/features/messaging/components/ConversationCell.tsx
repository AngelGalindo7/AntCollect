import type { Conversation } from '../types';

interface ConversationCellProps {
  conversation: Conversation;
  onClick: () => void;
}

export function ConversationCell({ conversation, onClick }: ConversationCellProps) {
  const displayName = conversation.isGroup
    ? conversation.groupName
    : conversation.participantName;

  const displayAvatar = conversation.isGroup
    ? conversation.groupAvatar
    : conversation.participantAvatar;

  function renderLastMessage() {
    if (!conversation.lastMessage) {
      return <span className="text-gray-400">No messages yet</span>;
    }
    const { contentType, senderName, content } = conversation.lastMessage;
    if (contentType !== 'text') {
      const labels: Record<string, string> = {
        image: 'Photo',
        video: 'Video',
        audio: 'Audio',
        file: 'File',
      };
      return <span className="text-gray-400">{labels[contentType] ?? 'Attachment'}</span>;
    }
    return (
      <span className="text-gray-500 truncate">
        {conversation.isGroup && <span className="text-gray-700">{senderName}: </span>}
        {content}
      </span>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
    >
      <div className="relative shrink-0">
        <img
          src={displayAvatar ?? ''}
          alt=""
          className="w-10 h-10 rounded-full object-cover bg-gray-200"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm truncate ${conversation.unreadCount > 0 ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
            {displayName}
          </span>
          <span className="text-xs text-gray-400 shrink-0">
            {conversation.lastMessage
              ? new Date(conversation.lastMessage.timeSent).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : ''}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs truncate flex-1">{renderLastMessage()}</p>
          {conversation.unreadCount > 0 && (
            <span className="shrink-0 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
