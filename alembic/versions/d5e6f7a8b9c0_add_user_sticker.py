"""add_user_sticker

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-05-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_sticker',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('sticker_id', sa.BigInteger(), nullable=True),
        sa.Column('source_post_id', sa.BigInteger(), nullable=True),
        sa.Column('favorite', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('for_trade', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('condition', sa.Text(), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('acquired_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sticker_id'], ['sticker_library.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['source_post_id'], ['posts.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'user_sticker_image',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_sticker_id', sa.BigInteger(), nullable=False),
        sa.Column('asset_id', sa.BigInteger(), nullable=False),
        sa.Column('order_index', sa.Integer(), server_default=sa.text('1'), nullable=False),
        sa.ForeignKeyConstraint(['user_sticker_id'], ['user_sticker.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['asset_id'], ['media_assets.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_sticker_id', 'order_index', name='uq_user_sticker_image_order'),
    )

    # Indexes built concurrently (outside the transaction) so the pre-flight
    # lock check passes and the pattern stays consistent with future migrations
    # that add indexes to existing populated tables.
    with op.get_context().autocommit_block():
        op.create_index('ix_user_sticker_user_id', 'user_sticker', ['user_id'], postgresql_concurrently=True)
        op.create_index('ix_user_sticker_sticker_id', 'user_sticker', ['sticker_id'], postgresql_concurrently=True)
        op.create_index('ix_user_sticker_source_post_id', 'user_sticker', ['source_post_id'], postgresql_concurrently=True)


def downgrade() -> None:
    op.drop_table('user_sticker_image')
    with op.get_context().autocommit_block():
        op.drop_index('ix_user_sticker_source_post_id', table_name='user_sticker', postgresql_concurrently=True)
        op.drop_index('ix_user_sticker_sticker_id', table_name='user_sticker', postgresql_concurrently=True)
        op.drop_index('ix_user_sticker_user_id', table_name='user_sticker', postgresql_concurrently=True)
    op.drop_table('user_sticker')
