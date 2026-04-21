"""add_reports

Revision ID: b1c2d3e4f5a6
Revises: 45e3494f7697
Create Date: 2026-04-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = '45e3494f7697'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'reports',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('reporter_id', sa.BigInteger(), nullable=False),
        sa.Column('target_type', sa.String(length=20), nullable=False),
        sa.Column('target_id', sa.BigInteger(), nullable=False),
        sa.Column('reason', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), server_default=sa.text("'pending'"), nullable=False),
        sa.Column('ai_score', sa.Float(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("target_type IN ('post', 'user')", name='ck_report_target_type'),
        sa.CheckConstraint("reason IN ('spam', 'inappropriate', 'harassment', 'copyright', 'other')", name='ck_report_reason'),
        sa.CheckConstraint("status IN ('pending', 'reviewed', 'dismissed', 'actioned')", name='ck_report_status'),
        sa.ForeignKeyConstraint(['reporter_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    # Prevent the same user from filing duplicate pending reports on the same target.
    op.create_index(
        'idx_reports_no_duplicate_pending',
        'reports',
        ['reporter_id', 'target_type', 'target_id'],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )
    # Fast lookup for "how many reports does this target have?"
    op.create_index('idx_reports_target', 'reports', ['target_type', 'target_id'])
    # Admin / AI review queue ordered by age.
    op.create_index('idx_reports_status_created', 'reports', ['status', 'created_at'])


def downgrade() -> None:
    op.drop_index('idx_reports_status_created', table_name='reports')
    op.drop_index('idx_reports_target', table_name='reports')
    op.drop_index('idx_reports_no_duplicate_pending', table_name='reports', postgresql_where=sa.text("status = 'pending'"))
    op.drop_table('reports')
