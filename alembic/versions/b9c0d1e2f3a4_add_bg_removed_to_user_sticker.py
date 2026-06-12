"""add bg_removed to user_sticker

Revision ID: b9c0d1e2f3a4
Revises: f8a9b0c1d2e3
Create Date: 2026-06-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b9c0d1e2f3a4'
down_revision: Union[str, None] = 'f8a9b0c1d2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'user_sticker',
        sa.Column('bg_removed_asset_id', sa.BigInteger(), nullable=True),
    )
    op.add_column(
        'user_sticker',
        sa.Column('bg_removed', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    )
    op.create_foreign_key(
        'fk_user_sticker_bg_removed_asset',
        'user_sticker',
        'media_assets',
        ['bg_removed_asset_id'],
        ['id'],
        ondelete='SET NULL',
    )

    with op.get_context().autocommit_block():
        op.create_index(
            'ix_user_sticker_bg_removed_asset_id',
            'user_sticker',
            ['bg_removed_asset_id'],
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            'ix_user_sticker_bg_removed_asset_id',
            table_name='user_sticker',
            postgresql_concurrently=True,
        )
    op.drop_constraint('fk_user_sticker_bg_removed_asset', 'user_sticker', type_='foreignkey')
    op.drop_column('user_sticker', 'bg_removed')
    op.drop_column('user_sticker', 'bg_removed_asset_id')
