"""Adaptateur de démonstration locale ; aucun compte ni serveur officiel.

Les fonctions métier restent celles de backend/fibda. La frontière SQL est
remplacée par une transaction JSON ; le navigateur persiste le snapshot après
chaque commande, avant d'afficher son accusé de réception local.
"""
import ast
import base64
import copy
import hashlib
import io
import json
from pathlib import Path
import sys
import time
import types
from urllib.parse import parse_qs, urlsplit
import uuid
import zipfile

import fibda

ROOT = Path(fibda.__file__).parent
FORMAT = 'fibda-standalone'
SCHEMA = 1
MAX_SNAPSHOT = 200 * 1024 * 1024
DB = None
CLOCK = time.time


def _original_definitions(filename, names, namespace):
    tree = ast.parse((ROOT / filename).read_text())
    definitions = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.ClassDef)) and node.name in names:
            definitions.append(node)
        elif isinstance(node, ast.Assign) and any(isinstance(x, ast.Name) and x.id in names for x in node.targets):
            definitions.append(node)
    exec(compile(ast.Module(body=definitions, type_ignores=[]), str(ROOT / filename), 'exec'), namespace)


class _Column:
    def __init__(self, name): self.name = name
    def __eq__(self, value): return (self.name, value)


class _Table:
    def __init__(self, name):
        self.name = name
        self.c = types.SimpleNamespace(id=_Column('id'))


class _Query:
    def __init__(self, operation, table):
        self.operation, self.table, self.condition, self.data = operation, table, None, {}
    def where(self, condition): self.condition = condition; return self
    def values(self, **values): self.data = values; return self


class _Rows:
    def __init__(self, rows): self.rows = rows
    def mappings(self): return self
    def first(self): return next(iter(self.rows), None)
    def __iter__(self): return iter(self.rows)


def _select(table): return _Query('select', table)
def _insert(table): return _Query('insert', table)
def _update(table): return _Query('update', table)
def _uid(): return str(uuid.uuid4())


store_module = types.ModuleType('fibda.store')
store_module.__dict__.update(uid=_uid, json=json)
_original_definitions('store.py', {'new_state', 'dump', 'safe_user'}, store_module.__dict__)
store_module.users = _Table('users')
sys.modules['fibda.store'] = store_module

# Ces codes sont publics dans le kit de test : ce hash ne constitue pas une
# authentification sûre. L'application avec serveur conserve son auth originale.
auth_module = types.ModuleType('fibda.auth')
auth_module.__dict__.update(json=json, users=store_module.users, uid=_uid,
    dump=store_module.dump, select=_select, insert=_insert)
auth_module.hash_code = lambda code: 'local-test:' + hashlib.sha256(code.encode()).hexdigest()
auth_module.matches = lambda code, stored: auth_module.hash_code(code) == stored
_original_definitions('auth.py', {'ROLES', 'ADMIN', 'SPORT', 'PREPARATION', 'REGIE', 'Problem', 'require', 'add_user'}, auth_module.__dict__)
sys.modules['fibda.auth'] = auth_module
sql_module = types.ModuleType('sqlalchemy')
sql_module.update = _update
sys.modules['sqlalchemy'] = sql_module

from fibda.auth import Problem, require, ADMIN, PREPARATION, add_user
from fibda.commands import apply_command
from fibda.workflow import tick, find
from fibda.projections import project_state, public_state, exams, collective, sync_collective_rewards
from fibda.catalogue import load_catalogue, eligibility
from fibda.domain import DomainError
from fibda.printing import render_print, export_document
from fibda.transfers import preview_import, safe_members, MAX_FILE, MAX_TOTAL


class LocalStore:
    demo = True
    def clock(self): return CLOCK()
    def all_users(self, conn=None): return [store_module.safe_user(u) for u in DB['users']]
    def read_conn(self, conn=None): return copy.deepcopy(DB['state'])
    def read(self): return self.read_conn()
    def write(self, conn, state): DB['state'] = copy.deepcopy(state)
    def record(self, conn, state, user_id, action, data):
        safe = {k:v for k,v in data.items() if k not in {'code','token','password','file','data_url','data_b64','snapshot'}}
        DB['audit'].append(dict(id=_uid(), event_id=state['id'], user_id=user_id, action=action, at=self.clock(), data=copy.deepcopy(safe)))
    def execute(self, query):
        if not isinstance(query, _Query) or query.table.name != 'users':
            raise ValueError('Opération de stockage hors adaptateur')
        rows = DB['users']
        matches = [u for u in rows if not query.condition or u.get(query.condition[0]) == query.condition[1]]
        if query.operation == 'select': return _Rows(copy.deepcopy(matches))
        if query.operation == 'insert':
            row = copy.deepcopy(query.data)
            DB['users'].append(row)
            return _Rows([row])
        if query.operation == 'update':
            for row in matches: row.update(query.data)
            return _Rows(matches)
        raise ValueError('Opération de stockage inconnue')


STORE = LocalStore()


def _validate_snapshot(value):
    if not isinstance(value, dict) or value.get('format') != FORMAT or value.get('schema') != SCHEMA:
        raise Problem('Sauvegarde attendue : kit HTML autonome FIBDA, version 1.')
    state = value.get('state')
    if not isinstance(state, dict) or state.get('demo') is not True:
        raise Problem('Seules des données fictives de test sont acceptées.')
    for key in ('id','version','name','date','location','mode','status','restore_id','rules_version','public','settings','jury','discipline_progress'):
        if key not in state: raise Problem('Sauvegarde incomplète : '+key)
    if type(state['version']) is not int or state['mode'] not in {'national','international'} or state['status'] not in {'preparation','running','finished'}:
        raise Problem('État de compétition invalide.')
    for key in ('people','entries','categories','officials','rounds','alerts','rewards','exam_programs','exam_decisions','collective_decisions'):
        if not isinstance(state.get(key), list): raise Problem('Liste absente : '+key)
    for key in ('users','audit'):
        if not isinstance(value.get(key), list): raise Problem('Sauvegarde incomplète : '+key)
    for key in ('commands','photos','previews'):
        if not isinstance(value.get(key), dict): raise Problem('Sauvegarde incomplète : '+key)
    identifiers = {}
    for key in ('people','entries','categories','officials','rounds'):
        rows = state[key]
        if any(not isinstance(x,dict) or not isinstance(x.get('id'),str) or not x['id'] for x in rows): raise Problem('Identifiants invalides : '+key)
        identifiers[key] = {x['id'] for x in rows}
        if len(identifiers[key]) != len(rows): raise Problem('Identifiants répétés : '+key)
    user_ids = set()
    chiefs = 0
    for user in value['users']:
        if not isinstance(user,dict) or not isinstance(user.get('id'),str) or not user['id'] or user['id'] in user_ids: raise Problem('Comptes invalides dans la sauvegarde.')
        roles = json.loads(user['roles'])
        if not roles or not set(roles) <= auth_module.ROLES: raise Problem('Rôles invalides dans la sauvegarde.')
        if 'director' in roles and set(roles)&{'chief','responsable','judge','trainee'}: raise Problem('Compte directeur incompatible.')
        if 'trainee' in roles and set(roles)&{'chief','responsable','judge'}: raise Problem('Compte stagiaire incompatible.')
        if not isinstance(user.get('code_hash'),str) or not user['code_hash'].startswith('local-test:'): raise Problem('Codes de démonstration invalides.')
        store_module.safe_user(user)
        chiefs += int('chief' in roles)
        user_ids.add(user['id'])
    if chiefs != 1: raise Problem('Un seul chef est requis dans la sauvegarde.')
    for entry in state['entries']:
        if entry.get('person_id') not in identifiers['people'] or entry.get('category_id') not in identifiers['categories']: raise Problem('Inscription orpheline dans la sauvegarde.')
    for rnd in state['rounds']:
        overall_category = rnd.get('phase')=='overall' and rnd.get('category_id')=='overall-'+str(rnd.get('discipline'))+'-'+str(rnd.get('section'))
        if (rnd.get('category_id') not in identifiers['categories'] and not overall_category) or not set(rnd.get('participant_ids',[])) <= identifiers['entries']: raise Problem('Tour incohérent dans la sauvegarde.')
        if not set(rnd.get('panel',[])+rnd.get('trainees',[])) <= user_ids or not isinstance(rnd.get('ballots'),dict): raise Problem('Jury incohérent dans la sauvegarde.')
    for ident, photo in value['photos'].items():
        if not isinstance(photo,dict) or photo.get('id') != ident or photo.get('owner_type') not in {'person','official'}: raise Problem('Photo invalide dans la sauvegarde.')
        collection = 'people' if photo['owner_type']=='person' else 'officials'
        if photo.get('owner_id') not in identifiers[collection]: raise Problem('Photo orpheline dans la sauvegarde.')
        _photo_data(photo.get('data_url'))
    # Cette copie vérifie aussi l'absence de valeurs non JSON (NaN, objets natifs).
    return json.loads(store_module.dump(value))


def _accounts():
    return [{**store_module.safe_user(u), 'code':u.get('test_code','')} for u in DB['users']]


def _seed():
    global DB
    DB = dict(format=FORMAT, schema=SCHEMA, state=store_module.new_state(True), users=[], audit=[], commands={}, photos={}, previews={})
    specs = [('Chef démonstration',['chief'],'1111')]
    specs += [(f'Juge fictif {i}',['judge'],str(2000+i)) for i in range(1,5)]
    specs += [('Stagiaire démonstration',['trainee'],'3001'),('Responsable démonstration',['responsable'],'4444'),('Direction démonstration',['director'],'5555'),('Secrétariat démonstration',['secretariat'],'6666'),('Régie démonstration',['regie'],'7777'),('Speaker démonstration',['speaker'],'8888'),('Commission démonstration',['commission'],'9999')]
    for name, roles, code in specs:
        add_user(STORE, STORE, name, roles, code, True)
        DB['users'][-1]['test_code'] = code
    # seed_demo est réutilisé tel quel en raccordant ses créations à ces comptes.
    from fibda import demo
    original = demo.add_user
    def existing_account(store,conn,name,roles,code,approved=False):
        return next(u for u in STORE.all_users() if u['name']==name)
    demo.add_user = existing_account
    try: demo.seed_demo(STORE, STORE, DB['state'])
    finally: demo.add_user = original
    DB['state']['name'] = 'FIBDA — compétition fictive de test'
    DB['state']['settings']['collective_tiebreak'] = 'Test : décision motivée du chef et du directeur ; responsable en cas de désaccord.'
    return DB


def init(snapshot_json=''):
    global DB
    try:
        DB = _validate_snapshot(json.loads(snapshot_json)) if snapshot_json else _seed()
        return _response(200, {'initialized':True,'version':DB['state']['version'],'accounts':_accounts()})
    except (ValueError, KeyError, TypeError, Problem) as exc:
        return _response(getattr(exc,'status',422), {'detail':str(exc)})


def snapshot():
    if DB is None: raise ValueError('Adaptateur non initialisé')
    return store_module.dump(DB)


def _response(status, data, headers=None):
    out = {'status':status,'data':data}
    if headers: out['headers'] = headers
    return store_module.dump(out)


def _actor(identifier):
    user = next((u for u in DB['users'] if u['id']==identifier and u.get('active')),None)
    if not user: raise Problem('Connectez-vous avec votre code personnel de test.',401)
    if not user.get('approved'): raise Problem('Votre accès attend la validation du chef des juges.',403)
    return store_module.safe_user(user)


def _view(user): return project_state(DB['state'],user,STORE.all_users(),STORE.clock())


def _tick():
    state = DB['state']
    if tick(state,STORE.all_users(),STORE.clock()):
        state['version'] += 1
        STORE.record(STORE,state,'local-timer','timer.transition',{})
        return True
    return False


def _mutated(actor, action, data):
    DB['state']['version'] += 1
    STORE.record(STORE,DB['state'],actor['id'],action,data)


def _decode(data, limit=MAX_FILE):
    if not isinstance(data,str) or len(data) > (limit*4//3)+4: raise Problem('Fichier trop volumineux ou invalide.',413)
    try: raw=base64.b64decode(data,validate=True)
    except ValueError: raise Problem('Contenu de fichier invalide.') from None
    if len(raw)>limit: raise Problem('Fichier trop volumineux.',413)
    return raw


def _photo_data(value):
    if not isinstance(value,str) or not value.startswith('data:image/jpeg;base64,'): raise Problem('Photo JPEG normalisée attendue.')
    raw = _decode(value.split(',',1)[1])
    if not raw.startswith(b'\xff\xd8\xff') or not raw.endswith(b'\xff\xd9'): raise Problem('Photo JPEG invalide.')
    return raw


def _save_photo(p):
    owner_type,kind=p.get('owner_type'),p.get('kind')
    if owner_type not in {'person','official'} or kind not in {'portrait','full'}: raise Problem('Type de photo invalide.')
    owner=find(DB['state']['people' if owner_type=='person' else 'officials'],p.get('owner_id'),'Personne')
    _photo_data(p.get('data_url'))
    ident=_uid()
    DB['photos'][ident]=dict(id=ident,owner_id=owner['id'],owner_type=owner_type,kind=kind,approved=False,consent=False,data_url=p['data_url'])
    owner['photo_id' if owner_type=='official' else 'photo_'+kind]=ident
    owner['photo_approved']=False;owner['photo_consent']=False
    return ident


def _printable(user, kind, query):
    state=copy.deepcopy(DB['state']);roles=set(user['roles'])
    filters={key:query.get(key,[None])[0] for key in ('category_id','round_id','judge_id')}
    judge_id=filters['judge_id']
    if kind in {'blank','ballot','recap','results'}:
        if not roles&ADMIN:
            require(user,{'judge','trainee'})
            if judge_id and judge_id!=user['id']:raise Problem('Seuls vos bulletins sont accessibles.',403)
            filters['judge_id']=user['id']
            if kind=='results':raise Problem('Document réservé à la direction.',403)
            state['rounds']=[r for r in state['rounds'] if user['id'] in r['panel']+r['trainees']]
    elif kind=='exams':
        if not roles&(ADMIN|{'commission'}):
            require(user,{'judge','trainee'})
            if judge_id and judge_id!=user['id']:raise Problem('Rapport personnel uniquement.',403)
            filters['judge_id']=user['id']
    else:require(user,PREPARATION|{'regie','speaker'})
    state['users']=STORE.all_users();state['exam_reports']=exams(state,user)['reports'];state['printed_at']=STORE.clock()
    return state,filters


def _route(method,path,body,actor_id,query):
    global DB
    state=DB['state']
    if method=='GET' and path=='/health':
        return {'status':'ok','version':fibda.__version__,'setup_required':not DB['users'],'demo':True,'restore_id':state['restore_id'],'sqlite_version':'stockage local de test','standalone':True}
    if method=='POST' and path=='/auth/login':
        code=body.get('code')
        if not isinstance(code,str) or len(code)>128:raise Problem('Code incorrect.',401)
        row=next((u for u in DB['users'] if u['active'] and auth_module.matches(code,u['code_hash'])),None)
        if not row:raise Problem('Code incorrect.',401)
        if not row['approved']:raise Problem('Accès en attente de validation du chef.',403)
        return {'user':store_module.safe_user(row),'event_id':state['id']}
    if method=='POST' and path=='/auth/logout':return {'ok':True}
    if method=='POST' and path=='/auth/setup':raise Problem('Les comptes fictifs de ce kit sont déjà configurés.',409)
    if method=='POST' and path in {'/demo','/demo/seed'}:
        chief=next(u for u in STORE.all_users() if 'chief' in u['roles'])
        return {'codes':{u['id']:{'name':u['name'],'roles':json.loads(u['roles']),'code':u.get('test_code','')} for u in DB['users']},'state':_view(chief)}
    if method=='GET' and path.startswith('/public/'):
        _tick();return public_state(state,path.rsplit('/',1)[1])
    if method=='GET' and path.startswith('/photos/'):
        ident=path.rsplit('/',1)[1];photo=DB['photos'].get(ident)
        if not photo:raise Problem('Photo inconnue.',404)
        owner=find(state['people' if photo['owner_type']=='person' else 'officials'],photo['owner_id'])
        current=ident in [owner.get('photo_portrait'),owner.get('photo_full'),owner.get('photo_id')]
        if not (photo['approved'] and photo['consent'] and owner.get('photo_consent') and owner.get('photo_approved') and ident in owner.get('approved_photo_ids',[]) and current):require(_actor(actor_id),PREPARATION)
        return {'data_url':photo['data_url']}
    user=_actor(actor_id)
    if method=='GET' and path=='/auth/me':return {'user':user,'event_id':state['id']}
    if method=='GET' and path=='/state':_tick();return _view(user)
    if method=='POST' and path=='/tick':return {'changed':_tick(),'version':state['version']}
    if method=='GET' and path=='/catalogue':return load_catalogue()
    if method=='GET' and path.startswith('/eligibility/'):
        require(user,PREPARATION);return {'proposals':eligibility(find(state['people'],path.rsplit('/',1)[1],'Personne'),int(state['date'][:4]))}
    if method=='GET' and path=='/speaker':require(user,ADMIN|{'speaker','regie'});return _view(user)
    if method=='GET' and path=='/exams':return exams(state,user)
    if method=='GET' and path=='/collective':require(user,ADMIN|{'regie','speaker'});return collective(state)
    if method=='GET' and path=='/audit':require(user,ADMIN);return copy.deepcopy(DB['audit'])
    if method=='GET' and path=='/snapshot':require(user,ADMIN);return copy.deepcopy(DB)
    if method=='POST' and path=='/command':
        p=body
        if not isinstance(p.get('id'),str) or not p['id'] or len(p['id'])>100 or type(p.get('version')) is not int or not isinstance(p.get('payload'),dict):raise Problem('Commande, version et paramètres requis.')
        kind=p.get('type','');fingerprint=hashlib.sha256(store_module.dump({'type':kind,'payload':p['payload']}).encode()).hexdigest()
        prior=DB['commands'].get(p['id'])
        if prior:
            if prior['user_id']!=user['id'] or prior['fingerprint']!=fingerprint:raise Problem('Identifiant de commande déjà utilisé pour une autre action.',409)
            return {'state':_view(user),'result':prior['result']}
        if state['version']!=p['version'] and kind!='ballot.submit':raise Problem('Les données ont changé. Rechargez avant de confirmer votre action.',409)
        result=apply_command(STORE,STORE,state,user,kind,p['payload']) or {}
        sync_collective_rewards(state)
        _mutated(user,kind,p['payload'])
        DB['commands'][p['id']]=dict(user_id=user['id'],fingerprint=fingerprint,result=copy.deepcopy(result),version=state['version'])
        return {'state':_view(user),'result':result}
    if method=='POST' and path=='/photos':
        require(user,PREPARATION);ident=_save_photo(body);_mutated(user,'photo.upload',{'photo_id':ident,'owner_id':body['owner_id']});return {'id':ident}
    if method=='POST' and path=='/photos/batch':
        require(user,PREPARATION);items=body.get('items')
        if not isinstance(items,list) or not items or len(items)>2000:raise Problem('Liste de photos invalide.')
        owners=[(x.get('owner_type'),x.get('owner_id'),x.get('kind')) for x in items]
        if len(owners)!=len(set(owners)):raise Problem('Association photo répétée.')
        ids=[_save_photo(item) for item in items];_mutated(user,'photo.batch',{'ids':ids});return {'ids':ids}
    if method=='POST' and path=='/photos/batch/preview':
        require(user,PREPARATION);data=_decode(body.get('data_b64'),MAX_TOTAL);mappings=body.get('mappings')
        if not isinstance(mappings,list):raise Problem('Associations photos invalides.')
        items=[];owners=set()
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            names={x.filename for x in safe_members(archive) if not x.is_dir()}
            for mapping in mappings:
                owner=(mapping.get('owner_type'),mapping.get('owner_id'),mapping.get('kind'));name=mapping.get('filename')
                if name not in names or owner[0] not in {'person','official'} or owner[2] not in {'portrait','full'} or owner in owners:raise Problem('Association photo invalide ou répétée.')
                find(state['people' if owner[0]=='person' else 'officials'],owner[1]);owners.add(owner)
                raw=archive.read(name);suffix=Path(name).suffix.lower();mime={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'}.get(suffix)
                if not mime:raise Problem('Photos acceptées : JPEG, PNG ou WebP.')
                items.append(dict(owner_type=owner[0],owner_id=owner[1],kind=owner[2],crop=mapping.get('crop'),data_url='data:'+mime+';base64,'+base64.b64encode(raw).decode()))
        return {'items':items}
    if method=='POST' and path.startswith('/photos/') and path.endswith('/approve'):
        require(user,PREPARATION)
        if body.get('consent') is not True:raise Problem('Autorisation de diffusion obligatoire.')
        ident=path.split('/')[2];photo=DB['photos'].get(ident)
        if not photo:raise Problem('Photo inconnue.',404)
        owner=find(state['people' if photo['owner_type']=='person' else 'officials'],photo['owner_id'])
        owner.update(photo_approved=True,photo_consent=True)
        owner['approved_photo_ids']=list(set(owner.get('approved_photo_ids',[]))|{ident})
        photo.update(approved=True,consent=True);_mutated(user,'photo.approve',{'photo_id':ident});return {'approved':True}
    if method=='POST' and path=='/imports/preview':
        require(user,PREPARATION);preview=preview_import(_decode(body.get('data_b64')),body.get('filename',''));ident=_uid()
        DB['previews'][ident]=dict(user_id=user['id'],preview=preview,version=state['version'],at=STORE.clock())
        return {'preview_id':ident,**preview}
    if method=='POST' and path=='/imports/commit':
        require(user,PREPARATION);preview=DB['previews'].get(body.get('preview_id'))
        if not preview or preview['user_id']!=user['id'] or STORE.clock()-preview['at']>3600:raise Problem('Aperçu expiré ou inconnu.')
        if preview['preview']['errors']:raise Problem('Corrigez les erreurs avant import.')
        if state['version']!=preview['version']:raise Problem('Refaites l’aperçu après les modifications récentes.',409)
        count=0
        for row in preview['preview']['rows']:
            person={k:v for k,v in row.items() if k!='category_id'};person['id']=_uid()
            apply_command(STORE,STORE,state,user,'person.save',{'person':person})
            if row.get('category_id'):apply_command(STORE,STORE,state,user,'entry.save',{'entry':{'id':_uid(),'person_id':person['id'],'category_id':row['category_id'],'confirmed':False}})
            count+=1
        _mutated(user,'import.commit',{'count':count});del DB['previews'][body['preview_id']];return {'count':count}
    if method=='GET' and (path.startswith('/print/') or path.startswith('/export/')):
        kind=path.rsplit('/',1)[1];printstate,filters=_printable(user,kind,query)
        format=query.get('format',['pdf'])[0]
        if path.startswith('/print/') or format=='pdf':return (render_print(printstate,kind,**filters),{'content-type':'text/html; charset=utf-8','x-fibda-export':'browser-print' if format=='pdf' else 'html'})
        data,mime,name=export_document(printstate,kind,format,**filters)
        return {'data_b64':base64.b64encode(data).decode(),'mime':mime,'name':name}
    if method=='POST' and path=='/backup':
        require(user,ADMIN);output=io.BytesIO()
        with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:archive.writestr('snapshot.json',snapshot())
        return {'data_b64':base64.b64encode(output.getvalue()).decode(),'mime':'application/zip','name':'fibda-test-sauvegarde.zip'}
    if method=='POST' and path=='/restore':
        require(user,{'chief','director'})
        if 'snapshot' in body:incoming=body['snapshot']
        else:
            with zipfile.ZipFile(io.BytesIO(_decode(body.get('data_b64'),MAX_TOTAL))) as archive:
                members=archive.infolist()
                if len(members)!=1 or members[0].filename!='snapshot.json' or members[0].is_dir() or members[0].file_size>MAX_SNAPSHOT or ((members[0].external_attr>>16)&0o170000)==0o120000:
                    raise Problem('Archive du kit autonome attendue (snapshot.json, 200 Mio maximum).')
                incoming=json.loads(archive.read('snapshot.json'))
        restored=_validate_snapshot(incoming)
        restored['state']['restore_id']=_uid();restored['state']['version']+=1;restored['commands']={};restored['previews']={}
        DB=restored;STORE.record(STORE,DB['state'],user['id'],'restore',{'mode':'standalone-test'})
        return {'restore_id':DB['state']['restore_id'],'relogin_required':True}
    raise Problem('Route inconnue dans le kit autonome.',404)


def handle(method,path,body_json='{}',actor_id=''):
    global DB
    if DB is None:return _response(503,{'detail':'Initialisez le kit autonome.'})
    previous=copy.deepcopy(DB)
    try:
        body=json.loads(body_json) if isinstance(body_json,str) else body_json
        if not isinstance(body,dict):raise Problem('Objet JSON attendu.')
        parts=urlsplit(path);route=parts.path.removeprefix('/api/v1') or '/'
        result=_route(method.upper(),route,body,actor_id,parse_qs(parts.query))
        if isinstance(result,tuple):return _response(200,result[0],result[1])
        return _response(200,result)
    except (Problem,DomainError,ValueError,KeyError,TypeError,zipfile.BadZipFile,UnicodeError) as exc:
        DB=previous
        message=exc.message if isinstance(exc,Problem) else ('Paramètres incomplets ou invalides : '+str(exc) if isinstance(exc,(KeyError,TypeError)) else str(exc))
        return _response(getattr(exc,'status',422),{'detail':message})
    except Exception as exc:
        DB=previous
        return _response(500,{'detail':'Erreur du kit autonome : '+str(exc)})
