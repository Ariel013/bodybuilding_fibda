import argparse
import importlib.util
from pathlib import Path
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect
from fibda.demo import seed_demo
from fibda.store import Store

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('fibda_launcher',ROOT/'launch.py')
launcher=importlib.util.module_from_spec(spec);spec.loader.exec_module(launcher)


def test_launcher_refuses_plain_lan_and_separates_data():
    args=argparse.Namespace(host='0.0.0.0',port=8443,cert=None,key=None)
    with pytest.raises(ValueError,match='HTTPS'):launcher.validate_config(args)
    args.host='127.0.0.1';launcher.validate_config(args)
    assert launcher.default_data_dir(True)!=launcher.default_data_dir(False)
    assert launcher.display_url('127.0.0.1',8443,False)=='http://127.0.0.1:8443'


def test_demo_only_idempotent_and_generated_accounts(tmp_path):
    store=Store(tmp_path/'demo',demo=True)
    def seed(conn):return seed_demo(store,conn,store.read_conn(conn))
    codes=store.transact(seed)
    event=store.read()
    assert len(event['people'])==24 and len(event['categories'])==3 and not event['rounds']
    assert len(event['jury']['panel'])==5 and len(event['jury']['trainees'])==1
    assert len(codes)==9 and len({value['code'] for value in codes.values()})==9
    assert store.transact(seed)=={}
    official=Store(tmp_path/'official')
    with pytest.raises(ValueError):official.transact(lambda conn:seed_demo(official,conn,official.read_conn(conn)))


def test_migration_fresh_and_existing_schema(tmp_path):
    for name,existing in [('new',False),('existing',True)]:
        database=tmp_path/(name+'.sqlite')
        engine=create_engine('sqlite:///'+str(database))
        if existing:
            from fibda.store import metadata
            metadata.create_all(engine)
        config=Config(str(ROOT/'alembic.ini'))
        config.set_main_option('sqlalchemy.url','sqlite:///'+str(database))
        command.upgrade(config,'head')
        tables=set(inspect(engine).get_table_names())
        assert {'events','users','sessions','audit','commands','photos','alembic_version'}<=tables
        command.upgrade(config,'head')


def test_public_url_requires_certificate_hostname(monkeypatch):
    class Context:
        def load_cert_chain(self,*args):pass
    monkeypatch.setattr(launcher.ssl,'SSLContext',lambda *args:Context())
    monkeypatch.setattr(launcher.ssl._ssl,'_test_decode_cert',lambda path:{'subjectAltName':(('DNS','competition.example.test'),)})
    args=argparse.Namespace(host='0.0.0.0',port=8443,cert='cert.pem',key='key.pem',public_url=None)
    with pytest.raises(ValueError,match='public-url'):launcher.validate_config(args)
    args.public_url='https://192.168.1.10:8443'
    with pytest.raises(launcher.ssl.CertificateError):launcher.validate_config(args)
    args.public_url='https://competition.example.test:8443'
    launcher.validate_config(args)
    assert launcher.display_url(args.host,args.port,True,args.public_url)==args.public_url
    args.public_url='https://competition.example.test:8443/wrong'
    with pytest.raises(ValueError):launcher.validate_config(args)


def test_old_sqlite_refuses_network_and_warns_local(monkeypatch,capsys):
    monkeypatch.setattr(launcher.sqlite3,'sqlite_version_info',(3,50,4))
    monkeypatch.setattr(launcher.sqlite3,'sqlite_version','3.50.4')
    with pytest.raises(ValueError,match='3.51.3'):launcher.check_sqlite('0.0.0.0')
    launcher.check_sqlite('127.0.0.1')
    assert 'AVERTISSEMENT' in capsys.readouterr().out
    monkeypatch.setattr(launcher.sqlite3,'sqlite_version_info',(3,51,3))
    launcher.check_sqlite('0.0.0.0')
