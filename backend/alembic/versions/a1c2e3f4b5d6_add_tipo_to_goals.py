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
    op.add_column('dashboard_goals', sa.Column('tipo', sa.String(15), nullable=False, server_default='faturamento'))
    op.drop_constraint('uq_dashboard_goal_ano_mes_loja', 'dashboard_goals', type_='unique')
    op.create_unique_constraint('uq_dashboard_goal_ano_mes_loja_tipo', 'dashboard_goals', ['ano', 'mes', 'id_loja', 'tipo'])

    # meta_vendedor (constraint auto-named by postgres: meta_vendedor_id_vendedor_ano_mes_key)
    op.add_column('meta_vendedor', sa.Column('tipo', sa.String(15), nullable=False, server_default='faturamento'))
    op.drop_constraint('meta_vendedor_id_vendedor_ano_mes_key', 'meta_vendedor', type_='unique')
    op.create_unique_constraint('uq_meta_vendedor_mes_tipo', 'meta_vendedor', ['id_vendedor', 'ano_mes', 'tipo'])


def downgrade() -> None:
    # meta_vendedor
    op.drop_constraint('uq_meta_vendedor_mes_tipo', 'meta_vendedor', type_='unique')
    op.create_unique_constraint('meta_vendedor_id_vendedor_ano_mes_key', 'meta_vendedor', ['id_vendedor', 'ano_mes'])
    op.drop_column('meta_vendedor', 'tipo')

    # dashboard_goals
    op.drop_constraint('uq_dashboard_goal_ano_mes_loja_tipo', 'dashboard_goals', type_='unique')
    op.create_unique_constraint('uq_dashboard_goal_ano_mes_loja', 'dashboard_goals', ['ano', 'mes', 'id_loja'])
    op.drop_column('dashboard_goals', 'tipo')
