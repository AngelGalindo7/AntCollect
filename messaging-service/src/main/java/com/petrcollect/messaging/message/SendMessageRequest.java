package com.petrcollect.messaging.message;

import java.util.UUID;

public record SendMessageRequest(
        UUID clientMessageId,
        Long conversationId,
        String content,
        Message.ContentType contentType
) {}
