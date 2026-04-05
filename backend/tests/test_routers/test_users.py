import uuid

from httpx import AsyncClient
from sqlalchemy.orm import Session

from backend.models import User
from backend.utils.auth import hash_password


def _uid(prefix: str = "u") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


# ── POST /users/create-user ──────────────────────────────────────────────────

async def test_create_user_success(client: AsyncClient):
    payload = {
        "username": _uid("reg"),
        "email": f"{_uid()}@example.com",
        "password": "Securepass1!",
    }
    response = await client.post("/users/create-user", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == payload["username"]
    assert body["email"] == payload["email"]
    assert "id" in body



# ── POST /users/login ────────────────────────────────────────────────────────

async def test_login_success(client: AsyncClient, test_credentials: dict):
    await client.post("/users/create-user", json=test_credentials)
    response = await client.post(
        "/users/login",
        json={
            "email": test_credentials["email"],
            "password": test_credentials["password"],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert "user" in body
    assert "id" in body["user"]
    assert "email" in body["user"]
    assert "username" in body["user"]
    assert "access_token" in response.cookies
    assert "refresh_token" in response.cookies


async def test_login_wrong_password(client: AsyncClient, test_credentials: dict):
    await client.post("/users/create-user", json=test_credentials)
    response = await client.post(
        "/users/login",
        json={
            "email": test_credentials["email"],
            "password": "definitelywrong!",
        },
    )
    assert response.status_code == 400


async def test_login_unknown_email(client: AsyncClient):
    response = await client.post(
        "/users/login",
        json={"email": "nobody@nowhere.example.com", "password": "irrelevant"},
    )
    assert response.status_code == 400


# ── GET /users/me ────────────────────────────────────────────────────────────

async def test_get_me_authenticated(auth_client: AsyncClient):
    response = await auth_client.get("/users/me")
    assert response.status_code == 200
    body = response.json()
    assert "id" in body
    assert "username" in body
    assert "email" in body
    assert "bio" in body
    assert "avatar_path" in body


async def test_get_me_unauthenticated(client: AsyncClient):
    response = await client.get("/users/me")
    assert response.status_code == 401


# ── PATCH /users/me/profile ──────────────────────────────────────────────────

async def test_update_profile_bio(auth_client: AsyncClient):
    new_bio = f"bio_{uuid.uuid4().hex[:8]}"
    response = await auth_client.patch("/users/me/profile", json={"bio": new_bio})
    assert response.status_code == 200
    assert response.json()["bio"] == new_bio


async def test_update_profile_username_conflict_409(
    auth_client: AsyncClient, db: Session
):
    taken_username = _uid("taken")
    other = User(
        username=taken_username,
        email=f"{_uid()}@example.com",
        password_hash=hash_password("Irrelevant1!"),
    )
    db.add(other)
    db.flush()  # visible to the router via the shared savepoint session

    response = await auth_client.patch(
        "/users/me/profile", json={"username": taken_username}
    )
    assert response.status_code == 409


async def test_update_profile_unauthenticated(client: AsyncClient):
    response = await client.patch("/users/me/profile", json={"bio": "x"})
    assert response.status_code == 401


# ── POST /users/me/password ──────────────────────────────────────────────────

async def test_change_password_success(
    auth_client: AsyncClient, test_credentials: dict
):
    response = await auth_client.post(
        "/users/me/password",
        json={
            "current_password": test_credentials["password"],
            "new_password": "NewPass1234!",
        },
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Password updated successfully"


async def test_change_password_wrong_current(auth_client: AsyncClient):
    response = await auth_client.post(
        "/users/me/password",
        json={"current_password": "totallyWrong!", "new_password": "NewPass1234!"},
    )
    assert response.status_code == 400


async def test_change_password_unauthenticated(client: AsyncClient):
    response = await client.post(
        "/users/me/password",
        json={"current_password": "any", "new_password": "NewPass1234!"},
    )
    assert response.status_code == 401
