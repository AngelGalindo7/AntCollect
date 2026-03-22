import { useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchWithAuth } from '@/shared/api/api';
import { useMessageStore } from '../store/messageStore';
import type { Message } from '../types';

const API_BASE = import.meta.env.VITE_API_URL;

// ── Response shape from GET /conversations/:id/messages ───────────────────────
// Matches MessageHistoryResponse.java exactly.
// messages: ordered oldest → newest (backend reversed the DB result for us)
// nextCursor: the oldest messageId in this batch — null means beginning of chat
interface MessagesPage {
  messages: Message[];
  nextCursor: string | null;
}

export interface UseMessagesReturn {
  messages: Message[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}

export function useMessages(conversationId: string): UseMessagesReturn {
  // Pull only the setter — not the full store state.
  // If we subscribed to messagesByConversation here, this hook would re-render
  // on every single message append, including live WebSocket messages.
  // We're a writer here, not a reader. MessageList is the reader.
  const setMessages = useMessageStore((s) => s.setMessages);

  const query = useInfiniteQuery<MessagesPage>({
    queryKey: ['messages', conversationId],

    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '50' });

      // pageParam is null on the first fetch (no cursor = get most recent 50).
      // On subsequent fetches (scroll up), it's the nextCursor string from the
      // previous page — the backend interprets it as "give me messages older than this".
      if (pageParam) {
        params.set('cursor', pageParam as string);
      }

      const res = await fetchWithAuth(
        `${API_BASE}/conversations/${conversationId}/messages?${params.toString()}`
      );

      if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);
      return res.json() as Promise<MessagesPage>;
    },

    // TanStack Query v5 requires this explicitly — it's the pageParam value
    // used for the very first fetch. null = no cursor = load most recent.
    initialPageParam: null as string | null,

    // Called after each page fetch to determine if there's a next page.
    // Returning undefined (not null!) tells TanStack "no more pages exist".
    // Returning the cursor string enables fetchNextPage() for Phase 8.
    //
    // "next page" = "older messages" — each call goes further back in history.
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,

    enabled: !!conversationId,
  });

  // ── Seed Zustand on data change (TanStack v5 — no onSuccess callback) ───────
  //
  // WHY seed Zustand at all?
  // The WebSocket frame handler writes live messages directly into Zustand.
  // MessageList reads from Zustand. For both sources (HTTP history + WebSocket)
  // to appear in the same list, HTTP history must also write into Zustand.
  // TanStack's cache is used for fetching/caching only — not for rendering.
  //
  // WHY reverse pages before flatMapping?
  // data.pages is ordered by insertion time:
  //   pages[0] = first fetch (50 most recent messages)
  //   pages[1] = second fetch after scrolling up (50 messages older than pages[0])
  // Reversing puts older pages first, giving us chronological order overall.
  // Each page is already internally sorted oldest→newest by the backend.
  // For Phase 1 there's only ever pages[0], so reverse() is a no-op here.
  // It's written this way so Phase 8 pagination works without touching this file.
  const { data } = query;
  useEffect(() => {
    if (!data) return;

    const allMessages = [...data.pages]
      .reverse()
      .flatMap((page) => page.messages);

    setMessages(conversationId, allMessages);
  }, [data, conversationId, setMessages]);

  // Flat array returned to ChatPage for finding the last ackable messageId on mount.
  // MessageList does NOT use this — it reads from the store directly.
  const messages = data
    ? [...data.pages].reverse().flatMap((page) => page.messages)
    : [];

  return {
    messages,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage ?? false,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
