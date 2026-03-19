package com.petrcollect.messaging.message;

import java.util.List;

/**
 * Wrapper returned by GET /conversations/:id/messages.
 *
 * nextCursor is the messageId of the OLDEST message in the current batch.
 * The client passes it back as ?cursor=X on the next request to fetch
 * messages that are even older (i.e. messageId < cursor).
 *
 * nextCursor is null when there are no more messages — the client uses this
 * to hide the "load more" trigger and show "Beginning of conversation".
 */
public record MessageHistoryResponse(
        List<MessageResponse> messages,
        String nextCursor
) {}
