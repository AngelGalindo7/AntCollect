import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select, func, update
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.dialects.postgresql import insert as pg_insert

from backend.database import get_db
from backend.models import User
from backend.models.binder import Binder, BinderPage
from backend.models.user_sticker import UserSticker, UserStickerImage
from backend.schemas import (
    BinderOut,
    BinderPageOut,
    BinderPageCreate,
    BinderPageUpdate,
    BinderSlotAssign,
    UserSearch,
)
from backend.utils.auth import authenthicate_access_token
from backend.utils.sticker_serialization import build_user_sticker_out
from backend.utils.rate_limit import limiter, get_user_or_ip_key

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/binders",
    tags=["Binders"],
)


def _ensure_binder(db: Session, user_id: int) -> Binder:
    stmt = (
        pg_insert(Binder)
        .values(user_id=user_id)
        .on_conflict_do_nothing(constraint="uq_binder_user")
    )
    db.execute(stmt)
    binder = db.execute(select(Binder).where(Binder.user_id == user_id)).scalar_one()
    page_count = db.execute(
        select(func.count()).where(BinderPage.binder_id == binder.id)
    ).scalar()
    if page_count == 0:
        db.add(BinderPage(binder_id=binder.id, page_index=0, rows=3, cols=3))
        db.add(BinderPage(binder_id=binder.id, page_index=1, rows=3, cols=3))
    db.commit()
    return binder


def _load_binder(db: Session, user_id: int) -> Binder | None:
    return db.execute(
        select(Binder)
        .where(Binder.user_id == user_id)
        .options(
            selectinload(Binder.pages)
            .selectinload(BinderPage.stickers)
            .selectinload(UserSticker.images)
            .selectinload(UserStickerImage.asset),
            selectinload(Binder.pages)
            .selectinload(BinderPage.stickers)
            .selectinload(UserSticker.bg_removed_asset),
            selectinload(Binder.pages)
            .selectinload(BinderPage.stickers)
            .selectinload(UserSticker.library_sticker),
        )
    ).scalar_one_or_none()


def _load_page(db: Session, page_id: int) -> BinderPage:
    return db.execute(
        select(BinderPage)
        .where(BinderPage.id == page_id)
        .options(
            selectinload(BinderPage.stickers).selectinload(UserSticker.images).selectinload(UserStickerImage.asset),
            selectinload(BinderPage.stickers).selectinload(UserSticker.bg_removed_asset),
            selectinload(BinderPage.stickers).selectinload(UserSticker.library_sticker),
        )
    ).scalar_one()


def _get_owned_page(db: Session, user_id: int, page_id: int) -> BinderPage:
    page = db.execute(
        select(BinderPage)
        .join(Binder, Binder.id == BinderPage.binder_id)
        .where(BinderPage.id == page_id, Binder.user_id == user_id)
    ).scalar_one_or_none()
    if page is None:
        raise HTTPException(404, "Page not found")
    return page


def _build_page_out(page: BinderPage) -> BinderPageOut:
    return BinderPageOut(
        id=page.id,
        page_index=page.page_index,
        title=page.title,
        rows=page.rows,
        cols=page.cols,
        background=page.background,
        stickers=[build_user_sticker_out(s) for s in page.stickers],
    )


def _build_binder_out(binder: Binder) -> BinderOut:
    return BinderOut(
        id=binder.id,
        title=binder.title,
        pages=[_build_page_out(p) for p in binder.pages],
    )


@router.get("/me", response_model=BinderOut)
def get_my_binder(
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    _ensure_binder(db, user.user_id)
    binder = _load_binder(db, user.user_id)
    return _build_binder_out(binder)


@router.post("/me/pages", response_model=BinderPageOut, status_code=201)
@limiter.limit("60/hour", key_func=get_user_or_ip_key)
def create_page(
    request: Request,
    body: BinderPageCreate,
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    binder = _ensure_binder(db, user.user_id)
    max_idx = db.execute(
        select(func.max(BinderPage.page_index)).where(BinderPage.binder_id == binder.id)
    ).scalar()
    next_idx = (max_idx + 1) if max_idx is not None else 0

    page = BinderPage(
        binder_id=binder.id,
        page_index=next_idx,
        title=body.title,
        rows=body.rows,
        cols=body.cols,
    )
    db.add(page)
    db.commit()
    return _build_page_out(_load_page(db, page.id))


@router.patch("/me/pages/{page_id}", response_model=BinderPageOut)
@limiter.limit("120/hour", key_func=get_user_or_ip_key)
def update_page(
    request: Request,
    page_id: int,
    body: BinderPageUpdate,
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    page = _get_owned_page(db, user.user_id, page_id)
    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(page, field, value)
    db.commit()
    return _build_page_out(_load_page(db, page_id))


@router.delete("/me/pages/{page_id}", status_code=204)
@limiter.limit("60/hour", key_func=get_user_or_ip_key)
def delete_page(
    request: Request,
    page_id: int,
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    page = _get_owned_page(db, user.user_id, page_id)
    # Return this page's stickers to the unfiled collection before dropping the page.
    db.execute(
        update(UserSticker)
        .where(UserSticker.binder_page_id == page.id)
        .values(binder_page_id=None, slot_index=None)
    )
    db.delete(page)
    db.commit()
    return Response(status_code=204)


@router.put("/me/slots", response_model=BinderOut)
@limiter.limit("120/minute", key_func=get_user_or_ip_key)
def assign_slot(
    request: Request,
    body: BinderSlotAssign,
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    sticker = db.execute(
        select(UserSticker).where(
            UserSticker.id == body.user_sticker_id,
            UserSticker.user_id == user.user_id,
        )
    ).scalar_one_or_none()
    if sticker is None:
        raise HTTPException(404, "Sticker not found")

    target_page_id = body.binder_page_id
    target_slot = body.slot_index

    # A placement needs both page and slot; passing neither unfiles the sticker.
    if (target_page_id is None) != (target_slot is None):
        raise HTTPException(400, "Provide both binder_page_id and slot_index, or neither to unfile.")

    if target_page_id is None:
        sticker.binder_page_id = None
        sticker.slot_index = None
        db.commit()
        return _build_binder_out(_load_binder(db, user.user_id))

    page = _get_owned_page(db, user.user_id, target_page_id)
    if target_slot >= page.rows * page.cols:
        raise HTTPException(400, "slot_index is outside this page's grid.")

    occupant = db.execute(
        select(UserSticker).where(
            UserSticker.binder_page_id == target_page_id,
            UserSticker.slot_index == target_slot,
            UserSticker.id != sticker.id,
        )
    ).scalar_one_or_none()

    old_page_id, old_slot = sticker.binder_page_id, sticker.slot_index

    # Park the occupant out of the way first so the unique (page, slot) constraint
    # never sees two rows in the same slot mid-swap, then settle it into the source's
    # old spot (or unfiled, if the moved sticker had no slot).
    if occupant is not None:
        occupant.binder_page_id = None
        occupant.slot_index = None
        db.flush()

    sticker.binder_page_id = target_page_id
    sticker.slot_index = target_slot
    db.flush()

    if occupant is not None:
        occupant.binder_page_id = old_page_id
        occupant.slot_index = old_slot

    db.commit()
    return _build_binder_out(_load_binder(db, user.user_id))


@router.get("/{username}", response_model=BinderOut)
def get_public_binder(username: str, db: Session = Depends(get_db)):
    db_user = db.execute(select(User).where(User.username == username)).scalar_one_or_none()
    if db_user is None:
        raise HTTPException(404, "User not found")

    binder = _load_binder(db, db_user.id)
    if binder is None:
        raise HTTPException(404, "Binder not found")
    return _build_binder_out(binder)
