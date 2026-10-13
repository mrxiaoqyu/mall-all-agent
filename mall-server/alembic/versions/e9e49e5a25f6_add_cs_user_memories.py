"""add_cs_user_memories

Revision ID: e9e49e5a25f6
Revises: 5381b9f7841b
Create Date: 2026-10-13 09:10:05.388439

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e9e49e5a25f6'
down_revision: Union[str, Sequence[str], None] = '5381b9f7841b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'cs_user_memories',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('memory_type', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('source_session_id', sa.Integer(), nullable=True),
        sa.Column('relevance_score', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['source_session_id'], ['cs_sessions.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_cs_user_memories_user_type', 'cs_user_memories',
        ['user_id', 'memory_type'], unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_cs_user_memories_user_type', table_name='cs_user_memories')
    op.drop_table('cs_user_memories')
