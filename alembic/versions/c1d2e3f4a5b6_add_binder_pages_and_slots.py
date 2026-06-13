"""add binder, binder_page, and user_sticker slots

Revision ID: c1d2e3f4a5b6
Revises: b9c0d1e2f3a4
Create Date: 2026-06-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b9c0d1e2f3a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'binder',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('title', sa.String(length=80), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_binder_user'),
    )

    op.create_table(
        'binder_page',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('binder_id', sa.BigInteger(), nullable=False),
        sa.Column('page_index', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=80), nullable=True),
        sa.Column('rows', sa.Integer(), server_default=sa.text('3'), nullable=False),
        sa.Column('cols', sa.Integer(), server_default=sa.text('3'), nullable=False),
        sa.Column('background', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.CheckConstraint('rows >= 1 AND rows <= 8', name='ck_binder_page_rows'),
        sa.CheckConstraint('cols >= 1 AND cols <= 8', name='ck_binder_page_cols'),
        sa.ForeignKeyConstraint(['binder_id'], ['binder.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('binder_id', 'page_index', name='uq_binder_page_index'),
    )

    op.add_column('user_sticker', sa.Column('binder_page_id', sa.BigInteger(), nullable=True))
    op.add_column('user_sticker', sa.Column('slot_index', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_user_sticker_binder_page',
        'user_sticker',
        'binder_page',
        ['binder_page_id'],
        ['id'],
        ondelete='SET NULL',
    )
    # NULLs are distinct in Postgres, so many unfiled stickers (binder_page_id NULL)
    # coexist; the constraint only bites once a sticker occupies a real page slot.
    op.create_unique_constraint(
        'uq_user_sticker_binder_slot',
        'user_sticker',
        ['binder_page_id', 'slot_index'],
    )


def downgrade() -> None:
    op.drop_constraint('uq_user_sticker_binder_slot', 'user_sticker', type_='unique')
    op.drop_constraint('fk_user_sticker_binder_page', 'user_sticker', type_='foreignkey')
    op.drop_column('user_sticker', 'slot_index')
    op.drop_column('user_sticker', 'binder_page_id')
    op.drop_table('binder_page')
    op.drop_table('binder')
