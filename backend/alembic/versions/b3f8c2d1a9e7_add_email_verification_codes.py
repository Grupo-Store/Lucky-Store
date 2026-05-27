"""add email_verification_codes table

Revision ID: b3f8c2d1a9e7
Revises: dc8a321ea931
Create Date: 2026-05-06

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'b3f8c2d1a9e7'
down_revision = 'dc8a321ea931'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'email_verification_codes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('code', sa.String(6), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_email_verification_codes_user_id', 'email_verification_codes', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_email_verification_codes_user_id', table_name='email_verification_codes')
    op.drop_table('email_verification_codes')
