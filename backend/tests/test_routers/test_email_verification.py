import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

import jwt
import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from backend.models import User
from backend.utils.auth import hash_password, _create_verification_token, SECRET_KEY


def _uid(prefix: str = "u") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _reg_payload() -> dict:
    suffix = uuid.uuid4().hex[:8]
    return {
        "username": f"evtest_{suffix}",
        "email": f"evtest_{suffix}@example.com",
        "password": "Securepass1!",
    }


# ── POST /users/create-user — email_verified defaults to False ───────────────

async def test_create_user_email_not_verified(client: AsyncClient):
    payload = _reg_payload()
    with patch("backend.routers.users.send_verification_email") as mock_send:
        response = await client.post("/users/create-user", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["email_verified"] is False
    mock_send.assert_called_once()
    called_email = mock_send.call_args[0][0]
    assert called_email == payload["email"]


# ── POST /auth/verify-email — valid signup_verify token ─────────────────────

async def test_verify_email_valid_token(client: AsyncClient, db: Session):
    creds = _reg_payload()
    with patch("backend.routers.users.send_verification_email"):
        resp = await client.post("/users/create-user", json=creds)
    user_id = resp.json()["id"]

    token = _create_verification_token(user_id, creds["email"], "signup_verify")
    response = await client.post("/auth/verify-email", json={"token": token})

    assert response.status_code == 200
    assert response.json()["message"] == "Email verified successfully"

    db_user = db.query(User).filter(User.id == user_id).first()
    assert db_user.email_verified is True


# ── POST /auth/verify-email — expired token → 400 ───────────────────────────

async def test_verify_email_expired_token(client: AsyncClient, db: Session):
    creds = _reg_payload()
    with patch("backend.routers.users.send_verification_email"):
        resp = await client.post("/users/create-user", json=creds)
    user_id = resp.json()["id"]

    # Forge a token that expired 1 second ago.
    payload = {
        "sub": str(user_id),
        "email": creds["email"],
        "purpose": "signup_verify",
        "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
        "type": "email_verify",
    }
    expired_token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")

    response = await client.post("/auth/verify-email", json={"token": expired_token})
    assert response.status_code == 400
    assert "expired" in response.json()["detail"].lower()


# ── POST /auth/verify-email — wrong purpose (email_change) → 400 ────────────

async def test_verify_email_wrong_purpose(client: AsyncClient, db: Session):
    creds = _reg_payload()
    with patch("backend.routers.users.send_verification_email"):
        resp = await client.post("/users/create-user", json=creds)
    user_id = resp.json()["id"]

    # Token has purpose=email_change, not signup_verify.
    wrong_purpose_token = _create_verification_token(user_id, creds["email"], "email_change")
    response = await client.post("/auth/verify-email", json={"token": wrong_purpose_token})

    assert response.status_code == 400
    assert "invalid" in response.json()["detail"].lower()


# ── POST /auth/verify-email — idempotent: second call still returns 200 ─────

async def test_verify_email_idempotent(client: AsyncClient, db: Session):
    creds = _reg_payload()
    with patch("backend.routers.users.send_verification_email"):
        resp = await client.post("/users/create-user", json=creds)
    user_id = resp.json()["id"]

    token = _create_verification_token(user_id, creds["email"], "signup_verify")

    first = await client.post("/auth/verify-email", json={"token": token})
    assert first.status_code == 200

    second = await client.post("/auth/verify-email", json={"token": token})
    assert second.status_code == 200
    assert second.json()["message"] == "Email verified successfully"


# ── PATCH /users/me/email — pending_email set, current email unchanged ───────

async def test_change_email_sets_pending(
    auth_client: AsyncClient, test_credentials: dict, db: Session
):
    new_email = f"new_{uuid.uuid4().hex[:8]}@example.com"

    with patch("backend.routers.users.send_email_change_verification") as mock_send:
        response = await auth_client.patch(
            "/users/me/email",
            json={"new_email": new_email, "password": test_credentials["password"]},
        )

    assert response.status_code == 200

    db_user = db.query(User).filter(User.email == test_credentials["email"]).first()
    assert db_user is not None
    # Current email unchanged.
    assert db_user.email == test_credentials["email"]
    # Pending email set to requested value.
    assert db_user.pending_email == new_email

    mock_send.assert_called_once()
    called_email = mock_send.call_args[0][0]
    assert called_email == new_email


# ── POST /auth/confirm-email-change — valid token swaps email ────────────────

async def test_confirm_email_change_valid(
    auth_client: AsyncClient, test_credentials: dict, db: Session
):
    new_email = f"confirmed_{uuid.uuid4().hex[:8]}@example.com"

    with patch("backend.routers.users.send_email_change_verification"):
        await auth_client.patch(
            "/users/me/email",
            json={"new_email": new_email, "password": test_credentials["password"]},
        )

    db_user = db.query(User).filter(User.email == test_credentials["email"]).first()
    assert db_user is not None
    user_id = db_user.id

    token = _create_verification_token(user_id, new_email, "email_change")
    response = await auth_client.post(
        "/auth/confirm-email-change", json={"token": token}
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Email updated successfully"

    db.refresh(db_user)
    assert db_user.email == new_email
    assert db_user.pending_email is None
    assert db_user.email_verified is True


# ── POST /auth/confirm-email-change — pending_email mismatch → no-op 200 ────

async def test_confirm_email_change_mismatched_pending(
    auth_client: AsyncClient, test_credentials: dict, db: Session
):
    # Set pending_email to one address but craft a token for a different address.
    pending = f"pending_{uuid.uuid4().hex[:8]}@example.com"
    token_email = f"other_{uuid.uuid4().hex[:8]}@example.com"

    with patch("backend.routers.users.send_email_change_verification"):
        await auth_client.patch(
            "/users/me/email",
            json={"new_email": pending, "password": test_credentials["password"]},
        )

    db_user = db.query(User).filter(User.email == test_credentials["email"]).first()
    assert db_user is not None
    user_id = db_user.id

    # Token refers to a different email — pending_email != token email.
    mismatched_token = _create_verification_token(user_id, token_email, "email_change")
    response = await auth_client.post(
        "/auth/confirm-email-change", json={"token": mismatched_token}
    )

    # Endpoint silently no-ops (anti-enumeration) and still returns 200.
    assert response.status_code == 200

    db.refresh(db_user)
    # Email must not have changed.
    assert db_user.email == test_credentials["email"]


# ── POST /auth/resend-verification — already verified → 400 ──────────────────

async def test_resend_verification_already_verified(
    auth_client: AsyncClient, test_credentials: dict, db: Session
):
    # Force email_verified=True directly in DB.
    db_user = db.query(User).filter(User.email == test_credentials["email"]).first()
    assert db_user is not None
    db_user.email_verified = True
    db.flush()

    response = await auth_client.post("/auth/resend-verification")

    assert response.status_code == 400
    assert "already verified" in response.json()["detail"].lower()
