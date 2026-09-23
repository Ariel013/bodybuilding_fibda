from sqlalchemy import update
from .auth import Problem, require, ADMIN, SPORT, PREPARATION, REGIE, add_user
from .store import users as user_table, uid
from .preparation import apply_preparation
from .workflow import apply_sport, find, apply_correction
from .projections import exams, collective

PREP={'event.update','person.save','entry.save','measurement.save','category.save','category.fuse','programme.reorder','bibs.assign','entry.late','official.save'}
SPORTS={'jury.configure','programme.generate','event.start','event.finish','round.configure','round.open','round.next','round.validate','round.correct','round.incident','round.resolve','panel.reduce','overall.create','overall.confirm','discipline.advance','ballot.submit','paper.submit','rewards.complete'}


def apply_command(store,conn,state,actor,kind,p):
    users=store.all_users(conn);now=store.clock()
    if kind in PREP:return apply_preparation(store,conn,state,actor,kind,p)
    if kind in SPORTS:return apply_sport(state,actor,kind,p,users,now)
    if kind=='user.invite':
        require(actor,ADMIN);roles=p.get('roles',[])
        if set(roles)&{'chief','responsable','director'} and 'chief' not in actor['roles']:raise Problem('Seul le chef peut créer un accès de direction.',403)
        user=add_user(store,conn,p.get('name',''),roles,p.get('code',''),approved='chief' in actor['roles'] or not set(roles)&{'judge','trainee','responsable'})
        return {'user':user}
    if kind=='user.approve':
        require(actor,{'chief'});user=find(users,p['user_id'],'Utilisateur')
        conn.execute(update(user_table).where(user_table.c.id==user['id']).values(approved=True));return {}
    if kind=='correction.sign':
        require(actor,{'chief','director'});r=find(state['rounds'],p['round_id'],'Tour');c=r['correction']
        if not c or not c.get('published'):raise Problem('Aucune correction publiée à signer.')
        if actor['id'] not in c['signatures']:c['signatures'].append(actor['id'])
        signed=[u for u in users if u['id'] in c['signatures']]
        chiefs={u['id'] for u in signed if 'chief' in u['roles']};directors={u['id'] for u in signed if 'director' in u['roles']}
        if chiefs and directors and chiefs.isdisjoint(directors):apply_correction(state,r,users,now)
        return {'pending_signatures':bool(r['correction'])}
    if kind=='scene.set':
        require(actor,REGIE);screen=p.get('screen');scene=p.get('scene',{});kindscene=scene.get('kind')
        if screen not in state['public'] or kindscene not in {'idle','category','qualifiers','reveal','podium','ranking','official','officials'}:raise Problem('Scène inconnue.')
        allowed={'kind','category_id','round_id','official_id','official_ids','called_entry_id','revealed_count','positions'}
        scene={k:v for k,v in scene.items() if k in allowed}
        if scene.get('category_id'):find(state['categories'],scene['category_id'],'Catégorie')
        r=find(state['rounds'],scene['round_id'],'Tour') if scene.get('round_id') else None
        if r and scene.get('category_id') and scene['category_id']!=r['category_id']:raise Problem('La catégorie et le tour ne correspondent pas.')
        if kindscene in {'qualifiers','reveal','podium','ranking'}:
            if not r or r['status'] not in {'validated','published'} or not r['result']:raise Problem('Résultat non validé : diffusion interdite.')
            if kindscene=='qualifiers' and r['phase'] not in {'semi','elimination'}:raise Problem('Pas de qualification pour ce tour.')
            if kindscene in {'reveal','podium','ranking'} and r['phase'] not in {'final','overall'}:raise Problem('Révélation réservée aux finales et overall.')
            prior=state['public'][screen];n=len(r['result']['official'])
            if kindscene=='reveal':
                count=scene.get('revealed_count',0)
                if not isinstance(count,int) or count<0 or count>n:raise Problem('Nombre d’annonces invalide.')
                old=prior.get('revealed_count',0) if prior.get('round_id')==r['id'] else 0
                if count>old+1:raise Problem('Annoncez les athlètes un par un du dernier au premier.')
                r.setdefault('reveals',{})[screen]=max(r.get('reveals',{}).get(screen,0),count)
            if kindscene in {'podium','ranking'} and r.get('reveals',{}).get(screen,0)<n:raise Problem('Terminez les annonces avant le podium et le classement complet.')
            r['status']='published';r['has_been_published']=True
        for ident in ([scene['official_id']] if scene.get('official_id') else scene.get('official_ids',[])):find(state['officials'],ident,'Officiel')
        if scene.get('called_entry_id'):
            e=find(state['entries'],scene['called_entry_id'],'Athlète')
            if r and e['id'] not in r['participant_ids']:raise Problem('Cet athlète ne participe pas au tour.')
        scene['version']=state['version']+1;state['public'][screen]=scene;return {}
    if kind=='reward.update':
        require(actor,ADMIN|{'secretariat'});reward=find(state['rewards'],p['reward_id'],'Récompense')
        allowed={'prepared','delivered','title','trophy','medal','lot','prize','currency'}
        for key in allowed:
            if key in p:reward[key]=p[key]
        return {}
    if kind=='exam.program':
        require(actor,SPORT|{'commission'});u=find(users,p['user_id'],'Juge');ids=p.get('round_ids',[])
        if not set(u['roles'])&{'trainee','judge','responsable'}:raise Problem('Cet utilisateur n’est pas candidat à la comparaison.')
        if len(ids)!=len(set(ids)):raise Problem('Un tour ne compte qu’une fois.')
        old=next((x for x in state['exam_programs'] if x['user_id']==u['id']),None)
        locked=old and any(find(state['rounds'],i)['status']!='pending' for i in old['round_ids'])
        if locked and not set(old['round_ids'])<=set(ids):raise Problem('Le programme engagé ne peut être réduit ou remplacé.')
        for ident in ids:
            if locked and ident in old['round_ids']:continue
            r=find(state['rounds'],ident,'Tour')
            if r['status']!='pending' or r['phase']=='elimination':raise Problem('Programmez les tours classés avant leur ouverture.')
            if u['id'] not in r['panel']+r['trainees']:raise Problem('Le juge doit être attendu sur chaque tour.')
        state['exam_programs']=[x for x in state['exam_programs'] if x['user_id']!=u['id']]+[{'user_id':u['id'],'round_ids':ids,'version':(old or {}).get('version',0)+1}];return {}
    if kind=='exam.decide':
        require(actor,{'commission'});report=next((x for x in exams(state,actor)['reports'] if x['user_id']==p['user_id']),None)
        if not report:raise Problem('Programme d’examen absent.')
        if p.get('decision') not in {'approved','rejected','deferred'} or not p.get('reason','').strip():raise Problem('Décision et motif requis.')
        if p['decision']=='approved' and not report['passed']:raise Problem('Les conditions de réussite ne sont pas atteintes.')
        state['exam_decisions'].append({'id':uid(),**p,'by':actor['id'],'at':now,'report':report});return {}
    if kind=='collective.decide':
        require(actor,ADMIN);k=p.get('kind');result=collective(state);rows=result.get(k,[]) if k in {'club','country'} else []
        if not result['complete']:raise Problem('Toutes les finales doivent être validées avant le départage collectif.')
        if not rows or p.get('winner') not in [r['name'] for r in rows if r['rank']==1]:raise Problem('Le vainqueur doit appartenir au groupe ex æquo en tête.')
        if not p.get('reason','').strip() or not state['settings'].get('collective_tiebreak'):raise Problem('Critère publié et motif requis.')
        decisions=[d for d in state['collective_decisions'] if d['kind']==k and d.get('revision')==result['revision']]
        chief=next((d for d in reversed(decisions) if 'chief' in d['roles']),None);director=next((d for d in reversed(decisions) if 'director' in d['roles']),None)
        arbitration=[]
        if not set(actor['roles'])&{'chief','director'}:
            if not chief or not director or chief['winner']==director['winner'] or actor['id'] in {chief['by'],director['by']}:raise Problem('Le responsable arbitre uniquement un désaccord préalable entre le chef et le directeur.')
            arbitration=[chief['id'],director['id']]
        state['collective_decisions'].append({'id':uid(),'kind':k,'winner':p['winner'],'reason':p['reason'],'by':actor['id'],'roles':actor['roles'],'at':now,'criterion':state['settings']['collective_tiebreak'],'revision':result['revision'],'arbitrates':arbitration})
        return {}
    raise Problem('Commande inconnue.',404)
