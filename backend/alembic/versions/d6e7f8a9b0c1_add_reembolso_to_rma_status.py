"""add Reembolso status to rmas

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-07-28

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'd6e7f8a9b0c1'
down_revision: Union[str, None] = 'c5d6e7f8a9b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD_STATUSES = (
    'Registered', 'In Analysis', 'Approved', 'In Repair',
    'Repaired', 'Ready', 'Shipped', 'Delivered', 'Cancelled', 'Completed',
)

_NEW_STATUSES = (
    'Registered', 'In Analysis', 'Approved', 'In Repair',
    'Repaired', 'Ready', 'Shipped', 'Delivered', 'Cancelled', 'Completed',
    'Reembolso',
)


def _check(statuses: tuple) -> str:
    vals = ', '.join(f"'{s}'" for s in statuses)
    return f"status IN ({vals})"


def upgrade() -> None:
    op.execute("ALTER TABLE rmas DROP CONSTRAINT IF EXISTS rmas_status")
    op.execute("ALTER TABLE rmas DROP CONSTRAINT IF EXISTS rmas_status_check")
    op.create_check_constraint('rmas_status_check', 'rmas', _check(_NEW_STATUSES))


def downgrade() -> None:
    op.execute("ALTER TABLE rmas DROP CONSTRAINT IF EXISTS rmas_status_check")
    op.create_check_constraint('rmas_status_check', 'rmas', _check(_OLD_STATUSES))
