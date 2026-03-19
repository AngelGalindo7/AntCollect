package com.petrcollect.messaging.conversation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationParticipantRepository
        extends JpaRepository<ConversationParticipant, ConversationParticipant.ParticipantId> {

    
    List<ConversationParticipant> findByConversation_IdAndIsActiveTrue(Long conversationId);
    Optional<ConversationParticipant> findByConversation_IdAndId_UserId(Long conversationId, Long userId);

      @Query("""
            SELECT cp FROM ConversationParticipant cp
            WHERE cp.id.userId = :userId
              AND cp.isActive = true
            """)
    List<ConversationParticipant> findActiveConversationsForUser(@Param("userId") Long userId);

  @Query("""
        SELECT cp1.conversation.id
        FROM ConversationParticipant cp1
        JOIN ConversationParticipant cp2
          ON cp1.conversation.id = cp2.conversation.id
        WHERE cp1.id.userId = :userId1
          AND cp2.id.userId = :userId2
          AND cp1.isActive = true
          AND cp2.isActive = true
          AND cp1.conversation.isGroup = false
        """)
Optional<Long> findDirectConversationByParticipants(
        @Param("userId1") Long userId1,
        @Param("userId2") Long userId2);
}
