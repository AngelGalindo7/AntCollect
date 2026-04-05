from httpx import AsyncClient
from sqlalchemy.orm import Session

from backend.models import RefreshToken


# ── POST /auth/refresh-token ─────────────────────────────────────────────────

async def test_refresh_token_happy_path(auth_client: AsyncClient):
    # First rotation: old token revoked, new tokens set
    r1 = await auth_client.post("/auth/refresh-token")
    assert r1.status_code == 200
    assert "access_token" in r1.cookies
    assert "refresh_token" in r1.cookies

    # httpx updates the cookie jar from Set-Cookie headers, so the client
    # now holds the new refresh_token. A second rotation must also succeed.
    r2 = await auth_client.post("/auth/refresh-token")
    assert r2.status_code == 200


async def test_refresh_token_revoked_returns_401(
    auth_client: AsyncClient, db: Session
):
    token_str = auth_client.cookies.get("refresh_token")
    assert token_str, "auth_client must carry a refresh_token cookie after login"

    db_token = db.query(RefreshToken).filter(RefreshToken.token == token_str).first()
    assert db_token is not None, "Refresh token record missing from test DB"

    db_token.revoked = True
    db.flush()

    response = await auth_client.post("/auth/refresh-token")
    # Router filter (revoked == False) finds no row → unpacking None → caught
    # by the broad except → re-raised as 401
    assert response.status_code == 401


async def test_refresh_token_missing_cookie_returns_401(client: AsyncClient):
    # Plain client has no cookies — decode_refresh_token(None) raises 401
    response = await client.post("/auth/refresh-token")
    assert response.status_code == 401
