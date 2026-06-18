from backend.models.user_sticker import UserSticker
from backend.schemas import UserStickerOut, UserStickerImageOut


def build_user_sticker_out(sticker: UserSticker) -> UserStickerOut:
    """Serialize a UserSticker (with its images, bg-removed asset, and binder slot)
    into the UserStickerOut DTO. Expects images/bg_removed_asset eagerly loaded."""
    images = [
        UserStickerImageOut(
            id=img.id,
            asset_id=img.asset_id,
            order_index=img.order_index,
            file_url=img.asset.file_url,
        )
        for img in sticker.images
    ]
    return UserStickerOut(
        id=sticker.id,
        sticker_id=sticker.sticker_id,
        sticker_name=sticker.library_sticker.name if sticker.library_sticker else None,
        source_post_id=sticker.source_post_id,
        favorite=sticker.favorite,
        for_trade=sticker.for_trade,
        bg_removed=sticker.bg_removed,
        bg_removed_file_url=sticker.bg_removed_asset.file_url if sticker.bg_removed_asset else None,
        binder_page_id=sticker.binder_page_id,
        slot_index=sticker.slot_index,
        condition=sticker.condition,
        note=sticker.note,
        acquired_at=sticker.acquired_at,
        created_at=sticker.created_at,
        updated_at=sticker.updated_at,
        images=images,
    )
