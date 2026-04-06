import { useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { useConversationStore } from '../store/conversationStore';
import { useMessageStore } from '../store/messageStore';
import type { AckPayload, EventPayload, Message } from '../types';

// Mirrors MessagesPage in useMessages.ts — kept local to avoid a circular import.
interface MessagesPage {
  messages: Message[];
  nextCursor: string | null;
}


type SendReadAck = (conversationId: string, messageId: string) => void;

export function useSocketFrameHandler(sendReadAck: SendReadAck) {
  const queryClient = useQueryClient();

  // Appends a message to the TanStack Query cache for a conversation so that
  // navigation within staleTime still shows the latest messages.
  function appendToCache(conversationId: string, message: Message) {
    queryClient.setQueryData<InfiniteData<MessagesPage>>(
      ['messages', conversationId],
      (old) => {
        if (!old?.pages?.length) return old;
        const pages = [...old.pages];
        pages[0] = { ...pages[0], messages: [...pages[0].messages, message] };
        return { ...old, pages };
      }
    );
  }

  function handleInboundMessage(payload: { message: Message }) {
    const convStore = useConversationStore.getState();
    const msgStore = useMessageStore.getState();
    const isActive = msgStore.activeConversationId === payload.message.conversationId;

    const existing = convStore.conversations.find(
      c => c.conversationId === payload.message.conversationId
    );
    if (existing) {
      convStore.upsertConversation({
        ...existing,
        lastMessage: {
          content: payload.message.content,
          contentType: payload.message.contentType,
          senderName: payload.message.senderName,
          timeSent: payload.message.timeSent,
        },
        lastActivityAt: payload.message.timeSent,
      });
    }

    // Always sync the cache so navigation within staleTime shows this message.
    appendToCache(payload.message.conversationId, payload.message);

    if (isActive) {
      // Append to open conversation
      msgStore.appendMessage(payload.message.conversationId, payload.message);
      // Send read ack since user is looking at it
      if (payload.message.messageId) {
        sendReadAck(payload.message.conversationId, payload.message.messageId);
      }
    } else {
      convStore.incrementUnread(payload.message.conversationId);
    }
  }

  function handleAck(payload: AckPayload) {
    if (!payload.clientMessageId) return;
    const msgStore = useMessageStore.getState();

    if (payload.status === 'ok' && payload.message) {
      // Update the optimistic message in Zustand with the confirmed server version.
      msgStore.updateMessage(
        payload.message.conversationId,
        payload.clientMessageId,
        {
          messageId: String(payload.message.messageId),
          timeSent: payload.message.timeSent,
          status: 'sent',
        }
      );

      // Sync the confirmed message into the TanStack cache.
      // The optimistic message was never in the cache, only in Zustand.
      // Adding it here ensures navigation within staleTime doesn't lose it.
      const confirmedMessage: Message = {
        ...payload.message,
        messageId: String(payload.message.messageId),
        clientMessageId: payload.clientMessageId,
        status: 'sent',
      };
      queryClient.setQueryData<InfiniteData<MessagesPage>>(
        ['messages', payload.message.conversationId],
        (old) => {
          if (!old?.pages?.length) return old;
          // Skip if already in cache (e.g. duplicate ack).
          const alreadyPresent = old.pages.some((page) =>
            page.messages.some((m) => m.clientMessageId === payload.clientMessageId)
          );
          if (alreadyPresent) return old;
          const pages = [...old.pages];
          pages[0] = { ...pages[0], messages: [...pages[0].messages, confirmedMessage] };
          return { ...old, pages };
        }
      );
    } else {
      const allMessages = Object.entries(msgStore.messagesByConversation);
      for (const [conversationId, messages] of allMessages) {
        const match = messages.find(
          (m) => m.clientMessageId === payload.clientMessageId
        );
        if (match) {
          msgStore.updateMessage(conversationId, payload.clientMessageId, {
            status: 'failed',
          });
          break;
        }
      }
    }
  }

  function handleEvent(payload: EventPayload) {
    const msgStore = useMessageStore.getState();
    switch (payload.type) {
      case 'EDIT': {
        const conversationId = String(payload.message.conversationId);
        msgStore.updateMessage(conversationId, payload.message.clientMessageId, {
          content: payload.message.content,
          editedAt: payload.message.editedAt,
        });
        break;
      }

      case 'DELETE': {
        const allMessages = Object.entries(msgStore.messagesByConversation);
        for (const [conversationId, messages] of allMessages) {
          const match = messages.find(
            (m) => m.messageId === String(payload.messageId)
          );
          if (match) {
            msgStore.updateMessage(conversationId, match.clientMessageId, {
              deletedAt: new Date().toISOString(),
            });
            break;
          }
        }
        break;
      }

      case 'READ': {
        const allMessages = Object.entries(msgStore.messagesByConversation);
        for (const [conversationId, messages] of allMessages) {
          const match = messages.find(
            (m) => m.messageId === String(payload.messageId)
          );
          if (match) {
            msgStore.updateMessage(conversationId, match.clientMessageId, {
              status: 'read',
            });
            break;
          }
        }
        break;
      }
    }
  }

  function handleTyping(payload: { conversationId: string; userId: string; username: string }) {
    const currentUserId = localStorage.getItem('userId');
    // Don't show the indicator for the current user's own typing events.
    if (payload.userId === currentUserId) return;
    useConversationStore.getState().setTyping(payload.conversationId, payload.username);
  }

  return { handleInboundMessage, handleAck, handleEvent, handleTyping };
}
