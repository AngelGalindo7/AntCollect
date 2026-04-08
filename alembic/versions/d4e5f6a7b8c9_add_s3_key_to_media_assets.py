"""add s3_key to media_assets

Revision ID: d4e5f6a7b8c9
Revises: eb5703a6fa90
Create Date: 2026-04-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'eb5703a6fa90'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('media_assets', sa.Column('s3_key', sa.String(512), nullable=True))


def downgrade() -> None:
    op.drop_column('media_assets', 's3_key')
