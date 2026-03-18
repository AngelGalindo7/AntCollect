// IMPORTANT: All IDs are BIGINT snowflakes from the backend.
// JavaScript cannot safely represent 64-bit integers as number — always string.

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type ContentType = 'text' | 'image' | 'video' | 'audio' | 'file';

export interface LastMessagePreview {
  content: string;
  contentType: ContentType;
  senderName: string;
  timeSent: string;
}

export interface MessageReplyPreview {
  messageId: string;
  senderName: string;
  content: string;
  contentType: ContentType;
}

export interface Conversation {
  conversationId: string;
  participantId: string;
  isGroup: boolean;
  groupName: string | null;
  groupAvatar: string | null;
  participantName: string;
  participantAvatar: string;
  lastMessage: LastMessagePreview | null;
  lastActivityAt: string;
  unreadCount: number;
  lastReadMessageId: string | null;
  isMuted: boolean;
}

export interface Message {
  clientMessageId: string;
  messageId: string | null; // null until MESSAGE_ACK received
  conversationId: string;
  sender: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  contentType: ContentType;
  timeSent: string;
  editedAt: string | null;
  replyTo: MessageReplyPreview | null;
  deletedAt: string | null;
  status: MessageStatus;
}


export interface AckPayload {
  status: 'ok' | 'error';
  clientMessageId: string;
  message: Message | null;
  error: string | null;
}

export type EventPayload =
  | { type: 'EDIT';   messageId: string; message: Message }
  | { type: 'DELETE'; messageId: string }
  | { type: 'READ';   messageId: string; readByUserId: string };


export type WebSocketFrame =
  | { type: 'NEW_MESSAGE'; message: Message; conversationPreview: Conversation }
  | { type: 'MESSAGE_ACK'; clientMessageId: string; messageId: string; conversationId: string; timeSent: string }
  | { type: 'MESSAGE_FAILED'; clientMessageId: string; conversationId: string; reason: string }
  | { type: 'MESSAGE_DELIVERED'; clientMessageId: string; conversationId: string }
  | { type: 'MESSAGE_READ'; clientMessageId: string; conversationId: string }
  | { type: 'TYPING'; conversationId: string; userId: string; username: string }
  | { type: 'SYNC_RESPONSE'; unreadCounts: Array<{ conversationId: string; count: number }> };
