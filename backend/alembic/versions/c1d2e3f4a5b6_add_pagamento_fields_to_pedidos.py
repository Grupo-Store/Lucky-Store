"""add pagamento fields to pedidos

Revision ID: c1d2e3f4a5b6
Revises: b2c3d4e5f6a7
Create Date: 2026-05-25 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('pedidos', sa.Column('data_pagamento', sa.Date(), nullable=True))
    op.add_column('pedidos', sa.Column('valor_multa', sa.Numeric(12, 2), nullable=True))
    op.add_column('pedidos', sa.Column('valor_juros', sa.Numeric(12, 2), nullable=True))
    op.add_column('pedidos', sa.Column('metodo_pagamento', sa.String(50), nullable=True))
    op.add_column('pedidos', sa.Column('plano_parcelas', JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column('pedidos', 'plano_parcelas')
    op.drop_column('pedidos', 'metodo_pagamento')
    op.drop_column('pedidos', 'valor_juros')
    op.drop_column('pedidos', 'valor_multa')
    op.drop_column('pedidos', 'data_pagamento')
