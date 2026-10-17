"""Move categories still on the old dark-theme default colours to the pastel palette."""
from alembic import op
import sqlalchemy as sa

revision = '0006'
down_revision = '0005'

# Old default -> new default, per default category. Only exact matches change, so colours people picked stay.
COLORS = [('#00704a', '#ff8fb1'), ('#c79254', '#7cc8f5'), ('#8ba99a', '#b79cff'), ('#90735c', '#ffb86b'),
          ('#b1bf84', '#7ed9a6'), ('#dbb6a0', '#ffd166'), ('#466c67', '#5fc6b8'), ('#a5a59a', '#b8b8c8')]

def _swap(pairs):
    update = sa.text('UPDATE categories SET color = :new WHERE lower(color) = :old')
    for old, new in pairs:
        op.execute(update.bindparams(old=old, new=new))

def upgrade():
    _swap(COLORS)

def downgrade():
    _swap([(new, old) for old, new in COLORS])
