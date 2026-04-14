"""rewrite S3 URLs to CloudFront URLs

Revision ID: f1a2b3c4d5e6
Revises: 2955404a34d7
Create Date: 2026-04-12 00:00:00.000000

Requires CLOUDFRONT_DOMAIN env var to be set before running.

"""
import json
import os
import re
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.orm import Session

revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "2955404a34d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Matches virtual-host-style S3 URLs and captures the key.
# https://bucket.s3.region.amazonaws.com/key
_S3_URL_RE = re.compile(r"https://[^/]+\.amazonaws\.com/(.+)")


def _to_cf(url: str, cf_domain: str) -> str:
    """Return a CloudFront URL for a given S3 URL, or the original if no match."""
    m = _S3_URL_RE.match(url)
    if not m:
        return url
    return f"https://{cf_domain}/{m.group(1)}"


def upgrade() -> None:
    cf_domain = os.environ.get("CLOUDFRONT_DOMAIN")
    if not cf_domain:
        raise RuntimeError(
            "CLOUDFRONT_DOMAIN env var must be set before running this migration."
        )

    bind = op.get_bind()
    session = Session(bind=bind)

    # ── users.avatar_path ───────────────────────────────────────────────────
    rows = session.execute(
        sa.text(
            "SELECT id, avatar_path FROM users "
            "WHERE avatar_path LIKE 'https://%.amazonaws.com/%'"
        )
    ).fetchall()
    for user_id, avatar_path in rows:
        session.execute(
            sa.text("UPDATE users SET avatar_path = :url WHERE id = :id"),
            {"url": _to_cf(avatar_path, cf_domain), "id": user_id},
        )

    # ── folders.avatar_path ─────────────────────────────────────────────────
    folder_rows = session.execute(
        sa.text(
            "SELECT id, avatar_path FROM folders "
            "WHERE avatar_path LIKE 'https://%.amazonaws.com/%'"
        )
    ).fetchall()
    for folder_id, avatar_path in folder_rows:
        session.execute(
            sa.text("UPDATE folders SET avatar_path = :url WHERE id = :id"),
            {"url": _to_cf(avatar_path, cf_domain), "id": folder_id},
        )

    # ── media_assets.file_url + json_metadata paths ─────────────────────────
    assets = session.execute(
        sa.text(
            "SELECT id, file_url, json_metadata FROM media_assets "
            "WHERE file_url LIKE 'https://%.amazonaws.com/%'"
        )
    ).fetchall()
    for asset_id, file_url, json_metadata in assets:
        new_file_url = _to_cf(file_url, cf_domain)

        new_metadata = json_metadata
        if json_metadata and "paths" in json_metadata:
            for size in ("original", "thumbnail", "medium"):
                if size in json_metadata["paths"]:
                    json_metadata["paths"][size] = _to_cf(
                        json_metadata["paths"][size], cf_domain
                    )
            new_metadata = json_metadata

        session.execute(
            sa.text(
                "UPDATE media_assets "
                "SET file_url = :file_url, json_metadata = :meta::jsonb "
                "WHERE id = :id"
            ),
            {
                "file_url": new_file_url,
                "meta": json.dumps(new_metadata),
                "id": asset_id,
            },
        )

    session.commit()


def downgrade() -> None:
    # Intentionally a no-op: reversing requires the original bucket/region,
    # which are not stored in this migration.
    pass
