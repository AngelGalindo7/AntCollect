import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from backend.models import Post, User
from backend.models.post import PostType


def _make_user(db: Session, suffix: str) -> User:
    user = User(
        username=f"rpt_user_{suffix}",
        email=f"rpt_{suffix}@example.com",
        password_hash="hash",
    )
    db.add(user)
    db.flush()
    return user


def _make_post(db: Session, user_id: int) -> Post:
    post = Post(
        user_id=user_id,
        caption="A post to report",
        type=PostType.collection,
        is_published=True,
        public=True,
    )
    db.add(post)
    db.flush()
    return post


# ── POST /reports ─────────────────────────────────────────────────────────────

async def test_create_report_requires_auth(client: AsyncClient, db: Session):
    target = _make_user(db, uuid.uuid4().hex[:8])
    res = await client.post(
        "/reports",
        json={"target_type": "user", "target_id": target.id, "reason": "spam"},
    )
    assert res.status_code == 401


async def test_create_report_on_nonexistent_post_returns_404(auth_client: AsyncClient):
    res = await auth_client.post(
        "/reports",
        json={"target_type": "post", "target_id": 999_999_999, "reason": "spam"},
    )
    assert res.status_code == 404


async def test_create_report_on_nonexistent_user_returns_404(auth_client: AsyncClient):
    res = await auth_client.post(
        "/reports",
        json={"target_type": "user", "target_id": 999_999_999, "reason": "spam"},
    )
    assert res.status_code == 404


async def test_create_report_on_post_success(
    auth_client: AsyncClient, db: Session
):
    suffix = uuid.uuid4().hex[:8]
    target_user = _make_user(db, suffix)
    post = _make_post(db, target_user.id)

    res = await auth_client.post(
        "/reports",
        json={"target_type": "post", "target_id": post.id, "reason": "inappropriate"},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["target_type"] == "post"
    assert body["target_id"] == post.id
    assert body["reason"] == "inappropriate"
    assert body["status"] == "pending"


async def test_create_report_on_user_success(
    auth_client: AsyncClient, db: Session
):
    suffix = uuid.uuid4().hex[:8]
    target = _make_user(db, suffix)

    res = await auth_client.post(
        "/reports",
        json={"target_type": "user", "target_id": target.id, "reason": "harassment"},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["target_type"] == "user"
    assert body["target_id"] == target.id


async def test_create_report_duplicate_pending_returns_409(
    auth_client: AsyncClient, db: Session
):
    suffix = uuid.uuid4().hex[:8]
    target = _make_user(db, suffix)
    post = _make_post(db, target.id)

    payload = {"target_type": "post", "target_id": post.id, "reason": "spam"}

    r1 = await auth_client.post("/reports", json=payload)
    assert r1.status_code == 201

    r2 = await auth_client.post("/reports", json=payload)
    assert r2.status_code == 409
    assert "already reported" in r2.json()["detail"].lower()


async def test_create_report_all_reasons_accepted(
    auth_client: AsyncClient, db: Session
):
    for reason in ("spam", "inappropriate", "harassment", "copyright", "other"):
        suffix = uuid.uuid4().hex[:8]
        target = _make_user(db, suffix)
        post = _make_post(db, target.id)
        res = await auth_client.post(
            "/reports",
            json={"target_type": "post", "target_id": post.id, "reason": reason},
        )
        assert res.status_code == 201, f"reason={reason} failed: {res.text}"


async def test_create_report_invalid_reason_returns_422(
    auth_client: AsyncClient, db: Session
):
    suffix = uuid.uuid4().hex[:8]
    target = _make_user(db, suffix)
    post = _make_post(db, target.id)
    res = await auth_client.post(
        "/reports",
        json={"target_type": "post", "target_id": post.id, "reason": "not_a_reason"},
    )
    assert res.status_code == 422


async def test_create_report_invalid_target_type_returns_422(auth_client: AsyncClient):
    res = await auth_client.post(
        "/reports",
        json={"target_type": "folder", "target_id": 1, "reason": "spam"},
    )
    assert res.status_code == 422
