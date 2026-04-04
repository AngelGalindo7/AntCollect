import { useConversationStore } from '../store/conversationStore';
import { useMessageStore } from '../store/messageStore';
import type { AckPayload, EventPayload, Message } from '../types';


type SendReadAck = (conversationId: string, messageId: string) => void;

export function useSocketFrameHandler(sendReadAck: SendReadAck) {
        
    
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
      msgStore.updateMessage(
        payload.message.conversationId,
        payload.clientMessageId,
        {
          messageId: String(payload.message.messageId),
          timeSent: payload.message.timeSent,
          status: 'sent',
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

  return { handleInboundMessage, handleAck, handleEvent };
}
