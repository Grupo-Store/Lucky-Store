"""add numero sequencial to cotacoes

Revision ID: b1c2d3e4f5a6
Revises: f0e1d2c3b4a5
Create Date: 2026-07-14 02:00:00.000000

Idempotente (IF NOT EXISTS) porque o banco de dev pode já ter a coluna/sequence
criadas por uma migration equivalente em outra branch.
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'f0e1d2c3b4a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS cotacao_numero_seq")
    op.execute("ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS numero INTEGER")
    # Numera as cotações sem número por ordem de criação (1, 2, 3, ...), continuando do máximo atual
    op.execute("""
        WITH ordered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
            FROM cotacoes WHERE numero IS NULL
        )
        UPDATE cotacoes c
        SET numero = o.rn + COALESCE((SELECT MAX(numero) FROM cotacoes), 0)
        FROM ordered o WHERE c.id = o.id
    """)
    op.execute(
        "SELECT setval('cotacao_numero_seq', "
        "COALESCE((SELECT MAX(numero) FROM cotacoes), 0) + 1, false)"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE cotacoes DROP COLUMN IF EXISTS numero")
    op.execute("DROP SEQUENCE IF EXISTS cotacao_numero_seq")
