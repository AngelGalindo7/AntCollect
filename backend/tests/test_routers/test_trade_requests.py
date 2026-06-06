import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from backend.models import Post, User, TradeRequest
from backend.models.post import PostType


def _make_user(db: Session, suffix: str) -> User:
    user = User(
        username=f"tr_user_{suffix}",
        email=f"tr_{suffix}@example.com",
        password_hash="hash",
    )
    db.add(user)
    db.flush()
    return user


def _make_post(db: Session, user_id: int) -> Post:
    post = Post(
        user_id=user_id,
        caption="Trade target post",
        type=PostType.collection,
        is_published=True,
        public=True,
    )
    db.add(post)
    db.flush()
    return post


def _make_trade(
    db: Session,
    requester_id: int,
    recipient_id: int,
    post_id: int,
    status: str = "PENDING",
) -> TradeRequest:
    trade = TradeRequest(
        requester_id=requester_id,
        recipient_id=recipient_id,
        target_post_id=post_id,
        request_type="WANT_TO_TRADE",
        status=status,
        created_at=datetime.now(timezone.utc),
    )
    db.add(trade)
    db.flush()
    return trade


async def _get_me_id(client: AsyncClient) -> int:
    res = await client.get("/users/me")
    return res.json()["id"]


# ── POST /trade-requests ──────────────────────────────────────────────────────

async def test_create_trade_request_success(
    auth_client: AsyncClient, db: Session
):
    suffix = uuid.uuid4().hex[:8]
    recipient = _make_user(db, suffix)
    post = _make_post(db, recipient.id)

    res = await auth_client.post(
        "/trade-requests",
        json={
            "recipient_id": recipient.id,
            "target_post_id": post.id,
            "request_type": "WANT_TO_TRADE",
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "PENDING"
    assert body["recipient_id"] == recipient.id
    assert body["target_post_id"] == post.id


async def test_create_trade_request_post_not_found(
    auth_client: AsyncClient, db: Session
):
    suffix = uuid.uuid4().hex[:8]
    recipient = _make_user(db, suffix)

    res = await auth_client.post(
        "/trade-requests",
        json={
            "recipient_id": recipient.id,
            "target_post_id": 999_999_999,
            "request_type": "WANT_TO_TRADE",
        },
    )
    assert res.status_code == 404


async def test_create_trade_request_self_request_returns_400(
    auth_client: AsyncClient, db: Session
):
    requester_id = await _get_me_id(auth_client)
    post = _make_post(db, requester_id)

    res = await auth_client.post(
        "/trade-requests",
        json={
            "recipient_id": requester_id,
            "target_post_id": post.id,
            "request_type": "WANT_TO_TRADE",
        },
    )
    assert res.status_code == 400
    assert "own" in res.json()["detail"].lower()


async def test_create_trade_request_wrong_recipient_returns_400(
    auth_client: AsyncClient, db: Session
):
    suffix = uuid.uuid4().hex[:8]
    real_owner = _make_user(db, suffix)
    wrong_recipient = _make_user(db, suffix + "w")
    post = _make_post(db, real_owner.id)

    res = await auth_client.post(
        "/trade-requests",
        json={
            "recipient_id": wrong_recipient.id,
            "target_post_id": post.id,
            "request_type": "WANT_TO_TRADE",
        },
    )
    assert res.status_code == 400


async def test_create_trade_request_requires_auth(client: AsyncClient, db: Session):
    suffix = uuid.uuid4().hex[:8]
    recipient = _make_user(db, suffix)
    post = _make_post(db, recipient.id)
    res = await client.post(
        "/trade-requests",
        json={
            "recipient_id": recipient.id,
            "target_post_id": post.id,
            "request_type": "WANT_TO_TRADE",
        },
    )
    assert res.status_code == 401


async def test_create_trade_request_duplicate_pending_returns_409(
    auth_client: AsyncClient, db: Session
):
    suffix = uuid.uuid4().hex[:8]
    recipient = _make_user(db, suffix)
    post = _make_post(db, recipient.id)
    payload = {
        "recipient_id": recipient.id,
        "target_post_id": post.id,
        "request_type": "WANT_TO_TRADE",
    }

    r1 = await auth_client.post("/trade-requests", json=payload)
    assert r1.status_code == 201

    r2 = await auth_client.post("/trade-requests", json=payload)
    assert r2.status_code == 409


async def test_create_trade_request_three_strike_block(
    auth_client: AsyncClient, db: Session
):
    requester_id = await _get_me_id(auth_client)
    suffix = uuid.uuid4().hex[:8]
    recipient = _make_user(db, suffix)
    post = _make_post(db, recipient.id)

    # 3 pre-existing DECLINED trades → next request must be blocked
    for _ in range(3):
        p = _make_post(db, recipient.id)
        _make_trade(db, requester_id, recipient.id, p.id, "DECLINED")

    res = await auth_client.post(
        "/trade-requests",
        json={
            "recipient_id": recipient.id,
            "target_post_id": post.id,
            "request_type": "WANT_TO_TRADE",
        },
    )
    assert res.status_code == 403


# ── GET /trade-requests/inbox ─────────────────────────────────────────────────

async def test_get_inbox_returns_pending_for_recipient(
    auth_client: AsyncClient, db: Session
):
    recipient_id = await _get_me_id(auth_client)
    suffix = uuid.uuid4().hex[:8]
    requester = _make_user(db, suffix)
    post = _make_post(db, recipient_id)
    _make_trade(db, requester.id, recipient_id, post.id, "PENDING")

    res = await auth_client.get("/trade-requests/inbox")
    assert res.status_code == 200
    body = res.json()
    assert len(body) >= 1
    assert all(t["status"] == "PENDING" for t in body)


async def test_get_inbox_does_not_return_declined(
    auth_client: AsyncClient, db: Session
):
    recipient_id = await _get_me_id(auth_client)
    suffix = uuid.uuid4().hex[:8]
    requester = _make_user(db, suffix)
    post = _make_post(db, recipient_id)
    _make_trade(db, requester.id, recipient_id, post.id, "DECLINED")

    res = await auth_client.get("/trade-requests/inbox")
    assert res.status_code == 200
    assert res.json() == []


async def test_get_inbox_requires_auth(client: AsyncClient):
    res = await client.get("/trade-requests/inbox")
    assert res.status_code == 401


# ── GET /trade-requests/inbox/count ──────────────────────────────────────────

async def test_get_inbox_count(auth_client: AsyncClient, db: Session):
    recipient_id = await _get_me_id(auth_client)
    suffix = uuid.uuid4().hex[:8]
    requester = _make_user(db, suffix)

    for _ in range(2):
        post = _make_post(db, recipient_id)
        _make_trade(db, requester.id, recipient_id, post.id, "PENDING")

    res = await auth_client.get("/trade-requests/inbox/count")
    assert res.status_code == 200
    assert res.json()["count"] >= 2


# ── GET /trade-requests/sent ──────────────────────────────────────────────────

async def test_get_sent_returns_own_requests(
    auth_client: AsyncClient, db: Session
):
    requester_id = await _get_me_id(auth_client)
    suffix = uuid.uuid4().hex[:8]
    recipient = _make_user(db, suffix)
    post = _make_post(db, recipient.id)
    _make_trade(db, requester_id, recipient.id, post.id, "PENDING")

    res = await auth_client.get("/trade-requests/sent")
    assert res.status_code == 200
    body = res.json()
    assert len(body) >= 1
    assert all(t["requester_id"] == requester_id for t in body)


# ── POST /trade-requests/{id}/accept ─────────────────────────────────────────

async def test_accept_trade_request_sets_accepted(
    auth_client: AsyncClient, db: Session
):
    recipient_id = await _get_me_id(auth_client)
    suffix = uuid.uuid4().hex[:8]
    requester = _make_user(db, suffix)
    post = _make_post(db, recipient_id)
    trade = _make_trade(db, requester.id, recipient_id, post.id)

    res = await auth_client.post(f"/trade-requests/{trade.id}/accept")
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "ACCEPTED"


async def test_accept_trade_request_by_requester_returns_403(
    auth_client: AsyncClient, db: Session
):
    requester_id = await _get_me_id(auth_client)
    suffix = uuid.uuid4().hex[:8]
    recipient = _make_user(db, suffix)
    post = _make_post(db, recipient.id)
    trade = _make_trade(db, requester_id, recipient.id, post.id)

    res = await auth_client.post(f"/trade-requests/{trade.id}/accept")
    assert res.status_code == 403


async def test_accept_nonexistent_trade_returns_404(auth_client: AsyncClient):
    res = await auth_client.post("/trade-requests/999999999/accept")
    assert res.status_code == 404


async def test_accept_already_resolved_trade_returns_400(
    auth_client: AsyncClient, db: Session
):
    recipient_id = await _get_me_id(auth_client)
    suffix = uuid.uuid4().hex[:8]
    requester = _make_user(db, suffix)
    post = _make_post(db, recipient_id)
    trade = _make_trade(db, requester.id, recipient_id, post.id, "ACCEPTED")

    res = await auth_client.post(f"/trade-requests/{trade.id}/accept")
    assert res.status_code == 400


# ── POST /trade-requests/{id}/decline ────────────────────────────────────────

async def test_decline_trade_request_returns_204(
    auth_client: AsyncClient, db: Session
):
    recipient_id = await _get_me_id(auth_client)
    suffix = uuid.uuid4().hex[:8]
    requester = _make_user(db, suffix)
    post = _make_post(db, recipient_id)
    trade = _make_trade(db, requester.id, recipient_id, post.id)

    res = await auth_client.post(f"/trade-requests/{trade.id}/decline")
    assert res.status_code == 204


async def test_decline_trade_request_by_requester_returns_403(
    auth_client: AsyncClient, db: Session
):
    requester_id = await _get_me_id(auth_client)
    suffix = uuid.uuid4().hex[:8]
    recipient = _make_user(db, suffix)
    post = _make_post(db, recipient.id)
    trade = _make_trade(db, requester_id, recipient.id, post.id)

    res = await auth_client.post(f"/trade-requests/{trade.id}/decline")
    assert res.status_code == 403


async def test_decline_nonexistent_trade_returns_404(auth_client: AsyncClient):
    res = await auth_client.post("/trade-requests/999999999/decline")
    assert res.status_code == 404
