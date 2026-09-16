"""Create SlipSnap tables."""
from alembic import op
import sqlalchemy as sa

revision = '0001'
down_revision = None

def upgrade():
    op.create_table('users', sa.Column('id', sa.String(36), primary_key=True), sa.Column('email', sa.String(254), nullable=False), sa.Column('name', sa.String(80), nullable=False), sa.Column('password_hash', sa.String(200), nullable=False))
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_table('refresh_sessions', sa.Column('id', sa.String(36), primary_key=True), sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False), sa.Column('expires_at', sa.DateTime(), nullable=False))
    op.create_table('categories', sa.Column('id', sa.String(36), primary_key=True), sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False), sa.Column('name', sa.String(60), nullable=False), sa.Column('color', sa.String(7), nullable=False), sa.UniqueConstraint('user_id', 'name'))
    op.create_table('receipts', sa.Column('id', sa.String(36), primary_key=True), sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False), sa.Column('filename', sa.String(255), nullable=False), sa.Column('storage_name', sa.String(100), nullable=False), sa.Column('content_type', sa.String(60), nullable=False), sa.Column('raw_text', sa.Text(), nullable=False))
    op.create_table('transactions', sa.Column('id', sa.String(36), primary_key=True), sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False), sa.Column('merchant', sa.String(160), nullable=False), sa.Column('date', sa.Date(), nullable=False), sa.Column('amount', sa.Numeric(14, 2), nullable=False), sa.Column('kind', sa.String(10), nullable=False), sa.Column('category_id', sa.String(36), sa.ForeignKey('categories.id'), nullable=False), sa.Column('receipt_id', sa.String(36), sa.ForeignKey('receipts.id')), sa.Column('notes', sa.String(2000), nullable=False), sa.Column('line_items', sa.JSON(), nullable=False))
    for table in ['refresh_sessions', 'categories', 'receipts', 'transactions']:
        op.create_index(f'ix_{table}_user_id', table, ['user_id'])
    op.create_index('ix_transactions_date', 'transactions', ['date'])

def downgrade():
    for table in ['transactions', 'receipts', 'categories', 'refresh_sessions', 'users']:
        op.drop_table(table)
