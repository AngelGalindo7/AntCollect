import { create } from 'zustand';
import type { Conversation } from '../types';

interface ConversationStore {
  conversations: Conversation[];
  totalUnread: number;

  setConversations: (conversations: Conversation[]) => void;
  upsertConversation: (conversation: Conversation) => void;
  incrementUnread: (conversationId: string) => void;
  markConversationRead: (conversationId: string) => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  conversations: [],
  totalUnread: 0,

  setConversations: (conversations) =>
    set({
      conversations,
      totalUnread: conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    }),

  upsertConversation: (conversation) =>
    set((state) => {
      const exists = state.conversations.find(
        (c) => c.conversationId === conversation.conversationId
      );
      const updated = exists
        ? state.conversations.map((c) =>
            c.conversationId === conversation.conversationId ? conversation : c
          )
        : [conversation, ...state.conversations];

      // Re-sort by lastActivityAt DESC after upsert
      updated.sort(
        (a, b) =>
          new Date(b.lastActivityAt).getTime() -
          new Date(a.lastActivityAt).getTime()
      );

      return {
        conversations: updated,
        totalUnread: updated.reduce((sum, c) => sum + c.unreadCount, 0),
      };
    }),

  incrementUnread: (conversationId) =>
    set((state) => {
      const updated = state.conversations.map((c) =>
        c.conversationId === conversationId
          ? { ...c, unreadCount: c.unreadCount + 1 }
          : c
      );
      return {
        conversations: updated,
        totalUnread: updated.reduce((sum, c) => sum + c.unreadCount, 0),
      };
    }),

  markConversationRead: (conversationId) =>
    set((state) => {
      const updated = state.conversations.map((c) =>
        c.conversationId === conversationId ? { ...c, unreadCount: 0 } : c
      );
      return {
        conversations: updated,
        totalUnread: updated.reduce((sum, c) => sum + c.unreadCount, 0),
      };
    }),
}));

export function useUnreadCount() {
  return useConversationStore((s) => s.totalUnread);
}
