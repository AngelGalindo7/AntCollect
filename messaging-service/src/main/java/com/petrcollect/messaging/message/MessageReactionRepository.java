package com.petrcollect.messaging.message;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageReactionRepository extends JpaRepository<MessageReaction, Long> {

    /**
     * Returns all reactions on a message.
     *
     * <p>Typically called when loading a conversation page so the client can render
     * reaction counts/emoji beneath each message bubble. The DB unique constraint on
     * {@code (message_id, user_id, reaction)} prevents duplicates at the storage level,
     * but de-duplication is not a concern here — just fetch and return.
     *
     * @param messageId the snowflake messageId of the target message
     * @return all {@link MessageReaction} rows for this message, unordered
     */
    List<MessageReaction> findByMessage_MessageId(Long messageId);
}
