package com.petrcollect.messaging.message;

import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
//import org.springframework.messaging.Message;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
//import org.springframework.messaging.support.SimpMessageHeadAccessor;
import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import com.petrcollect.messaging.conversation.ConversationParticipant;
import com.petrcollect.messaging.conversation.ConversationParticipantRepository;
import com.petrcollect.messaging.websocket.SessionRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Handles inbound STOMP frames from WebSocket clients.
 *
 * <p>Each connected user gets a dedicated single-thread executor so that
 * messages from the same user are processed strictly in order, without
 * blocking or interleaving with other users' tasks.
 *
 * <p>WebSocket authentication (userId extraction) is handled upstream by
 * JwtHandshakeInterceptor, which stores the userId in the session attributes
 * map before this handler sees any frames.
 */
@Controller
public class MessageWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(MessageWebSocketHandler.class);

    // ── Destinations ──────────────────────────────────────────────────────────
    /** Sender-only queue: ack confirming the message was persisted. */
    private static final String DEST_ACK = "/queue/ack";
    /** Per-user queue: inbound messages from other participants. */
    private static final String DEST_MESSAGES = "/queue/messages";
    /** Per-user queue: edit/delete/read-receipt events. */
    private static final String DEST_EVENTS = "/queue/events";

    // ── Injected dependencies ─────────────────────────────────────────────────
    private final MessageService messageService;
    private final SessionRegistry sessionRegistry;
    private final ConversationParticipantRepository participantRepository;
    private final SimpMessagingTemplate messaging;

    /**
     * Per-session state: executor + userId + registeredAt timestamp.
     * Keyed by STOMP session ID (not userId) so a user can reconnect
     * and get a fresh entry without evicting the old one prematurely.
     */
    private final ConcurrentHashMap<String, SessionState> sessionStates =
            new ConcurrentHashMap<>();

    public MessageWebSocketHandler(MessageService messageService,
                                   SessionRegistry sessionRegistry,
                                   ConversationParticipantRepository participantRepository,
                                   SimpMessagingTemplate messaging) {
        this.messageService = messageService;
        this.sessionRegistry = sessionRegistry;
        this.participantRepository = participantRepository;
        this.messaging = messaging;
    }

    // ── Lifecycle events ──────────────────────────────────────────────────────

    /**
     * Fires after the STOMP CONNECT frame is fully processed and the session
     * is considered active.
     *
     * <p>Extracts the userId placed in session attributes by JwtHandshakeInterceptor,
     * registers the user as online in SessionRegistry, and creates their dedicated
     * single-thread executor.
     */
    @EventListener
    public void onConnected(SessionConnectedEvent event) {
        //BUG StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        //StompHeaderAccessor accessor = StompHeaderAccessor
         //   .getAccessor(event.getMessage(), StompHeaderAccessor.class);
        
        
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        org.springframework.messaging.Message<?> connectMessage = 
        (org.springframework.messaging.Message<?>) accessor.getHeader(SimpMessageHeaderAccessor.CONNECT_MESSAGE_HEADER);

    // SessionConnectedEvent wraps a CONNECT_ACK — session attributes
    // live in the original CONNECT message nested inside it
         // SimpMessageHeaderAccessor connectHeader = SimpMessageHeaderAccessor
         //   .getAccessor(
          //      (Message<?>) accessor.getHeader(SimpMessageHeaderAccessor.CONNECT_MESSAGE_HEADER),
          //      SimpMessageHeaderAccessor.class
          //  );
          SimpMessageHeaderAccessor connectHeader = SimpMessageHeaderAccessor.getAccessor(
            connectMessage, 
            SimpMessageHeaderAccessor.class
    );

    Map<String, Object> attrs = connectHeader != null
            ? connectHeader.getSessionAttributes()
            : accessor.getSessionAttributes();


        Long userId   = attrs != null ? (Long) attrs.get("userId") : null;
        //Long userId = extractUserId(accessor);
        String sessionId = accessor.getSessionId();

        if (userId == null || sessionId == null) {
            log.warn("SessionConnectedEvent missing userId or sessionId — skipping registration");
            return;
        }

        long registeredAt = System.currentTimeMillis();

        // Register as online — overwrites any stale entry for this userId
        sessionRegistry.register(userId, sessionId); // session handle not needed by registry for STOMP

        ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "ws-user-" + userId);
            t.setDaemon(true);
            return t;
        });

        sessionStates.put(sessionId, new SessionState(userId, executor, registeredAt));
        log.debug("WebSocket connected: userId={} sessionId={}", userId, sessionId);
    }

    /**
     * Fires when the WebSocket connection is closed (client disconnect, timeout, or error).
     *
     * <p>Removes the user from SessionRegistry using the captured registeredAt timestamp
     * to avoid evicting a newer session opened by the same user (reconnect race).
     * Gracefully shuts down the executor — inflight tasks are drained before termination.
     */
    @EventListener
    public void onDisconnected(SessionDisconnectEvent event) {
        //BUG StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        StompHeaderAccessor accessor = StompHeaderAccessor
            .getAccessor(event.getMessage(), StompHeaderAccessor.class);
        //String sessionId = accessor.getSessionId();
        String sessionId = accessor != null ? accessor.getSessionId() : null;
        SessionState state = sessionStates.remove(sessionId);
        if (state == null) return;

        // Guarded remove — only evicts if registeredAt still matches
        sessionRegistry.remove(state.userId(), state.registeredAt());

        // Drain the queue — do NOT call shutdownNow()
        state.executor().shutdown();
        log.debug("WebSocket disconnected: userId={} sessionId={}", state.userId(), sessionId);
    }

    // ── STOMP message handlers ────────────────────────────────────────────────

    /**
     * Handles /app/send — client wants to persist a new message.
     *
     * <p>Flow:
     * <ol>
     *   <li>Submit to the sender's executor (preserves per-user ordering).</li>
     *   <li>On success: ack the sender, fan-out to online participants.</li>
     *   <li>On duplicate (idempotency hit): ack the sender with the existing message.</li>
     * </ol>
     */
    @MessageMapping("/send")
    public void handleSend(@Payload SendMessageRequest req, Principal principal) {
        log.info("handleSend called - principal={} req={}", principal, req);

        Long senderId = extractUserId(principal);
        log.info("senderId resolved to: {}", senderId);
        SessionState state = getState(senderId);
        if (state == null) return;

        state.executor().submit(() -> {
            try {
                Message saved = messageService.sendMessage(req, senderId);
                // Ack back to sender
                messaging.convertAndSendToUser(
                        senderId.toString(), DEST_ACK,
                        AckPayload.success(req.clientMessageId(), saved)
                );
                // Fan-out to all online participants except the sender
                fanOutToParticipants(req.conversationId(), senderId,
                        DEST_MESSAGES, saved);

            } catch (MessageService.DuplicateMessageException dup) {
                // Idempotent retry — return existing message, same shape as success
                messaging.convertAndSendToUser(
                        senderId.toString(), DEST_ACK,
                        AckPayload.success(req.clientMessageId(), dup.getExisting())
                );
            } catch (Exception e) {
                log.error("sendMessage failed for userId={}", senderId, e);
                messaging.convertAndSendToUser(
                        senderId.toString(), DEST_ACK,
                        AckPayload.error(req.clientMessageId(), e.getMessage())
                );
            }
        });
    }

    /**
     * Handles /app/edit — client wants to update a message's content.
     *
     * <p>Broadcasts the updated message to online participants so their UI
     * reflects the edit without a refresh.
     */
    @MessageMapping("/edit")
    public void handleEdit(@Payload EditMessageRequest req, Principal principal) {
        Long userId = extractUserId(principal);
        SessionState state = getState(userId);
        if (state == null) return;

        state.executor().submit(() -> {
            try {
                Message updated = messageService.editMessage(
                        req.messageIdAsLong(), req.newContent(), userId);

                EventPayload event = EventPayload.edit(updated);
                fanOutToParticipants(req.conversationId(), null, DEST_EVENTS, event);

            } catch (Exception e) {
                log.error("editMessage failed for userId={}", userId, e);
            }
        });
    }

    /**
     * Handles /app/delete — client soft-deletes a message.
     *
     * <p>Broadcasts a tombstone event so online participants remove or grey-out
     * the message in their UI immediately.
     */
    @MessageMapping("/delete")
    public void handleDelete(@Payload DeleteMessageRequest req, Principal principal) {
        Long userId = extractUserId(principal);
        SessionState state = getState(userId);
        if (state == null) return;

        state.executor().submit(() -> {
            try {
                messageService.deleteMessage(req.messageIdAsLong(), userId);

                EventPayload tombstone = EventPayload.delete(req.messageIdAsLong());
                fanOutToParticipants(req.conversationId(), null, DEST_EVENTS, tombstone);

            } catch (Exception e) {
                log.error("deleteMessage failed for userId={}", userId, e);
            }
        });
    }

    /**
     * Handles /app/read — client signals the user has read up to a message.
     *
     * <p>Notifies the original sender (if online) so they can render a
     * read receipt in the UI.
     */
    @MessageMapping("/read")
    public void handleRead(@Payload ReadReceiptRequest req, Principal principal) {
        Long userId = extractUserId(principal);
        SessionState state = getState(userId);
        if (state == null) return;

        state.executor().submit(() -> {
            try {
                messageService.markRead(req.messageIdAsLong(), userId, req.conversationId());

                // Notify the original sender if they are online
                Long senderId = loadSenderId(req.messageIdAsLong());
                if (senderId != null && sessionRegistry.isOnline(senderId)) {
                    messaging.convertAndSendToUser(
                            senderId.toString(), DEST_EVENTS,
                            EventPayload.readReceipt(req.messageIdAsLong(), userId)
                    );
                }

            } catch (Exception e) {
                log.error("markRead failed for userId={}", userId, e);
            }
        });
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Sends {@code payload} to every active participant in a conversation who
     * is currently online, optionally skipping one userId (typically the sender).
     *
     * @param conversationId the conversation whose participants receive the push
     * @param excludeUserId  userId to skip — pass null to include everyone
     * @param destination    STOMP user-destination suffix (e.g. /queue/messages)
     * @param payload        the object to serialise and send
     */
    private void fanOutToParticipants(Long conversationId,
                                      Long excludeUserId,
                                      String destination,
                                      Object payload) {
        List<ConversationParticipant> participants =
                participantRepository.findByConversation_IdAndIsActiveTrue(conversationId);

        for (ConversationParticipant participant : participants) {
            Long recipientId = participant.getId().getUserId();
            if (recipientId.equals(excludeUserId)) continue;
            if (!sessionRegistry.isOnline(recipientId)) continue;

            messaging.convertAndSendToUser(
                    recipientId.toString(), destination, payload);
        }
    }

    /** Extracts userId from the STOMP session attributes (set by JwtHandshakeInterceptor). */
    private Long extractUserId(StompHeaderAccessor accessor) {
        if (accessor == null) return null;
        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs == null) return null;
        return (Long) attrs.get("userId");
    }

    /** Extracts userId from the STOMP Principal (set by JwtHandshakeInterceptor). */
    private Long extractUserId(Principal principal) {
        if (principal == null) return null;
        return Long.parseLong(principal.getName());
    }

    /** Returns the SessionState for a user, logging a warning if it is missing. */
    private SessionState getState(Long userId) {
        return sessionStates.values().stream()
                .filter(s -> s.userId().equals(userId))
                .findFirst()
                .orElse(null);
    }

    /** Loads the sender of a message — used for read-receipt routing. */
    private Long loadSenderId(Long messageId) {
        return messageService.getSenderIdForMessage(messageId);
    }

    // ── Nested types ──────────────────────────────────────────────────────────

    /**
     * Immutable per-session state bundle.
     *
     * @param userId       authenticated user who owns this session
     * @param executor     single-thread executor for ordered message processing
     * @param registeredAt epoch-ms timestamp captured on connect (used for guarded remove)
     */
    private record SessionState(Long userId,
                                 ExecutorService executor,
                                 long registeredAt) {}

    /** Outbound ack payload sent to the sender after a send attempt. */
    public record AckPayload(String status,
                              java.util.UUID clientMessageId,
                              Message message,
                              String error) {
        static AckPayload success(java.util.UUID clientMessageId, Message message) {
            return new AckPayload("ok", clientMessageId, message, null);
        }

        static AckPayload error(java.util.UUID clientMessageId, String error) {
            return new AckPayload("error", clientMessageId, null, error);
        }
    }

    /** Outbound event payload for edit / delete / read-receipt broadcasts. */
    public record EventPayload(String type,
                                Long messageId,
                                Message message,
                                Long readByUserId) {
        static EventPayload edit(Message message) {
            return new EventPayload("EDIT", message.getMessageId(), message, null);
        }

        static EventPayload delete(Long messageId) {
            return new EventPayload("DELETE", messageId, null, null);
        }

        static EventPayload readReceipt(Long messageId, Long readByUserId) {
            return new EventPayload("READ", messageId, null, readByUserId);
        }
    }

    // ── Inbound request records ───────────────────────────────────────────────

    public record EditMessageRequest(String messageId, Long conversationId, String newContent) {
      public Long messageIdAsLong() { return Long.parseLong(messageId); }
    }
    public record DeleteMessageRequest(String messageId, Long conversationId) {
      public Long messageIdAsLong() { return Long.parseLong(messageId); }
    }
    public record ReadReceiptRequest(String messageId, Long conversationId) {
      public Long messageIdAsLong() { return Long.parseLong(messageId); }
    }
}
