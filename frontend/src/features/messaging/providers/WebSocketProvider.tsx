import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import type { ReactNode } from 'react';
import { Client } from '@stomp/stompjs';
import { useSocketFrameHandler } from '../hooks/useSocketFrameHandler';
import { toast } from '@/shared/feedback/toastStore';

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8080/ws";

interface WebSocketContextValue {
  sendMessage: (conversationId: string, content: string, clientMessageId: string, contentType?: string) => void;
  sendTyping: (conversationId: string) => void;
  sendReadAck: (conversationId: string, messageId: string) => void;
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

  

  
  // Guard every publish with clientRef.current?.connected — optional chaining alone
  // only prevents calling publish on null. If the client is activated but the
  // WebSocket handshake hasn't completed yet (e.g. cold refresh), publish throws
  // "There is no underlying STOMP connection" which propagates through React's
  // effect scheduler and gets caught by the error boundary.
  const sendReadAck = useCallback((conversationId: string, messageId: string) => {
    if (!clientRef.current?.connected) return;
    try {
      clientRef.current.publish({
        destination: '/app/read',
        body: JSON.stringify({ conversationId, messageId }),
      });
    } catch (err) {
      console.warn('[WS] publish failed — connection not ready:', err);
    }
  }, []);

  
  const handlers = useSocketFrameHandler(sendReadAck);
  const handlersRef = useRef(handlers);

  useEffect(() => { handlersRef.current = handlers; });
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
            handlersRef.current.handleInboundMessage(JSON.parse(frame.body));
          } catch {
            console.error('[WS] Failed to parse frame', frame.body);
          }
        });
        client.subscribe('/user/queue/ack', (frame) => {
          try {
        handlersRef.current.handleAck(JSON.parse(frame.body));
          } catch {
            console.error('[WS] Failed to parse ack frame', frame.body);
          }
        });

        client.subscribe('/user/queue/events', (frame) => {
          try {
            const payload = JSON.parse(frame.body);
            if (payload.type === 'TYPING') {
              handlersRef.current.handleTyping(payload);
            } else {
              handlersRef.current.handleEvent(payload);
            }
          } catch {
            console.error('[WS] Failed to parse event frame', frame.body);
          }
        });

        client.subscribe('/user/queue/trade-events', (frame) => {
          try {
            handlersRef.current.handleTradeEvent(JSON.parse(frame.body));
          } catch {
            console.error('[WS] Failed to parse trade event frame', frame.body);
          }
        });
      },

      onDisconnect: () => {
        console.log('[WS] Disconnected');
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
    contentType: string = 'text',
  ) => {
    if (!clientRef.current?.connected) return;
    try {
      clientRef.current.publish({
        destination: '/app/send',
        body: JSON.stringify({ clientMessageId, conversationId, content, contentType }),
      });
    } catch (err) {
      console.warn('[WS] publish failed — connection not ready:', err);
      toast.error('Message could not be sent. Please try again.');
    }
  }, []);

  const sendTyping = useCallback((conversationId: string) => {
    if (!clientRef.current?.connected) return;
    try {
      clientRef.current.publish({
        destination: '/app/typing',
        body: JSON.stringify({ conversationId }),
      });
    } catch (err) {
      console.warn('[WS] publish failed — connection not ready:', err);
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{ sendMessage, sendTyping, sendReadAck }}>
      {children}
    </WebSocketContext.Provider>
  );
}
