"""merge_heads

Revision ID: ca08251cbc81
Revises: c3d4e5f6a7b8, d4e5f6a7b8c9
Create Date: 2026-04-08 12:55:26.216286

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ca08251cbc81'
down_revision: Union[str, Sequence[str], None] = ('c3d4e5f6a7b8', 'd4e5f6a7b8c9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
