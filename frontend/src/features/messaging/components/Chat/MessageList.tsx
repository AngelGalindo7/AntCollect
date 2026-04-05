import { useRef, useEffect, useLayoutEffect } from 'react';
import { useMessageStore } from '../../store/messageStore';
import type { Message } from '../../types';

interface MessageListProps {
  conversationId: string;
  currentUserId: string;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}

export default function MessageList({
  conversationId,
  currentUserId,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
}: MessageListProps) {
  const messages = useMessageStore(
    (s) => s.messagesByConversation[conversationId] ?? []
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);

  // Saved before older messages are prepended so we can restore visual position.
  const savedScrollHeightRef = useRef(0);
  // True until the first non-empty render — causes an instant jump to bottom.
  const isInitialLoadRef = useRef(true);

  // Capture scrollHeight the moment a pagination fetch starts, before any DOM change.
  useEffect(() => {
    if (isFetchingNextPage) {
      savedScrollHeightRef.current = scrollContainerRef.current?.scrollHeight ?? 0;
    }
  }, [isFetchingNextPage]);

  // Runs synchronously after every paint caused by messages.length changing.
  // Three cases, evaluated in priority order:
  //   1. Older page was prepended  → keep visual position stable
  //   2. Initial load              → jump to bottom without animation
  //   3. New message appended      → scroll to bottom only if already near it
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    if (savedScrollHeightRef.current > 0) {
      el.scrollTop = el.scrollHeight - savedScrollHeightRef.current;
      savedScrollHeightRef.current = 0;
      return;
    }

    if (isInitialLoadRef.current && messages.length > 0) {
      el.scrollTop = el.scrollHeight;
      isInitialLoadRef.current = false;
      return;
    }

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 150) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  // Intersection Observer fires fetchNextPage when the top sentinel enters view.
  // Re-creates when hasNextPage or isFetchingNextPage change so the guard
  // condition inside always reflects current state.
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container || !hasNextPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root: container, threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">No messages yet. Say hello!</p>
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="flex flex-col gap-0 p-4 overflow-y-auto h-full">

      {/* Sentinel — scrolling to the top triggers upward pagination */}
      <div ref={topSentinelRef} className="h-px shrink-0" />

      {isFetchingNextPage && (
        <div className="flex justify-center py-2 shrink-0">
          <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
        </div>
      )}

      {messages.map((message, index) => {
        const isOwn = message.sender === currentUserId;
        const prev = index > 0 ? messages[index - 1] : null;

        // Grouped: same sender and sent within 60 seconds of the previous bubble.
        // Grouped bubbles skip the avatar and get tighter vertical spacing.
        const isGrouped =
          prev !== null &&
          prev.sender === message.sender &&
          new Date(message.timeSent).getTime() - new Date(prev.timeSent).getTime() < 60_000;

        return (
          <MessageBubble
            key={message.clientMessageId}
            message={message}
            isOwn={isOwn}
            isGrouped={isGrouped}
          />
        );
      })}
    </div>
  );
}

// ── MessageBubble ──────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isGrouped: boolean;
}

function MessageBubble({ message, isOwn, isGrouped }: MessageBubbleProps) {
  return (
    <div
      className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${
        isGrouped ? 'mt-0.5' : 'mt-2'
      }`}
    >
      {/* Avatar column — always rendered for inbound messages to preserve alignment.
          Empty when grouped so the bubble stays left-aligned with the one above it. */}
      {!isOwn && (
        <div className="w-7 h-7 shrink-0">
          {!isGrouped && (
            message.senderAvatar ? (
              <img
                src={message.senderAvatar}
                alt={message.senderName}
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-400 flex items-center justify-center text-white text-xs font-semibold">
                {message.senderName.charAt(0).toUpperCase()}
              </div>
            )
          )}
        </div>
      )}

      <div
        className={[
          'px-3 py-2 rounded-2xl text-sm max-w-xs lg:max-w-md wrap-break-word',
          isOwn
            ? 'bg-blue-500 text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-900 rounded-bl-sm',
          message.status === 'failed'  ? 'opacity-50' : '',
          message.status === 'sending' ? 'opacity-70' : '',
        ].join(' ')}
      >
        {message.deletedAt ? (
          <span className="italic text-xs opacity-60">This message was deleted</span>
        ) : (
          message.content
        )}
      </div>
    </div>
  );
}
