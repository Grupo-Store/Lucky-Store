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
    op.add_column('item_rma', sa.Column('valor_estornado', sa.Numeric(12, 2), nullable=True))
    op.add_column('item_rma', sa.Column('data_estorno', sa.Date(), nullable=True))
    op.add_column('item_rma', sa.Column('motivo_estorno', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('item_rma', 'motivo_estorno')
    op.drop_column('item_rma', 'data_estorno')
    op.drop_column('item_rma', 'valor_estornado')
