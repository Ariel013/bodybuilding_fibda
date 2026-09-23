import copy
import hashlib
import json
from .auth import ADMIN, Problem
from .domain import collective_results, exam_report
from .workflow import eligible_ids, find


def public_person(p):
    fields={'id','first_name','last_name','country','club','pronunciation','section'}
    out={k:p.get(k) for k in fields}
    if p.get('photo_approved') and p.get('photo_consent'):
        out.update({k:p.get(k) for k in ['photo_portrait','photo_full'] if p.get(k) in p.get('approved_photo_ids',[])});out['photo_approved']=True;out['photo_consent']=True
    return out


def public_official(o):
    out={k:o.get(k) for k in ['id','first_name','last_name','post','organization','country','pedigree']}
    if o.get('photo_approved') and o.get('photo_consent') and o.get('photo_id') in o.get('approved_photo_ids',[]):out['photo_id']=o.get('photo_id')
    return out


def public_state(state,screen):
    if screen not in {'main','secondary','backstage'}:raise Problem('Affichage inconnu.',404)
    scene=copy.deepcopy(state['public'][screen]);r=next((r for r in state['rounds'] if r['id']==scene.get('round_id')),None)
    ids=set(r['participant_ids'] if r else [])
    if scene.get('category_id') and not r:ids.update(e['id'] for e in state['entries'] if e['category_id']==scene['category_id'] and e.get('confirmed'))
    entries=[{k:e.get(k) for k in ['id','person_id','category_id','bib']} for e in state['entries'] if e['id'] in ids]
    person_ids={e['person_id'] for e in entries}
    officials_ids=set(scene.get('official_ids',[]))|{scene.get('official_id')}
    rounds=[]
    if r:
        pr={k:copy.deepcopy(r.get(k)) for k in ['id','category_id','discipline','section','phase','participant_ids']}
        if scene['kind'] in {'qualifiers','reveal','podium','ranking'} and r['result'] and r['status'] in {'validated','published'}:
            rows=r['result']['official'];kind=scene['kind']
            if kind=='reveal':rows=sorted(rows,key=lambda x:x['rank'],reverse=True)[:scene.get('revealed_count',0)]
            if kind=='podium':rows=[x for x in rows if x['rank']<=3]
            pr['result']={'official':[{k:x.get(k) for k in ['entry_id','rank']} for x in rows] if kind!='qualifiers' else [],'qualified':r['result']['qualified'] if kind=='qualifiers' else [],'version':r['result']['version']}
        rounds=[pr]
    return {'name':state['name'],'mode':state['mode'],'demo':state['demo'],'version':state['version'],'scene':scene,'people':[public_person(p) for p in state['people'] if p['id'] in person_ids],'entries':entries,'officials':[public_official(o) for o in state['officials'] if o['id'] in officials_ids],'categories':[{k:c.get(k) for k in ['id','name','discipline','section']} for c in state['categories'] if c['id']==scene.get('category_id') or (r and c['id']==r['category_id'])],'rounds':rounds}


def project_state(state,actor,users,now):
    out=copy.deepcopy(state);roles=set(actor['roles']);out['me']=actor;out['server_time']=now;out['users']=users
    if not roles&ADMIN:
        out['users']=[u for u in users if u['id']==actor['id']]
        out['settings'].pop('collective_tiebreak',None)
        for p in out['people']:
            if not roles&{'secretariat'}:
                for k in ['private_contact','birth_date','nationalities','licence_ok','payment_ok','minor_authorization']:p.pop(k,None)
        for r in out['rounds']:
            r.pop('history',None);r.pop('removed_ballots',None);r.pop('correction',None)
            r['ballots']={j:b for j,b in r['ballots'].items() if j==actor['id']}
            # Le résultat sportif n'est partagé qu'avec la conduite / régie et après validation.
            if not roles&{'regie','speaker','commission'}:r['result']=None
            elif r.get('result'):
                r['result'].pop('reference_ranking',None);r['result'].pop('reference_version',None)
                for rows in [r['result'].get('common',[]),r['result'].get('official',[])]:
                    if isinstance(rows,list):
                        for row in rows:
                            if isinstance(row,dict):
                                for key in ['ranks','removed_min','removed_max']:row.pop(key,None)
        if not roles&{'commission'}:
            out['exam_programs']=[p for p in out['exam_programs'] if p['user_id']==actor['id']];out['exam_decisions']=[p for p in out['exam_decisions'] if p['user_id']==actor['id']]
        if not roles&{'regie','speaker','secretariat'}:out['rewards']=[]
    out['alerts']=[a for a in out['alerts'] if roles&set(a.get('roles',[]))]
    out.pop('rules_snapshot',None)
    return out


def exams(state,actor):
    allowed=set(actor['roles'])& (ADMIN|{'commission'})
    return {'reports':[{'user_id':p['user_id'],**exam_report(p,state['rounds'],p['user_id'])} for p in state['exam_programs'] if allowed or p['user_id']==actor['id']], 'decisions':[d for d in state['exam_decisions'] if allowed or d['user_id']==actor['id']]}


def collective(state):
    rows=[{**x,'round_id':r['id'],'phase':'final','section':r['section']} for r in state['rounds'] if r['phase']=='final' and r['status'] in {'validated','published'} for x in (r.get('result') or {}).get('official',[])]
    finals=[r for r in state['rounds'] if r['phase']=='final']
    complete=bool(finals) and all(r['status'] in {'validated','published'} for r in finals)
    revision=hashlib.sha256(json.dumps([(r['id'],(r.get('result') or {}).get('version')) for r in finals],sort_keys=True).encode()).hexdigest()
    out={'club':collective_results(rows,state['entries'],state['people'],'club',eligible_ids(state),'counts'),'country':collective_results(rows,state['entries'],state['people'],'country',eligible_ids(state),'counts') if state['mode']=='international' else [],'decisions':state['collective_decisions'],'complete':complete,'revision':revision,'winners':{}}
    if complete:
        for kind in ['club','country']:
            tied=[x['name'] for x in out[kind] if x['rank']==1]
            if len(tied)==1:out['winners'][kind]=tied[0]
            elif len(tied)>1:
                decisions=[d for d in state['collective_decisions'] if d['kind']==kind and d.get('revision')==revision]
                chief=next((d for d in reversed(decisions) if 'chief' in d['roles']),None)
                director=next((d for d in reversed(decisions) if 'director' in d['roles']),None)
                if chief and director and chief['by']!=director['by']:
                    if chief['winner']==director['winner']:out['winners'][kind]=chief['winner']
                    else:
                        arbiter=next((d for d in reversed(decisions) if 'responsable' in d['roles'] and d['by'] not in {chief['by'],director['by']} and d.get('arbitrates')==[chief['id'],director['id']]),None)
                        if arbiter:out['winners'][kind]=arbiter['winner']
    return out


def sync_collective_rewards(state):
    results=collective(state)
    previous={r['kind']:r for r in state['rewards'] if r['kind'] in {'club','country'}}
    state['rewards']=[r for r in state['rewards'] if r['kind'] not in {'club','country'}]
    from .store import uid
    for kind,winner in results['winners'].items():
        reward={'id':uid(),'round_id':None,'category_id':None,'entry_id':None,'rank':1,'kind':kind,'collective_name':winner,'title':'Meilleur club' if kind=='club' else 'Meilleur pays','prepared':False,'delivered':False,'trophy':'','medal':'','lot':'','prize':'','currency':'XOF','result_version':results['revision']}
        old=previous.get(kind)
        if old and old['collective_name']==winner:
            reward.update({k:old[k] for k in ['id','title','prepared','delivered','trophy','medal','lot','prize','currency'] if k in old})
        state['rewards'].append(reward)
