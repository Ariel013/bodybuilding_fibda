import copy
import hashlib
import json
import secrets
import threading
import time
import uuid
from pathlib import Path
from sqlalchemy import create_engine, MetaData, Table, Column, String, Integer, Text, Float, select, insert, update, delete, event
from .resources import resource_path

metadata = MetaData()
events = Table('events', metadata, Column('id', String, primary_key=True), Column('version', Integer, nullable=False), Column('data', Text, nullable=False))
users = Table('users', metadata, Column('id', String, primary_key=True), Column('name', String, nullable=False), Column('roles', Text, nullable=False), Column('approved', Integer, nullable=False), Column('active', Integer, nullable=False), Column('code_hash', String, nullable=False), Column('created_at', Float, nullable=False))
sessions = Table('sessions', metadata, Column('id', String, primary_key=True), Column('user_id', String, nullable=False), Column('expires', Float, nullable=False))
commands = Table('commands', metadata, Column('id', String, primary_key=True), Column('user_id', String, nullable=False), Column('fingerprint', String, nullable=False), Column('result', Text, nullable=False), Column('version', Integer, nullable=False))
audit = Table('audit', metadata, Column('id', String, primary_key=True), Column('event_id', String, nullable=False), Column('user_id', String, nullable=False), Column('action', String, nullable=False), Column('at', Float, nullable=False), Column('data', Text, nullable=False))
photos = Table('photos', metadata, Column('id', String, primary_key=True), Column('owner_id', String, nullable=False), Column('owner_type', String, nullable=False), Column('kind', String, nullable=False), Column('approved', Integer, nullable=False), Column('consent', Integer, nullable=False), Column('filename', String, nullable=False))


def uid():
    return str(uuid.uuid4())


def dump(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)


def new_state(demo=False):
    return {'id':uid(),'version':0,'name':'Nouvelle compétition FIBDA','date':'2027-01-01','location':'','mode':'national','status':'preparation','demo':demo,'rules_version':'FIBDA-2026-09-22','restore_id':uid(),'bibs_distributed':False,'people':[],'entries':[],'categories':[],'officials':[],'rounds':[],'active_round_id':None,'public':{'main':{'kind':'idle'},'secondary':{'kind':'idle'},'backstage':{'kind':'idle'}},'alerts':[],'rewards':[],'exam_programs':[],'exam_decisions':[],'collective_decisions':[],'discipline_progress':{},'jury':{'panel':[],'trainees':[],'withdrawal_order':[]},'settings':{'collective_tiebreak':'','regulations_checked':False,'network_checked':False,'backup_checked':False},'rules_snapshot':None}


def safe_user(row):
    return {'id':row['id'],'name':row['name'],'roles':json.loads(row['roles']),'approved':bool(row['approved']),'active':bool(row['active'])}


class Store:
    def __init__(self, directory, demo=False, clock=None):
        self.directory=Path(directory).resolve(); self.directory.mkdir(parents=True,exist_ok=True)
        self.photos_dir=self.directory/'photos'; self.photos_dir.mkdir(exist_ok=True)
        self.db_path=self.directory/'competition.sqlite3'
        self.clock=clock or time.time; self.lock=threading.RLock()
        self.engine=create_engine('sqlite:///'+str(self.db_path),connect_args={'check_same_thread':False,'timeout':15})
        @event.listens_for(self.engine,'connect')
        def configure(conn, _):
            conn.execute('PRAGMA foreign_keys=ON'); conn.execute('PRAGMA journal_mode=WAL'); conn.execute('PRAGMA synchronous=FULL'); conn.execute('PRAGMA busy_timeout=15000')
        from alembic.config import Config
        from alembic import command
        config = Config(str(resource_path('alembic.ini')))
        config.set_main_option('script_location', str(resource_path('migrations')))
        with self.engine.begin() as connection:
            config.attributes['connection'] = connection
            command.upgrade(config, 'head')
        with self.engine.begin() as conn:
            if not conn.execute(select(events.c.id)).first():
                state=new_state(demo); conn.execute(insert(events).values(id=state['id'],version=0,data=dump(state)))
        self.demo=demo
        if self.read()['demo'] != demo:
            self.engine.dispose()
            raise ValueError('Ce dossier contient une autre nature de données : démonstration et officiel doivent rester séparés.')

    def read(self):
        with self.lock,self.engine.connect() as conn:
            return self.read_conn(conn)

    def read_conn(self,conn):
        row=conn.execute(select(events)).mappings().first()
        return json.loads(row['data'])

    def write(self,conn,state):
        conn.execute(update(events).where(events.c.id==state['id']).values(version=state['version'],data=dump(state)))

    def all_users(self,conn=None):
        if conn is not None:
            return [safe_user(row) for row in conn.execute(select(users)).mappings()]
        with self.engine.connect() as con:
            return self.all_users(con)

    def transact(self,operation):
        with self.lock,self.engine.connect() as conn:
            conn.exec_driver_sql('BEGIN IMMEDIATE')
            try:
                result=operation(conn)
                conn.commit(); return result
            except Exception:
                conn.rollback(); raise

    def record(self,conn,state,user_id,action,data):
        # Codes, sessions et photos binaires n'entrent jamais dans le journal.
        redacted={k:v for k,v in data.items() if k not in {'code','token','password','file'}}
        conn.execute(insert(audit).values(id=uid(),event_id=state['id'],user_id=user_id,action=action,at=self.clock(),data=dump(redacted)))
