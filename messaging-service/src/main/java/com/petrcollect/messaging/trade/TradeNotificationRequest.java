package com.petrcollect.messaging.trade;

import com.fasterxml.jackson.annotation.JsonProperty;

public record TradeNotificationRequest(
    @JsonProperty("recipient_id")  Long recipientId,
    @JsonProperty("id")            Long id,
    @JsonProperty("requester_id")  Long requesterId,
    @JsonProperty("requester_username") String requesterUsername,
    @JsonProperty("requester_avatar")   String requesterAvatar,
    @JsonProperty("target_post_id")     Long targetPostId,
    @JsonProperty("post_caption")       String postCaption,
    @JsonProperty("post_thumbnail")     String postThumbnail,
    @JsonProperty("request_type")       String requestType,
    @JsonProperty("offered_folder_id")  Long offeredFolderId,
    @JsonProperty("offered_folder_name") String offeredFolderName,
    @JsonProperty("status")             String status,
    @JsonProperty("created_at")         String createdAt
) {}
