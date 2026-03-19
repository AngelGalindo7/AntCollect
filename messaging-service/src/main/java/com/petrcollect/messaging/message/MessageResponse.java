package com.petrcollect.messaging.message;

/**
 * DTO returned by GET /conversations/:id/messages.
 *
 * Field names and types are chosen to match the frontend Message TypeScript
 * interface exactly — camelCase, all IDs as strings (snowflakes exceed JS
 * Number.MAX_SAFE_INTEGER so they must never be serialised as JSON numbers).
 *
 * status is always "sent" for historical messages. The frontend's optimistic
 * UI only tracks "sending"/"failed" for messages the current user just sent.
 * WebSocket events (MESSAGE_READ, MESSAGE_DELIVERED) update status in real
 * time after the page loads — we don't need to recompute it here.
 */
public record MessageResponse(
        String clientMessageId,   // UUID as string
        String messageId,         // snowflake as string
        String conversationId,    // snowflake as string
        String sender,            // userId as string
        String senderName,
        String senderAvatar,
        String content,
        String contentType,       // "text" | "image" | "video" | "audio" | "file"
        String timeSent,          // ISO-8601 offset datetime string
        String editedAt,          // null if never edited
        ReplyPreview replyTo,     // null if not a reply
        String deletedAt,         // null — query excludes deleted msgs (see Phase 9 note)
        String status             // always "sent" for history

) {
    /**
     * Nested DTO for the replyTo preview shown above a bubble.
     * Matches frontend MessageReplyPreview interface.
     */
    public record ReplyPreview(
            String messageId,
            String senderName,
            String content,
            String contentType
    ) {}
}
