"""add tipo to dashboard_goals and meta_vendedor

Revision ID: a1c2e3f4b5d6
Revises: c6c8376ba5c2, d0ba03d0f790
Create Date: 2026-06-24

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1c2e3f4b5d6'
down_revision = ('c6c8376ba5c2', 'e1f2a3b4c5d6')
branch_labels = None
depends_on = None


def upgrade() -> None:
    # dashboard_goals
    op.execute("ALTER TABLE dashboard_goals ADD COLUMN IF NOT EXISTS tipo VARCHAR(15) NOT NULL DEFAULT 'faturamento'")
    op.execute("ALTER TABLE dashboard_goals DROP CONSTRAINT IF EXISTS uq_dashboard_goal_ano_mes_loja")
    op.execute("ALTER TABLE dashboard_goals DROP CONSTRAINT IF EXISTS uq_dashboard_goal_ano_mes_loja_tipo")
    op.execute("ALTER TABLE dashboard_goals ADD CONSTRAINT uq_dashboard_goal_ano_mes_loja_tipo UNIQUE (ano, mes, id_loja, tipo)")

    # meta_vendedor
    op.execute("ALTER TABLE meta_vendedor ADD COLUMN IF NOT EXISTS tipo VARCHAR(15) NOT NULL DEFAULT 'faturamento'")
    op.execute("ALTER TABLE meta_vendedor DROP CONSTRAINT IF EXISTS meta_vendedor_id_vendedor_ano_mes_key")
    op.execute("ALTER TABLE meta_vendedor DROP CONSTRAINT IF EXISTS uq_meta_vendedor_mes_tipo")
    op.execute("ALTER TABLE meta_vendedor ADD CONSTRAINT uq_meta_vendedor_mes_tipo UNIQUE (id_vendedor, ano_mes, tipo)")


def downgrade() -> None:
    # meta_vendedor
    op.drop_constraint('uq_meta_vendedor_mes_tipo', 'meta_vendedor', type_='unique')
    op.create_unique_constraint('meta_vendedor_id_vendedor_ano_mes_key', 'meta_vendedor', ['id_vendedor', 'ano_mes'])
    op.drop_column('meta_vendedor', 'tipo')

    # dashboard_goals
    op.drop_constraint('uq_dashboard_goal_ano_mes_loja_tipo', 'dashboard_goals', type_='unique')
    op.create_unique_constraint('uq_dashboard_goal_ano_mes_loja', 'dashboard_goals', ['ano', 'mes', 'id_loja'])
    op.drop_column('dashboard_goals', 'tipo')
