"""add_email_verification_columns

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-06-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e6f7a8b9c0d1'
down_revision: Union[str, None] = 'd5e6f7a8b9c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column(
        'email_verified',
        sa.Boolean(),
        nullable=False,
        server_default=sa.text('false'),
    ))
    op.add_column('users', sa.Column(
        'pending_email',
        sa.String(50),
        nullable=True,
    ))
    op.execute("UPDATE users SET email_verified = TRUE")


def downgrade() -> None:
    op.drop_column('users', 'pending_email')
    op.drop_column('users', 'email_verified')
