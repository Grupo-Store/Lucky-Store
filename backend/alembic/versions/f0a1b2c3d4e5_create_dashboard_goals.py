"""create dashboard_goals table

Revision ID: f0a1b2c3d4e5
Revises: e5f6a7b8c9d0
Create Date: 2026-05-19

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'f0a1b2c3d4e5'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'dashboard_goals',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('ano', sa.Integer(), nullable=False),
        sa.Column('mes', sa.Integer(), nullable=False),
        sa.Column('id_loja', UUID(as_uuid=True), sa.ForeignKey('lojas.id', ondelete='CASCADE'), nullable=False),
        sa.Column('target', sa.Numeric(14, 2), nullable=False),
        sa.Column('floor', sa.Numeric(14, 2), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.UniqueConstraint('ano', 'mes', 'id_loja', name='uq_dashboard_goal_ano_mes_loja'),
    )


def downgrade() -> None:
    op.drop_table('dashboard_goals')
