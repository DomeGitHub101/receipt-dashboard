"""Account verification, two-factor authentication and persistent throttling."""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'

def upgrade():
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('email_verified', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column('totp_secret', sa.String(300)))
        batch.add_column(sa.Column('totp_pending', sa.String(300)))
        batch.add_column(sa.Column('totp_pending_expires', sa.DateTime()))
        batch.add_column(sa.Column('totp_last_step', sa.Integer(), nullable=False, server_default='-1'))
    op.create_table('action_tokens', sa.Column('digest', sa.String(64), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('purpose', sa.String(20), nullable=False), sa.Column('expires_at', sa.DateTime(), nullable=False))
    op.create_index('ix_action_tokens_user_id', 'action_tokens', ['user_id'])
    op.create_table('recovery_codes', sa.Column('digest', sa.String(64), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False))
    op.create_index('ix_recovery_codes_user_id', 'recovery_codes', ['user_id'])
    op.create_table('auth_limits', sa.Column('key', sa.String(64), primary_key=True),
        sa.Column('count', sa.Integer(), nullable=False), sa.Column('expires_at', sa.DateTime(), nullable=False))

def downgrade():
    for table in ['auth_limits', 'recovery_codes', 'action_tokens']:
        op.drop_table(table)
    with op.batch_alter_table('users') as batch:
        for column in ['totp_last_step', 'totp_pending_expires', 'totp_pending', 'totp_secret', 'email_verified']:
            batch.drop_column(column)
