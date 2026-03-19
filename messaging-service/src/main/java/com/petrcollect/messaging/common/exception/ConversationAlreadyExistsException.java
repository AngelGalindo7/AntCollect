package com.petrcollect.messaging.common.exception;

public class ConversationAlreadyExistsException extends RuntimeException {
    private final Long conversationId;

    public ConversationAlreadyExistsException(Long conversationId) {
        super("Conversation already exists: " + conversationId);
        this.conversationId = conversationId;
    }

    public Long getConversationId() {
        return conversationId;
    }
}
