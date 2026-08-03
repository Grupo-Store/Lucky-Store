"""add despesas table

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-05-25 00:01:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = 'd2e3f4a5b6c7'
down_revision: Union[str, None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'despesas',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tipo', sa.String(10), nullable=False),
        sa.Column('servico', sa.String(200), nullable=False),
        sa.Column('destino', sa.String(200), nullable=False, server_default=''),
        sa.Column('valor_previsto', sa.Numeric(12, 2), nullable=True),
        sa.Column('data_prevista', sa.Date(), nullable=True),
        sa.Column('status', sa.String(20), nullable=True),
        sa.Column('valor_pago', sa.Numeric(12, 2), nullable=True),
        sa.Column('data_pagamento', sa.Date(), nullable=True),
        sa.Column('metodo_pagamento', sa.String(50), nullable=True),
        sa.Column('parcelas', sa.Integer(), nullable=True),
        sa.Column('plano_parcelas', JSONB(), nullable=True),
        sa.Column('observacoes', sa.Text(), nullable=True),
        sa.Column('created_by', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('despesas')
