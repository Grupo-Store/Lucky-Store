"""add estorno fields to item_rma (devolução/estorno no RMA)

Revision ID: f0e1d2c3b4a5
Revises: e1f2a3b4c5d6
Create Date: 2026-07-14 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f0e1d2c3b4a5'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE item_rma ADD COLUMN IF NOT EXISTS valor_estornado NUMERIC(12, 2)")
    op.execute("ALTER TABLE item_rma ADD COLUMN IF NOT EXISTS data_estorno DATE")
    op.execute("ALTER TABLE item_rma ADD COLUMN IF NOT EXISTS motivo_estorno VARCHAR(255)")


def downgrade() -> None:
    op.drop_column('item_rma', 'motivo_estorno')
    op.drop_column('item_rma', 'data_estorno')
    op.drop_column('item_rma', 'valor_estornado')
