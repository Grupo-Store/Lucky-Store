"""add expenses table

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-05-19

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'expenses' not in inspector.get_table_names():
        op.create_table(
            'expenses',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('id_loja', postgresql.UUID(as_uuid=True),
                      sa.ForeignKey('lojas.id'), nullable=False),
            sa.Column('descricao', sa.String(255), nullable=False),
            sa.Column('valor', sa.Numeric(12, 2), nullable=False),
            sa.Column('data_prevista', sa.Date(), nullable=False),
            sa.Column('data_paga', sa.Date(), nullable=True),
            sa.Column('recorrente', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('parcelas', sa.Integer(), nullable=True),
            sa.Column('created_by', postgresql.UUID(as_uuid=True),
                      sa.ForeignKey('users.id'), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True),
                      server_default=sa.func.now(), nullable=False),
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index('ix_expenses_id_loja', 'expenses', ['id_loja'])
        op.create_index('ix_expenses_data_prevista', 'expenses', ['data_prevista'])


def downgrade() -> None:
    op.drop_index('ix_expenses_data_prevista', table_name='expenses')
    op.drop_index('ix_expenses_id_loja', table_name='expenses')
    op.drop_table('expenses')
