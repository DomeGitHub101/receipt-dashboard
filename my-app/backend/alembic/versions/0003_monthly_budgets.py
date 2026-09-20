"""Add monthly and category budgets."""
from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'

def upgrade():
    op.create_table(
        'monthly_budgets',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('month', sa.String(7), nullable=False),
        sa.Column('amount', sa.Numeric(14, 2), nullable=False),
        sa.UniqueConstraint('user_id', 'month', name='uq_budget_user_month'),
    )
    op.create_index('ix_monthly_budgets_user_id', 'monthly_budgets', ['user_id'])
    op.create_index('ix_monthly_budgets_month', 'monthly_budgets', ['month'])
    op.create_table(
        'category_budgets',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('monthly_budget_id', sa.String(36), sa.ForeignKey('monthly_budgets.id'), nullable=False),
        sa.Column('category_id', sa.String(36), sa.ForeignKey('categories.id'), nullable=False),
        sa.Column('amount', sa.Numeric(14, 2), nullable=False),
        sa.UniqueConstraint('monthly_budget_id', 'category_id', name='uq_budget_category'),
    )
    op.create_index('ix_category_budgets_monthly_budget_id', 'category_budgets', ['monthly_budget_id'])
    op.create_index('ix_category_budgets_category_id', 'category_budgets', ['category_id'])

def downgrade():
    op.drop_table('category_budgets')
    op.drop_table('monthly_budgets')
