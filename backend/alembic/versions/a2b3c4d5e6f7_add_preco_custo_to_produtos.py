"""add preco_custo to produtos

Revision ID: a2b3c4d5e6f7
Revises: c6c8376ba5c2
Create Date: 2026-05-21 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, None] = 'c6c8376ba5c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('produtos', sa.Column('preco_custo', sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('produtos', 'preco_custo')
