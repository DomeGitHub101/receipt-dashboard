"""Add bank transfer references while retaining existing receipt transactions."""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'

def upgrade():
    with op.batch_alter_table('transactions') as batch:
        batch.add_column(sa.Column('source', sa.String(20), nullable=False, server_default='manual'))
        batch.add_column(sa.Column('reference_code', sa.String(80), nullable=True))
        batch.create_unique_constraint('uq_transaction_user_reference', ['user_id', 'reference_code'])
    op.execute("UPDATE transactions SET source = 'receipt' WHERE receipt_id IS NOT NULL")

def downgrade():
    with op.batch_alter_table('transactions') as batch:
        batch.drop_constraint('uq_transaction_user_reference', type_='unique')
        batch.drop_column('reference_code')
        batch.drop_column('source')
