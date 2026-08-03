"""add envio de cotação fields to cotacoes

Revision ID: f3a4b5c6d7e8
Revises: e1f2a3b4c5d6
Create Date: 2026-06-19 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f3a4b5c6d7e8'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('cotacoes', sa.Column('data_entrega', sa.Date(), nullable=True))
    op.add_column('cotacoes', sa.Column('previsao_entrega', sa.Date(), nullable=True))
    op.add_column('cotacoes', sa.Column('forma_pagamento', sa.String(length=50), nullable=True))
    op.add_column('cotacoes', sa.Column('detalhes_pagamento', sa.Text(), nullable=True))
    op.add_column('cotacoes', sa.Column('prazo_pagamento', sa.Date(), nullable=True))
    op.add_column('cotacoes', sa.Column('garantia', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('cotacoes', 'garantia')
    op.drop_column('cotacoes', 'prazo_pagamento')
    op.drop_column('cotacoes', 'detalhes_pagamento')
    op.drop_column('cotacoes', 'forma_pagamento')
    op.drop_column('cotacoes', 'previsao_entrega')
    op.drop_column('cotacoes', 'data_entrega')
