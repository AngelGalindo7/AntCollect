import logging
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload

from backend.database import get_db
from backend.models import User, MediaAsset
from backend.models.media_assets import AssetStatus
from backend.models.user_sticker import UserSticker, UserStickerImage
from backend.schemas import UserStickerCreate, UserStickerUpdate, UserStickerOut
from backend.utils.auth import authenthicate_access_token, optional_auth_token
from backend.utils.background_removal import fetch_and_remove_background
from backend.utils.files import process_and_save_image, delete_file
from backend.utils.s3 import upload_image_bytes
from backend.utils.sticker_serialization import build_user_sticker_out
from backend.utils.rate_limit import limiter, get_user_or_ip_key
from backend.schemas import UserSearch

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/stickers",
    tags=["User Stickers"],
)


def _load_stickers(user_id: int, db: Session) -> List[UserSticker]:
    return db.execute(
        select(UserSticker)
        .where(UserSticker.user_id == user_id)
        .options(
            selectinload(UserSticker.images).selectinload(UserStickerImage.asset),
            selectinload(UserSticker.bg_removed_asset),
        )
        .order_by(UserSticker.created_at.desc())
    ).scalars().all()


@router.get("/me", response_model=List[UserStickerOut])
@limiter.limit("60/minute", key_func=get_user_or_ip_key)
def list_my_stickers(
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserSearch = Depends(authenthicate_access_token),
):
    stickers = _load_stickers(current_user.user_id, db)
    return [build_user_sticker_out(s) for s in stickers]


@router.get("/{username}", response_model=List[UserStickerOut])
@limiter.limit("60/minute", key_func=get_user_or_ip_key)
def list_user_stickers(
    request: Request,
    username: str,
    db: Session = Depends(get_db),
):
    user = db.execute(
        select(User).where(User.username == username)
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    stickers = _load_stickers(user.id, db)
    return [build_user_sticker_out(s) for s in stickers]


@router.post("/me", response_model=UserStickerOut, status_code=201)
@limiter.limit("30/hour", key_func=get_user_or_ip_key)
def create_sticker(
    request: Request,
    body: UserStickerCreate,
    db: Session = Depends(get_db),
    current_user: UserSearch = Depends(authenthicate_access_token),
):
    if not body.asset_ids and body.sticker_id is None:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one asset_id or a sticker_id so the entry has an image.",
        )

    if body.asset_ids:
        owned = db.execute(
            select(func.count(MediaAsset.id))
            .where(
                MediaAsset.id.in_(body.asset_ids),
                MediaAsset.uploader_id == current_user.user_id,
            )
        ).scalar_one()
        if owned != len(body.asset_ids):
            raise HTTPException(status_code=403, detail="One or more assets do not belong to you.")

    sticker = UserSticker(
        user_id=current_user.user_id,
        sticker_id=body.sticker_id,
        source_post_id=body.source_post_id,
        favorite=body.favorite,
        for_trade=body.for_trade,
        condition=body.condition,
        note=body.note,
        acquired_at=body.acquired_at,
    )
    db.add(sticker)
    db.flush()

    for idx, asset_id in enumerate(body.asset_ids, start=1):
        db.add(UserStickerImage(
            user_sticker_id=sticker.id,
            asset_id=asset_id,
            order_index=idx,
        ))

    db.commit()

    sticker = db.execute(
        select(UserSticker)
        .where(UserSticker.id == sticker.id)
        .options(
            selectinload(UserSticker.images).selectinload(UserStickerImage.asset),
            selectinload(UserSticker.bg_removed_asset),
        )
    ).scalar_one()

    return build_user_sticker_out(sticker)


@router.post("/me/upload", response_model=UserStickerOut, status_code=201)
@limiter.limit("30/hour", key_func=get_user_or_ip_key)
def upload_sticker(
    request: Request,
    file: UploadFile = File(...),
    sticker_id: Optional[int] = Form(None),
    favorite: bool = Form(False),
    for_trade: bool = Form(False),
    condition: Optional[str] = Form(None),
    note: Optional[str] = Form(None),
    acquired_at: Optional[datetime] = Form(None),
    db: Session = Depends(get_db),
    current_user: UserSearch = Depends(authenthicate_access_token),
):
    """Upload a user's own photo of a sticker they own: processes the image through the
    shared pipeline, stores it as a MediaAsset the user owns, and creates a user_sticker
    row pointing at it. The result can then be background-removed and placed in a binder."""
    created_files: List[str] = []
    try:
        image_data = process_and_save_image(file, current_user.user_id, folder_prefix="stickers")
        created_files.extend(image_data["paths"].values())

        asset = MediaAsset(
            uploader_id=current_user.user_id,
            file_url=image_data["paths"]["original"],
            s3_key=f"stickers/{current_user.user_id}/original/{image_data['filename']}",
            json_metadata={"paths": image_data["paths"], "dimensions": image_data["dimensions"]},
            status=AssetStatus.ATTACHED,
        )
        db.add(asset)
        db.flush()

        sticker = UserSticker(
            user_id=current_user.user_id,
            sticker_id=sticker_id,
            favorite=favorite,
            for_trade=for_trade,
            condition=condition,
            note=note,
            acquired_at=acquired_at,
        )
        db.add(sticker)
        db.flush()
        db.add(UserStickerImage(user_sticker_id=sticker.id, asset_id=asset.id, order_index=1))
        db.commit()
    except HTTPException:
        db.rollback()
        for path in created_files:
            try:
                delete_file(path)
            except Exception:
                pass
        raise
    except Exception as e:
        db.rollback()
        for path in created_files:
            try:
                delete_file(path)
            except Exception:
                pass
        logger.error(f"Sticker upload failed: {e}")
        raise HTTPException(status_code=500, detail="Could not save sticker image")

    sticker = db.execute(
        select(UserSticker)
        .where(UserSticker.id == sticker.id)
        .options(
            selectinload(UserSticker.images).selectinload(UserStickerImage.asset),
            selectinload(UserSticker.bg_removed_asset),
        )
    ).scalar_one()
    return build_user_sticker_out(sticker)


@router.patch("/me/{sticker_id}", response_model=UserStickerOut)
@limiter.limit("60/hour", key_func=get_user_or_ip_key)
def update_sticker(
    request: Request,
    sticker_id: int,
    body: UserStickerUpdate,
    db: Session = Depends(get_db),
    current_user: UserSearch = Depends(authenthicate_access_token),
):
    sticker = db.execute(
        select(UserSticker)
        .where(UserSticker.id == sticker_id, UserSticker.user_id == current_user.user_id)
        .options(
            selectinload(UserSticker.images).selectinload(UserStickerImage.asset),
            selectinload(UserSticker.bg_removed_asset),
        )
    ).scalar_one_or_none()
    if not sticker:
        raise HTTPException(status_code=404, detail="Sticker not found")

    if body.favorite is not None:
        sticker.favorite = body.favorite
    if body.for_trade is not None:
        sticker.for_trade = body.for_trade
    if body.bg_removed is not None:
        if body.bg_removed and sticker.bg_removed_asset_id is None:
            raise HTTPException(
                status_code=400,
                detail="No background-removed image is available; run remove-bg first.",
            )
        sticker.bg_removed = body.bg_removed
    if body.condition is not None:
        sticker.condition = body.condition
    if body.note is not None:
        sticker.note = body.note
    if body.acquired_at is not None:
        sticker.acquired_at = body.acquired_at

    db.commit()
    db.refresh(sticker)

    sticker = db.execute(
        select(UserSticker)
        .where(UserSticker.id == sticker_id)
        .options(
            selectinload(UserSticker.images).selectinload(UserStickerImage.asset),
            selectinload(UserSticker.bg_removed_asset),
        )
    ).scalar_one()

    return build_user_sticker_out(sticker)


@router.delete("/me/{sticker_id}", status_code=204)
@limiter.limit("30/hour", key_func=get_user_or_ip_key)
def delete_sticker(
    request: Request,
    sticker_id: int,
    db: Session = Depends(get_db),
    current_user: UserSearch = Depends(authenthicate_access_token),
):
    sticker = db.execute(
        select(UserSticker).where(
            UserSticker.id == sticker_id,
            UserSticker.user_id == current_user.user_id,
        )
    ).scalar_one_or_none()
    if not sticker:
        raise HTTPException(status_code=404, detail="Sticker not found")

    db.delete(sticker)
    db.commit()


@router.post("/me/{sticker_id}/remove-bg", response_model=UserStickerOut)
@limiter.limit("10/minute", key_func=get_user_or_ip_key)
def remove_sticker_background(
    request: Request,
    sticker_id: int,
    db: Session = Depends(get_db),
    current_user: UserSearch = Depends(authenthicate_access_token),
):
    sticker = db.execute(
        select(UserSticker)
        .where(UserSticker.id == sticker_id, UserSticker.user_id == current_user.user_id)
        .options(
            selectinload(UserSticker.images).selectinload(UserStickerImage.asset),
            selectinload(UserSticker.bg_removed_asset),
        )
    ).scalar_one_or_none()
    if not sticker:
        raise HTTPException(status_code=404, detail="Sticker not found")

    if sticker.bg_removed_asset_id is None:
        source_url = sticker.images[0].asset.file_url if sticker.images else None
        if not source_url:
            raise HTTPException(
                status_code=400,
                detail="This sticker has no image to remove a background from.",
            )

        output_bytes = fetch_and_remove_background(source_url)
        key = f"stickers/{current_user.user_id}/cutout/{uuid.uuid4()}.png"
        processed_url = upload_image_bytes(key, output_bytes, "image/png")

        asset = MediaAsset(
            uploader_id=current_user.user_id,
            file_url=processed_url,
            s3_key=key,
            json_metadata={"kind": "bg_removed"},
            status=AssetStatus.ATTACHED,
        )
        db.add(asset)
        db.flush()
        sticker.bg_removed_asset_id = asset.id

    sticker.bg_removed = True
    db.commit()

    sticker = db.execute(
        select(UserSticker)
        .where(UserSticker.id == sticker_id)
        .options(
            selectinload(UserSticker.images).selectinload(UserStickerImage.asset),
            selectinload(UserSticker.bg_removed_asset),
        )
    ).scalar_one()

    return build_user_sticker_out(sticker)
