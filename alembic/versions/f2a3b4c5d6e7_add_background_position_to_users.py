"""add_background_position_to_users

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-05-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f2a3b4c5d6e7'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('background_offset_x', sa.Float(), nullable=False, server_default='0'),
    )
    op.add_column(
        'users',
        sa.Column('background_offset_y', sa.Float(), nullable=False, server_default='0'),
    )
    op.add_column(
        'users',
        sa.Column('background_scale', sa.Float(), nullable=False, server_default='1'),
    )


def downgrade() -> None:
    op.drop_column('users', 'background_scale')
    op.drop_column('users', 'background_offset_y')
    op.drop_column('users', 'background_offset_x')
