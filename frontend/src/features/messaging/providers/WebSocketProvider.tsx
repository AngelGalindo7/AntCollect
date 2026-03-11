import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { Client } from '@stomp/stompjs';
import { useConversationStore } from '../store/conversationStore';
import { useSocketFrameHandler } from '../hooks/useSocketFrameHandler';
import type { WebSocketFrame } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL;

interface WebSocketContextValue {
  sendMessage: (conversationId: string, content: string, clientMessageId: string) => void;
  sendTyping: (conversationId: string) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function useWebSocketContext() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWebSocketContext must be used inside WebSocketProvider');
  return ctx;
}

interface WebSocketProviderProps {
 
  isAuthenticated: boolean;
  children: ReactNode;
}

export function WebSocketProvider({ isAuthenticated, children }: WebSocketProviderProps) {
  const clientRef = useRef<Client | null>(null);

  

  
  const sendReadAck = useCallback((conversationId: string, messageId: string) => {
    clientRef.current?.publish({
      destination: '/app/read',
      body: JSON.stringify({ conversationId, messageId }),
    });
  }, []); 
  const { handleFrame } = useSocketFrameHandler(sendReadAck);

  const handleFrameRef = useRef(handleFrame);
  //const sendReadAckRef = useRef(sendReadAck);
  useEffect(() => { handleFrameRef.current = handleFrame; });
  //useEffect(() => { sendReadAckRef.current = sendReadAck; });
  useEffect(() => {

    if (!isAuthenticated) return;

    const client = new Client({
      brokerURL: WS_URL,

      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      reconnectDelay: 5_000,

      onConnect: () => {
        console.log("Connected")
        client.subscribe('/user/queue/messages', (frame) => {
          try {
            const payload: WebSocketFrame = JSON.parse(frame.body);
            handleFrameRef.current(payload);
          } catch {
            console.error('[WS] Failed to parse frame', frame.body);
          }
        });

           sendSyncPayload(client);
      },

      onDisconnect: () => {
      },

      onStompError: (frame) => {
        console.error('[WS] STOMP error', frame);
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
    };
  }, [isAuthenticated]); 
  
  const sendMessage = useCallback((
    conversationId: string,
    content: string,
    clientMessageId: string,
  ) => {
    clientRef.current?.publish({
      destination: '/app/send',
      body: JSON.stringify({ clientMessageId, conversationId, content, contentType: 'text' }),
    });
  }, []);

  const sendTyping = useCallback((conversationId: string) => {
    clientRef.current?.publish({
      destination: '/app/typing',
      body: JSON.stringify({ conversationId }),
    });
  }, []);

  return (
    <WebSocketContext.Provider value={{ sendMessage, sendTyping }}>
      {children}
    </WebSocketContext.Provider>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * After (re)connecting, ask the server to reconcile unread counts for all
 * conversations since our last read message. The backend responds with a
 * SYNC_RESPONSE frame handled in useSocketFrameHandler.
 */
function sendSyncPayload(client: Client) {
  const { conversations } = useConversationStore.getState();
  client.publish({
    destination: '/app/sync',
    body: JSON.stringify({
      conversations: conversations.map((c) => ({
        conversationId: c.conversationId,
        lastReadMessageId: c.lastReadMessageId,
      })),
    }),
  });
}
