"""merge heads and add deleted_at to produtos

Revision ID: c5d6e7f8a9b0
Revises: a1c2e3f4b5d6, d1e2f3a4b5c6, f1a2b3c4d5e6
Create Date: 2026-07-28

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'c5d6e7f8a9b0'
down_revision: Union[str, tuple] = ('a1c2e3f4b5d6', 'd1e2f3a4b5c6', 'f1a2b3c4d5e6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE produtos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL")


def downgrade() -> None:
    op.drop_column('produtos', 'deleted_at')
