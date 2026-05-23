"""lowercase_emails

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-05-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, None] = 'b3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Abort if any two existing rows differ only by case. Auto-merging would
    # silently collapse accounts that the users still consider separate; the
    # operator must decide which row keeps the address.
    collisions = conn.execute(sa.text(
        """
        SELECT lower(email) AS lc, array_agg(email ORDER BY id) AS variants
        FROM users
        GROUP BY lower(email)
        HAVING count(*) > 1
        """
    )).fetchall()
    if collisions:
        detail = "; ".join(f"{row.lc!r}: {row.variants}" for row in collisions)
        raise RuntimeError(
            "Cannot lowercase emails — case-only duplicates exist. "
            "Reconcile one of each pair manually, then re-run migration. "
            f"Collisions: {detail}"
        )

    op.execute(sa.text(
        "UPDATE users SET email = lower(email) WHERE email != lower(email)"
    ))

    op.create_check_constraint(
        'users_email_lowercase_check',
        'users',
        'email = lower(email)',
    )


def downgrade() -> None:
    # Original mixed-case values are not recoverable; this only undoes the
    # forward invariant so future inserts can use mixed case again.
    op.drop_constraint('users_email_lowercase_check', 'users', type_='check')
