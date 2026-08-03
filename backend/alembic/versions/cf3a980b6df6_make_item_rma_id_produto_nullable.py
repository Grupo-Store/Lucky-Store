"""make_item_rma_id_produto_nullable

Revision ID: cf3a980b6df6
Revises: b3f8c2d1a9e7
Create Date: 2026-05-11 11:54:02.469066

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'cf3a980b6df6'
down_revision: Union[str, None] = 'b3f8c2d1a9e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('item_rma', 'id_produto_origem',
                    existing_type=sa.UUID(),
                    nullable=True)
    op.drop_constraint('item_rma_id_rma_id_produto_origem_key', 'item_rma', type_='unique')
    op.create_unique_constraint('uq_item_rma_rma_produto', 'item_rma', ['id_rma', 'id_produto_origem'])


def downgrade() -> None:
    op.drop_constraint('uq_item_rma_rma_produto', 'item_rma', type_='unique')
    op.create_unique_constraint('item_rma_id_rma_id_produto_origem_key', 'item_rma', ['id_rma', 'id_produto_origem'])
    op.alter_column('item_rma', 'id_produto_origem',
                    existing_type=sa.UUID(),
                    nullable=False)
