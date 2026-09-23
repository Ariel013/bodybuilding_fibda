from alembic import context
from sqlalchemy import engine_from_config, pool
from fibda.store import metadata

config = context.config
target_metadata = metadata

def run(connection):
    context.configure(connection=connection,target_metadata=target_metadata,render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()

if context.is_offline_mode():
    context.configure(url=config.get_main_option('sqlalchemy.url'),target_metadata=target_metadata,literal_binds=True,dialect_opts={'paramstyle':'named'})
    with context.begin_transaction():
        context.run_migrations()
else:
    connection = config.attributes.get('connection')
    if connection is not None:
        run(connection)
    else:
        connectable = engine_from_config(config.get_section(config.config_ini_section),prefix='sqlalchemy.',poolclass=pool.NullPool)
        with connectable.connect() as connection:
            run(connection)
