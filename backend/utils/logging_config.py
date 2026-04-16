import contextvars
import logging
import os

from pythonjsonlogger import jsonlogger

# Holds the active request's ID for the duration of that request.
# Set in RequestTimingMiddleware before call_next; Starlette's BaseHTTPMiddleware
# copies the current context into the child task, so the value is visible in
# route handlers, auth utils, and SQLAlchemy event listeners without passing it
# explicitly. Resets to "-" after the response is returned.
request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default="-"
)


class _RequestIdFilter(logging.Filter):
    """Stamps every log record with the active request_id from the contextvar."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


def configure_logging() -> None:
    """
    Replace all root-logger handlers with a single structured-JSON handler.
    Must be called once at startup (top of main.py) before any loggers fire.

    Env vars:
        LOG_LEVEL — root log level (default INFO). Set DEBUG locally, INFO/WARNING in prod.
    """
    log_level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)

    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(name)s %(levelname)s %(message)s %(request_id)s",
        datefmt="%Y-%m-%dT%H:%M:%SZ",
        rename_fields={
            "asctime": "timestamp",
            "levelname": "level",
            "name": "logger",
        },
    )
    handler = logging.StreamHandler()
    handler.setFormatter(formatter)
    handler.addFilter(_RequestIdFilter())

    root = logging.getLogger()
    root.setLevel(log_level)
    root.handlers.clear()
    root.addHandler(handler)

    # Uvicorn's per-request access log is redundant with RequestTimingMiddleware,
    # which emits structured equivalents with more fields. Silence it entirely.
    logging.getLogger("uvicorn.access").propagate = False
