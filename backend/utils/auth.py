import bcrypt
import logging
import secrets
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from typing import List, Optional
import jwt
from fastapi import HTTPException, Depends, Request
from backend.schemas import AccessRequest, UserSearch
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
import os

load_dotenv()

logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("JWT_SECRET")
if not SECRET_KEY or len(SECRET_KEY) < 32:
    raise RuntimeError("JWT_SECRET env var is required and must be at least 32 characters")
security = HTTPBearer(auto_error=False) #Reads the "Authorization: Bearer <token> header"


def hash_password(password: str) -> str:

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_passowrd: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_passowrd.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=30))
    to_encode.update({"exp": expire, "type": "access"})
    token = jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")
    return token

def create_refresh_token(data: dict, expires_delta: timedelta | None = None):
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + (expires_delta or timedelta(days=10))

    # jti (JWT ID) makes every token unique even when issued in the same second
    payload = {
        "sub": str(data["sub"]),
        "exp": expires_at,
        "type": "refresh",
        "jti": secrets.token_hex(16),
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")

    token_info = {"issued_at":issued_at, "expires_at":expires_at,"token":token}
    return token_info

def decode_refresh_token(db_token):
    try:
        payload = jwt.decode(db_token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        payload_type = payload.get("type")

    except jwt.ExpiredSignatureError:
        logger.info("refresh token expired", extra={"event": "auth.refresh_token_expired"})
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        logger.warning("invalid refresh token", extra={"event": "auth.refresh_token_invalid"})
        raise HTTPException(status_code=401, detail="Invalid token")
    if not user_id:
        raise  HTTPException(status_code=401, detail="Invalid refresh token payload")
    if not payload_type == "refresh":
        raise HTTPException(status_code=401, detail="Invalid payload type")
    
    return user_id


def authenthicate_access_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security)):
    access_token_str = request.cookies.get("access_token")

    if not access_token_str and credentials:
        access_token_str = credentials.credentials
    if not access_token_str:
        raise HTTPException(status_code=401, detail="No access token provided")
    
    return _decode_access_token(access_token_str)


def _decode_access_token(access_token_str: str):
    
    try:
        payload = jwt.decode(access_token_str, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        username = payload.get("username")
        email = payload.get("email")
        role = payload.get("role", "user") # Default to user if not present
        payload_type = payload.get("type")

    except jwt.ExpiredSignatureError:
        logger.info("access token expired", extra={"event": "auth.access_token_expired"})
        raise HTTPException(status_code=401, detail="Access token expired")
    except jwt.InvalidTokenError:
        logger.warning("invalid access token", extra={"event": "auth.access_token_invalid"})
        raise HTTPException(status_code=401, detail="Invalid token")
    if not user_id:
        raise  HTTPException(status_code=401, detail="Invalid refresh token payload")
    if payload_type != "access":
        raise HTTPException(status_code=401, detail="Invalid payload type")
    
    return UserSearch(
        user_id=int(user_id),
        username=username,
        email=email,
        role=role
    )

def optional_auth_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> "UserSearch | None":
    access_token_str = request.cookies.get("access_token")
    if not access_token_str and credentials:
        access_token_str = credentials.credentials
    if not access_token_str:
        return None
    try:
        payload = jwt.decode(access_token_str, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        # Expired: treat as guest — frontend refreshes via /auth/refresh-token separately
        return None
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload.get("sub")
    if not user_id or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return UserSearch(
        user_id=int(user_id),
        username=payload.get("username"),
        email=payload.get("email"),
        role=payload.get("role", "user"),
    )


def create_google_pending_token(google_id: str, email: str, display_name: str) -> str:
    payload = {
        "google_id": google_id,
        "email": email,
        "display_name": display_name,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        "type": "google_pending",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def decode_google_pending_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Setup session expired, please sign in with Google again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid setup token")
    if payload.get("type") != "google_pending":
        raise HTTPException(status_code=401, detail="Invalid token type")
    return payload


def _create_verification_token(user_id: int, target_email: str, purpose: str) -> str:
    """
    purpose must be 'signup_verify' or 'email_change'.
    Expires in 1 hour. Never log the returned token.
    """
    payload = {
        "sub": str(user_id),
        "email": target_email,
        "purpose": purpose,
        "jti": secrets.token_hex(16),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "type": "email_verify",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: UserSearch = Depends(authenthicate_access_token)):
        if current_user.role not in self.allowed_roles:
            logger.warning(
                "insufficient permissions",
                extra={
                    "user_id": current_user.user_id,
                    "role": current_user.role,
                    "allowed_roles": self.allowed_roles
                }
            )
            raise HTTPException(
                status_code=403, 
                detail="You do not have permission to perform this action"
            )
        return current_user
