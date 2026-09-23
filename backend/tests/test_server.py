import uuid
from fastapi.testclient import TestClient
from fibda.app import create_app


def client(tmp_path, clock=None):
    app = create_app(tmp_path, testing=True, clock=clock)
    return TestClient(app)


def setup(c):
    assert c.post('/api/v1/auth/setup', json={'name':'Chef Test','code':'Chef-Secure-12345'}).status_code == 200


def cmd(c, kind, payload=None, version=None, command_id=None):
    version = c.get('/api/v1/state').json()['version'] if version is None else version
    return c.post('/api/v1/command', json={'id':command_id or str(uuid.uuid4()),'version':version,'type':kind,'payload':payload or {}})


def test_setup_persist_and_auth(tmp_path):
    with client(tmp_path) as c:
        assert c.get('/api/v1/state').status_code == 401
        setup(c)
        assert cmd(c,'event.update',{'name':'National FIBDA'}).status_code == 200
        assert c.post('/api/v1/auth/setup',json={'name':'Intrus','code':'Intrus-12345678'}).status_code == 409
    with client(tmp_path) as c:
        assert c.post('/api/v1/auth/login',json={'code':'Chef-Secure-12345'}).status_code == 200
        assert c.get('/api/v1/state').json()['name'] == 'National FIBDA'


def test_idempotent_commands_and_stale_version(tmp_path):
    with client(tmp_path) as c:
        setup(c)
        ident=str(uuid.uuid4()); version=c.get('/api/v1/state').json()['version']
        a=cmd(c,'event.update',{'name':'A'},version,ident)
        b=cmd(c,'event.update',{'name':'A'},version,ident)
        assert a.status_code == b.status_code == 200
        assert a.json()['state']['version'] == b.json()['state']['version']
        assert cmd(c,'event.update',{'name':'B'},version).status_code == 409
        assert cmd(c,'event.update',{'name':'B'},version,ident).status_code == 409


def test_director_cannot_programme_or_vote(tmp_path):
    with client(tmp_path) as c:
        setup(c)
        assert cmd(c,'user.invite',{'name':'Direction','roles':['director'],'code':'Director-12345'}).status_code == 200
        c.post('/api/v1/auth/logout')
        assert c.post('/api/v1/auth/login',json={'code':'Director-12345'}).status_code == 200
        assert cmd(c,'programme.reorder',{'category_ids':[]}).status_code == 403
        assert cmd(c,'ballot.submit',{'round_id':'missing','ranking':[]}).status_code == 403


def test_public_has_no_private_data(tmp_path):
    with client(tmp_path) as c:
        setup(c)
        assert cmd(c,'official.save',{'official':{'first_name':'Anne','last_name':'Test','post':'Invitée','pedigree':'Médecin'}}).status_code == 200
        data=c.get('/api/v1/public/main').json()
        assert 'users' not in data and 'audit' not in data
        assert 'code' not in str(data) and 'Chef-Secure' not in str(data)
