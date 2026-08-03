"""add Estorno status to item_rma

Revision ID: f1a2b3c4d5e6
Revises: e0f1a2b3c4d5
Create Date: 2026-07-15 01:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e0f1a2b3c4d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD_STATUSES = (
    'Not Received', 'Received', 'Sent for Repair', 'In Repair',
    'Repaired Not Received', 'Repaired Received',
    'To Pack', 'Ready for Delivery', 'Out for Delivery', 'Delivered',
)

_NEW_STATUSES = (
    'Not Received', 'Received', 'Sent for Repair', 'In Repair',
    'Repaired Not Received', 'Repaired Received',
    'To Pack', 'Ready for Delivery', 'Out for Delivery', 'Delivered',
    'Estorno',
)


def _check(statuses: tuple) -> str:
    vals = ', '.join(f"'{s}'" for s in statuses)
    return f"status IN ({vals})"


def upgrade() -> None:
    op.drop_constraint('item_rma_status_check', 'item_rma', type_='check')
    op.create_check_constraint('item_rma_status_check', 'item_rma', _check(_NEW_STATUSES))


def downgrade() -> None:
    op.drop_constraint('item_rma_status_check', 'item_rma', type_='check')
    op.create_check_constraint('item_rma_status_check', 'item_rma', _check(_OLD_STATUSES))
