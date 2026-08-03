"""merge_despesas_and_main_heads

Revision ID: d0ba03d0f790
Revises: b3c4d5e6f7a8, d2e3f4a5b6c7
Create Date: 2026-06-01 17:19:15.162576

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd0ba03d0f790'
down_revision: Union[str, None] = ('b3c4d5e6f7a8', 'd2e3f4a5b6c7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
