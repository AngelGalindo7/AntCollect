import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMessageStore } from '../store/messageStore';
import { useConversationStore } from '../store/conversationStore';
import { useWebSocketContext } from '@/features/messaging/providers/WebSocketProvider'; // adjust if path differs
import { useMessages } from '../hooks/useMessages';
import { fetchWithAuth } from '@/shared/api/api';
import type { Conversation } from '../types';
import ChatHeader from '../components/Chat/ChatHeader';
import MessageList from '../components/Chat/MessageList';
import ChatInput from '../components/Chat/ChatInput/ChatInput';

const API_BASE = import.meta.env.VITE_API_URL;

export default function ChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();

  // Safe string for hooks — hooks can't be called conditionally so we need a
  // fallback value. The `enabled: !!conversationId` guards prevent fetching
  // with an empty string. The hard guard at the bottom handles the null case.
  const safeId = conversationId ?? '';

  // ── Store actions only — never store state here ────────────────────────────
  // Pulling state (e.g. messagesByConversation) in ChatPage would mean this
  // component re-renders on every message. State lives in the child components.
  const setActiveConversation = useMessageStore((s) => s.setActiveConversation);
  const markConversationRead  = useConversationStore((s) => s.markConversationRead);
  const upsertConversation    = useConversationStore((s) => s.upsertConversation);
  const { sendReadAck }       = useWebSocketContext();

  // ── Message history ────────────────────────────────────────────────────────
  // useMessages fetches from the API and seeds the Zustand store.
  // We only use the returned flat array here to find the last ackable messageId.
  // MessageList reads from the store directly.
  const {
    messages,
    isLoading: messagesLoading,
    isError:   messagesError,
    refetch:   refetchMessages,
  } = useMessages(safeId);

  // ── Conversation metadata ──────────────────────────────────────────────────
  // Fetched explicitly so direct URL access (/messages/abc123) works even
  // when conversationStore is empty (fresh page load, no sidebar fetch yet).
  // staleTime: 5 min — name and avatar don't change mid-session.
  const { data: conversationData, isLoading: convLoading } = useQuery<Conversation>({
    queryKey: ['conversation', safeId],
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_BASE}/conversations/${safeId}`);
      if (!res.ok) throw new Error('Failed to fetch conversation');
      return res.json();
    },
    enabled: !!conversationId,
    staleTime: 5 * 60 * 1000,
  });

  // Sync into store so sidebar reflects latest name/avatar
  useEffect(() => {
    if (conversationData) upsertConversation(conversationData);
  }, [conversationData, upsertConversation]);

  // ── Active conversation registration ──────────────────────────────────────
  // This is the flag useSocketFrameHandler reads to decide:
  //   "Is the user currently looking at this conversation?"
  //   YES → appendMessage (visible in list)
  //   NO  → incrementUnread (badge on sidebar)
  //
  // Cleanup on unmount clears it so navigating away stops messages from
  // being appended to a list the user is no longer looking at.
  //
  // conversationId in deps: handles navigating directly from one chat to
  // another without unmounting ChatPage — React runs cleanup then re-registers.
  useEffect(() => {
    if (!conversationId) return;
    setActiveConversation(conversationId);
    return () => setActiveConversation(null);
  }, [conversationId, setActiveConversation]);

  // ── Unread badge reset ─────────────────────────────────────────────────────
  // Zeroes the red badge in the sidebar the instant the page mounts.
  // This is local UI only — sendReadAck (below) handles telling the server.
  // We do both because:
  //   markConversationRead = instant visual feedback, no network needed
  //   sendReadAck          = tells backend + other clients which msg was seen
  useEffect(() => {
    if (!conversationId) return;
    markConversationRead(conversationId);
  }, [conversationId, markConversationRead]);

  // ── Read acknowledgement with Page Visibility API ─────────────────────────
  // We want to send a read ack when BOTH are true:
  //   1. Messages have loaded (we have a real messageId to ack)
  //   2. The tab is actually visible (user is looking at it)
  //
  // WHY a ref instead of putting messages in a useEffect dep array?
  // If we did: useEffect(() => { sendReadAck(...) }, [messages])
  // it would fire on EVERY new message append — including live WebSocket msgs.
  // useSocketFrameHandler already acks those. We only want to ack once on
  // initial load, and again when the user tabs back in.
  //
  // The ref pattern:
  //   tryAckRef.current is reassigned on every render (synchronously, not
  //   inside useEffect) so it always has the latest messages and conversationId.
  //   The event listeners call tryAckRef.current() and always get the fresh version.
  //   No stale closures, no re-registering listeners on every message.
  const tryAckRef = useRef<() => void>(() => {});

  // Reassigned synchronously every render — keeps the ref fresh
  tryAckRef.current = () => {
    if (!conversationId) return;

    // Find the latest message with a real server-assigned messageId.
    // Optimistic messages (status: 'sending') have messageId: null —
    // sending an ack for null would be a protocol error.
    const lastAckable = [...messages]
      .reverse()
      .find((m) => m.messageId !== null);

    if (document.visibilityState === 'visible' && lastAckable?.messageId) {
      sendReadAck(conversationId, lastAckable.messageId);
    }
  };

  // Fire once when messages first load (empty → has messages transition)
  const hasMessages = messages.length > 0;
  useEffect(() => {
    if (hasMessages) tryAckRef.current();
    // tryAckRef is intentionally omitted — it's a ref (stable object), not state.
    // hasMessages is the only signal we care about: did messages just appear?
  }, [hasMessages]);

  // Re-ack when user returns to this tab after being away.
  // Registered once on mount, never re-registered.
  useEffect(() => {
    const handler = () => tryAckRef.current();
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // ── Guard — all hooks called above, safe to early-return now ──────────────
  if (!conversationId) {
    navigate('/');
    return null;
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const isLoading    = messagesLoading || convLoading;
  const currentUserId = localStorage.getItem('userId') ?? '';

  const displayName = conversationData?.isGroup
    ? (conversationData.groupName ?? 'Group')
    : (conversationData?.participantName ?? '');

  const displayAvatar = conversationData?.isGroup
    ? (conversationData.groupAvatar ?? '')
    : (conversationData?.participantAvatar ?? '');

  // ── Render ─────────────────────────────────────────────────────────────────
  // Column flex filling whatever height the Layout gives us.
  // overflow-hidden on the wrapper is critical — without it, flex-1 on the
  // middle section has no bounded height to grow against and the layout collapses.
  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">

      <ChatHeader
        conversationId={conversationId}
        isGroup={conversationData?.isGroup ?? false}
        displayName={displayName}
        displayAvatar={displayAvatar}
        participantId={conversationData?.participantId}
        onBack={() => navigate('/')}
        isLoading={convLoading}
      />

      {/* Takes all space between header and input */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <MessageSkeleton />
        ) : messagesError ? (
          <MessageError onRetry={refetchMessages} />
        ) : (
          <MessageList
            conversationId={conversationId}
            currentUserId={currentUserId}
          />
        )}
      </div>

      <ChatInput
        conversationId={conversationId}
        currentUserId={currentUserId}
      />
    </div>
  );
}

// ── MessageSkeleton ────────────────────────────────────────────────────────────
// Ghost bubbles that mirror real message layout. Alternating alignment so the
// user's brain maps the skeleton to the content that's about to appear.
// Widths are hardcoded constants — never Math.random() which would produce
// different values each render and cause visible flicker.
const SKELETON_ITEMS = [
  { isOwn: false, width: 'w-2/3' },
  { isOwn: true,  width: 'w-1/2' },
  { isOwn: false, width: 'w-3/5' },
  { isOwn: true,  width: 'w-2/5' },
  { isOwn: false, width: 'w-1/2' },
] as const;

function MessageSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 h-full justify-end">
      {/* justify-end so skeletons appear at the bottom — matching where real
          messages sit before the list fills up */}
      {SKELETON_ITEMS.map((item, i) => (
        <div
          key={i}
          className={`flex items-end gap-2 ${item.isOwn ? 'flex-row-reverse' : 'flex-row'}`}
        >
          {!item.isOwn && (
            <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
          )}
          <div className={`h-9 rounded-2xl bg-gray-200 animate-pulse ${item.width}`} />
        </div>
      ))}
    </div>
  );
}

// ── MessageError ───────────────────────────────────────────────────────────────
// onRetry calls TanStack Query's refetch — reruns the queryFn and clears isError
// on success. No manual error state to reset.
function MessageError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
      <p className="text-sm text-gray-500">
        Something went wrong loading messages.
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
