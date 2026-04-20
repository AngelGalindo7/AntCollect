"""add_sticker_library

Revision ID: 45e3494f7697
Revises: a9b0c1d2e3f4
Create Date: 2026-04-19 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '45e3494f7697'
down_revision: Union[str, None] = 'a9b0c1d2e3f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create sticker_library table (title is NOT unique to allow duplicates)
    op.create_table(
        'sticker_library',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('petr_dropper', sa.String(length=255), nullable=True),
        sa.Column('drop_date', sa.String(length=100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('added_by_user_id', sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(['added_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create sticker_library_images table
    op.create_table(
        'sticker_library_images',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('sticker_id', sa.BigInteger(), nullable=False),
        sa.Column('asset_id', sa.BigInteger(), nullable=False),
        sa.Column('order_index', sa.Integer(), server_default=sa.text('1'), nullable=False),
        sa.ForeignKeyConstraint(['asset_id'], ['media_assets.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['sticker_id'], ['sticker_library.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sticker_id', 'order_index', name='uq_sticker_image_order')
    )

    # Add GIN index for search (requires pg_trgm extension)
    # Note: On RDS, this extension must be installed by a superuser (handled in CD)
    try:
        op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    except Exception:
        # Ignore if user lacks privilege; index creation will fail if extension is truly missing
        pass
    op.execute('CREATE INDEX idx_sticker_title ON sticker_library USING gin (title gin_trgm_ops)')


def downgrade() -> None:
    op.drop_index('idx_sticker_title', table_name='sticker_library')
    op.drop_table('sticker_library_images')
    op.drop_table('sticker_library')
