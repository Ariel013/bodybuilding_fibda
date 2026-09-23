import io
from PIL import Image
from fastapi.testclient import TestClient
from fibda.app import create_app
from fibda.projections import public_state, sync_collective_rewards, collective
from test_server import setup, cmd


def jpeg():
    output=io.BytesIO();Image.new('RGB',(32,32),'green').save(output,'JPEG');return output.getvalue()


def test_photo_revocation_blocks_old_public_url(tmp_path):
    app=create_app(tmp_path,testing=True)
    with TestClient(app) as c:
        setup(c)
        result=cmd(c,'official.save',{'official':{'first_name':'Marie','last_name':'Exemple','post':'Médecin'}})
        official=result.json()['state']['officials'][0]
        uploaded=c.post('/api/v1/photos',data={'owner_type':'official','owner_id':official['id'],'kind':'portrait'},files={'file':('photo.jpg',jpeg(),'image/jpeg')})
        photo=uploaded.json()['id']
        assert c.post(f'/api/v1/photos/{photo}/approve',json={'consent':True}).status_code==200
        with TestClient(app) as public:
            assert public.get(f'/api/v1/photos/{photo}').status_code==200
            assert cmd(c,'official.save',{'official':{**official,'photo_consent':False}}).status_code==200
            assert public.get(f'/api/v1/photos/{photo}').status_code==401


def test_restore_io_failure_preserves_live_data_and_session(tmp_path,monkeypatch):
    app=create_app(tmp_path,testing=True)
    with TestClient(app) as c:
        setup(c);backup=c.post('/api/v1/backup').content
        assert cmd(c,'event.update',{'name':'À conserver'}).status_code==200
        import fibda.app as application
        def fail(*args,**kwargs):raise OSError('Disque de recette indisponible')
        monkeypatch.setattr(application.shutil,'copytree',fail)
        response=c.post('/api/v1/restore',files={'file':('backup.zip',backup,'application/zip')})
        assert response.status_code==500
        state=c.get('/api/v1/state')
        assert state.status_code==200 and state.json()['name']=='À conserver'


def test_final_projection_does_not_include_eliminated_entries():
    state={'name':'FIBDA','mode':'national','demo':True,'version':1,'public':{'main':{'kind':'category','round_id':'r','category_id':'c'}},'rounds':[{'id':'r','participant_ids':['b'],'category_id':'c','phase':'final','discipline':'bikini','section':'amateur','result':None}], 'entries':[{'id':e,'person_id':e,'category_id':'c','bib':i,'confirmed':True} for i,e in enumerate('ab')], 'people':[{'id':e} for e in 'ab'],'officials':[],'categories':[{'id':'c'}]}
    assert [e['id'] for e in public_state(state,'main')['entries']]==['b']


def test_collective_awards_wait_for_all_finals_and_follow_revision():
    state={'mode':'national','people':[{'id':p,'club':p,'nationalities':['CI']} for p in 'ab'],'entries':[{'id':p,'person_id':p} for p in 'ab'],'rounds':[{'id':'r','phase':'final','section':'amateur','status':'validated','result':{'official':[{'entry_id':'a','rank':1},{'entry_id':'b','rank':2}],'version':1}},{'id':'s','phase':'final','section':'amateur','status':'pending','result':None}],'rewards':[],'collective_decisions':[]}
    sync_collective_rewards(state);assert not state['rewards']
    state['rounds'].pop();sync_collective_rewards(state)
    assert state['rewards'][0]['collective_name']=='a'
    state['rounds'][0]['result']={'official':[{'entry_id':'b','rank':1},{'entry_id':'a','rank':2}],'version':2}
    sync_collective_rewards(state);assert state['rewards'][0]['collective_name']=='b'
