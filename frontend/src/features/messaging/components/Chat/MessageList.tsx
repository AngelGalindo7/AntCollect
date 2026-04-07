import { useRef, useEffect, useLayoutEffect } from 'react';
import { useMessageStore } from '../../store/messageStore';
import { useConversationStore } from '../../store/conversationStore';
import type { Message, MessageStatus } from '../../types';
import PostEmbedCard from './PostEmbedCard';

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
  const typingUser = useConversationStore(
    (s) => s.typingUsers[conversationId] ?? null
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);

  const savedScrollHeightRef = useRef(0);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (isFetchingNextPage) {
      savedScrollHeightRef.current = scrollContainerRef.current?.scrollHeight ?? 0;
    }
  }, [isFetchingNextPage]);

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

  // Scroll to bottom when typing indicator appears so it's always visible.
  useLayoutEffect(() => {
    if (!typingUser) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 200) el.scrollTop = el.scrollHeight;
  }, [typingUser]);

  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container || !hasNextPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage();
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

      <div ref={topSentinelRef} className="h-px shrink-0" />

      {isFetchingNextPage && (
        <div className="flex justify-center py-2 shrink-0">
          <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin" />
        </div>
      )}

      {messages.map((message, index) => {
        const isOwn = message.sender === currentUserId;
        const prev = index > 0 ? messages[index - 1] : null;

        const isGrouped =
          prev !== null &&
          prev.sender === message.sender &&
          new Date(message.timeSent).getTime() - new Date(prev.timeSent).getTime() < 60_000;

        const prevDateStr = prev ? toDateString(prev.timeSent) : null;
        const thisDateStr = toDateString(message.timeSent);
        const showDateSeparator = prevDateStr !== thisDateStr;

        return (
          <div key={message.clientMessageId}>
            {showDateSeparator && <DateSeparator isoDate={message.timeSent} />}
            <MessageBubble
              message={message}
              isOwn={isOwn}
              isGrouped={isGrouped}
            />
          </div>
        );
      })}

      {typingUser && <TypingIndicator username={typingUser} />}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toDateString(iso: string) {
  return new Date(iso).toDateString();
}

function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

// ── DateSeparator ──────────────────────────────────────────────────────────────

function DateSeparator({ isoDate }: { isoDate: string }) {
  return (
    <div className="flex items-center gap-3 my-3 shrink-0">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs text-gray-400 font-medium">{formatDateLabel(isoDate)}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

// ── DeliveryIcon ───────────────────────────────────────────────────────────────
// Single check = sent, double check = delivered, blue double = read.

function DeliveryIcon({ status }: { status: MessageStatus }) {
  if (status === 'sending' || status === 'failed') return null;

  if (status === 'read') {
    return (
      <svg className="w-3.5 h-3.5 text-blue-300 shrink-0" fill="currentColor" viewBox="0 0 16 16">
        <path d="M1 8.5l3.5 3.5 6.5-7M5 8.5l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="1.2" fill="none" />
      </svg>
    );
  }

  if (status === 'delivered') {
    return (
      <svg className="w-3.5 h-3.5 text-white/60 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 16 16">
        <path d="M1 8.5l3.5 3.5 6.5-7M5 8.5l3.5 3.5 6.5-7" />
      </svg>
    );
  }

  // sent
  return (
    <svg className="w-3.5 h-3.5 text-white/60 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 16 16">
      <path d="M2 8l4 4 8-8" />
    </svg>
  );
}

// ── TypingIndicator ────────────────────────────────────────────────────────────

function TypingIndicator({ username }: { username: string }) {
  return (
    <div className="flex items-end gap-2 mt-2 shrink-0">
      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-semibold shrink-0">
        {username.charAt(0).toUpperCase()}
      </div>
      <div className="flex items-center gap-1 bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2">
        <span className="text-[10px] text-gray-400 mr-1">{username} is typing</span>
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
      </div>
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
  const time = new Date(message.timeSent).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${
        isGrouped ? 'mt-0.5' : 'mt-2'
      }`}
    >
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

      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-xs lg:max-w-md`}>
        <div
          className={[
            'px-3 py-2 rounded-2xl text-sm wrap-break-word',
            isOwn
              ? 'bg-blue-500 text-white rounded-br-sm'
              : 'bg-gray-100 text-gray-900 rounded-bl-sm',
            message.status === 'failed'  ? 'opacity-50' : '',
            message.status === 'sending' ? 'opacity-70' : '',
          ].join(' ')}
        >
          {message.deletedAt ? (
            <span className="italic text-xs opacity-60">This message was deleted</span>
          ) : message.contentType === 'post_reference' || message.contentType === 'trade_context' ? (
            <PostEmbedCard content={message.content} contentType={message.contentType} isOwn={isOwn} />
          ) : (
            message.content
          )}
        </div>

        {/* Timestamp + delivery status */}
        <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] text-gray-400">{time}</span>
          {isOwn && <DeliveryIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}
