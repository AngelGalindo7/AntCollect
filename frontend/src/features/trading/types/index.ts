export type TradeRequestType = 'WANT_TO_TRADE' | 'HAVE_WHAT_YOU_NEED';
export type TradeRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface TradeRequest {
  id: number;
  requester_id: number;
  requester_username: string;
  requester_avatar: string | null;
  recipient_id: number;
  recipient_username: string;
  recipient_avatar: string | null;
  target_post_id: number;
  post_caption: string;
  post_thumbnail: string | null;
  request_type: TradeRequestType;
  offered_folder_id: number | null;
  offered_folder_name: string | null;
  offered_post_ids: number[] | null;
  status: TradeRequestStatus;
  created_at: string;
}

/** JSON body stored inside a message with contentType "post_reference" */
export interface PostReferenceContent {
  postId: number;
  caption: string;
  thumbnailPath: string | null;
  ownerUsername: string;
}

/** JSON body stored inside a message with contentType "trade_context" */
export interface TradeContextContent {
  type: TradeRequestType;
  targetPostId: number;
  postCaption: string;
  postThumbnail: string | null;
  offeredFolderId: number | null;
  offeredFolderName: string | null;
  requesterUsername: string;
  recipientUsername: string;
}
