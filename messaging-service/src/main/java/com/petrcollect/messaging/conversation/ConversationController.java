package com.petrcollect.messaging.conversation;

import com.petrcollect.messaging.message.MessageHistoryResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/conversations")
public class ConversationController {

    private final ConversationService conversationService;

    public ConversationController(ConversationService conversationService) {
        this.conversationService = conversationService;
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (Long) auth.getPrincipal();
    } 
    @PostMapping
    public ResponseEntity<ConversationResponse> createConversation(@RequestBody CreateConversationRequest request) {

        
        Long currentUserId = currentUserId();

        boolean hasOtherParticipant = request.userIds() != null &&
        request.userIds().stream().anyMatch(id -> !id.equals(currentUserId));

        if (!hasOtherParticipant) {
          return ResponseEntity.badRequest().build();
          }
        Conversation conversation = conversationService.createConversation(
                request.userIds(),
                request.isGroup(),
                request.groupName(),
                currentUserId
        );


          ConversationResponse response = conversationService
            .getConversationForUser(conversation.getId(), currentUserId);

            return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * GET /conversations
     * @return list of Conversation objects for the current user
     */
    @GetMapping
    public ResponseEntity<List<ConversationResponse>> getConversationsForCurrentUser() {
                
        return ResponseEntity.ok(conversationService.getConversationsForUser(currentUserId()));
    }
    


    @GetMapping("/{conversationId}")
    public ResponseEntity<ConversationResponse> getConversation(
            @PathVariable Long conversationId) {

        ConversationResponse response = conversationService
                .getConversationForUser(conversationId, currentUserId());

        return ResponseEntity.ok(response);
    }

    /**
     * GET /conversations/:id/messages?cursor=X&limit=50
     *
     * Cursor-based paginated message history.
     *
     * @param conversationId path param — the conversation to load
     * @param cursor         optional — the oldest messageId the client holds
     * @param limit          page size — defaults to 50, capped at 100
     */
    @GetMapping("/{conversationId}/messages")
    public ResponseEntity<MessageHistoryResponse> getMessages(
            @PathVariable Long conversationId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "50") int limit) {

        // Cap limit to prevent abuse — client should never need more than 100
        int safeLimit = Math.min(limit, 100);

        MessageHistoryResponse response = conversationService
                .getMessageHistory(conversationId, cursor, safeLimit, currentUserId());

        return ResponseEntity.ok(response);
    }

    public record CreateConversationRequest(
            List<Long> userIds,
            boolean isGroup,
            String groupName
    ) {}
}
