import logging
import os
import time

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from urllib.parse import quote_plus

load_dotenv()
load_dotenv('.env.local', override=True)

logger = logging.getLogger(__name__)

# Queries that exceed this threshold are logged at WARNING so they surface in
# CloudWatch without spamming logs with every routine SELECT.
_SLOW_QUERY_MS = int(os.getenv("SLOW_QUERY_MS", "100"))

DB_USER = os.getenv("DB_USER")
DB_HOST = os.getenv("DB_HOST")
DB_PASSWORD = quote_plus(os.getenv("DB_PASSWORD", ""))
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


@event.listens_for(engine, "before_cursor_execute")
def _before_query(conn, cursor, statement, parameters, context, executemany):
    conn.info["query_start"] = time.perf_counter()


@event.listens_for(engine, "after_cursor_execute")
def _after_query(conn, cursor, statement, parameters, context, executemany):
    start = conn.info.get("query_start")
    if start is None:
        return
    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    if duration_ms > _SLOW_QUERY_MS:
        # Deferred import: logging_config may not be importable during plain
        # Alembic CLI runs that bypass main.py (e.g. `alembic upgrade head`).
        # The import succeeds once the package is installed; the fallback "-"
        # is harmless for migration runs where no request context exists.
        try:
            from backend.utils.logging_config import request_id_var
            req_id = request_id_var.get()
        except Exception:
            req_id = "-"

        logger.warning(
            "slow query",
            extra={
                "duration_ms": duration_ms,
                # Log the SQL template only — never log parameters, which can
                # contain user-supplied values (search terms, emails, etc.).
                "statement": statement[:500],
                "request_id": req_id,
            },
        )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
