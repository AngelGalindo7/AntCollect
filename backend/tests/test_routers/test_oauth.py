import uuid
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from backend.models import User
from backend.utils.auth import create_google_pending_token

_PENDING_COOKIE = "google_pending_token"


# ── GET /auth/google ──────────────────────────────────────────────────────────

async def test_google_login_redirects_to_google(client: AsyncClient):
    res = await client.get("/auth/google", follow_redirects=False)
    assert res.status_code in (302, 307)
    assert "accounts.google.com" in res.headers["location"]
    assert "oauth_state" in res.cookies


async def test_google_login_sets_state_cookie(client: AsyncClient):
    res = await client.get("/auth/google", follow_redirects=False)
    assert "oauth_state" in res.cookies
    assert res.cookies["oauth_state"]  # non-empty


# ── GET /auth/google/callback ─────────────────────────────────────────────────

async def test_google_callback_state_mismatch_returns_400(client: AsyncClient):
    # State cookie and state param differ — CSRF check must reject this.
    client.cookies.set("oauth_state", "correct_state")
    res = await client.get(
        "/auth/google/callback",
        params={"state": "wrong_state", "code": "fake_code"},
    )
    assert res.status_code == 400
    assert "state" in res.json()["detail"].lower()


async def test_google_callback_missing_state_returns_400(client: AsyncClient):
    res = await client.get(
        "/auth/google/callback",
        params={"code": "fake_code"},
    )
    assert res.status_code == 400


async def test_google_callback_missing_code_returns_400(client: AsyncClient):
    state = "abc123"
    client.cookies.set("oauth_state", state)
    res = await client.get(
        "/auth/google/callback",
        params={"state": state},  # no code
    )
    assert res.status_code == 400
    assert "code" in res.json()["detail"].lower()


async def test_google_callback_google_token_failure_returns_400(client: AsyncClient):
    """Token exchange with Google fails — router must surface 400."""
    state = "valid_state_xyz"
    client.cookies.set("oauth_state", state)

    with patch("backend.routers.oauth.httpx.Client") as mock_httpx:
        mock_resp = mock_httpx.return_value.__enter__.return_value
        mock_resp.post.return_value.status_code = 400
        mock_resp.post.return_value.json.return_value = {}

        res = await client.get(
            "/auth/google/callback",
            params={"state": state, "code": "fake_code"},
        )
    assert res.status_code == 400


# ── POST /auth/google/complete ────────────────────────────────────────────────

async def test_google_complete_without_cookie_returns_401(client: AsyncClient):
    res = await client.post(
        "/auth/google/complete",
        json={"username": "newuser"},
    )
    assert res.status_code == 401


async def test_google_complete_creates_account(client: AsyncClient, db: Session):
    suffix = uuid.uuid4().hex[:8]
    google_id = f"google_{suffix}"
    email = f"oauth_{suffix}@gmail.com"
    username = f"oauth_{suffix}"

    pending_token = create_google_pending_token(google_id, email, "Test User")
    client.cookies.set(_PENDING_COOKIE, pending_token)

    res = await client.post(
        "/auth/google/complete",
        json={"username": username},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["username"] == username
    assert body["email"] == email
    assert "access_token" in res.cookies
    assert "refresh_token" in res.cookies

    db.expire_all()
    user = db.query(User).filter(User.google_id == google_id).first()
    assert user is not None
    assert user.password_hash is None


async def test_google_complete_duplicate_google_id_returns_409(
    client: AsyncClient, db: Session
):
    suffix = uuid.uuid4().hex[:8]
    google_id = f"google_{suffix}"
    email = f"dup_oauth_{suffix}@gmail.com"

    # Pre-create a user with this google_id
    user = User(
        username=f"existing_{suffix}",
        email=email,
        google_id=google_id,
        password_hash=None,
    )
    db.add(user)
    db.commit()

    pending_token = create_google_pending_token(google_id, email, "Test User")
    client.cookies.set(_PENDING_COOKIE, pending_token)

    res = await client.post(
        "/auth/google/complete",
        json={"username": f"other_{suffix}"},
    )
    assert res.status_code == 409
    assert "already exists" in res.json()["detail"].lower()


async def test_google_complete_taken_username_returns_409(
    client: AsyncClient, db: Session
):
    suffix = uuid.uuid4().hex[:8]
    taken_username = f"taken_{suffix}"

    existing = User(
        username=taken_username,
        email=f"taken_{suffix}@example.com",
        password_hash="hash",
    )
    db.add(existing)
    db.commit()

    pending_token = create_google_pending_token(
        f"gid_{suffix}", f"new_{suffix}@gmail.com", "New User"
    )
    client.cookies.set(_PENDING_COOKIE, pending_token)

    res = await client.post(
        "/auth/google/complete",
        json={"username": taken_username},
    )
    assert res.status_code == 409
    assert "taken" in res.json()["detail"].lower()
