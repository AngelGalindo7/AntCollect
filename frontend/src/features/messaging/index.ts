// Public API for features/messaging
// app/ and shared/ must only import from this file — never from internals.

export { WebSocketProvider, useWebSocketContext } from './providers/WebSocketProvider';
export { UnreadMessageBadge } from './components/UnreadMessageBadge';

export type {
  Conversation,
  Message,
  MessageStatus,
  ContentType,
  WebSocketFrame,
} from './types';

// Selector hook — AuthenticatedLayout calls this and passes the number as a
// prop to NavBar. NavBar imports nothing from features/messaging.
export { useUnreadCount } from './store/conversationStore';

