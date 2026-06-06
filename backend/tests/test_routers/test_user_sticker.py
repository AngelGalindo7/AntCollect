import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from backend.models import User
from backend.models.sticker_library import StickerLibrary
from backend.models.user_sticker import UserSticker, UserStickerImage


def _make_user(db: Session, suffix: str) -> User:
    user = User(
        username=f"stk_user_{suffix}",
        email=f"stk_{suffix}@example.com",
        password_hash="hash",
    )
    db.add(user)
    db.flush()
    return user


def _make_library_sticker(db: Session) -> StickerLibrary:
    sl = StickerLibrary(title=f"Test Pack {uuid.uuid4().hex[:8]}")
    db.add(sl)
    db.flush()
    return sl


async def _get_me_id(client: AsyncClient) -> int:
    res = await client.get("/users/me")
    return res.json()["id"]


# ── GET /stickers/me ──────────────────────────────────────────────────────────

async def test_list_my_stickers_empty(auth_client: AsyncClient):
    res = await auth_client.get("/stickers/me")
    assert res.status_code == 200, res.text
    assert res.json() == []


async def test_list_my_stickers_requires_auth(client: AsyncClient):
    res = await client.get("/stickers/me")
    assert res.status_code == 401


# ── GET /stickers/{username} ──────────────────────────────────────────────────

async def test_list_user_stickers_unknown_user_returns_404(client: AsyncClient):
    res = await client.get("/stickers/no_such_user_xyz_abc")
    assert res.status_code == 404


async def test_list_user_stickers_public(
    auth_client: AsyncClient, client: AsyncClient, test_credentials: dict, db: Session
):
    username = test_credentials["username"]
    user_id = await _get_me_id(auth_client)

    lib = _make_library_sticker(db)
    sticker = UserSticker(
        user_id=user_id,
        sticker_id=lib.id,
        favorite=True,
    )
    db.add(sticker)
    db.commit()

    res = await client.get(f"/stickers/{username}")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["sticker_id"] == lib.id
    assert body[0]["favorite"] is True


# ── POST /stickers/me ─────────────────────────────────────────────────────────

async def test_create_sticker_with_sticker_id(
    auth_client: AsyncClient, db: Session
):
    lib = _make_library_sticker(db)
    res = await auth_client.post(
        "/stickers/me",
        json={"sticker_id": lib.id, "favorite": True, "condition": "mint"},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["sticker_id"] == lib.id
    assert body["favorite"] is True
    assert body["condition"] == "mint"
    assert body["images"] == []


async def test_create_sticker_without_sticker_id_or_asset_returns_400(
    auth_client: AsyncClient,
):
    res = await auth_client.post(
        "/stickers/me",
        json={"note": "orphan"},
    )
    assert res.status_code == 400
    assert "sticker_id" in res.json()["detail"].lower() or "asset" in res.json()["detail"].lower()


async def test_create_sticker_requires_auth(client: AsyncClient, db: Session):
    lib = _make_library_sticker(db)
    res = await client.post(
        "/stickers/me",
        json={"sticker_id": lib.id},
    )
    assert res.status_code == 401


async def test_create_sticker_unowned_asset_returns_403(
    auth_client: AsyncClient, db: Session
):
    # asset_id 999_999_999 doesn't belong to the test user — ownership check must fire
    res = await auth_client.post(
        "/stickers/me",
        json={"asset_ids": [999_999_999]},
    )
    assert res.status_code == 403


async def test_create_sticker_persisted_in_db(
    auth_client: AsyncClient, db: Session
):
    user_id = await _get_me_id(auth_client)
    lib = _make_library_sticker(db)

    res = await auth_client.post(
        "/stickers/me",
        json={"sticker_id": lib.id, "for_trade": True},
    )
    assert res.status_code == 201
    sticker_id = res.json()["id"]

    db.expire_all()
    row = db.get(UserSticker, sticker_id)
    assert row is not None
    assert row.user_id == user_id
    assert row.for_trade is True


# ── PATCH /stickers/me/{sticker_id} ──────────────────────────────────────────

async def test_update_sticker_changes_fields(
    auth_client: AsyncClient, db: Session
):
    lib = _make_library_sticker(db)
    create_res = await auth_client.post(
        "/stickers/me",
        json={"sticker_id": lib.id},
    )
    sticker_id = create_res.json()["id"]

    res = await auth_client.patch(
        f"/stickers/me/{sticker_id}",
        json={"favorite": True, "note": "updated note"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["favorite"] is True
    assert body["note"] == "updated note"


async def test_update_sticker_not_owned_returns_404(
    auth_client: AsyncClient, db: Session
):
    suffix = uuid.uuid4().hex[:8]
    other_user = _make_user(db, suffix)
    lib = _make_library_sticker(db)
    sticker = UserSticker(user_id=other_user.id, sticker_id=lib.id)
    db.add(sticker)
    db.commit()

    res = await auth_client.patch(
        f"/stickers/me/{sticker.id}",
        json={"favorite": True},
    )
    assert res.status_code == 404


async def test_update_sticker_nonexistent_returns_404(auth_client: AsyncClient):
    res = await auth_client.patch(
        "/stickers/me/999999999",
        json={"favorite": True},
    )
    assert res.status_code == 404


# ── DELETE /stickers/me/{sticker_id} ─────────────────────────────────────────

async def test_delete_sticker_returns_204(auth_client: AsyncClient, db: Session):
    lib = _make_library_sticker(db)
    create_res = await auth_client.post(
        "/stickers/me",
        json={"sticker_id": lib.id},
    )
    sticker_id = create_res.json()["id"]

    res = await auth_client.delete(f"/stickers/me/{sticker_id}")
    assert res.status_code == 204

    db.expire_all()
    assert db.get(UserSticker, sticker_id) is None


async def test_delete_sticker_not_owned_returns_404(
    auth_client: AsyncClient, db: Session
):
    suffix = uuid.uuid4().hex[:8]
    other_user = _make_user(db, suffix)
    lib = _make_library_sticker(db)
    sticker = UserSticker(user_id=other_user.id, sticker_id=lib.id)
    db.add(sticker)
    db.commit()

    res = await auth_client.delete(f"/stickers/me/{sticker.id}")
    assert res.status_code == 404


async def test_delete_sticker_nonexistent_returns_404(auth_client: AsyncClient):
    res = await auth_client.delete("/stickers/me/999999999")
    assert res.status_code == 404
