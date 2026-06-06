"""add used_verification_tokens

Revision ID: f8a9b0c1d2e3
Revises: e6f7a8b9c0d1
Create Date: 2026-06-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f8a9b0c1d2e3"
down_revision: Union[str, None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "used_verification_tokens",
        sa.Column("jti", sa.String(32), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("jti"),
    )
    op.create_index(
        "ix_used_verification_tokens_expires_at",
        "used_verification_tokens",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_used_verification_tokens_expires_at", table_name="used_verification_tokens")
    op.drop_table("used_verification_tokens")
