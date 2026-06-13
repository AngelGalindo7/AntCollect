import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from .errors import AppError, ErrorCode
# DECOMMISSIONED 2026-05-06: trading + messaging — see docs/RECOMMISSION_TRADING_MESSAGING.md
from .routers import auth, users, posts, folders, library, reports, canvas, workspace, oauth, user_sticker, binder  # trade_requests removed
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend.utils.background_removal import get_rembg_session
    try:
        get_rembg_session()
        logger.info("rembg session pre-warmed")
    except Exception:
        logger.warning("rembg session pre-warm failed; will retry on first request")
    yield


app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter


def _envelope(code: str, message: str, field: str | None = None) -> dict:
    """
    Canonical error response shape. `detail` is a back-compat shim for
    callers still reading the legacy field; remove once all frontend sites
    consume `error.message` (Layer 4 migration).
    """
    return {
        "error": {
            "code": code,
            "message": message,
            "field": field,
            "request_id": request_id_var.get(""),
        },
        "detail": message,
    }


# Maps bare HTTPException status codes to the closest stable error code.
# New code should raise AppError directly to skip this guess.
_HTTP_STATUS_TO_CODE: dict[int, ErrorCode] = {
    400: ErrorCode.VALIDATION,
    401: ErrorCode.UNAUTHORIZED,
    403: ErrorCode.FORBIDDEN,
    404: ErrorCode.NOT_FOUND,
    409: ErrorCode.CONFLICT,
    413: ErrorCode.POST_IMAGE_TOO_LARGE,
    429: ErrorCode.RATE_LIMITED,
}


async def _app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    logger.info(
        "app error",
        extra={
            "path": request.url.path,
            "code": exc.code.value,
            "status": exc.status,
            "field": exc.field,
        },
    )
    return JSONResponse(
        status_code=exc.status,
        content=_envelope(exc.code.value, exc.message, exc.field),
    )


async def _http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    code = _HTTP_STATUS_TO_CODE.get(exc.status_code, ErrorCode.INTERNAL)
    message = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return JSONResponse(
        status_code=exc.status_code,
        content=_envelope(code.value, message),
    )


async def _validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errs = exc.errors()
    first = errs[0] if errs else None
    # loc is like ("body", "post_images") — drop the source segment for the field name.
    field = ".".join(str(p) for p in first["loc"][1:]) if first and first.get("loc") else None
    message = first["msg"] if first else "Invalid request"
    return JSONResponse(
        status_code=422,
        content=_envelope(ErrorCode.VALIDATION.value, message, field),
    )


async def _rate_limit_handler(request: Request, exc) -> JSONResponse:
    logger.warning(
        "rate limit exceeded",
        extra={
            "path": request.url.path,
            "client_ip": get_real_ip(request),
        },
    )
    return JSONResponse(
        status_code=429,
        content=_envelope(ErrorCode.RATE_LIMITED.value, "Too many requests"),
    )


async def _generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catch-all for any exception not handled by a more specific handler.
    Returning a JSONResponse here keeps the response inside FastAPI's ExceptionMiddleware,
    which sits below CORSMiddleware — so CORS headers are always present even on 500s.
    """
    logger.error(
        "unhandled exception",
        exc_info=exc,
        extra={"path": str(request.url), "method": request.method},
    )
    return JSONResponse(
        status_code=500,
        content=_envelope(ErrorCode.INTERNAL.value, "Internal server error"),
    )


app.add_exception_handler(AppError, _app_error_handler)
app.add_exception_handler(HTTPException, _http_exception_handler)
app.add_exception_handler(RequestValidationError, _validation_exception_handler)
app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)
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
# DECOMMISSIONED 2026-05-06: trading + messaging — see docs/RECOMMISSION_TRADING_MESSAGING.md
# app.include_router(trade_requests.router)
app.include_router(library.router)
app.include_router(reports.router)
app.include_router(canvas.router)
app.include_router(workspace.router)
app.include_router(oauth.router)
app.include_router(user_sticker.router)
app.include_router(binder.router)


@app.get("/health")
def health():
    return {"status": "ok"}
