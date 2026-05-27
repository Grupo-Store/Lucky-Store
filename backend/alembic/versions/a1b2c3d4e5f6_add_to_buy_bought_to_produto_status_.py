"""add_to_buy_bought_to_produto_status_check

Revision ID: a1b2c3d4e5f6
Revises: cf3a980b6df6
Create Date: 2026-05-12 15:25:37.807338

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'cf3a980b6df6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_NEW_STATUSES = [
    'To Buy', 'Bought', 'Pending', 'To Purchase', 'In Stock',
    'Received', 'Ready', 'Shipped', 'Delivered', 'Delayed', 'Cancelled',
]
_OLD_STATUSES = [
    'Pending', 'To Purchase', 'In Stock', 'Received', 'Ready',
    'Shipped', 'Delivered', 'Delayed', 'Cancelled',
]


def _array_literal(statuses):
    values = ', '.join(f"'{s}'" for s in statuses)
    return f"ARRAY[{values}]::text[]"


def upgrade() -> None:
    op.execute('ALTER TABLE produtos DROP CONSTRAINT IF EXISTS produtos_status_check')
    op.execute(
        f"ALTER TABLE produtos ADD CONSTRAINT produtos_status_check "
        f"CHECK (status = ANY ({_array_literal(_NEW_STATUSES)}))"
    )


def downgrade() -> None:
    op.execute('ALTER TABLE produtos DROP CONSTRAINT IF EXISTS produtos_status_check')
    op.execute(
        f"ALTER TABLE produtos ADD CONSTRAINT produtos_status_check "
        f"CHECK (status = ANY ({_array_literal(_OLD_STATUSES)}))"
    )
