package com.petrcollect.messaging.conversation;

import com.petrcollect.messaging.message.Message;
import com.petrcollect.messaging.message.MessageHistoryResponse;
import com.petrcollect.messaging.message.MessageRepository;
import com.petrcollect.messaging.message.MessageResponse;
import com.petrcollect.messaging.user.User;
import com.petrcollect.messaging.user.UserRepository;
import com.petrcollect.messaging.common.exception.ConversationAlreadyExistsException;

import jakarta.persistence.EntityNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.Optional;

@Service
@Transactional
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final ConversationParticipantRepository participantRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;


    public ConversationService(ConversationRepository conversationRepository,
                               ConversationParticipantRepository participantRepository,
                               MessageRepository messageRepository,
                               UserRepository userRepository) {

        this.conversationRepository = conversationRepository;
        this.participantRepository = participantRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
    }


      public Conversation createConversation(List<Long> userIds,
                                           boolean isGroup,
                                           String groupName,
                                           Long currentUserId) {
       
        /*for (Long userId : userIds) {
            ConversationParticipant.ParticipantId pk =
                    new ConversationParticipant.ParticipantId(saved.getId(), userId);

            ConversationParticipant participant = new ConversationParticipant();
            participant.setId(pk);
            participant.setConversation(saved);
            participant.setActive(true);
            participant.setJoinedAt(OffsetDateTime.now());
            // role left null — valid for DM participants per schema design
            participantRepository.save(participant);
        }*/
        List<Long> allUserIds = userIds.contains(currentUserId)
                ? userIds
                : new java.util.ArrayList<>(userIds) {{ add(currentUserId); }};
        if (!isGroup && allUserIds.size() == 2) {
        Long otherUserId = allUserIds.stream()
                .filter(id -> !id.equals(currentUserId))
                .findFirst()
                .orElseThrow();

        Optional<Long> existing = participantRepository
                .findDirectConversationByParticipants(currentUserId, otherUserId);

        if (existing.isPresent()) {
            throw new ConversationAlreadyExistsException(existing.get());
        }
    }

       Conversation conversation = new Conversation();
        conversation.setGroup(isGroup);
        conversation.setGroupName(groupName);
        // @PrePersist sets createdAt and lastActivityAt automatically
        Conversation saved = conversationRepository.save(conversation);

        List<ConversationParticipant> participants = allUserIds.stream()
                .map(userId -> {
                    ConversationParticipant.ParticipantId pk =
                            new ConversationParticipant.ParticipantId(saved.getId(), userId);
                    ConversationParticipant participant = new ConversationParticipant();
                    participant.setId(pk);
                    participant.setConversation(saved);
                    participant.setActive(true);
                    participant.setJoinedAt(OffsetDateTime.now());
                    return participant;
                })
                .toList();

        participantRepository.saveAll(participants);

        return saved;
    }

    @Transactional(readOnly = true)
    public List<ConversationResponse> getConversationsForUser(Long currentUserId) {
        List<ConversationParticipant> participations =
                participantRepository.findActiveConversationsForUser(currentUserId);

        // Collect all userIds across all conversations in one shot
        // to avoid N+1 profile lookups
        List<Long> allUserIds = participations.stream()
                .flatMap(p -> participantRepository
                        .findByConversation_IdAndIsActiveTrue(p.getConversation().getId())
                        .stream()
                        .map(cp -> cp.getId().getUserId()))
                .distinct()
                .toList();

        Map<Long, User> profileMap = userRepository
                .findAllByIdIn(allUserIds)
                .stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        return participations.stream()
                .map(p -> buildResponse(p, currentUserId, profileMap))
                .toList();
    }

    @Transactional(readOnly = true)
    public ConversationResponse getConversationForUser(Long conversationId, Long currentUserId) {
        ConversationParticipant myParticipation = participantRepository
                .findByConversation_IdAndId_UserId(conversationId, currentUserId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "User " + currentUserId + " is not a member of conversation " + conversationId));

        // Load profiles for all participants in this conversation
        List<Long> participantUserIds = participantRepository
                .findByConversation_IdAndIsActiveTrue(conversationId)
                .stream()
                .map(p -> p.getId().getUserId())
                .toList();

        Map<Long, User> profileMap = userRepository
                .findAllByIdIn(participantUserIds)
                .stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        return buildResponse(myParticipation, currentUserId, profileMap);
    }
    

    @Transactional(readOnly = true)
    public MessageHistoryResponse getMessageHistory(Long conversationId,
                                                    String cursorParam,
                                                    int limit,
                                                    Long currentUserId) {
        // Security check — user must be an active participant
        validateParticipant(conversationId, currentUserId);

        // Parse cursor: null on first load → use MAX_VALUE to get most recent
        Long cursor = (cursorParam != null) ? Long.parseLong(cursorParam) : Long.MAX_VALUE;

        Page<Message> page = messageRepository.findPageBefore(
                conversationId,
                cursor,
                PageRequest.of(0, limit)
        );

        List<Message> messages = page.getContent();

        // Batch load all sender profiles in one query — avoids N+1
        List<Long> senderIds = messages.stream()
                .map(Message::getSender)
                .distinct()
                .toList();

        Map<Long, User> profileMap = userRepository
                .findAllByIdIn(senderIds)
                .stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        // Reverse: repo returns newest-first, client needs oldest-first
       
         List<Message> reversed = new java.util.ArrayList<>(messages);
java.util.Collections.reverse(reversed);
List<MessageResponse> responseMessages = reversed.stream()
        .map(m -> toMessageResponse(m, profileMap))
        .toList();


        // If we got a full page, there are likely more messages older than this batch.
        // The oldest message in this batch (first after reversing = last before reversing)
        // becomes the cursor the client sends on its next request.
        String nextCursor = (messages.size() == limit)
                ? String.valueOf(messages.get(messages.size() -1).getMessageId())
                : null;

        return new MessageHistoryResponse(responseMessages, nextCursor);
    }

    // ── toMessageResponse ─────────────────────────────────────────────────────
    // Maps a Message entity to the DTO the frontend expects.
    // Called per-message during getMessageHistory — profileMap is pre-loaded
    // by the caller so this method never triggers additional DB queries.
    private MessageResponse toMessageResponse(Message m, Map<Long, User> profileMap) {
        User sender = profileMap.get(m.getSender());
        String senderName   = sender != null ? sender.getUsername()   : "Unknown";
        String senderAvatar = sender != null ? sender.getAvatarPath() : null;

        // Map replyTo if present
        MessageResponse.ReplyPreview replyPreview = null;
        if (m.getReplyTo() != null) {
            Message replied = m.getReplyTo();
            User replySender = profileMap.get(replied.getSender());
            replyPreview = new MessageResponse.ReplyPreview(
                    String.valueOf(replied.getMessageId()),
                    replySender != null ? replySender.getUsername() : "Unknown",
                    replied.getContent(),
                    replied.getContentType().name().toLowerCase()
            );
        }

        return new MessageResponse(
                m.getClientMessageId().toString(),
                String.valueOf(m.getMessageId()),
                String.valueOf(m.getConversation().getId()),
                String.valueOf(m.getSender()),
                senderName,
                senderAvatar,
                m.getContent(),
                m.getContentType().name().toLowerCase(),
                m.getTimeSent().toString(),
                m.getEditedAt() != null ? m.getEditedAt().toString() : null,
                replyPreview,
                null,    // deletedAt — query excludes deleted messages (Phase 9)
                "sent"   // status — historical msgs are always "sent" from history perspective
        );
    }
    private ConversationResponse buildResponse(ConversationParticipant myParticipation,
                                                Long currentUserId,
                                                Map<Long, User> profileMap) {
        Conversation c = myParticipation.getConversation();

        // Other participant for DMs
        ConversationParticipant otherParticipant = participantRepository
                .findByConversation_IdAndIsActiveTrue(c.getId())
                .stream()
                .filter(p -> !p.getId().getUserId().equals(currentUserId))
                .findFirst()
                .orElse(null);

        String participantId = null;
        String participantName = null;
        String participantAvatar = null;

        if (!c.isGroup() && otherParticipant != null) {
            Long otherId = otherParticipant.getId().getUserId();
            User profile = profileMap.get(otherId);
            participantId = String.valueOf(otherId);
            participantName = profile != null ? profile.getUsername() : "Unknown";
            participantAvatar = profile != null ? profile.getAvatarPath() : null;
        }

        // Unread count
        Long lastReadId = myParticipation.getLastReadMessage() != null
                ? myParticipation.getLastReadMessage().getMessageId()
                : 0L;
        long unreadCount = messageRepository.countUnread(c.getId(), lastReadId, currentUserId);

        // Last message preview
        ConversationResponse.LastMessagePreview lastMessagePreview = null;
        if (c.getLastMessage() != null) {
            var lastMsg = c.getLastMessage();
            User senderProfile = profileMap.get(lastMsg.getSender());
            String senderName = senderProfile != null ? senderProfile.getUsername() : "Unknown";
            lastMessagePreview = new ConversationResponse.LastMessagePreview(
                    lastMsg.getContent(),
                    lastMsg.getContentType().name().toLowerCase(),
                    senderName,
                    lastMsg.getTimeSent().toString()
            );
        }

        return new ConversationResponse(
                String.valueOf(c.getId()),
                c.isGroup(),
                c.getGroupName(),
                c.getGroupAvatar(),
                participantId,
                participantName,
                participantAvatar,
                lastMessagePreview,
                c.getLastActivityAt().toString(),
                (int) unreadCount,
                lastReadId > 0 ? String.valueOf(lastReadId) : null,
                false // isMuted — column doesn't exist yet, hardcoded until you add it
        );
    } 

    /**
     * Verifies that a user is an active member of a conversation.
     * Throws EntityNotFoundException if the user is not a member or has left.
     * Called by MessageService before allowing a send.
     *
     * @param conversationId the conversation to check
     * @param userId         the user to verify
     * @return the participant record (useful for reading lastReadMessage)
     */
    @Transactional(readOnly = true)
    public ConversationParticipant validateParticipant(Long conversationId, Long userId) {
        ConversationParticipant participant = participantRepository
                .findByConversation_IdAndId_UserId(conversationId, userId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "User " + userId + " is not a member of conversation " + conversationId
                ));

        if (!participant.isActive()) {
            throw new EntityNotFoundException(
                    "User " + userId + " has left conversation " + conversationId
            );
        }
 
        return participant;
    }
}
