"""add offered_post_ids to trade_requests

Revision ID: a9b0c1d2e3f4
Revises: f1a2b3c4d5e6
Create Date: 2026-04-16 00:00:00.000000

Stores an ordered list of post IDs the requester is willing to trade away
for the target sticker. Nullable — offering specific posts is optional;
offered_folder_id remains a separate optional field.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a9b0c1d2e3f4"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "trade_requests",
        sa.Column(
            "offered_post_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Ordered list of post IDs the requester offers; null means no specific posts offered",
        ),
    )


def downgrade() -> None:
    op.drop_column("trade_requests", "offered_post_ids")
