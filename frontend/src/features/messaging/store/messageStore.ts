import { create } from 'zustand';
import type { Message } from '../types';

interface MessageStore {
  messagesByConversation: Record<string, Message[]>;
  activeConversationId: string | null;

  setActiveConversation: (id: string | null) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  appendMessage: (conversationId: string, message: Message) => void;
  prependMessages: (conversationId: string, messages: Message[]) => void;
  updateMessage: (
    conversationId: string,
    clientMessageId: string,
    updates: Partial<Message>
  ) => void;
}

export const useMessageStore = create<MessageStore>((set) => ({
  messagesByConversation: {},
  activeConversationId: null,

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: messages,
      },
    })),

  appendMessage: (conversationId, message) =>
    set((state) => {
      const existing = state.messagesByConversation[conversationId] ?? [];
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: [...existing, message],
        },
      };
    }),

  // Prepend older messages when loading history (scroll up)
  prependMessages: (conversationId, messages) =>
    set((state) => {
      const existing = state.messagesByConversation[conversationId] ?? [];
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: [...messages, ...existing],
        },
      };
    }),

  updateMessage: (conversationId, clientMessageId, updates) =>
    set((state) => {
      const messages = state.messagesByConversation[conversationId] ?? [];
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: messages.map((m) =>
            m.clientMessageId === clientMessageId ? { ...m, ...updates } : m
          ),
        },
      };
    }),
}));
