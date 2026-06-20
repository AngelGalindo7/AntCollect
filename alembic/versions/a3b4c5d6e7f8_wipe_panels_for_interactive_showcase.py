"""wipe panels for interactive showcase overhaul

Revision ID: a3b4c5d6e7f8
Revises: d2e3f4a5b6c7
Create Date: 2026-06-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, None] = 'd2e3f4a5b6c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Clean break: the new viewer renders a baked PNG + canvas_json overlay; pre-overhaul
    # panels have PNGs that predate the postId/overlay contract. TRUNCATE (not DELETE —
    # see cd.yml pre-flight guard on DELETE without WHERE) clears all rows and restarts
    # the identity sequence.
    op.execute("TRUNCATE TABLE panels RESTART IDENTITY")
    # Workspaces rows are kept (1:1 with user, auto-created on demand); reset z so new
    # panels start from a clean stacking context.
    op.execute("UPDATE workspaces SET z_counter = 0 WHERE z_counter <> 0")


def downgrade() -> None:
    pass  # irreversible: dropped panel content is not recoverable
