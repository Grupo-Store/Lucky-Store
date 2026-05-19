"""merge dashboard_goals and expenses heads

Revision ID: c6c8376ba5c2
Revises: f0a1b2c3d4e5, f6a7b8c9d0e1
Create Date: 2026-05-19 15:50:27.179517

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c6c8376ba5c2'
down_revision: Union[str, None] = ('f0a1b2c3d4e5', 'f6a7b8c9d0e1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
