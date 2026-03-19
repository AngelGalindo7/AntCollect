package com.petrcollect.messaging.message;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    /**
     * Cursor-based pagination — returns up to {@code pageable.getPageSize()} messages
     * in a conversation whose messageId is strictly less than {@code cursor},
     * ordered newest-first.
     *
     * <p>Call with {@code PageRequest.of(0, 50)}.
     * The service layer should reverse the returned list before sending to the client
     * so the client renders messages in oldest-first display order.
     */
    @Query("""
            SELECT m FROM Message m
            WHERE m.conversation.id = :conversationId
              AND m.messageId < :cursor
              AND m.deletedAt IS NULL
            ORDER BY m.messageId DESC
            """)
    Page<Message> findPageBefore(@Param("conversationId") Long conversationId,
                                 @Param("cursor") Long cursor,
                                 Pageable pageable);

    /**
     * Counts messages in a conversation that the given user has not yet read.
     */
    @Query("""
            SELECT COUNT(m) FROM Message m
            WHERE m.conversation.id = :conversationId
              AND m.messageId > :lastReadMessageId
              AND m.sender != :userId
              AND m.deletedAt IS NULL
            """)
    long countUnread(@Param("conversationId") Long conversationId,
                     @Param("lastReadMessageId") Long lastReadMessageId,
                     @Param("userId") Long userId);

    /**
     * Idempotency / deduplication check.
     */
    Optional<Message> findByClientMessageIdAndSender(UUID clientMessageId, Long sender);
}
