import logging
import os
import time
import uuid

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from .routers import auth, users, posts, folders, trade_requests, library
from .utils.logging_config import configure_logging, request_id_var
from .utils.rate_limit import get_real_ip, limiter

# Must run before any logger is used. Replaces root-logger handlers with a
# single JSON-to-stdout handler and silences uvicorn's duplicate access log.
configure_logging()

logger = logging.getLogger(__name__)

# Warn when a full HTTP request (including middleware) exceeds this threshold.
_SLOW_REQUEST_MS = int(os.getenv("SLOW_REQUEST_MS", "500"))


class RequestTimingMiddleware(BaseHTTPMiddleware):
    """
    Outermost middleware. For every request it:
      - Generates a short request_id and sets it in the ContextVar so all log
        calls within the request (route handlers, DB listeners, auth utils)
        carry the same ID without explicit plumbing.
      - Measures end-to-end duration and emits one structured log line.
      - Adds X-Request-ID to the response so the frontend can report it.
      - Logs at WARNING for 4xx security events and slow requests; ERROR for 5xx.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = uuid.uuid4().hex[:12]
        token = request_id_var.set(request_id)
        start = time.perf_counter()

        try:
            response = await call_next(request)

            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            route = request.scope.get("route")
            path_template = getattr(route, "path", request.url.path)

            log_extra = {
                "method": request.method,
                "path": path_template,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "client_ip": get_real_ip(request),
            }

            if response.status_code >= 500:
                logger.error("request completed", extra=log_extra)
            elif response.status_code == 429:
                logger.warning("rate limit hit", extra=log_extra)
            elif response.status_code in (401, 403):
                logger.warning("auth rejected", extra=log_extra)
            elif duration_ms > _SLOW_REQUEST_MS:
                logger.warning("slow request", extra=log_extra)
            else:
                logger.info("request completed", extra=log_extra)

            response.headers["X-Request-ID"] = request_id
            return response

        except Exception:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.error(
                "unhandled exception during request",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": duration_ms,
                    "client_ip": get_real_ip(request),
                },
            )
            raise
        finally:
            # Reset after the log call above so the contextvar is clean for
            # the next request that reuses this task slot.
            request_id_var.reset(token)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if os.getenv("HTTPS_ENABLED", "false").lower() == "true":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


app = FastAPI()
app.state.limiter = limiter


async def _rate_limit_handler(request: Request, exc) -> JSONResponse:
    logger.warning(
        "rate limit exceeded",
        extra={
            "path": request.url.path,
            "client_ip": get_real_ip(request),
        },
    )
    return JSONResponse({"detail": "Too many requests"}, status_code=429)


app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)


async def _generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catch-all for any exception not handled by a more specific handler.
    Returning a JSONResponse here keeps the response inside FastAPI's ExceptionMiddleware,
    which sits below CORSMiddleware — so CORS headers are always present even on 500s.
    Without this, Starlette's outermost ServerErrorMiddleware generates a bare 500
    that bypasses CORSMiddleware entirely, causing the browser to report a CORS error.
    """
    logger.error(
        "unhandled exception",
        exc_info=exc,
        extra={"path": str(request.url), "method": request.method},
    )
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.add_exception_handler(Exception, _generic_exception_handler)

_allowed = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
origins = [o.strip() for o in _allowed.split(",")]

# Middleware order matters: add_middleware wraps in reverse — last added is outermost.
# Request flow: RequestTimingMiddleware → SecurityHeadersMiddleware → CORSMiddleware → route
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestTimingMiddleware)

app.include_router(users.router)
app.include_router(auth.router)
app.include_router(posts.router)
app.include_router(folders.router)
app.include_router(trade_requests.router)
app.include_router(library.router)


@app.get("/health")
def health():
    return {"status": "ok"}
