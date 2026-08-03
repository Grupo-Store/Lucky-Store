"""add id_cotacao to pedidos (origem da conversão) + backfill via audit log

Revision ID: d1e2f3a4b5c6
Revises: c0a1b2c3d4e5
Create Date: 2026-06-20 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'c0a1b2c3d4e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('pedidos', sa.Column('id_cotacao', UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_pedidos_id_cotacao', 'pedidos', 'cotacoes', ['id_cotacao'], ['id'],
    )
    # Backfill: pedidos que vieram de conversão têm cotacao_id no audit log de criação
    op.execute("""
        UPDATE pedidos p
        SET id_cotacao = (al.new_values->>'cotacao_id')::uuid
        FROM audit_logs al
        WHERE al.entity_type = 'pedido'
          AND al.entity_id = p.id
          AND al.new_values->>'cotacao_id' IS NOT NULL
          AND p.id_cotacao IS NULL
          AND EXISTS (
              SELECT 1 FROM cotacoes c WHERE c.id = (al.new_values->>'cotacao_id')::uuid
          )
    """)


def downgrade() -> None:
    op.drop_constraint('fk_pedidos_id_cotacao', 'pedidos', type_='foreignkey')
    op.drop_column('pedidos', 'id_cotacao')
