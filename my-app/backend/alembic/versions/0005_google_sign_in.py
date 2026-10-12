"""Google sign-in identities and password-less accounts."""
from alembic import op
import sqlalchemy as sa

revision = '0005'
down_revision = '0004'

def upgrade():
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('google_sub', sa.String(255)))
        batch.add_column(sa.Column('has_password', sa.Boolean(), nullable=False, server_default=sa.true()))
        batch.create_unique_constraint('uq_users_google_sub', ['google_sub'])

def downgrade():
    with op.batch_alter_table('users') as batch:
        batch.drop_constraint('uq_users_google_sub', type_='unique')
        batch.drop_column('has_password')
        batch.drop_column('google_sub')
