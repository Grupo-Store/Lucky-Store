"""update pedidos status check constraint

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-15

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW_STATUSES = (
    'To Buy', 'Bought', 'Received', 'To Invoice',
    'Invoiced and Received', 'Invoiced and Awaiting Receipt',
    'To Pack', 'Ready for Delivery', 'Out for Delivery',
    'Delivered', 'Delayed', 'Cancelled',
)

_OLD_STATUSES = (
    'To Buy', 'Bought', 'Received', 'To Invoice',
    'Invoiced', 'To Pack', 'Ready for Delivery', 'Out for Delivery',
    'Delivered', 'Delayed', 'Cancelled',
)


def _status_check(statuses: tuple) -> str:
    vals = ', '.join(f"'{s}'" for s in statuses)
    return f"status IN ({vals})"


def upgrade() -> None:
    op.drop_constraint('pedidos_status_check', 'pedidos', type_='check')
    op.create_check_constraint('pedidos_status_check', 'pedidos', _status_check(_NEW_STATUSES))


def downgrade() -> None:
    op.drop_constraint('pedidos_status_check', 'pedidos', type_='check')
    op.create_check_constraint('pedidos_status_check', 'pedidos', _status_check(_OLD_STATUSES))
