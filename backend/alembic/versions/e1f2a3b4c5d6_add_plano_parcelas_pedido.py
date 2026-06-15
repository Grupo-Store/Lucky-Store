"""add plano_parcelas_pedido to pedidos

Revision ID: e1f2a3b4c5d6
Revises: d0ba03d0f790
Create Date: 2026-06-13 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'd0ba03d0f790'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('pedidos', sa.Column('plano_parcelas_pedido', JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column('pedidos', 'plano_parcelas_pedido')
