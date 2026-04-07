package com.petrcollect.messaging.trade;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/internal")
public class TradeNotificationController {

    private final SimpMessagingTemplate messagingTemplate;
    private final String internalSecret;

    public TradeNotificationController(
            SimpMessagingTemplate messagingTemplate,
            @Value("${app.internal.secret}") String internalSecret) {
        this.messagingTemplate = messagingTemplate;
        this.internalSecret = internalSecret;
    }

    @PostMapping("/trade-notify")
    public ResponseEntity<Void> notifyTradeRequest(
            @RequestHeader("X-Internal-Secret") String secret,
            @RequestBody TradeNotificationRequest req) {

        if (!internalSecret.equals(secret)) {
            return ResponseEntity.status(403).build();
        }

        // Build the STOMP payload with snake_case keys to match the frontend TradeRequest interface.
        Map<String, Object> payload = new HashMap<>();
        payload.put("id",                   req.id());
        payload.put("requester_id",         req.requesterId());
        payload.put("requester_username",   req.requesterUsername());
        payload.put("requester_avatar",     req.requesterAvatar());
        payload.put("recipient_id",         req.recipientId());
        payload.put("target_post_id",       req.targetPostId());
        payload.put("post_caption",         req.postCaption());
        payload.put("post_thumbnail",       req.postThumbnail());
        payload.put("request_type",         req.requestType());
        payload.put("offered_folder_id",    req.offeredFolderId());
        payload.put("offered_folder_name",  req.offeredFolderName());
        payload.put("status",               req.status());
        payload.put("created_at",           req.createdAt());

        messagingTemplate.convertAndSendToUser(
            String.valueOf(req.recipientId()),
            "/queue/trade-events",
            payload
        );

        return ResponseEntity.noContent().build();
    }
}
