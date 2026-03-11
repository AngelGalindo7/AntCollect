import { useConversationStore } from '../store/conversationStore';
import { useMessageStore } from '../store/messageStore';
import type { WebSocketFrame } from '../types';


type SendReadAck = (conversationId: string, messageId: string) => void;

export function useSocketFrameHandler(sendReadAck: SendReadAck) {
  function handleFrame(payload: WebSocketFrame) {
    const convStore = useConversationStore.getState();
    const msgStore = useMessageStore.getState();

    switch (payload.type) {
      case 'NEW_MESSAGE': {
        const isActive =
          msgStore.activeConversationId === payload.message.conversationId;

        convStore.upsertConversation(payload.conversationPreview);

        if (isActive) {
          msgStore.appendMessage(
            payload.message.conversationId,
            payload.message
          );
          if (payload.message.messageId) {
            sendReadAck(
              payload.message.conversationId,
              payload.message.messageId
            );
          }
        } else {
          convStore.incrementUnread(payload.message.conversationId);
        }
        break;
      }

      case 'MESSAGE_ACK': {
        msgStore.updateMessage(payload.conversationId, payload.clientMessageId, {
          messageId: payload.messageId,
          timeSent: payload.timeSent,
          status: 'sent',
        });
        break;
      }

      case 'MESSAGE_FAILED': {
        msgStore.updateMessage(payload.conversationId, payload.clientMessageId, {
          status: 'failed',
        });
        break;
      }

      case 'MESSAGE_DELIVERED': {
        msgStore.updateMessage(payload.conversationId, payload.clientMessageId, {
          status: 'delivered',
        });
        break;
      }

      case 'MESSAGE_READ': {
        msgStore.updateMessage(payload.conversationId, payload.clientMessageId, {
          status: 'read',
        });
        break;
      }

      case 'SYNC_RESPONSE': {
        payload.unreadCounts.forEach(({ conversationId, count }) => {
          const existing = convStore.conversations.find(
            (c) => c.conversationId === conversationId
          );
          if (existing) {
            convStore.upsertConversation({ ...existing, unreadCount: count });
          }
        });
        break;
      }

      default:
        break;
    }
  }

  return { handleFrame };
}
