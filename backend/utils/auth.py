import bcrypt
import secrets
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import HTTPException, Depends, Request
from backend.schemas import AccessRequest, UserSearch
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
import os

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET")
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
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
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
        payload_type = payload.get("type")

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Access token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if not user_id:
        raise  HTTPException(status_code=401, detail="Invalid refresh token payload")
    if payload_type != "access":
        raise HTTPException(status_code=401, detail="Invalid payload type")
    
    return UserSearch(
        user_id=int(user_id),
        username=username,
        email=email
    )
