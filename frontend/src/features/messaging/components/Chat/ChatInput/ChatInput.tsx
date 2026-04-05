import { useRef, useState, useCallback } from 'react';
import { useWebSocketContext } from '@/features/messaging/providers/WebSocketProvider';
import { useMessageStore } from '@/features/messaging/store/messageStore';
import type { Message } from '@/features/messaging/types';

interface ChatInputProps {
  conversationId: string;
  currentUserId: string;
}

const MAX_ROWS = 5;
const LINE_HEIGHT = 24; // px — matches text-sm leading

export default function ChatInput({ conversationId, currentUserId }: ChatInputProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage } = useWebSocketContext();
  const appendMessage = useMessageStore((s) => s.appendMessage);

  // Resize the textarea to fit its content, capped at MAX_ROWS lines.
  // Resets height to 'auto' first so shrinkage works when text is deleted.
  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = LINE_HEIGHT * MAX_ROWS;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    resize();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const trimmed = content.trim();
    if (!trimmed) return;

    const clientMessageId = crypto.randomUUID();

    // Optimistic message — visible immediately, replaced by server version on ack.
    const optimistic: Message = {
      clientMessageId,
      messageId: null,
      conversationId,
      sender: currentUserId,
      senderName: '',       // not shown on own messages
      senderAvatar: '',     // not shown on own messages
      content: trimmed,
      contentType: 'text',
      timeSent: new Date().toISOString(),
      editedAt: null,
      replyTo: null,
      deletedAt: null,
      status: 'sending',
    };

    appendMessage(conversationId, optimistic);
    sendMessage(conversationId, trimmed, clientMessageId);

    setContent('');

    // Reset textarea height after clearing.
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.overflowY = 'hidden';
      }
    });
  }

  const canSend = content.trim().length > 0;

  return (
    <div className="border-t border-gray-200 bg-white px-3 py-2 shrink-0">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:bg-white transition-colors leading-6 overflow-hidden"
          style={{ lineHeight: `${LINE_HEIGHT}px` }}
        />
        <button
          onClick={submit}
          disabled={!canSend}
          aria-label="Send message"
          className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
            canSend
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {/* Paper-plane send icon */}
          <svg className="w-4 h-4 translate-x-px" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
