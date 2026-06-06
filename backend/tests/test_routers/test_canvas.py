import io
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from backend.models.canvas import UserCanvas
from backend.models import User


# ── GET /canvas/me ────────────────────────────────────────────────────────────

async def test_get_my_canvas_returns_null_for_new_user(auth_client: AsyncClient):
    res = await auth_client.get("/canvas/me")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["canvas_json"] is None
    assert body["preview_path"] is None


async def test_get_my_canvas_requires_auth(client: AsyncClient):
    res = await client.get("/canvas/me")
    assert res.status_code == 401


# ── PUT /canvas/me ────────────────────────────────────────────────────────────

async def test_save_my_canvas_stores_json(auth_client: AsyncClient):
    state = {"nodes": [{"id": "n1", "type": "image", "x": 0, "y": 0}], "version": 1}
    res = await auth_client.put("/canvas/me", json={"canvas_json": state})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["canvas_json"] == state


async def test_save_my_canvas_upserts(auth_client: AsyncClient):
    state_a = {"nodes": [], "version": 1}
    state_b = {"nodes": [{"id": "x"}], "version": 2}

    r1 = await auth_client.put("/canvas/me", json={"canvas_json": state_a})
    r2 = await auth_client.put("/canvas/me", json={"canvas_json": state_b})

    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r2.json()["canvas_json"] == state_b


async def test_save_my_canvas_get_returns_latest(auth_client: AsyncClient):
    state = {"nodes": [{"id": "final"}]}
    await auth_client.put("/canvas/me", json={"canvas_json": state})

    res = await auth_client.get("/canvas/me")
    assert res.status_code == 200
    assert res.json()["canvas_json"] == state


async def test_save_my_canvas_requires_auth(client: AsyncClient):
    res = await client.put("/canvas/me", json={"canvas_json": {}})
    assert res.status_code == 401


# ── POST /canvas/me/preview ───────────────────────────────────────────────────

async def test_upload_canvas_preview_stores_preview_path(auth_client: AsyncClient):
    fake_png = b"PNG_BYTES_PLACEHOLDER"
    res = await auth_client.post(
        "/canvas/me/preview",
        files={"file": ("preview.png", fake_png, "image/png")},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["preview_path"]  # non-empty URL from mocked S3


async def test_upload_canvas_preview_too_large_returns_413(auth_client: AsyncClient):
    oversized = b"x" * (15 * 1024 * 1024 + 1)
    res = await auth_client.post(
        "/canvas/me/preview",
        files={"file": ("big.png", oversized, "image/png")},
    )
    assert res.status_code == 413


async def test_upload_canvas_preview_creates_row_if_none(
    auth_client: AsyncClient, db: Session
):
    fake_png = b"PNG_DATA"
    res = await auth_client.post(
        "/canvas/me/preview",
        files={"file": ("p.png", fake_png, "image/png")},
    )
    assert res.status_code == 200

    me_res = await auth_client.get("/users/me")
    user_id = me_res.json()["id"]

    db.expire_all()
    row = db.query(UserCanvas).filter(UserCanvas.user_id == user_id).first()
    assert row is not None
    assert row.preview_path is not None


async def test_upload_canvas_preview_requires_auth(client: AsyncClient):
    res = await client.post(
        "/canvas/me/preview",
        files={"file": ("p.png", b"data", "image/png")},
    )
    assert res.status_code == 401


# ── GET /canvas/{username}/preview ────────────────────────────────────────────

async def test_get_public_canvas_preview_unknown_user_returns_404(client: AsyncClient):
    res = await client.get("/canvas/no_such_user_xyz/preview")
    assert res.status_code == 404


async def test_get_public_canvas_preview_no_preview_returns_404(
    auth_client: AsyncClient, client: AsyncClient, test_credentials: dict
):
    # User exists (auth_client created them) but has no canvas yet
    username = test_credentials["username"]
    res = await client.get(f"/canvas/{username}/preview")
    assert res.status_code == 404


async def test_get_public_canvas_preview_returns_path_after_upload(
    auth_client: AsyncClient, client: AsyncClient, test_credentials: dict
):
    await auth_client.post(
        "/canvas/me/preview",
        files={"file": ("p.png", b"fake_png", "image/png")},
    )
    username = test_credentials["username"]
    res = await client.get(f"/canvas/{username}/preview")
    assert res.status_code == 200
    assert res.json()["preview_path"]


# ── GET /canvas/{username}/data ───────────────────────────────────────────────

async def test_get_public_canvas_data_unknown_user_returns_404(client: AsyncClient):
    res = await client.get("/canvas/no_such_user_xyz/data")
    assert res.status_code == 404


async def test_get_public_canvas_data_returns_json_after_save(
    auth_client: AsyncClient, client: AsyncClient, test_credentials: dict
):
    state = {"nodes": [{"id": "pub"}]}
    await auth_client.put("/canvas/me", json={"canvas_json": state})

    username = test_credentials["username"]
    res = await client.get(f"/canvas/{username}/data")
    assert res.status_code == 200
    assert res.json()["canvas_json"] == state


async def test_get_public_canvas_data_no_canvas_returns_null_json(
    auth_client: AsyncClient, client: AsyncClient, test_credentials: dict
):
    # No canvas saved — endpoint should still 200 with null canvas_json
    username = test_credentials["username"]
    res = await client.get(f"/canvas/{username}/data")
    assert res.status_code == 200
    assert res.json()["canvas_json"] is None
