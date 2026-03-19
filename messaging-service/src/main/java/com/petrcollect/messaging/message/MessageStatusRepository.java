package com.petrcollect.messaging.message;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageStatusRepository extends JpaRepository<MessageStatus, Long> {

    /**
     * Returns all per-recipient status records for a message.
     *
     * Used when the server pushes a status update to the sender — e.g. checking
     * whether all recipients have delivered or read a message in a group context.

     */
    List<MessageStatus> findByMessage_MessageId(Long messageId);

    /**
     * Returns the status record for a specific (message, user) pair.
     *
     * Used to upsert delivery/read state: if a row exists, update its {@code status};
     * otherwise create a new one. The service handles the upsert logic.
     */
    Optional<MessageStatus> findByMessage_MessageIdAndUserId(Long messageId, Long userId);
}
