import logging
import os
import secrets
from urllib.parse import quote, urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import RefreshToken, User
from ..schemas import CompleteGoogleSignupRequest
from ..utils.auth import (
    create_access_token,
    create_google_pending_token,
    create_refresh_token,
    decode_google_pending_token,
)
from ..utils.rate_limit import limiter, get_real_ip
from .auth import _cookie_response, _apply_auth_cookies

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")
FRONTEND_URL = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")[0].strip()

_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_STATE_COOKIE = "oauth_state"
_PENDING_COOKIE = "google_pending_token"


def _cookie_cfg() -> tuple[bool, str | None]:
    return os.getenv("COOKIE_SECURE", "false").lower() == "true", os.getenv("COOKIE_DOMAIN") or None


@router.get("/google")
@limiter.limit("5/minute", key_func=get_real_ip)
def google_login(request: Request):
    """Initiate Google OAuth — redirect user to Google's consent screen."""
    state = secrets.token_urlsafe(32)
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    secure, domain = _cookie_cfg()
    response = RedirectResponse(url=f"{_GOOGLE_AUTH_URL}?{urlencode(params)}")
    response.set_cookie(
        key=_STATE_COOKIE,
        value=state,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=600,
        path="/",
        domain=domain,
    )
    return response


@router.get("/google/callback")
def google_callback(request: Request, db: Session = Depends(get_db)):
    """Handle Google's redirect back after user consent."""
    code = request.query_params.get("code")
    state_param = request.query_params.get("state")
    stored_state = request.cookies.get(_STATE_COOKIE)

    # Constant-time comparison prevents timing-based state forgery
    if not state_param or not stored_state or not secrets.compare_digest(state_param, stored_state):
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    with httpx.Client() as client:
        token_resp = client.post(
            _GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )

    if token_resp.status_code != 200:
        logger.warning("google token exchange failed", extra={"event": "oauth.google_token_error", "status": token_resp.status_code})
        raise HTTPException(status_code=400, detail="Failed to exchange authorization code")

    raw_id_token = token_resp.json().get("id_token")
    if not raw_id_token:
        raise HTTPException(status_code=400, detail="No ID token in Google response")

    # Verify signature against Google's public keys — rejects forged tokens
    try:
        id_info = google_id_token.verify_oauth2_token(
            raw_id_token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError as exc:
        logger.warning("google id token verification failed", extra={"event": "oauth.google_idtoken_invalid", "error": str(exc)})
        raise HTTPException(status_code=400, detail="Google ID token verification failed")

    if not id_info.get("email_verified"):
        raise HTTPException(status_code=400, detail="Google account email is not verified")

    google_id = id_info["sub"]
    email = id_info.get("email", "")
    display_name = id_info.get("given_name") or id_info.get("name") or ""

    if not email:
        raise HTTPException(status_code=400, detail="Google account must have a verified email address")

    # Returning user — google_id already linked
    existing_by_google = db.query(User).filter(User.google_id == google_id).first()
    if existing_by_google:
        logger.info("google login: returning user", extra={"event": "oauth.google_login", "user_id": existing_by_google.id})
        return _login_and_redirect(existing_by_google, db)

    # Existing email/password account — silently link and log in
    existing_by_email = db.query(User).filter(User.email == email).first()
    if existing_by_email:
        existing_by_email.google_id = google_id
        db.commit()
        logger.info("google login: linked existing account", extra={"event": "oauth.google_account_linked", "user_id": existing_by_email.id})
        return _login_and_redirect(existing_by_email, db)

    # New user — send to username picker
    logger.info("google login: new user, redirecting to setup", extra={"event": "oauth.google_new_user"})
    pending_token = create_google_pending_token(google_id, email, display_name)
    secure, domain = _cookie_cfg()
    response = RedirectResponse(url=f"{FRONTEND_URL}/setup-profile?name={quote(display_name)}")
    response.delete_cookie(_STATE_COOKIE, path="/", domain=domain)
    response.set_cookie(
        key=_PENDING_COOKIE,
        value=pending_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=600,
        path="/",
        domain=domain,
    )
    return response


@router.post("/google/complete")
def google_complete(
    body: CompleteGoogleSignupRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Create account after new Google user chooses a username."""
    pending_token = request.cookies.get(_PENDING_COOKIE)
    if not pending_token:
        raise HTTPException(status_code=401, detail="No pending signup session — please sign in with Google again")

    payload = decode_google_pending_token(pending_token)
    google_id = payload["google_id"]
    email = payload["email"]
    username = body.username

    if db.query(User).filter(User.google_id == google_id).first():
        raise HTTPException(status_code=409, detail="Account already exists, please log in")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=409, detail="Username already taken")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="Email already registered, please log in")

    user = User(username=username, email=email, google_id=google_id, password_hash=None)
    db.add(user)
    db.flush()
    logger.info("google signup: account created", extra={"event": "oauth.google_signup", "user_id": user.id})

    refresh_token_data = create_refresh_token({"sub": user.id})
    db.add(RefreshToken(
        user_id=user.id,
        token=refresh_token_data["token"],
        issued_at=refresh_token_data["issued_at"],
        expires_at=refresh_token_data["expires_at"],
    ))
    db.commit()

    access_token = create_access_token({
        "sub": str(user.id),
        "username": user.username,
        "email": user.email,
        "role": user.role,
    })

    _, domain = _cookie_cfg()
    response = _cookie_response(
        content={"id": user.id, "username": user.username, "email": user.email},
        access_token=access_token,
        refresh_token=refresh_token_data["token"],
    )
    response.delete_cookie(_PENDING_COOKIE, path="/", domain=domain)
    return response


def _login_and_redirect(user: User, db: Session) -> RedirectResponse:
    """Issue tokens and redirect a returning/linked Google user to /auth/complete."""
    refresh_token_data = create_refresh_token({"sub": user.id})
    db.add(RefreshToken(
        user_id=user.id,
        token=refresh_token_data["token"],
        issued_at=refresh_token_data["issued_at"],
        expires_at=refresh_token_data["expires_at"],
    ))
    db.commit()

    access_token = create_access_token({
        "sub": str(user.id),
        "username": user.username,
        "email": user.email,
        "role": user.role,
    })

    _, domain = _cookie_cfg()
    response = RedirectResponse(url=f"{FRONTEND_URL}/auth/complete")
    response.delete_cookie(_STATE_COOKIE, path="/", domain=domain)
    _apply_auth_cookies(response, access_token, refresh_token_data["token"])
    return response
