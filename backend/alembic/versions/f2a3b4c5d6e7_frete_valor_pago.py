"""Armazena pagamentos parciais sem reescrever os fretes existentes.

NULL mantém a interpretação legada de pago: true = valor integral; false = zero.
"""
from alembic import op

revision = 'f2a3b4c5d6e7'
down_revision = 'f1e2d3c4b5a6'
branch_labels = None
depends_on = None


def upgrade():
    op.execute('ALTER TABLE frete ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(12, 2)')


def downgrade():
    op.drop_column('frete', 'valor_pago')
