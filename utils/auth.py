import bcrypt
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
import jwt

SECRET_KEY = "a_super_secret_key"
def hash_password(password: str) -> str:

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

    return hashed.decode("utf-8")


def verify_password(plain_passowrd: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_passowrd.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(data: dict, expires_delta: timedelta | None = None):

    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=30))
    to_encode.update({"exp": expire})
    token = jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")
    return token