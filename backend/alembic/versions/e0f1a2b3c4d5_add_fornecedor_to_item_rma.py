"""add fornecedor to item_rma

Revision ID: e0f1a2b3c4d5
Revises: b1c2d3e4f5a6
Create Date: 2026-07-15 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e0f1a2b3c4d5'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('item_rma', sa.Column('fornecedor', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('item_rma', 'fornecedor')
