import os

import jwt as pyjwt
from fastapi import Request
from slowapi import Limiter

# When BEHIND_PROXY=true, the leftmost IP in X-Forwarded-For is the real
# client IP (set by nginx). When running locally without a proxy, trusting
# that header would let any client spoof it to bypass limits.
def get_real_ip(request: Request) -> str:
    if os.getenv("BEHIND_PROXY", "false").lower() == "true":
        forwarded_for = request.headers.get("X-Forwarded-For", "")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
    return request.client.host


def _extract_user_sub(request: Request) -> str | None:
    # authenthicate_access_token returns the user as a dependency value and never
    # writes to request.state, so we decode the token here for rate-limit keying only.
    # Full validation still happens inside the endpoint dependency.
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        return None
    try:
        payload = pyjwt.decode(token, os.getenv("JWT_SECRET"), algorithms=["HS256"])
        sub = payload.get("sub")
        return str(sub) if sub else None
    except Exception:
        return None


def get_user_or_ip_key(request: Request) -> str:
    payload = getattr(request.state, "user", None)
    if payload is not None:
        return f"user:{payload['sub']}"
    sub = _extract_user_sub(request)
    if sub:
        return f"user:{sub}"
    return get_real_ip(request)


limiter = Limiter(
    key_func=get_real_ip,
    storage_uri=os.getenv("RATE_LIMIT_STORAGE_URL", "memory://"),
    enabled=os.getenv("TESTING", "false").lower() != "true" and "pytest" not in os.environ.get("PYTEST_CURRENT_TEST", ""),
)
