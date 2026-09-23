"""Initial FIBDA persistence. Existing pre-migration tables are preserved."""
from alembic import op
import sqlalchemy as sa
revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    definitions = {
        'events':[('id',sa.String,False),('version',sa.Integer,False),('data',sa.Text,False)],
        'users':[('id',sa.String,False),('name',sa.String,False),('roles',sa.Text,False),('approved',sa.Integer,False),('active',sa.Integer,False),('code_hash',sa.String,False),('created_at',sa.Float,False)],
        'sessions':[('id',sa.String,False),('user_id',sa.String,False),('expires',sa.Float,False)],
        'commands':[('id',sa.String,False),('user_id',sa.String,False),('fingerprint',sa.String,False),('result',sa.Text,False),('version',sa.Integer,False)],
        'audit':[('id',sa.String,False),('event_id',sa.String,False),('user_id',sa.String,False),('action',sa.String,False),('at',sa.Float,False),('data',sa.Text,False)],
        'photos':[('id',sa.String,False),('owner_id',sa.String,False),('owner_type',sa.String,False),('kind',sa.String,False),('approved',sa.Integer,False),('consent',sa.Integer,False),('filename',sa.String,False)],
    }
    inspector=sa.inspect(op.get_bind())
    existing=set(inspector.get_table_names())
    for name,columns in definitions.items():
        if name in existing:
            present={col['name'] for col in inspector.get_columns(name)}
            if present != {col[0] for col in columns}:
                raise ValueError('Schéma préexistant incompatible : '+name)
            continue
        op.create_table(name,*[sa.Column(column,datatype(),nullable=nullable,primary_key=column=='id') for column,datatype,nullable in columns])


def downgrade():
    raise RuntimeError('Retour destructif interdit : restaurer une sauvegarde vérifiée dans un nouveau dossier')
