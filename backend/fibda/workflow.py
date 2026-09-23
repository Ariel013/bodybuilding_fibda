"""Transitions sportives ; toutes les mutations s'exécutent dans une transaction serveur."""
import copy
from .auth import Problem, require, SPORT, ADMIN, REGIE
from .store import uid
from . import domain
from .catalogue import load_catalogue

PHASES={'elimination':0,'semi':1,'final':2,'overall':3}


def find(items, ident, label='Élément'):
    item=next((x for x in items if x['id']==ident),None)
    if item is None: raise Problem(label+' introuvable.',404)
    return item


def chief_id(users):
    chiefs=[u['id'] for u in users if 'chief' in u['roles'] and u['active']]
    if len(chiefs)!=1: raise Problem('Un chef unique est requis.')
    return chiefs[0]


def eligible_ids(state):
    people={p['id']:p for p in state['people']}
    return [e['id'] for e in state['entries'] if (('CI' in people[e['person_id']].get('nationalities',[])) if state['mode']=='national' else people[e['person_id']].get('delegation_approved') and people[e['person_id']].get('organizer_approved'))]


def officials_complete(r):
    return bool(r['panel']) and all(j in r['ballots'] for j in r['panel'])


def make_round(state,cat,phase,participants,quota=None,dependency=None):
    jury=state['jury']
    return {'id':uid(),'category_id':cat['id'],'discipline':cat['discipline'],'section':cat['section'],'phase':phase,'status':'pending','participant_ids':list(participants),'panel':list(jury['panel']),'trainees':list(jury['trainees']),'withdrawal_order':list(jury['withdrawal_order']),'quota':quota,'ballots':{},'trainee_deadline':None,'expired_trainees':[],'transitioned':False,'result':None,'correction':None,'dependency_id':dependency,'opened_at':None,'version':1}


def disciplines(state):
    return list(dict.fromkeys(c['discipline'] for c in sorted(state['categories'],key=lambda c:c['order']) if not c.get('archived')))


def current_discipline(state):
    return next((d for d in disciplines(state) if not state['discipline_progress'].get(d,{}).get('completed')),None)


def ready(state,r):
    if state['status']!='running' or state['active_round_id'] or r['status']!='pending': return False
    if r['discipline']!=current_discipline(state): return False
    group=[x for x in state['rounds'] if x['discipline']==r['discipline']]
    if any(PHASES[x['phase']]<PHASES[r['phase']] and x['status'] not in {'validated','published'} for x in group): return False
    if r['dependency_id']:
        before=find(state['rounds'],r['dependency_id'],'Tour précédent')
        if before['status'] not in {'validated','published'}: return False
        r['participant_ids']=list(before['result']['qualified'])
    if r['phase']=='overall' and not state['discipline_progress'].get(r['discipline'],{}).get('category_rewards_done'): return False
    if r['phase'] in {'semi','elimination'} and (not isinstance(r['quota'],int) or not 1<=r['quota']<=len(r['participant_ids'])): return False
    return len(r['participant_ids'])>0


def open_round(state,r,users,now):
    if not ready(state,r): raise Problem('Ce tour attend les bulletins, qualifications ou étapes précédentes.',409)
    domain.validate_panel(r['panel'],users)
    if r['phase'] in {'semi','elimination'} and (not isinstance(r['quota'],int) or not 1<=r['quota']<=len(r['participant_ids'])):
        raise Problem('Le quota doit être compris entre 1 et le nombre de participants qualifiés.')
    if r['phase']=='overall' and len(r['participant_ids'])<2: raise Problem('Un champion seul exige la confirmation du chef.')
    r['status']='open';r['opened_at']=now;r['version']+=1;state['active_round_id']=r['id']


def try_next(state,users,now):
    cats={c['id']:c for c in state['categories']}
    for r in sorted(state['rounds'],key=lambda r:(PHASES[r['phase']],cats.get(r['category_id'],{}).get('order',999))):
        if ready(state,r) and not (r['phase']=='overall' and len(r['participant_ids'])<2):
            open_round(state,r,users,now);return r['id']
    return None


def tick(state,users,now):
    changed=False
    for r in state['rounds']:
        if r['status']!='open' or r['transitioned'] or not officials_complete(r): continue
        if r['trainee_deadline'] is None:
            r['trainee_deadline']=max(r['ballots'][j]['received_at'] for j in r['panel'])+60;changed=True
        missing=[j for j in r['trainees'] if j not in r['ballots']]
        if missing and now<r['trainee_deadline']: continue
        if missing:
            r['expired_trainees']=missing
            state['alerts'].append({'id':uid(),'roles':['chief','responsable'],'round_id':r['id'],'message':'Délai stagiaire expiré : '+str(len(missing))+' bulletin(s) non reçu(s).','at':now})
        r['transitioned']=True;r['transitioned_at']=now;r['status']='awaiting_validation';r['version']+=1
        if state['active_round_id']==r['id']:state['active_round_id']=None
        changed=True
    if state['status']=='running' and not state['active_round_id']:
        if try_next(state,users,now):changed=True
    return changed


def sync_rewards(state,r):
    previous={x.get('entry_id'):x for x in state['rewards'] if x.get('round_id')==r['id']}
    state['rewards']=[x for x in state['rewards'] if x.get('round_id')!=r['id']]
    if r['phase'] not in {'final','overall'}:return
    for row in r['result']['official']:
        if row['rank']>(1 if r['phase']=='overall' else 3):continue
        reward={'id':uid(),'round_id':r['id'],'category_id':r['category_id'],'entry_id':row['entry_id'],'rank':row['rank'],'kind':r['phase'],'title':'Champion overall' if r['phase']=='overall' else str(row['rank'])+'e place','prepared':False,'delivered':False,'trophy':'','medal':'','lot':'','prize':'','currency':'XOF','result_version':r['result']['version']}
        old=previous.get(row['entry_id'])
        if old and old['rank']==row['rank']:
            reward.update({k:old[k] for k in ['id','prepared','delivered','title','trophy','medal','lot','prize','currency'] if k in old})
        state['rewards'].append(reward)


def calculate(state,r,users,qualified_ids=None,reason=''):
    chief=chief_id(users);ballots={j:r['ballots'][j] for j in r['panel']}
    old=r.get('result');version=(old or {}).get('version',0)+1
    if r['phase']=='elimination':
        result=domain.elimination_result(ballots,r['participant_ids'],r['quota'],chief)
        if result['pending']:
            selected=set(qualified_ids or [])
            certain=set(result['qualified']);tied=set(result['tied'])
            if not certain<=selected or not selected<=certain|tied or len(selected)<r['quota']:raise Problem('Le chef doit résoudre les ex æquo à la frontière du quota.')
            if len(selected)!=len(certain|tied) and (len(selected)!=r['quota'] or not reason.strip()):raise Problem('Respecter le quota exige une décision motivée ; sinon admettre tous les ex æquo.')
            qualified=[i for i in r['participant_ids'] if i in selected]
        else:qualified=result['qualified']
        r['result']={'common':result['counts'],'official':[],'qualified':qualified,'version':version,'qualification_decision':reason,'reference_ranking':None,'reference_version':None}
    else:
        common=domain.rank_ballots(ballots,r['participant_ids'],chief)
        official=domain.rank_ballots(ballots,r['participant_ids'],chief,eligible_ids(state))
        qualified=[x['entry_id'] for x in common[:r['quota']]] if r['phase']=='semi' else []
        r['result']={'common':common,'official':official,'qualified':qualified,'version':version,'reference_ranking':list(ballots[chief]['ranking']),'reference_version':ballots[chief]['version'],'tie_explanation':'Somme écrêtée ; préférence majoritaire sur tous les bulletins. Dans une composante cyclique, ordre du chef.','chief_id':chief}
    r['result']['validated_by']=chief;r['result']['validated_at']=state.get('_now')
    sync_rewards(state,r)


def apply_sport(state,actor,kind,p,users,now):
    state['_now']=now
    try:return _apply_sport(state,actor,kind,p,users,now)
    finally:state.pop('_now',None)


def _apply_sport(state,actor,kind,p,users,now):
    if kind in {'ballot.submit','paper.submit'}:
        if 'director' in actor['roles']:raise Problem('Le directeur ne peut pas voter.',403)
        require(actor,{'chief'} if kind=='paper.submit' else {'chief','responsable','judge','trainee'})
        r=find(state['rounds'],p['round_id'],'Tour')
        judge=p.get('judge_id') if kind=='paper.submit' else actor['id']
        if kind=='ballot.submit' and p.get('restore_id')!=state['restore_id']:raise Problem('La compétition a été restaurée ; vérifiez votre brouillon.',409)
        if r['status']!='open' or state['active_round_id']!=r['id']:raise Problem('Saisie close pour ce tour.',409)
        if judge not in r['panel']+r['trainees']:raise Problem('Vous ne jugez pas ce tour.',403)
        if judge in r['ballots']:raise Problem('Bulletin déjà reçu et verrouillé.',409)
        if judge in r['trainees'] and r['trainee_deadline'] is not None and now>=r['trainee_deadline']:raise Problem('Délai stagiaire expiré.',409)
        if kind=='paper.submit' and (not p.get('signature','').strip() or not p.get('reason','').strip()):raise Problem('Signature papier et motif requis.')
        key='selected' if r['phase']=='elimination' else 'ranking';value=p.get(key,[])
        if key=='ranking':domain.validate_ranking(value,r['participant_ids'])
        elif len(value)!=r['quota'] or len(set(value))!=len(value) or not set(value)<=set(r['participant_ids']):raise Problem('La sélection doit respecter exactement le quota sans doublon.')
        r['ballots'][judge]={key:list(value),'original':{key:list(value)},'received_at':now,'version':1,'source':'paper' if kind=='paper.submit' else 'digital','signature':p.get('signature'),'reason':p.get('reason')}
        tick(state,users,now)
        return {'received':True,'round_id':r['id'],'judge_id':judge,'received_at':now}
    require(actor, {'chief'} if kind in {'round.validate','round.correct','overall.confirm','panel.reduce','round.resolve'} else SPORT)
    if kind=='jury.configure':
        if state['status']!='preparation':raise Problem('Le jury général est figé ; configurez un tour non ouvert.')
        panel=list(p.get('panel',[]));domain.validate_panel(panel,users)
        trainees=validate_trainees(p.get('trainees',[]),users,panel)
        order=validate_withdrawal(p.get('withdrawal_order',[]),panel,chief_id(users))
        state['jury']={'panel':panel,'trainees':trainees,'withdrawal_order':order};return {}
    if kind=='programme.generate':
        if state['status']!='preparation' or any(r['opened_at'] for r in state['rounds']):raise Problem('Un programme engagé ne peut être régénéré.')
        domain.validate_panel(state['jury']['panel'],users)
        if not state['bibs_distributed']:raise Problem('Attribuez les dossards avant de préparer les tours.')
        rounds=[]
        for cat in sorted(state['categories'],key=lambda c:c['order']):
            if cat.get('archived'):continue
            ids=[e['id'] for e in state['entries'] if e['category_id']==cat['id'] and e.get('confirmed')]
            if not ids:continue
            n=len(ids);phase=cat.get('phase_override') or ('final' if n<=6 else 'semi' if n<=15 else 'elimination')
            previous=None
            for ph in ['elimination','semi','final'][['elimination','semi','final'].index(phase):]:
                quota=min(cat.get('elimination_quota',15),n) if ph=='elimination' else min(cat.get('quota',6),n) if ph=='semi' else None
                r=make_round(state,cat,ph,ids if previous is None else [],quota,previous);rounds.append(r);previous=r['id']
        state['rounds']=rounds;state['discipline_progress']={};return {'count':len(rounds)}
    if kind=='event.start':
        if state['status']!='preparation':raise Problem('La compétition est déjà engagée.')
        checks=['regulations_checked','network_checked','backup_checked']
        if any(not state['settings'].get(k) for k in checks) or not state['settings'].get('collective_tiebreak','').strip():raise Problem('Validez le règlement, le réseau, la sauvegarde et le critère collectif avant ouverture.')
        if not state['rounds']:raise Problem('Préparez les tours avant ouverture.')
        from .preparation import validate_confirmed_entries
        validate_confirmed_entries(state)
        domain.validate_panel(state['jury']['panel'],users)
        state['rules_snapshot']=load_catalogue();state['rules_version']=state['rules_snapshot']['version'];state['status']='running'
        tick(state,users,now);return {}
    if kind=='event.finish':
        if state['status']!='running' or current_discipline(state):raise Problem('Toutes les disciplines et récompenses doivent être terminées.')
        state['status']='finished';return {}
    if kind=='round.configure':
        r=find(state['rounds'],p['round_id'],'Tour')
        if r['status']!='pending':raise Problem('Le tour est déjà engagé.')
        panel=p.get('panel',r['panel']);domain.validate_panel(panel,users)
        r['panel']=panel;r['trainees']=validate_trainees(p.get('trainees',r['trainees']),users,panel)
        if 'quota' in p and r['phase'] in {'semi','elimination'}:
            if not isinstance(p['quota'],int) or p['quota']<1:raise Problem('Quota positif requis.')
            r['quota']=p['quota']
        r['withdrawal_order']=validate_withdrawal(p.get('withdrawal_order',r['withdrawal_order']),panel,chief_id(users));r['version']+=1;return {}
    if kind=='round.open':
        open_round(state,find(state['rounds'],p['round_id'],'Tour'),users,now);return {}
    if kind=='round.next':
        active=next((r for r in state['rounds'] if r['id']==state['active_round_id']),None)
        if active and (not officials_complete(active) or (any(j not in active['ballots'] for j in active['trainees']) and (active['trainee_deadline'] is None or now<active['trainee_deadline']))):raise Problem('Des bulletins officiels ou stagiaires sont encore attendus.',409)
        tick(state,users,now);return {}
    if kind=='round.validate':
        r=find(state['rounds'],p['round_id'],'Tour')
        if r['status']!='awaiting_validation' or not officials_complete(r):raise Problem('Le tour attend encore ses bulletins ou une décision d’incident.')
        calculate(state,r,users,p.get('qualified_ids'),p.get('reason',''));r['status']='validated';tick(state,users,now);return {'result':r['result']}
    if kind=='panel.reduce':
        r=find(state['rounds'],p['round_id'],'Tour');remove=p.get('remove_ids',[])
        if r['status'] not in {'open','suspended'} or not p.get('reason','').strip():raise Problem('Réduction motivée uniquement pour un tour en cours.')
        if state['active_round_id']!=r['id']:raise Problem('La réduction concerne uniquement le tour actif.')
        order=[j for j in r['withdrawal_order'] if j in r['panel']]
        if not remove or remove!=order[:len(remove)]:raise Problem('Respectez l’ordre de retrait prévu.')
        panel=[j for j in r['panel'] if j not in remove];domain.validate_panel(panel,users)
        r.setdefault('removed_ballots',{}).update({j:r['ballots'][j] for j in remove if j in r['ballots']})
        for j in remove:r['ballots'].pop(j,None)
        r['panel']=panel;r.setdefault('panel_changes',[]).append({'remove_ids':remove,'reason':p['reason'],'at':now});r['status']='open';r['version']+=1;tick(state,users,now);return {}
    if kind in {'round.incident','round.resolve'}:
        r=find(state['rounds'],p['round_id'],'Tour')
        if not p.get('reason','').strip():raise Problem('Motif obligatoire.')
        if kind=='round.incident':
            if r['status']=='suspended':raise Problem('Ce tour est déjà suspendu.')
            r['previous_status']=r['status'];r['status']='suspended';r.setdefault('incidents',[]).append({'reason':p['reason'],'at':now,'by':actor['id']})
        else:
            if r['status']!='suspended':raise Problem('Aucun incident à résoudre.')
            r['status']=r.get('previous_status','open');r['incidents'][-1]['resolution']={'reason':p['reason'],'at':now,'by':actor['id']}
            tick(state,users,now)
        return {}
    if kind=='round.correct':
        r=find(state['rounds'],p['round_id'],'Tour');j=p['judge_id']
        if r['status'] not in {'validated','published','awaiting_validation'} or j not in r['ballots']:raise Problem('Ce bulletin ne peut pas être rectifié dans cet état.')
        if not p.get('reason','').strip():raise Problem('Motif obligatoire.')
        # Une qualification déjà utilisée exige une décision d'incident, pas un changement silencieux des finalistes.
        correction_allowed(state,r)
        key='selected' if r['phase']=='elimination' else 'ranking';value=p.get(key,[])
        if key=='ranking':domain.validate_ranking(value,r['participant_ids'])
        elif len(value)!=r['quota'] or len(set(value))!=len(value) or not set(value)<=set(r['participant_ids']):raise Problem('Sélection corrigée invalide.')
        published=r['status']=='published' or r.get('has_been_published',False)
        r['correction']={'judge_id':j,key:list(value),'reason':p['reason'],'signatures':[actor['id']],'published':published,'at':now,'qualified_ids':p.get('qualified_ids')}
        if not published:apply_correction(state,r,users,now)
        return {'pending_signatures':bool(r['correction'])}
    if kind=='rewards.complete':
        d=p['discipline'];stage=p.get('kind')
        if d!=current_discipline(state) or stage not in {'category','overall'}:raise Problem('Étape de récompense invalide.')
        phase='final' if stage=='category' else 'overall';rounds=[r for r in state['rounds'] if r['discipline']==d and r['phase']==phase]
        if any(r['status'] not in {'validated','published','no_title'} for r in rounds):raise Problem('Validez les résultats avant la fin des récompenses.')
        progress=state['discipline_progress'].setdefault(d,{})
        if stage=='overall':
            sections={c['section'] for c in state['categories'] if c['discipline']==d and not c.get('archived')}
            if not sections<=set(progress.get('overall_sections',[])):raise Problem('Constituez chaque overall avant de terminer ses récompenses.')
        progress[stage+'_rewards_done']=True;return {}
    if kind=='overall.create':
        d=p['discipline'];section=p['section'];progress=state['discipline_progress'].setdefault(d,{})
        if d!=current_discipline(state) or not progress.get('category_rewards_done'):raise Problem('Terminez les récompenses des catégories avant l’overall.')
        if section not in {'amateur','pro'} or section in progress.get('overall_sections',[]):raise Problem('Overall déjà constitué ou section invalide.')
        finals=[r for r in state['rounds'] if r['discipline']==d and r['section']==section and r['phase']=='final']
        if any(r['status'] not in {'validated','published'} for r in finals):raise Problem('Toutes les finales doivent être validées.')
        rows=[x for r in finals for x in r['result']['official']]
        ids=domain.overall_candidates(rows,state['entries'],eligible_ids(state))
        absent=set(p.get('absent_ids',[]))
        if not absent<=set(ids):raise Problem('Absence overall inconnue.')
        ids=[i for i in ids if i not in absent]
        cat={'id':'overall-'+d+'-'+section,'discipline':d,'section':section}
        r=make_round(state,cat,'overall',ids);r['absent_ids']=list(absent)
        exam_ids=p.get('exam_user_ids',[])
        if not isinstance(exam_ids,list) or len(exam_ids)!=len(set(exam_ids)) or not set(exam_ids)<=set(r['panel']+r['trainees']):
            raise Problem('Les candidats doivent être attendus sur cet overall, sans doublon.')
        for user_id in exam_ids:
            candidate=find(users,user_id,'Candidat')
            if not set(candidate['roles'])&{'trainee','judge','responsable'}:raise Problem('Ce profil n’est pas candidat à une comparaison.')
            program=next((x for x in state['exam_programs'] if x['user_id']==user_id),None)
            if program is None:
                program={'user_id':user_id,'round_ids':[],'version':0};state['exam_programs'].append(program)
            program['round_ids'].append(r['id']);program['version']+=1
        if not ids:r['status']='no_title'
        state['rounds'].append(r);progress.setdefault('overall_sections',[]).append(section);tick(state,users,now);return {'round_id':r['id'],'champions':len(ids)}
    if kind=='overall.confirm':
        r=find(state['rounds'],p['round_id'],'Tour')
        if r['phase']!='overall' or len(r['participant_ids'])!=1 or r['status']!='pending':raise Problem('Confirmation réservée à un overall d’un seul champion.')
        r['result']={'common':[],'official':[{'entry_id':r['participant_ids'][0],'rank':1,'total':None}],'qualified':[],'version':1,'validated_by':actor['id'],'reference_ranking':None,'reference_version':None,'single_champion':True};r['status']='validated';r['transitioned']=True;sync_rewards(state,r);return {}
    if kind=='discipline.advance':
        d=p['discipline'];progress=state['discipline_progress'].setdefault(d,{})
        if d!=current_discipline(state) or not progress.get('category_rewards_done') or not progress.get('overall_rewards_done') or state['active_round_id']:raise Problem('Terminez les deux étapes de récompenses et l’overall.')
        progress['completed']=True;tick(state,users,now);return {}
    raise Problem('Commande sportive inconnue.',404)


def validate_trainees(ids,users,panel):
    if len(ids)!=len(set(ids)) or set(ids)&set(panel):raise Problem('Un juge ne figure qu’une fois dans le tour.')
    for i in ids:
        u=find(users,i,'Stagiaire')
        if 'trainee' not in u['roles'] or not u['approved'] or not u['active']:raise Problem('Stagiaire non habilité.')
    return list(ids)


def validate_withdrawal(ids,panel,chief):
    if len(ids)!=len(set(ids)) or not set(ids)<=set(panel) or chief in ids:raise Problem('Ordre de retrait invalide ; le chef reste dans le panel.')
    return list(ids)


def correction_allowed(state,r):
    if r['status'] not in {'validated','published','awaiting_validation'}:
        raise Problem('Résolvez l’incident avant de rectifier ce tour.',409)
    if any(x.get('dependency_id')==r['id'] and x['status']!='pending' for x in state['rounds']):
        raise Problem('La qualification a déjà servi : traitement d’incident requis, sans modification automatique du tour dépendant.',409)
    if r['phase']=='final' and any(x['phase']=='overall' and x['discipline']==r['discipline'] and x['section']==r['section'] for x in state['rounds']):
        raise Problem('L’overall est déjà constitué : traitement d’incident requis avant toute correction de sa finale source.',409)


def apply_correction(state,r,users,now):
    correction_allowed(state,r)
    correction=r['correction'];j=correction['judge_id'];b=r['ballots'][j];key='selected' if r['phase']=='elimination' else 'ranking'
    r.setdefault('history',[]).append({'result':copy.deepcopy(r['result']),'ballot':copy.deepcopy(b),'correction':copy.deepcopy(correction)})
    b[key]=correction[key];b['version']+=1;b.setdefault('corrections',[]).append(correction)
    calculate(state,r,users,qualified_ids=correction.get('qualified_ids'),reason=correction['reason']);r['result']['validated_at']=now;r['correction']=None;r['status']='validated';r['version']+=1;r['reveals']={}
    # Les annonces antérieures sont retirées ; la régie publie la nouvelle version consciemment.
    for screen,scene in state['public'].items():
        if scene.get('round_id')==r['id']:state['public'][screen]={'kind':'idle','notice':'Résultat en cours de mise à jour'}
