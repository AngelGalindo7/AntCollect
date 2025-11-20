import bcrypt
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import HTTPException

SECRET_KEY = "a_super_secret_key"
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
    to_encode = {"sub" : str(data["sub"])}
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at+ (expires_delta or timedelta(days = 10))

    payload = {"sub":str(data["sub"]),"exp": expires_at,"type": "refresh"}
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")

    token_info = {"issued_at":issued_at, "expires_at":expires_at,"token":token}
    return token_info

def valid_refresh_token(db_token):
    
    if db_token.revoked:
        raise HTTPException(status_code=401, detail="Refresh token revoked")
    try:
        payload = jwt.decode(db_token.token, SECRET_KEY, algorithms=["HS256"])
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
    
    return True

