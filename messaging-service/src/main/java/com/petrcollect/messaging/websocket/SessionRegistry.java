package com.petrcollect.messaging.websocket;

import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory registry of active WebSocket sessions, keyed by userId.
 */
@Component
public class SessionRegistry {

    private final ConcurrentHashMap<Long, SessionEntry> sessions = new ConcurrentHashMap<>();

    /**
     * Registers a new WebSocket session for the given user.
     */
    public void register(Long userId, String sessionId) {
        sessions.put(userId, new SessionEntry(sessionId, System.currentTimeMillis()));
    }

    /**
     * Removes the session for a user ONLY if the stored registeredAt matches
     * the provided timestamp.
     *
     */
    public void remove(Long userId, long registeredAt) {
        sessions.computeIfPresent(userId, (id, entry) ->
                entry.getRegisteredAt() == registeredAt ? null : entry
        );
    }

    /**
     * Returns the live WebSocketSession for a user, if they are online.
     */
    /*public Optional<WebSocketSession> getSession(Long userId) {
        SessionEntry entry = sessions.get(userId);
        return entry != null ? Optional.of(entry.getSession()) : Optional.empty();
    }*/

    /**
     * Returns true if the user currently has an active session registered.
     */
    public boolean isOnline(Long userId) {
        return sessions.containsKey(userId);
    }

    /**
     * Returns the set of all currently online userIds.
     */
    public Set<Long> getOnlineUserIds() {
        return sessions.keySet();
    }
}
