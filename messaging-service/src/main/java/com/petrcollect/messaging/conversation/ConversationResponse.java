package com.petrcollect.messaging.conversation;

import com.petrcollect.messaging.message.Message;
import java.time.OffsetDateTime;

public record ConversationResponse(
        String conversationId,
        boolean isGroup,
        String groupName,
        String groupAvatar,
        String participantId,
        String participantName,
        String participantAvatar,
        LastMessagePreview lastMessage,
        String lastActivityAt,
        int unreadCount,
        String lastReadMessageId,
        boolean isMuted
) {
    public record LastMessagePreview(
            String content,
            String contentType,
            String senderName,
            String timeSent
    ) {}
}
