from fastapi import Depends, HTTPException, APIRouter
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timedelta, timezone
from typing import List

from ..database import get_db
from backend.models import User, Post, Folder, TradeRequest, MediaAsset, PostImage
from ..schemas import (
    CreateTradeRequest,
    TradeRequestResponse,
    TradeRequestStatus,
    UserSearch,
)
from ..utils.auth import authenthicate_access_token

router = APIRouter(
    prefix="/trade-requests",
    tags=["Trade Requests"],
)

EXPIRY_DAYS = 14
MAX_DECLINES = 3


def _expiry_cutoff() -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=EXPIRY_DAYS)


def _build_response(
    trade: TradeRequest,
    db: Session,
) -> TradeRequestResponse:
    """Join requester, post, folder data onto the trade request row."""
    requester = db.get(User, trade.requester_id)
    post = db.get(Post, trade.target_post_id)

    # Thumbnail: first PostImage → json_metadata.paths.thumbnail
    post_thumbnail: str | None = None
    if post:
        first_image = (
            db.execute(
                select(PostImage)
                .where(PostImage.post_id == post.id)
                .order_by(PostImage.order_index)
                .limit(1)
            )
            .scalars()
            .first()
        )
        if first_image and first_image.asset and first_image.asset.json_metadata:
            paths = first_image.asset.json_metadata.get("paths", {})
            post_thumbnail = paths.get("thumbnail")

    offered_folder_name: str | None = None
    if trade.offered_folder_id:
        folder = db.get(Folder, trade.offered_folder_id)
        if folder:
            offered_folder_name = folder.name

    return TradeRequestResponse(
        id=trade.id,
        requester_id=trade.requester_id,
        requester_username=requester.username if requester else "",
        requester_avatar=requester.avatar_path if requester else None,
        recipient_id=trade.recipient_id,
        target_post_id=trade.target_post_id,
        post_caption=post.caption if post else "",
        post_thumbnail=post_thumbnail,
        request_type=trade.request_type,  # type: ignore[arg-type]
        offered_folder_id=trade.offered_folder_id,
        offered_folder_name=offered_folder_name,
        status=trade.status,  # type: ignore[arg-type]
        created_at=trade.created_at,
    )


@router.post("", response_model=TradeRequestResponse, status_code=201)
def create_trade_request(
    payload: CreateTradeRequest,
    db: Session = Depends(get_db),
    current_user: UserSearch = Depends(authenthicate_access_token),
):
    requester_id: int = current_user.user_id

    # 1. Load target post
    target_post = db.get(Post, payload.target_post_id)
    if not target_post:
        raise HTTPException(status_code=404, detail="Post not found")

    # 2. Verify post belongs to the stated recipient
    if target_post.user_id != payload.recipient_id:
        raise HTTPException(
            status_code=400,
            detail="Post does not belong to the specified recipient",
        )

    # 3. Prevent self-request
    if requester_id == payload.recipient_id:
        raise HTTPException(status_code=400, detail="Cannot request your own sticker")

    # 4. Three-strike block
    decline_count = db.execute(
        select(func.count()).where(
            TradeRequest.requester_id == requester_id,
            TradeRequest.recipient_id == payload.recipient_id,
            TradeRequest.status == "DECLINED",
        )
    ).scalar_one()
    if decline_count >= MAX_DECLINES:
        raise HTTPException(
            status_code=403,
            detail="Too many declined requests to this user",
        )

    # 5. Validate offered folder belongs to requester
    if payload.offered_folder_id is not None:
        folder = db.get(Folder, payload.offered_folder_id)
        if not folder or folder.user_id != requester_id:
            raise HTTPException(
                status_code=400,
                detail="Offered folder not found or does not belong to you",
            )

    # 6. Create and commit (partial unique index will raise IntegrityError on duplicate)
    trade = TradeRequest(
        requester_id=requester_id,
        recipient_id=payload.recipient_id,
        target_post_id=payload.target_post_id,
        request_type=payload.request_type.value,
        offered_folder_id=payload.offered_folder_id,
        status="PENDING",
        created_at=datetime.now(timezone.utc),
    )
    db.add(trade)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="You already have a pending request for this post",
        )
    db.refresh(trade)

    return _build_response(trade, db)


@router.get("/inbox", response_model=List[TradeRequestResponse])
def get_inbox(
    db: Session = Depends(get_db),
    current_user: UserSearch = Depends(authenthicate_access_token),
):
    rows = (
        db.execute(
            select(TradeRequest)
            .where(
                TradeRequest.recipient_id == current_user.user_id,
                TradeRequest.status == "PENDING",
                TradeRequest.created_at > _expiry_cutoff(),
            )
            .order_by(TradeRequest.created_at.desc())
        )
        .scalars()
        .all()
    )
    return [_build_response(r, db) for r in rows]


@router.get("/inbox/count")
def get_inbox_count(
    db: Session = Depends(get_db),
    current_user: UserSearch = Depends(authenthicate_access_token),
):
    count = db.execute(
        select(func.count()).where(
            TradeRequest.recipient_id == current_user.user_id,
            TradeRequest.status == "PENDING",
            TradeRequest.created_at > _expiry_cutoff(),
        )
    ).scalar_one()
    return {"count": count}


@router.get("/sent", response_model=List[TradeRequestResponse])
def get_sent(
    db: Session = Depends(get_db),
    current_user: UserSearch = Depends(authenthicate_access_token),
):
    rows = (
        db.execute(
            select(TradeRequest)
            .where(TradeRequest.requester_id == current_user.user_id)
            .order_by(TradeRequest.created_at.desc())
        )
        .scalars()
        .all()
    )
    return [_build_response(r, db) for r in rows]


@router.post("/{trade_id}/accept", response_model=TradeRequestResponse)
def accept_trade_request(
    trade_id: int,
    db: Session = Depends(get_db),
    current_user: UserSearch = Depends(authenthicate_access_token),
):
    trade = db.get(TradeRequest, trade_id)
    if not trade:
        raise HTTPException(status_code=404, detail="Trade request not found")
    if trade.recipient_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorised")
    if trade.status != "PENDING":
        raise HTTPException(status_code=400, detail="Request is no longer pending")

    trade.status = "ACCEPTED"
    trade.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(trade)
    return _build_response(trade, db)


@router.post("/{trade_id}/decline", status_code=204)
def decline_trade_request(
    trade_id: int,
    db: Session = Depends(get_db),
    current_user: UserSearch = Depends(authenthicate_access_token),
):
    trade = db.get(TradeRequest, trade_id)
    if not trade:
        raise HTTPException(status_code=404, detail="Trade request not found")
    if trade.recipient_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorised")
    if trade.status != "PENDING":
        raise HTTPException(status_code=400, detail="Request is no longer pending")

    trade.status = "DECLINED"
    trade.resolved_at = datetime.now(timezone.utc)
    db.commit()
