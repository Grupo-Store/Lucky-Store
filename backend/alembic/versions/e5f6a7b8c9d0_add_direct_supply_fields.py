"""add direct supply fields to item_cotacao and produtos

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa

revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('item_cotacao', sa.Column('is_direct_supply', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('item_cotacao', sa.Column('porcentagem_fornecedor', sa.Numeric(5, 2), nullable=True))
    op.add_column('item_cotacao', sa.Column('frete_fornecedor', sa.Numeric(12, 2), nullable=True))

    op.add_column('produtos', sa.Column('is_direct_supply', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('produtos', sa.Column('porcentagem_fornecedor', sa.Numeric(5, 2), nullable=True))
    op.add_column('produtos', sa.Column('frete_fornecedor', sa.Numeric(12, 2), nullable=True))
    op.add_column('produtos', sa.Column('nota_fiscal_item', sa.String(100), nullable=True))


def downgrade():
    op.drop_column('item_cotacao', 'frete_fornecedor')
    op.drop_column('item_cotacao', 'porcentagem_fornecedor')
    op.drop_column('item_cotacao', 'is_direct_supply')

    op.drop_column('produtos', 'nota_fiscal_item')
    op.drop_column('produtos', 'frete_fornecedor')
    op.drop_column('produtos', 'porcentagem_fornecedor')
    op.drop_column('produtos', 'is_direct_supply')
