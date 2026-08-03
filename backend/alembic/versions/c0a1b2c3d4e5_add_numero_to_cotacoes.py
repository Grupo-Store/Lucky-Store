"""add numero sequencial to cotacoes

Revision ID: c0a1b2c3d4e5
Revises: f3a4b5c6d7e8
Create Date: 2026-06-19 01:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c0a1b2c3d4e5'
down_revision: Union[str, None] = 'f3a4b5c6d7e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS cotacao_numero_seq")
    op.add_column('cotacoes', sa.Column('numero', sa.Integer(), nullable=True))
    # Backfill: numera as cotações existentes por ordem de criação (1, 2, 3, ...)
    op.execute("""
        WITH ordered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
            FROM cotacoes
        )
        UPDATE cotacoes c SET numero = o.rn FROM ordered o WHERE c.id = o.id
    """)
    # Avança a sequence para o próximo número disponível
    op.execute(
        "SELECT setval('cotacao_numero_seq', "
        "COALESCE((SELECT MAX(numero) FROM cotacoes), 0) + 1, false)"
    )


def downgrade() -> None:
    op.drop_column('cotacoes', 'numero')
    op.execute("DROP SEQUENCE IF EXISTS cotacao_numero_seq")
