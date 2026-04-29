"""add_google_oauth

Revision ID: a1b2c3d4e5f6
Revises: f7a8b9c0d1e2
Create Date: 2026-04-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f7a8b9c0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('google_id', sa.String(255), nullable=True))
    op.create_unique_constraint('uq_users_google_id', 'users', ['google_id'])
    op.alter_column('users', 'password_hash', existing_type=sa.Text(), nullable=True)
    op.alter_column('refresh_tokens', 'token',
                    existing_type=sa.String(255),
                    type_=sa.Text(),
                    existing_nullable=False)


def downgrade() -> None:
    op.alter_column('refresh_tokens', 'token',
                    existing_type=sa.Text(),
                    type_=sa.String(255),
                    existing_nullable=False)
    op.alter_column('users', 'password_hash', existing_type=sa.Text(), nullable=False)
    op.drop_constraint('uq_users_google_id', 'users', type_='unique')
    op.drop_column('users', 'google_id')
