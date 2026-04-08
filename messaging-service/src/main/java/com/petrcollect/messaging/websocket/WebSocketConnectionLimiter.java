package com.petrcollect.messaging.websocket;

import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Tracks open WebSocket connections per authenticated userId and enforces a
 * per-user ceiling.
 *
 * <p>In-memory only. Suitable for a single EC2 instance (free tier). If this
 * service ever scales horizontally, replace with a Redis-backed counter
 * (e.g. Redisson) to share state across instances.
 */
@Component
public class WebSocketConnectionLimiter {

    private static final int MAX_CONNECTIONS_PER_USER = 3;

    private final ConcurrentHashMap<Long, AtomicInteger> connectionCounts =
            new ConcurrentHashMap<>();

    /**
     * Attempts to register a new connection for {@code userId}.
     *
     * @return {@code true} if the connection is allowed; {@code false} if the
     *         per-user ceiling has been reached
     */
    public boolean tryConnect(Long userId) {
        AtomicInteger count = connectionCounts.computeIfAbsent(userId, id -> new AtomicInteger(0));
        int updated = count.incrementAndGet();
        if (updated > MAX_CONNECTIONS_PER_USER) {
            count.decrementAndGet();
            return false;
        }
        return true;
    }

    /**
     * Decrements the connection count for {@code userId} on disconnect.
     * Never goes below zero.
     */
    public void disconnect(Long userId) {
        AtomicInteger count = connectionCounts.get(userId);
        if (count != null) {
            int updated = count.decrementAndGet();
            if (updated <= 0) {
                connectionCounts.remove(userId);
            }
        }
    }
}
