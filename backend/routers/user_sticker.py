import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload

from backend.database import get_db
from backend.models import User, MediaAsset
from backend.models.user_sticker import UserSticker, UserStickerImage
from backend.schemas import UserStickerCreate, UserStickerUpdate, UserStickerOut, UserStickerImageOut
from backend.utils.auth import authenthicate_access_token, optional_auth_token
from backend.utils.rate_limit import limiter, get_user_or_ip_key
from backend.schemas import UserSearch

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/stickers",
    tags=["User Stickers"],
)


def _build_sticker_out(sticker: UserSticker) -> UserStickerOut:
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
        source_post_id=sticker.source_post_id,
        favorite=sticker.favorite,
        for_trade=sticker.for_trade,
        condition=sticker.condition,
        note=sticker.note,
        acquired_at=sticker.acquired_at,
        created_at=sticker.created_at,
        updated_at=sticker.updated_at,
        images=images,
    )


def _load_stickers(user_id: int, db: Session) -> List[UserSticker]:
    return db.execute(
        select(UserSticker)
        .where(UserSticker.user_id == user_id)
        .options(
            selectinload(UserSticker.images).selectinload(UserStickerImage.asset)
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
    return [_build_sticker_out(s) for s in stickers]


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
    return [_build_sticker_out(s) for s in stickers]


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
        .options(selectinload(UserSticker.images).selectinload(UserStickerImage.asset))
    ).scalar_one()

    return _build_sticker_out(sticker)


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
        .options(selectinload(UserSticker.images).selectinload(UserStickerImage.asset))
    ).scalar_one_or_none()
    if not sticker:
        raise HTTPException(status_code=404, detail="Sticker not found")

    if body.favorite is not None:
        sticker.favorite = body.favorite
    if body.for_trade is not None:
        sticker.for_trade = body.for_trade
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
        .options(selectinload(UserSticker.images).selectinload(UserStickerImage.asset))
    ).scalar_one()

    return _build_sticker_out(sticker)


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
