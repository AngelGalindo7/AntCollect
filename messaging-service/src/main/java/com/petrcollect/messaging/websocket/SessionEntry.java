package com.petrcollect.messaging.websocket;

import org.springframework.web.socket.WebSocketSession;

/**
 * Immutable snapshot of a user's active WebSocket session.
 *
 * registeredAt is captured at the moment of registration via
 * System.currentTimeMillis(). SessionRegistry.remove() compares
 * this value before evicting — if a new session has already been
 * registered for the same user, the timestamps won't match and
 * the stale cleanup task will skip eviction safely.
 */
public final class SessionEntry {

    private final String sessionId;
    private final long registeredAt;

    public SessionEntry(String sessionId, long registeredAt) {
        this.sessionId = sessionId;
        this.registeredAt = registeredAt;
    }

    public String getSessionId()  { return sessionId; }
    public long getRegisteredAt()         { return registeredAt; }
}
