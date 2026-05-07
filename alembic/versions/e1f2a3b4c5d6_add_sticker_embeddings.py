"""add sticker embeddings

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-05-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'd0e1f2a3b4c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # On RDS the app user lacks privilege to create extensions; CD pipeline
    # installs `vector` via admin creds. Locally the dev user usually can.
    try:
        op.execute('CREATE EXTENSION IF NOT EXISTS vector')
    except Exception:
        pass

    op.add_column(
        'sticker_library',
        sa.Column('embedding', Vector(512), nullable=True),
    )

    op.execute(
        'CREATE INDEX idx_sticker_embedding '
        'ON sticker_library USING hnsw (embedding vector_cosine_ops)'
    )


def downgrade() -> None:
    op.drop_index('idx_sticker_embedding', table_name='sticker_library')
    op.drop_column('sticker_library', 'embedding')
