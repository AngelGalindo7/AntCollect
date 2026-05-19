"""lowercase_usernames

Revision ID: b3c4d5e6f7a8
Revises: f2a3b4c5d6e7
Create Date: 2026-05-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, None] = 'f2a3b4c5d6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Abort if any two existing rows differ only by case. Auto-renaming would
    # silently overwrite the account a user thinks they own; the operator must
    # decide which row keeps the name.
    collisions = conn.execute(sa.text(
        """
        SELECT lower(username) AS lc, array_agg(username ORDER BY id) AS variants
        FROM users
        GROUP BY lower(username)
        HAVING count(*) > 1
        """
    )).fetchall()
    if collisions:
        detail = "; ".join(f"{row.lc!r}: {row.variants}" for row in collisions)
        raise RuntimeError(
            "Cannot lowercase usernames — case-only duplicates exist. "
            "Rename one of each pair manually, then re-run migration. "
            f"Collisions: {detail}"
        )

    op.execute(sa.text(
        "UPDATE users SET username = lower(username) WHERE username != lower(username)"
    ))

    op.create_check_constraint(
        'users_username_lowercase_check',
        'users',
        'username = lower(username)',
    )


def downgrade() -> None:
    # Original mixed-case values are not recoverable; this only undoes the
    # forward invariant so future inserts can use mixed case again.
    op.drop_constraint('users_username_lowercase_check', 'users', type_='check')
