"""add_folder_type

Revision ID: a1f3c8e02b47
Revises: 202371b0a196
Create Date: 2026-04-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1f3c8e02b47'
down_revision: Union[str, None] = '202371b0a196'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'folders',
        sa.Column('folder_type', sa.String(20), nullable=False, server_default='collection'),
    )


def downgrade() -> None:
    op.drop_column('folders', 'folder_type')
