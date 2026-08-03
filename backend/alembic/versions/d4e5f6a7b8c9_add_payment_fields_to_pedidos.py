"""add payment fields to pedidos

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-15

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('pedidos', sa.Column('data_pagamento', sa.Date(), nullable=True))
    op.add_column('pedidos', sa.Column('multa', sa.Numeric(12, 2), nullable=True))
    op.add_column('pedidos', sa.Column('juros', sa.Numeric(12, 2), nullable=True))
    op.add_column('pedidos', sa.Column('forma_pagamento_efetiva', sa.String(50), nullable=True))
    op.add_column('pedidos', sa.Column('num_parcelas_efetivas', sa.Integer(), nullable=True))
    op.add_column('pedidos', sa.Column('plano_parcelas', JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column('pedidos', 'plano_parcelas')
    op.drop_column('pedidos', 'num_parcelas_efetivas')
    op.drop_column('pedidos', 'forma_pagamento_efetiva')
    op.drop_column('pedidos', 'juros')
    op.drop_column('pedidos', 'multa')
    op.drop_column('pedidos', 'data_pagamento')
