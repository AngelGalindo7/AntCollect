export interface UserStickerImageOut {
  id: number;
  asset_id: number;
  order_index: number;
  file_url: string;
}

export interface UserStickerOut {
  id: number;
  sticker_id: number | null;
  source_post_id: number | null;
  favorite: boolean;
  for_trade: boolean;
  bg_removed: boolean;
  bg_removed_file_url: string | null;
  binder_page_id: number | null;
  slot_index: number | null;
  condition: string | null;
  note: string | null;
  acquired_at: string | null;
  created_at: string;
  updated_at: string;
  images: UserStickerImageOut[];
}

export interface BinderPageOut {
  id: number;
  page_index: number;
  title: string | null;
  rows: number;
  cols: number;
  background: Record<string, unknown> | null;
  stickers: UserStickerOut[];
}

export interface BinderOut {
  id: number;
  title: string | null;
  pages: BinderPageOut[];
}
