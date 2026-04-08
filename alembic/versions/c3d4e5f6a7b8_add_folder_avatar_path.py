"""add_folder_avatar_path

Revision ID: c3d4e5f6a7b8
Revises: a1f3c8e02b47
Create Date: 2026-04-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'a1f3c8e02b47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'folders',
        sa.Column('avatar_path', sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('folders', 'avatar_path')
