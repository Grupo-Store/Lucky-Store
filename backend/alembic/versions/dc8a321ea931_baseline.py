"""baseline

Revision ID: dc8a321ea931
Revises: 
Create Date: 2026-04-25 22:16:55.704721

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'dc8a321ea931'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
