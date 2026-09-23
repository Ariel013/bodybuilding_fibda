import io
import json
import sqlite3
import uuid
from pathlib import Path
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from fibda.app import create_app


def cmd(client,kind,payload,version=None,ident=None):
    if version is None:version=client.get('/api/v1/state').json()['version']
    return client.post('/api/v1/command',json={'id':ident or str(uuid.uuid4()),'version':version,'type':kind,'payload':payload})


@pytest.fixture
def environment(tmp_path):
    app=create_app(tmp_path,testing=True)
    with TestClient(app) as client:
        assert client.post('/api/v1/auth/setup',json={'name':'Chef test','code':'chief-test-12345'}).status_code==200
        yield client,app


def person(client):
    pid=str(uuid.uuid4())
    response=cmd(client,'person.save',{'person':{'id':pid,'first_name':'Alice','last_name':'Fictive','birth_date':'1995-01-01','sex':'F','section':'amateur','country':'CI','nationalities':['CI']}})
    assert response.status_code==200,response.text
    return pid


def test_import_preview_commit_errors_and_stale(environment):
    client,app=environment
    response=client.post('/api/v1/imports/preview',files={'file':('people.csv',b'first_name,last_name,birth_date,sex,section,country,nationalities\nTest,Personne,1990-01-01,M,amateur,CI,CI\n','text/csv')})
    assert response.status_code==200,response.text
    preview=response.json(); assert preview['rows'] and not preview['errors']
    assert not app.state.store.read()['people']
    assert client.post('/api/v1/imports/commit',json={'preview_id':preview['preview_id']}).json()['count']==1
    assert client.post('/api/v1/imports/commit',json={'preview_id':preview['preview_id']}).status_code==422
    bad=client.post('/api/v1/imports/preview',files={'file':('bad.csv',b'first_name,last_name\n=1+1,Nom\n')}).json()
    assert bad['errors']
    assert client.post('/api/v1/imports/commit',json={'preview_id':bad['preview_id']}).status_code==422
    next_preview=client.post('/api/v1/imports/preview',files={'file':('good.csv',b'first_name,last_name,birth_date,sex,section,country,nationalities\nAutre,Nom,1990-01-01,M,amateur,CI,CI\n')}).json()
    person(client)
    assert client.post('/api/v1/imports/commit',json={'preview_id':next_preview['preview_id']}).status_code==409


def test_photo_consent_public_access_and_normalization(environment):
    client,app=environment;pid=person(client)
    stream=io.BytesIO();Image.new('RGB',(70,80),'blue').save(stream,'PNG')
    response=client.post('/api/v1/photos',data={'owner_type':'person','owner_id':pid,'kind':'portrait','crop':'[0,0,40,50]'},files={'file':('test.png',stream.getvalue(),'image/png')})
    assert response.status_code==200,response.text
    photo_id=response.json()['id']
    with TestClient(app) as public:
        assert public.get('/api/v1/photos/'+photo_id).status_code==401
        assert client.post('/api/v1/photos/'+photo_id+'/approve',json={'consent':False}).status_code==422
        assert client.post('/api/v1/photos/'+photo_id+'/approve',json={'consent':True}).status_code==200
        result=public.get('/api/v1/photos/'+photo_id)
        assert result.status_code==200 and result.headers['content-type']=='image/jpeg'
        assert Image.open(io.BytesIO(result.content)).size==(40,50)


def test_restore_preserves_old_data_and_invalidates_sessions(environment):
    client,app=environment
    person(client)
    backup=client.post('/api/v1/backup')
    assert backup.status_code==200 and backup.content.startswith(b'PK')
    prior=app.state.store.read()
    ident=str(uuid.uuid4())
    change=cmd(client,'event.update',{'name':'Après sauvegarde'},ident=ident)
    assert change.status_code==200,change.text
    changed=app.state.store.read()
    restored=client.post('/api/v1/restore',files={'file':('backup.zip',backup.content,'application/zip')})
    assert restored.status_code==200,restored.text
    assert restored.json()['restore_id']!=prior['restore_id']
    assert client.get('/api/v1/state').status_code==401
    before=list((app.state.store.directory/'restorations').glob('before-*'))
    assert len(before)==1
    with sqlite3.connect(before[0]/'competition.sqlite3') as conn:
        assert json.loads(conn.execute('select data from events').fetchone()[0])['name']=='Après sauvegarde'
    assert client.post('/api/v1/auth/login',json={'code':'chief-test-12345'}).status_code==200
    assert app.state.store.read()['name']==prior['name']
    # A stale version from before the backup must be rejected after restoration.
    assert cmd(client,'event.update',{'name':'Ancien brouillon'},version=prior['version']).status_code==409
    with app.state.store.engine.connect() as conn:
        assert conn.exec_driver_sql('select count(*) from commands').scalar()==0


def test_official_profile_never_creates_account_and_print_formats(environment):
    client,app=environment
    initial=len(app.state.store.all_users())
    result=cmd(client,'official.save',{'official':{'id':str(uuid.uuid4()),'first_name':'Invité','last_name':'FICTIF','post':'Président','organization':'Test','country':'CI'}})
    assert result.status_code==200,result.text
    assert len(app.state.store.all_users())==initial
    assert 'Invité' in client.get('/api/v1/print/officials').text
    for fmt,magic in [('csv',b'\xef\xbb\xbf'),('xlsx',b'PK'),('pdf',b'%PDF')]:
        response=client.get('/api/v1/export/officials?format='+fmt)
        assert response.status_code==200,response.text
        assert response.content.startswith(magic)


def test_judge_cannot_import_backup_or_read_other_ballots(tmp_path):
    app=create_app(tmp_path,demo=True,testing=True)
    with TestClient(app) as chief:
        demo=chief.post('/api/v1/demo').json()
        codes=demo['codes'];judges=[(uid,data) for uid,data in codes.items() if data['roles']==['judge']]
        first,second=judges[:2]
        def fixture(conn):
            state=app.state.store.read_conn(conn);cat=state['categories'][0];entries=cat['entry_ids'][:2]
            state['rounds']=[dict(id='test-round',category_id=cat['id'],phase='final',status='open',panel=[first[0],second[0]],trainees=[],participant_ids=entries,ballots={first[0]:dict(ranking=entries,version=1),second[0]:dict(ranking=entries[::-1],version=7)})]
            state['exam_programs']=[dict(user_id=first[0],round_ids=['test-round']),dict(user_id=second[0],round_ids=['test-round'])]
            app.state.store.write(conn,state)
        app.state.store.transact(fixture)
        with TestClient(app) as judge:
            assert judge.post('/api/v1/auth/login',json={'code':first[1]['code']}).status_code==200
            assert judge.post('/api/v1/backup').status_code==403
            assert judge.post('/api/v1/imports/preview',files={'file':('a.csv',b'first_name,last_name\nA,B\n')}).status_code==403
            assert judge.get('/api/v1/print/ballot?judge_id='+second[0]).status_code==403
            recap=judge.get('/api/v1/print/recap')
            assert recap.status_code==200,recap.text
            assert second[1]['name'] not in recap.text and first[1]['name'] in recap.text
            exam=judge.get('/api/v1/print/exams')
            assert second[1]['name'] not in exam.text and first[1]['name'] in exam.text
            for kind in ('recap','exams'):
                export=judge.get('/api/v1/export/'+kind+'?format=csv')
                assert export.status_code==200
                assert second[1]['name'] not in export.text and first[1]['name'] in export.text


def test_invalid_restore_preserves_live_state(environment):
    client,app=environment
    before=app.state.store.read()
    response=client.post('/api/v1/restore',files={'file':('wrong.zip',b'not-a-zip')})
    assert response.status_code==422
    assert app.state.store.read()==before
    assert client.get('/api/v1/state').status_code==200


def test_xlsx_preview_and_commit(environment):
    from openpyxl import Workbook
    client,app=environment
    workbook=Workbook();sheet=workbook.active
    sheet.append(['first_name','last_name','birth_date','sex','section','country','nationalities'])
    sheet.append(['Fictive','Xlsx','1995-01-01','F','amateur','CI','CI|FR'])
    stream=io.BytesIO();workbook.save(stream)
    response=client.post('/api/v1/imports/preview',files={'file':('test.xlsx',stream.getvalue())})
    assert response.status_code==200,response.text
    preview=response.json();assert not preview['errors']
    assert client.post('/api/v1/imports/commit',json={'preview_id':preview['preview_id']}).status_code==200
    assert app.state.store.read()['people'][0]['nationalities']==['CI','FR']
