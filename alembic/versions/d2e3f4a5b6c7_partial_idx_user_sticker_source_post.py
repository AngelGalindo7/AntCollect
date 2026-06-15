"""partial index on user_sticker source_post_id where not null

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-06-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'd2e3f4a5b6c7'
down_revision: Union[str, None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.create_index(
            'ix_user_sticker_source_post_id_nonnull',
            'user_sticker',
            ['source_post_id'],
            postgresql_where='source_post_id IS NOT NULL',
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.drop_index(
            'ix_user_sticker_source_post_id_nonnull',
            table_name='user_sticker',
            postgresql_concurrently=True,
        )
