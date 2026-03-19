package com.petrcollect.messaging.message;

import com.petrcollect.messaging.common.snowflake.SnowflakeIdGenerator;
import com.petrcollect.messaging.conversation.Conversation;
import com.petrcollect.messaging.conversation.ConversationParticipant;
import com.petrcollect.messaging.conversation.ConversationParticipantRepository;
import com.petrcollect.messaging.conversation.ConversationRepository;
import com.petrcollect.messaging.websocket.SessionRegistry;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Service
public class MessageService {

    private final MessageRepository messageRepository;
    private final MessageStatusRepository messageStatusRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationParticipantRepository participantRepository;
    private final SessionRegistry sessionRegistry;
    private final SnowflakeIdGenerator snowflakeIdGenerator;

    public MessageService(MessageRepository messageRepository,
                          MessageStatusRepository messageStatusRepository,
                          ConversationRepository conversationRepository,
                          ConversationParticipantRepository participantRepository,
                          SessionRegistry sessionRegistry,
                          SnowflakeIdGenerator snowflakeIdGenerator) {
        this.messageRepository = messageRepository;
        this.messageStatusRepository = messageStatusRepository;
        this.conversationRepository = conversationRepository;
        this.participantRepository = participantRepository;
        this.sessionRegistry = sessionRegistry;
        this.snowflakeIdGenerator = snowflakeIdGenerator;
    }

    /**
     * Sends a new message to a conversation.
     *
     * <p>Idempotent — if a message with the same (clientMessageId, senderId) already
     * exists the existing row is returned without re-inserting, making it safe for
     * clients to retry on network failure.
     *
     * <p>Flow:
     * <ol>
     *   <li>Idempotency check — return early if duplicate.</li>
     *   <li>Validate sender is an active participant.</li>
     *   <li>Assign snowflake ID and timestamp, persist message.</li>
     *   <li>Update conversation.lastMessage and lastActivityAt.</li>
     *   <li>Create a SENT MessageStatus for every active participant.</li>
     * </ol>
     *
     * @param req      the inbound send request (clientMessageId, conversationId, content)
     * @param senderId the authenticated user sending the message
     * @return the persisted {@link Message}
     */
    @Transactional
    public Message sendMessage(SendMessageRequest req, Long senderId) {

        // ── 1. Idempotency check ─────────────────────────────────────────────
        UUID clientMessageId = req.clientMessageId();
        if (clientMessageId != null) {
            messageRepository
                    .findByClientMessageIdAndSender(clientMessageId, senderId)
                    .ifPresent(existing -> {
                        throw new DuplicateMessageException(existing);
                    });
        }

        // ── 2. Validate sender is an active participant ───────────────────────
        ConversationParticipant senderParticipant = participantRepository
                .findByConversation_IdAndId_UserId(req.conversationId(), senderId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "User " + senderId + " is not a member of conversation " + req.conversationId()
                ));

        if (!senderParticipant.isActive()) {
            throw new EntityNotFoundException(
                    "User " + senderId + " has left conversation " + req.conversationId()
            );
        }

        Conversation conversation = conversationRepository
                .findById(req.conversationId())
                .orElseThrow(() -> new EntityNotFoundException(
                        "Conversation " + req.conversationId() + " not found"
                ));

        // ── 3. Build and persist the message ─────────────────────────────────
        Message message = new Message();
        message.setMessageId(snowflakeIdGenerator.next());
        message.setConversation(conversation);
        message.setSender(senderId);
        message.setContent(req.content());
        message.setClientMessageId(clientMessageId);
        message.setTimeSent(OffsetDateTime.now());
        message.setContentType(req.contentType());

        Message saved = messageRepository.save(message);

        // ── 4. Update conversation metadata ──────────────────────────────────
        conversation.setLastMessage(saved);
        conversation.setLastActivityAt(OffsetDateTime.now());
        conversationRepository.save(conversation);

        // ── 5. Create SENT MessageStatus for every active participant ─────────
        List<ConversationParticipant> activeParticipants =
                participantRepository.findByConversation_IdAndIsActiveTrue(req.conversationId());

        List<MessageStatus> statuses = activeParticipants.stream()
                .map(participant -> {
                    MessageStatus status = new MessageStatus();
                    status.setMessage(saved);
                    status.setUserId(participant.getId().getUserId());
                    status.setStatus(MessageStatus.Status.sent);
                    return status;
                })
                .toList();

        messageStatusRepository.saveAll(statuses);

        return saved;
    }

    /**
     * Edits the content of an existing message.
     *
     * <p>Only the original sender may edit. Soft-deleted messages cannot be edited.
     *
     * @param messageId  the snowflake ID of the message to edit
     * @param newContent replacement content
     * @param userId     the requesting user (must be the original sender)
     * @return the updated {@link Message}
     */
    @Transactional
    public Message editMessage(Long messageId, String newContent, Long userId) {
        Message message = loadMessage(messageId);

        if (!message.getSender().equals(userId)) {
            throw new IllegalStateException(
                    "User " + userId + " is not the sender of message " + messageId
            );
        }
        if (message.isDeleted()) {
            throw new IllegalStateException(
                    "Cannot edit a deleted message: " + messageId
            );
        }

        message.setContent(newContent);
        message.setEditedAt(OffsetDateTime.now());

        return messageRepository.save(message);
    }

    /**
     * Soft-deletes a message by setting deletedAt.
     *
     * <p>Only the original sender may delete. The row is never hard-deleted —
     * deletedAt acts as the tombstone and is filtered out in queries.
     *
     * @param messageId the snowflake ID of the message to delete
     * @param userId    the requesting user (must be the original sender)
     */
    @Transactional
    public void deleteMessage(Long messageId, Long userId) {
        Message message = loadMessage(messageId);

        if (!message.getSender().equals(userId)) {
            throw new IllegalStateException(
                    "User " + userId + " is not the sender of message " + messageId
            );
        }

        message.setDeletedAt(OffsetDateTime.now());
        messageRepository.save(message);
    }

    /**
     * Advances a message's status to DELIVERED for the given recipient.
     *
     * <p>Only transitions from SENT → DELIVERED. If status is already DELIVERED
     * or READ this is a no-op, making the method safe to call multiple times.
     *
     * <p>Creates the status row if it does not yet exist (e.g. message arrived
     * while the recipient was briefly offline and status creation was delayed).
     *
     * @param messageId the snowflake ID of the target message
     * @param userId    the recipient marking delivery
     */
    @Transactional
    public void markDelivered(Long messageId, Long userId) {
        MessageStatus status = messageStatusRepository
                .findByMessage_MessageIdAndUserId(messageId, userId)
                .orElseGet(() -> {
                    Message message = loadMessage(messageId);
                    MessageStatus newStatus = new MessageStatus();
                    newStatus.setMessage(message);
                    newStatus.setUserId(userId);
                    newStatus.setStatus(MessageStatus.Status.sent);
                    return newStatus;
                });

        if (status.getStatus() == MessageStatus.Status.sent) {
            status.setStatus(MessageStatus.Status.delivered);
            messageStatusRepository.save(status);
        }
    }

    /**
     * Advances a message's status to READ for the given recipient and updates
     * the participant's lastReadMessage cursor.
     *
     * <p>Updating lastReadMessageId on the participant record drives unread
     * badge counts — {@code MessageRepository.countUnread} compares against it.
     *
     * @param messageId      the snowflake ID of the message being read
     * @param userId         the recipient marking read
     * @param conversationId the conversation the message belongs to
     */
    @Transactional
    public void markRead(Long messageId, Long userId, Long conversationId) {
        // ── Update MessageStatus ──────────────────────────────────────────────
        MessageStatus status = messageStatusRepository
                .findByMessage_MessageIdAndUserId(messageId, userId)
                .orElseGet(() -> {
                    Message message = loadMessage(messageId);
                    MessageStatus newStatus = new MessageStatus();
                    newStatus.setMessage(message);
                    newStatus.setUserId(userId);
                    newStatus.setStatus(MessageStatus.Status.sent);
                    return newStatus;
                });

        status.setStatus(MessageStatus.Status.read);
        messageStatusRepository.save(status);
        

        /*sendMessage validates the participant 
         * manually with a duplicate findByConversation_IdAndId_UserId 
         * call and active check, rather than calling ConversationService.validateParticipant() 
         * which already does exactly that. Not a bug, just duplication. You could inject ConversationService 
         * and replace those 10 lines with one call — though that creates a cross-service dependency 
         * some would argue against.
         *
         */
        // ── Advance participant's lastReadMessage cursor ───────────────────────
        participantRepository
                .findByConversation_IdAndId_UserId(conversationId, userId)
                .ifPresent(participant -> {
                    Message currentRead = participant.getLastReadMessage();
                    // Only move the cursor forward — never backwards
                    if (currentRead == null || messageId > currentRead.getMessageId()) {
                        participant.setLastReadMessage(loadMessage(messageId));
                        participantRepository.save(participant);
                    }
                });
    }

    /**
     * Fetches a page of messages before the given cursor, returned in
     * oldest-first order for client-side rendering.
     *
     * <p>The repository query returns rows newest-first (DESC); this method
     * reverses that list before returning so the client receives chronological order.
     *
     * <p>Pass {@code Long.MAX_VALUE} as the cursor for the initial load to
     * get the most recent {@code pageSize} messages.
     *
     * @param conversationId the conversation to query
     * @param cursor         exclusive upper bound on messageId
     * @param pageSize       maximum number of messages to return
     * @return messages in oldest-first (ascending) order
     */
    @Transactional(readOnly = true)
    public List<Message> getMessagesBefore(Long conversationId, Long cursor, int pageSize) {
        List<Message> newestFirst = messageRepository
                .findPageBefore(conversationId, cursor, PageRequest.of(0, pageSize))
                .getContent();

        List<Message> oldestFirst = new ArrayList<>(newestFirst);
        Collections.reverse(oldestFirst);

        return oldestFirst;
    }
    @Transactional(readOnly = true)
    public Long getSenderIdForMessage(Long messageId) {
        return messageRepository.findById(messageId)
            .map(Message::getSender)
            .orElse(null);
}

    // ── private helpers ───────────────────────────────────────────────────────

    private Message loadMessage(Long messageId) {
        return messageRepository.findById(messageId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "Message " + messageId + " not found"
                ));
    }

    // ── internal exception used for idempotency early-return ─────────────────

    /**
     * Thrown internally when a duplicate (clientMessageId, sender) pair is detected.
     * The existing message is carried as a field so the caller can return it directly.
     * This is intentionally package-private — callers should catch it at the handler layer.
     */
    static class DuplicateMessageException extends RuntimeException {
        private final Message existing;

        DuplicateMessageException(Message existing) {
            super("Duplicate message: " + existing.getClientMessageId());
            this.existing = existing;
        }

        public Message getExisting() {
            return existing;
        }
    }
}

