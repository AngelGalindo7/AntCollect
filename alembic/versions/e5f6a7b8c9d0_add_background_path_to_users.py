"""add_background_path_to_users

Revision ID: e5f6a7b8c9d0
Revises: 62f091a74a10
Create Date: 2026-04-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = '62f091a74a10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('background_path', sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('users', 'background_path')
