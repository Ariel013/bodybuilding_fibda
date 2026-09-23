import asyncio
import copy
import hashlib
import json
import os
import shutil
import sqlite3
import time
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse
from fastapi import FastAPI, Request, Response, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, insert, update, delete
from .store import Store, users, sessions, commands, audit, photos, uid, dump, safe_user
from .auth import Problem, require, authenticate, add_user, matches, new_session, ADMIN, PREPARATION
from .commands import apply_command
from .workflow import tick, find
from .projections import project_state, public_state, exams, collective
from .catalogue import load_catalogue, eligibility
from .domain import DomainError
from .transfers import preview_import, sanitize_photo, batch_photos, MAX_FILE, MAX_TOTAL
from .backup import create_backup, stage_restore
from .printing import render_print, export_document
from .resources import resource_path
from . import __version__

COOKIE='fibda_session'


def create_app(directory, demo=False, testing=False, clock=None):
    store=Store(directory,demo,clock);sockets=set();previews={};attempts={};last_backup=[0]

    def backup_file():
        with store.lock:
            data=create_backup(store.db_path,store.photos_dir)
            root=store.directory/'backups';root.mkdir(exist_ok=True)
            target=root/(time.strftime('%Y%m%d-%H%M%S')+'-'+uid()[:8]+'.zip');target.write_bytes(data)
            external=store.read().get('settings',{}).get('backup_directory')
            if external:
                dest=Path(external).expanduser();dest.mkdir(parents=True,exist_ok=True);shutil.copy2(target,dest/target.name)
            last_backup[0]=store.clock()
            app.state.last_background_error=None
            return data

    async def broadcast():
        version=store.read()['version']
        for ws in list(sockets):
            try:await ws.send_json({'type':'state_changed','version':version})
            except Exception:sockets.discard(ws)

    def timer_once():
        def mutate(conn):
            state=store.read_conn(conn)
            if tick(state,store.all_users(conn),store.clock()):
                state['version']+=1;store.write(conn,state);store.record(conn,state,'server','timer.transition',{});return True
            return False
        return store.transact(mutate)

    async def timer():
        while True:
            await asyncio.sleep(1)
            try:
                if await asyncio.to_thread(timer_once):await broadcast()
                if store.read()['status']=='running' and store.clock()-last_backup[0]>300:
                    await asyncio.to_thread(backup_file)
            except asyncio.CancelledError:raise
            except Exception as exc:
                app.state.last_background_error=str(exc)

    @asynccontextmanager
    async def lifespan(app):
        task=asyncio.create_task(timer()) if not testing else None
        yield
        if task:
            task.cancel()
            try:await task
            except asyncio.CancelledError:pass
        store.engine.dispose()

    app=FastAPI(title='FIBDA Bodybuilding',version=__version__,lifespan=lifespan)
    app.state.store=store;app.state.timer_once=timer_once;app.state.last_background_error=None

    @app.exception_handler(Problem)
    async def problem_handler(request,exc):return JSONResponse({'detail':exc.message},status_code=exc.status)

    @app.exception_handler(DomainError)
    async def domain_handler(request,exc):return JSONResponse({'detail':str(exc)},status_code=422)

    @app.exception_handler(ValueError)
    async def value_handler(request,exc):return JSONResponse({'detail':str(exc)},status_code=422)

    @app.middleware('http')
    async def security(request,call_next):
        origin=request.headers.get('origin')
        if request.method not in {'GET','HEAD','OPTIONS'} and origin:
            parsed=urlparse(origin)
            if parsed.netloc!=request.headers.get('host') or parsed.scheme!=request.url.scheme:return JSONResponse({'detail':'Origine de commande refusée.'},status_code=403)
        length=request.headers.get('content-length')
        if length and int(length)>MAX_TOTAL+1024*1024:return JSONResponse({'detail':'Requête trop volumineuse.'},status_code=413)
        response=await call_next(request)
        response.headers['X-Content-Type-Options']='nosniff';response.headers['Referrer-Policy']='same-origin'
        response.headers['X-Frame-Options']='SAMEORIGIN';response.headers['Cache-Control']='no-store'
        response.headers['Content-Security-Policy']="default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'"
        return response

    def actor(request):return authenticate(store,request.cookies.get(COOKIE))
    def view(state,u):
        result=project_state(state,u,store.all_users(),store.clock())
        if set(u['roles'])&ADMIN and app.state.last_background_error:
            result['alerts'].append({'id':'server-background-error','message':'Incident serveur à vérifier : '+app.state.last_background_error,'roles':list(ADMIN)})
        return result
    def local_only(request):
        if not testing and request.client.host not in {'127.0.0.1','::1'}:raise Problem('Cette opération se prépare depuis l’ordinateur serveur.',403)
    def set_cookie(response,token,request):response.set_cookie(COOKIE,token,httponly=True,secure=request.url.scheme=='https',samesite='strict',max_age=16*3600)

    @app.get('/api/v1/health')
    def health():
        state=store.read();return {'status':'ok','version':__version__,'setup_required':not store.all_users(),'demo':state['demo'],'restore_id':state['restore_id'],'sqlite_version':sqlite3.sqlite_version}

    @app.post('/api/v1/auth/setup')
    async def setup(request:Request,response:Response):
        local_only(request);p=await request.json()
        def mutate(conn):
            if store.all_users(conn):raise Problem('Le chef est déjà configuré.',409)
            u=add_user(store,conn,p.get('name',''),['chief'],p.get('code',''),True);token=new_session(store,conn,u['id'])
            state=store.read_conn(conn);store.record(conn,state,u['id'],'auth.setup',{});return u,token
        u,token=store.transact(mutate);set_cookie(response,token,request);return {'user':u,'event_id':store.read()['id']}

    @app.post('/api/v1/auth/login')
    async def login(request:Request,response:Response):
        p=await request.json();code=p.get('code','');address=request.client.host;now=store.clock()
        attempts[address]=[x for x in attempts.get(address,[]) if now-x<300]
        if len(attempts[address])>=15:raise Problem('Trop de tentatives. Réessayez dans quelques minutes.',429)
        if not isinstance(code,str) or len(code)>128:raise Problem('Code incorrect.',401)
        def mutate(conn):
            u=next((row for row in conn.execute(select(users)).mappings() if row['active'] and matches(code,row['code_hash'])),None)
            if not u:raise Problem('Code incorrect.',401)
            if not u['approved']:raise Problem('Accès en attente de validation du chef.',403)
            return safe_user(u),new_session(store,conn,u['id'])
        try:u,token=store.transact(mutate)
        except Problem:
            attempts[address].append(now);raise
        attempts.pop(address,None);set_cookie(response,token,request);return {'user':u,'event_id':store.read()['id']}

    @app.post('/api/v1/auth/logout')
    def logout(request:Request,response:Response):
        token=request.cookies.get(COOKIE)
        if token:store.transact(lambda conn:conn.execute(delete(sessions).where(sessions.c.id==hashlib.sha256(token.encode()).hexdigest())))
        response.delete_cookie(COOKIE);return {'ok':True}

    @app.get('/api/v1/auth/me')
    def me(request:Request):return {'user':actor(request),'event_id':store.read()['id']}

    @app.get('/api/v1/state')
    def state(request:Request):return view(store.read(),actor(request))

    @app.get('/api/v1/catalogue')
    def catalogue(request:Request):actor(request);return load_catalogue()

    @app.get('/api/v1/eligibility/{person_id}')
    def eligible(request:Request,person_id:str):
        require(actor(request),PREPARATION);s=store.read();return {'proposals':eligibility(find(s['people'],person_id,'Personne'),int(s['date'][:4]))}

    @app.post('/api/v1/command')
    async def command(request:Request):
        u=actor(request);p=await request.json()
        if not isinstance(p,dict) or not isinstance(p.get('id'),str) or not p['id'] or len(p['id'])>100 or not isinstance(p.get('version'),int) or not isinstance(p.get('payload'),dict):raise Problem('Commande, version et paramètres requis.')
        kind=p.get('type','');fingerprint=hashlib.sha256(dump({'type':kind,'payload':p['payload']}).encode()).hexdigest()
        def mutate(conn):
            prior=conn.execute(select(commands).where(commands.c.id==p['id'])).mappings().first()
            s=store.read_conn(conn)
            if prior:
                if prior['user_id']!=u['id'] or prior['fingerprint']!=fingerprint:raise Problem('Identifiant de commande déjà utilisé pour une autre action.',409)
                return s,json.loads(prior['result']),False
            # Les votes concurrents portent une liste figée par tour. Une mise à jour sans rapport ne bloque pas leur réception.
            if s['version']!=p['version'] and kind not in {'ballot.submit'}:raise Problem('Les données ont changé. Rechargez avant de confirmer votre action.',409)
            result=apply_command(store,conn,s,u,kind,p['payload']) or {}
            from .projections import sync_collective_rewards
            sync_collective_rewards(s)
            s['version']+=1;store.write(conn,s);store.record(conn,s,u['id'],kind,p['payload'])
            conn.execute(insert(commands).values(id=p['id'],user_id=u['id'],fingerprint=fingerprint,result=dump(result),version=s['version']))
            return s,result,True
        try:s,result,changed=store.transact(mutate)
        except (KeyError,TypeError) as exc:raise Problem('Paramètres incomplets ou invalides : '+str(exc)) from exc
        if changed:
            await broadcast()
            if kind in {'round.validate','overall.confirm','correction.sign','event.finish'}:
                try:await asyncio.to_thread(backup_file)
                except Exception as exc:app.state.last_background_error='Sauvegarde : '+str(exc)
        return {'state':view(s,u),'result':result}

    @app.get('/api/v1/public/{screen}')
    def public(screen:str):return public_state(store.read(),screen)

    @app.get('/api/v1/speaker')
    def speaker(request:Request):
        u=actor(request);require(u,ADMIN|{'speaker','regie'});return view(store.read(),u)

    @app.get('/api/v1/exams')
    def examination(request:Request):return exams(store.read(),actor(request))

    @app.get('/api/v1/collective')
    def collective_api(request:Request):require(actor(request),ADMIN|{'regie','speaker'});return collective(store.read())

    @app.get('/api/v1/audit')
    def journal(request:Request):
        require(actor(request),ADMIN)
        with store.engine.connect() as conn:return [{'id':r['id'],'user_id':r['user_id'],'action':r['action'],'at':r['at'],'data':json.loads(r['data'])} for r in conn.execute(select(audit).order_by(audit.c.at)).mappings()]

    @app.websocket('/api/v1/ws')
    async def websocket(ws:WebSocket):
        origin=ws.headers.get('origin')
        if origin and urlparse(origin).netloc!=ws.headers.get('host'):await ws.close(code=1008);return
        try:authenticate(store,ws.cookies.get(COOKIE))
        except Problem:await ws.close(code=1008);return
        await ws.accept();sockets.add(ws)
        try:
            await ws.send_json({'type':'state_changed','version':store.read()['version']})
            while True:await ws.receive_text()
        except WebSocketDisconnect:pass
        finally:sockets.discard(ws)

    async def read_file(file,limit):
        data=await file.read(limit+1)
        if len(data)>limit:raise Problem('Fichier trop volumineux.',413)
        return data

    def save_photo(conn,s,data,owner_type,owner_id,kind):
        if owner_type not in {'person','official'} or kind not in {'portrait','full'}:raise Problem('Type de photo invalide.')
        owner=find(s['people'] if owner_type=='person' else s['officials'],owner_id,'Personne')
        photo_id=uid();filename=photo_id+'.jpg';(store.photos_dir/filename).write_bytes(data)
        conn.execute(insert(photos).values(id=photo_id,owner_id=owner_id,owner_type=owner_type,kind=kind,approved=0,consent=0,filename=filename))
        owner['photo_id' if owner_type=='official' else 'photo_'+kind]=photo_id
        owner['photo_approved']=False;owner['photo_consent']=False
        return photo_id

    @app.post('/api/v1/photos')
    async def photo_upload(request:Request,file:UploadFile=File(...),owner_type:str=Form(...),owner_id:str=Form(...),kind:str=Form(...),crop:str|None=Form(None)):
        u=actor(request);require(u,PREPARATION);data=sanitize_photo(await read_file(file,MAX_FILE),json.loads(crop) if crop else None)
        def mutate(conn):
            s=store.read_conn(conn);ident=save_photo(conn,s,data,owner_type,owner_id,kind);s['version']+=1;store.write(conn,s);store.record(conn,s,u['id'],'photo.upload',{'photo_id':ident,'owner_id':owner_id});return ident
        ident=store.transact(mutate);await broadcast();return {'id':ident}

    @app.post('/api/v1/photos/batch')
    async def photos_batch(request:Request,file:UploadFile=File(...),mappings:str=Form(...)):
        u=actor(request);require(u,PREPARATION);items=batch_photos(await read_file(file,MAX_TOTAL),json.loads(mappings))
        def mutate(conn):
            s=store.read_conn(conn);ids=[save_photo(conn,s,**item) for item in items];s['version']+=1;store.write(conn,s);store.record(conn,s,u['id'],'photo.batch',{'ids':ids});return ids
        ids=store.transact(mutate);await broadcast();return {'ids':ids}

    @app.post('/api/v1/photos/{photo_id}/approve')
    async def photo_approve(request:Request,photo_id:str):
        u=actor(request);require(u,PREPARATION);p=await request.json()
        if p.get('consent') is not True:raise Problem('Autorisation de diffusion obligatoire.')
        def mutate(conn):
            row=conn.execute(select(photos).where(photos.c.id==photo_id)).mappings().first()
            if not row:raise Problem('Photo inconnue.',404)
            s=store.read_conn(conn);owner=find(s['people'] if row['owner_type']=='person' else s['officials'],row['owner_id'])
            owner['photo_approved']=True;owner['photo_consent']=True
            owner['approved_photo_ids']=list(set(owner.get('approved_photo_ids',[]))|{photo_id})
            conn.execute(update(photos).where(photos.c.id==photo_id).values(approved=1,consent=1));s['version']+=1;store.write(conn,s);store.record(conn,s,u['id'],'photo.approve',{'photo_id':photo_id});return {}
        store.transact(mutate);await broadcast();return {'approved':True}

    @app.get('/api/v1/photos/{photo_id}')
    def photo_get(request:Request,photo_id:str):
        with store.engine.connect() as conn:row=conn.execute(select(photos).where(photos.c.id==photo_id)).mappings().first()
        if not row:raise Problem('Photo inconnue.',404)
        s=store.read();owner=next((p for p in s['people'] if p['id']==row['owner_id']),None) if row['owner_type']=='person' else next((p for p in s['officials'] if p['id']==row['owner_id']),None)
        current=owner and photo_id in [owner.get('photo_portrait'),owner.get('photo_full'),owner.get('photo_id')]
        if not (row['approved'] and row['consent'] and owner and owner.get('photo_consent') and owner.get('photo_approved') and photo_id in owner.get('approved_photo_ids',[]) and current):require(actor(request),PREPARATION)
        return FileResponse(store.photos_dir/row['filename'],media_type='image/jpeg')

    @app.post('/api/v1/imports/preview')
    async def import_preview(request:Request,file:UploadFile=File(...)):
        u=actor(request);require(u,PREPARATION);preview=preview_import(await read_file(file,MAX_FILE),file.filename or '')
        ident=uid();previews[ident]={'user_id':u['id'],'preview':preview,'version':store.read()['version'],'at':store.clock()};return {'preview_id':ident,**preview}

    @app.post('/api/v1/imports/commit')
    async def import_commit(request:Request):
        u=actor(request);require(u,PREPARATION);p=await request.json();preview=previews.get(p.get('preview_id'))
        if not preview or preview['user_id']!=u['id'] or store.clock()-preview['at']>3600:raise Problem('Aperçu expiré ou inconnu.')
        if preview['preview']['errors']:raise Problem('Corrigez les erreurs avant import.')
        def mutate(conn):
            s=store.read_conn(conn)
            if s['version']!=preview['version']:raise Problem('Refaites l’aperçu après les modifications récentes.',409)
            count=0
            for row in preview['preview']['rows']:
                person={k:v for k,v in row.items() if k!='category_id'};person['id']=uid()
                apply_command(store,conn,s,u,'person.save',{'person':person})
                if row.get('category_id'):apply_command(store,conn,s,u,'entry.save',{'entry':{'id':uid(),'person_id':person['id'],'category_id':row['category_id'],'confirmed':False}})
                count+=1
            s['version']+=1;store.write(conn,s);store.record(conn,s,u['id'],'import.commit',{'count':count});return count
        count=store.transact(mutate);previews.pop(p['preview_id']);await broadcast();return {'count':count}

    def printable(request,kind,category_id,round_id,judge_id):
        u=actor(request);s=store.read();roles=set(u['roles'])
        private={'blank','ballot','recap','results'}
        if kind in private:
            if not roles&ADMIN:
                require(u,{'judge','trainee'})
                if judge_id and judge_id!=u['id']:raise Problem('Seuls vos bulletins sont accessibles.',403)
                judge_id=u['id']
                if kind=='results':raise Problem('Document réservé à la direction.',403)
                s['rounds']=[r for r in s['rounds'] if u['id'] in r['panel']+r['trainees']]
        elif kind=='exams':
            if not roles&(ADMIN|{'commission'}):
                require(u,{'judge','trainee'})
                if judge_id and judge_id!=u['id']:raise Problem('Rapport personnel uniquement.',403)
                judge_id=u['id']
        else:require(u,PREPARATION|{'regie','speaker'})
        s['users']=store.all_users();s['exam_reports']=exams(s,u)['reports'];s['printed_at']=store.clock()
        return s,{'category_id':category_id,'round_id':round_id,'judge_id':judge_id}

    @app.get('/api/v1/print/{kind}',response_class=HTMLResponse)
    def print_doc(request:Request,kind:str,category_id:str|None=None,round_id:str|None=None,judge_id:str|None=None):
        s,filters=printable(request,kind,category_id,round_id,judge_id);return render_print(s,kind,**filters)

    @app.get('/api/v1/export/{kind}')
    def export_doc(request:Request,kind:str,format:str='pdf',category_id:str|None=None,round_id:str|None=None,judge_id:str|None=None):
        s,filters=printable(request,kind,category_id,round_id,judge_id);data,mime,name=export_document(s,kind,format,**filters)
        return Response(data,media_type=mime,headers={'Content-Disposition':'attachment; filename="'+name+'"'})

    @app.post('/api/v1/backup')
    async def backup_api(request:Request):
        require(actor(request),ADMIN);data=await asyncio.to_thread(backup_file)
        return Response(data,media_type='application/zip',headers={'Content-Disposition':'attachment; filename="fibda-sauvegarde.zip"'})

    @app.post('/api/v1/restore')
    async def restore_api(request:Request,file:UploadFile=File(...)):
        u=actor(request);require(u,{'chief','director'});local_only(request);data=await read_file(file,MAX_TOTAL)
        with store.lock:
            staged=stage_restore(data,store.directory/'restorations')
            source=sqlite3.connect(staged['database_path']);raw=json.loads(source.execute('SELECT data FROM events').fetchone()[0]);source.close()
            if raw['demo']!=store.demo:raise Problem('Une sauvegarde de démonstration ne remplace pas une compétition officielle, et inversement.')
            backup_file();store.engine.dispose()
            before=store.directory/'restorations'/('before-'+uid());before.mkdir()
            def mutate(conn):
                s=store.read_conn(conn);s['restore_id']=uid();s['version']+=1
                conn.execute(delete(sessions));conn.execute(delete(commands));store.write(conn,s);store.record(conn,s,u['id'],'restore',{'previous_state':str(before)});return s['restore_id']
            moved=[]
            try:
                for suffix in ('','-wal','-shm'):
                    path=Path(str(store.db_path)+suffix)
                    if path.exists():shutil.move(path,before/path.name);moved.append(path)
                shutil.move(store.photos_dir,before/'photos');moved.append(store.photos_dir)
                shutil.copy2(staged['database_path'],store.db_path);shutil.copytree(staged['photos_dir'],store.photos_dir)
                ident=store.transact(mutate)
            except Exception as exc:
                store.engine.dispose()
                if store.db_path in moved:
                    for suffix in ('-wal','-shm'):
                        sidecar=Path(str(store.db_path)+suffix)
                        if sidecar not in moved and sidecar.exists():sidecar.unlink()
                for path in reversed(moved):
                    if path.is_dir():shutil.rmtree(path)
                    elif path.exists():path.unlink()
                    shutil.move(before/path.name,path)
                raise Problem('Restauration interrompue ; état précédent rétabli. '+str(exc),500) from exc
        previews.clear();await broadcast();return {'restore_id':ident,'relogin_required':True}

    @app.post('/api/v1/demo')
    async def demo_api(request:Request,response:Response):
        local_only(request)
        if not store.demo:raise Problem('Ce serveur utilise les données officielles.',403)
        from .demo import seed_demo
        def mutate(conn):
            s=store.read_conn(conn);codes=seed_demo(store,conn,s);chief=next(u for u in store.all_users(conn) if 'chief' in u['roles']);token=new_session(store,conn,chief['id']);return codes,chief,token
        codes,chief,token=store.transact(mutate);set_cookie(response,token,request);await broadcast();return {'codes':codes,'state':view(store.read(),chief)}

    frontend=resource_path('frontend','dist')
    if frontend.exists():
        app.mount('/assets',StaticFiles(directory=frontend/'assets'),name='assets')
        @app.get('/{path:path}')
        def spa(path:str):
            if path.startswith('api/'):raise Problem('Route inconnue.',404)
            return FileResponse(frontend/'index.html')
    else:
        @app.get('/',response_class=HTMLResponse)
        def missing_ui():return '<h1>FIBDA — serveur prêt</h1><p>Construire l’interface : cd frontend puis npm ci et npm run build.</p><a href="/docs">Contrat API</a>'
    return app
