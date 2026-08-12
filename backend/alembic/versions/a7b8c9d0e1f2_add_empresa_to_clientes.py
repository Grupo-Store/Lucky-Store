"""add empresa (razão social) to clientes + índice de CNPJ normalizado

Revision ID: a7b8c9d0e1f2
Revises: d6e7f8a9b0c1
Create Date: 2026-08-09 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = 'd6e7f8a9b0c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('clientes', sa.Column('empresa', sa.String(length=255), nullable=True))
    # Índice funcional sobre o CNPJ sem pontuação, para o lookup do autocomplete
    # encontrar o cliente independente de como o documento foi digitado.
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_clientes_cnpj_digits "
        "ON clientes ((regexp_replace(cnpj, '[^0-9]', '', 'g')))"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_clientes_cnpj_digits")
    op.drop_column('clientes', 'empresa')
