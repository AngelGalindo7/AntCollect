package com.petrcollect.messaging.conversation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Repository for {@link Conversation}.
 *
 * <p>Standard {@link JpaRepository} methods cover all current use cases:
 * <ul>
 *   <li>{@code findById(Long id)} — load a conversation for auth checks and updates.</li>
 *   <li>{@code save(Conversation)} — persist a new conversation or update
 *       {@code lastMessage} / {@code lastActivityAt} after a message is sent.</li>
 * </ul>
 *
 * <p>No custom queries are needed at this stage. Add them here as requirements grow
 * (e.g. listing a user's conversations sorted by {@code last_activity_at}).
 */
@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    // No custom queries yet — findById is sufficient for current service logic.
}
