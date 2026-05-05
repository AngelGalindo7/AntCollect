"""create workspaces and panels

Revision ID: c8d9e0f1a2b3
Revises: a1b2c3d4e5f6
Create Date: 2026-05-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'c8d9e0f1a2b3'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'workspaces',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('z_counter', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_workspace_user'),
    )

    op.create_table(
        'panels',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('workspace_id', sa.BigInteger(), nullable=False),
        sa.Column('x', sa.Integer(), nullable=False),
        sa.Column('y', sa.Integer(), nullable=False),
        sa.Column('w', sa.Integer(), nullable=False),
        sa.Column('h', sa.Integer(), nullable=False),
        sa.Column('z', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('locked', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('title', sa.String(80), nullable=True),
        sa.Column('accent', sa.String(16), nullable=True),
        sa.Column('canvas_json', postgresql.JSONB(), nullable=True),
        sa.Column('preview_path', sa.String(1024), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('w >= 280', name='ck_panel_min_width'),
        sa.CheckConstraint('h >= 220', name='ck_panel_min_height'),
        sa.CheckConstraint('x >= 0', name='ck_panel_x_nonneg'),
        sa.CheckConstraint('y >= 0', name='ck_panel_y_nonneg'),
    )
    op.create_index('ix_panels_workspace_id', 'panels', ['workspace_id'])
    op.create_index('ix_panel_workspace_z', 'panels', ['workspace_id', 'z'])

    op.execute(
        """
        INSERT INTO workspaces (user_id, z_counter)
        SELECT uc.user_id, 1
        FROM user_canvases uc
        WHERE NOT EXISTS (
            SELECT 1 FROM workspaces w WHERE w.user_id = uc.user_id
        )
        """
    )

    op.execute(
        """
        INSERT INTO panels (workspace_id, x, y, w, h, z, locked, canvas_json, preview_path)
        SELECT w.id, 40, 40, 1120, 700, 1, false, uc.canvas_json, uc.preview_path
        FROM user_canvases uc
        JOIN workspaces w ON w.user_id = uc.user_id
        WHERE NOT EXISTS (
            SELECT 1 FROM panels p WHERE p.workspace_id = w.id
        )
        """
    )


def downgrade() -> None:
    op.drop_index('ix_panel_workspace_z', table_name='panels')
    op.drop_index('ix_panels_workspace_id', table_name='panels')
    op.drop_table('panels')
    op.drop_table('workspaces')
