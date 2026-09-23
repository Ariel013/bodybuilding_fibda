"""Commandes de préparation : mutations d'état contrôlées, sans persistance."""
from copy import deepcopy
from datetime import date
from .auth import Problem, require, PREPARATION, SPORT, ADMIN
from .catalogue import load_catalogue, eligibility, measure
from .domain import DomainError
from .store import uid


def get_item(state, collection, identifier):
    item = next((x for x in state[collection] if x['id'] == identifier), None)
    if item is None:
        raise Problem('Élément introuvable : ' + collection, 404)
    return item


def _before_round(state, category_id):
    if any(r['category_id'] == category_id and (r.get('status') != 'pending' or r.get('ballots')) for r in state['rounds']):
        raise Problem('La catégorie a déjà commencé.')


def _country(value):
    return isinstance(value, str) and len(value) == 2 and value.isascii() and value.isalpha() and value.isupper()


def _admission(state, person, category):
    catalogue = state.get('rules_snapshot') if state.get('status') != 'preparation' else None
    catalogue = catalogue or load_catalogue()
    reasons = []
    if person['sex'] != category['sex'] or person['section'] != category['section']:
        reasons.append('Sexe ou section incompatible.')
    if category.get('archived'):
        reasons.append('Catégorie archivée.')
    for flag in ('status_approved', 'licence_ok', 'payment_ok', 'measurements_confirmed'):
        if not person.get(flag):
            reasons.append('Contrôle requis : ' + flag)
    if state['mode'] == 'international':
        for flag in ('delegation_approved','organizer_approved'):
            if not person.get(flag):
                reasons.append('Contrôle requis : ' + flag)
    age = int(state['date'][:4]) - int(person['birth_date'][:4])
    if category['division'] == 'senior':
        age_groups = [r for r in catalogue['rules'] if r['discipline'] == category['discipline'] and r['division'] != 'senior']
        if any((r['age_min'] is None or age >= r['age_min']) and (r['age_max'] is None or age <= r['age_max']) for r in age_groups) and not person.get('crossover_approved'):
            reasons.append('Crossover Junior/Masters vers Senior à autoriser par le chef.')
    if age < 18 and not person.get('minor_authorization'):
        reasons.append('Autorisation du représentant légal requise.')
    proposals = eligibility(person, state['date'], division=category['division'], discipline=category['discipline'], catalogue=catalogue)
    origins = set(category.get('source_rule_ids', [category['rule_id']]))
    matching = [p for p in proposals if p['rule_id'] in origins]
    if not matching:
        reasons.append('Âge ou mesures hors catégorie.')
    elif any('15 ans' in reason for p in matching for reason in p['reasons']):
        reasons.append('Confirmation IFBB à 15 ans requise ; une dérogation locale ne certifie pas l’admission internationale.')
    return reasons


def validate_confirmed_entries(state):
    """Recontrôle les confirmations avant ouverture ; ne modifie aucun objet."""
    invalid = []
    for entry in state['entries']:
        if not entry.get('confirmed'):
            continue
        person = get_item(state, 'people', entry['person_id'])
        category = get_item(state, 'categories', entry['category_id'])
        try:
            reasons = _admission(state, person, category)
        except (DomainError, ValueError, KeyError, TypeError) as exc:
            raise Problem('Inscription confirmée invalide : ' + entry['id']) from exc
        derogation = entry.get('derogation') or {}
        covered = set(derogation.get('issues', [])) if isinstance(derogation, dict) and derogation.get('signed_by') and str(derogation.get('reason', '')).strip() else set()
        outstanding = [reason for reason in reasons if reason not in covered]
        if person.get('sex') != category.get('sex') or person.get('section') != category.get('section') or category.get('archived'):
            outstanding.append('Sexe, section ou catégorie incompatible.')
        if outstanding:
            invalid.append(entry['id'] + ' : ' + ' '.join(outstanding))
    if invalid:
        raise Problem('Inscriptions confirmées à recontrôler : ' + ' ; '.join(invalid))
    return True


def _upsert(state, collection, item):
    old = next((i for i, x in enumerate(state[collection]) if x['id'] == item['id']), None)
    if old is None:
        state[collection].append(item)
    else:
        state[collection][old] = item
    return item


def _person(state, actor, incoming):
    allowed = {'id','first_name','last_name','birth_date','sex','nationalities','country','club','section','status_approved','delegation_approved','organizer_approved','licence_ok','payment_ok','minor_authorization','height_cm','weight_kg','measurements_confirmed','photo_consent','private_contact','pronunciation','crossover_approved'}
    previous = next((p for p in state['people'] if p['id'] == incoming.get('id')), {})
    person = {**previous, **{k:v for k,v in incoming.items() if k in allowed}}
    person['id'] = previous.get('id') or incoming.get('id') or uid()
    if person.get('crossover_approved') and not previous.get('crossover_approved'):
        require(actor, {'chief'})
    for key in ('first_name','last_name'):
        if not isinstance(person.get(key), str) or not person[key].strip():
            raise Problem('Prénom et nom obligatoires.')
        person[key] = person[key].strip()
    try:
        birth = date.fromisoformat(person.get('birth_date', ''))
        if birth > date.fromisoformat(state['date']):
            raise ValueError()
    except (ValueError, TypeError):
        raise Problem('Date de naissance complète valide requise.') from None
    if person.get('sex') not in ('M','F') or person.get('section') not in ('amateur','pro'):
        raise Problem('Sexe et section obligatoires.')
    if not _country(person.get('country')) or not isinstance(person.get('nationalities'),list) or not person['nationalities'] or not all(_country(c) for c in person['nationalities']):
        raise Problem('Pays et nationalités : codes pays de deux lettres majuscules requis.')
    person['nationalities'] = list(dict.fromkeys(person['nationalities']))
    for key in ('height_cm','weight_kg'):
        if person.get(key) not in (None,''):
            person[key] = str(measure(person[key]))
    if previous and any(person.get(k) != previous.get(k) for k in ('height_cm','weight_kg')):
        person['measurements_confirmed'] = False
    for entry in state['entries']:
        if entry['person_id'] == person['id']:
            _before_round(state, entry['category_id'])
            if entry.get('confirmed') and _admission(state,person,get_item(state,'categories',entry['category_id'])):
                raise Problem('Modification incompatible avec une inscription confirmée ; déconfirmer avant correction.')
    return _upsert(state,'people',person)


def _entry(state, actor, incoming, late=False):
    person = get_item(state,'people',incoming.get('person_id'))
    category = get_item(state,'categories',incoming.get('category_id'))
    _before_round(state,category['id'])
    if category.get('archived'):
        raise Problem('Catégorie archivée.')
    old = next((e for e in state['entries'] if e['id'] == incoming.get('id')), {})
    if old and old.get('bib') is not None and old['category_id'] != category['id']:
        raise Problem('Inscription figée après attribution du dossard.')
    if state.get('bibs_distributed') and not old and not late:
        raise Problem('Utiliser l’inscription tardive après attribution des dossards.')
    others = [e for e in state['entries'] if e['person_id'] == person['id'] and e['id'] != old.get('id')]
    if any(e['category_id'] == category['id'] for e in others):
        raise Problem('Personne déjà inscrite dans cette catégorie.')
    if others:
        require(actor,{'chief'})
    reasons = _admission(state,person,category) if incoming.get('confirmed',False) else []
    derogation = incoming.get('derogation')
    if derogation:
        require(actor,{'chief'})
        reason = derogation.get('reason','') if isinstance(derogation,dict) else str(derogation)
        if not reason.strip():
            raise Problem('Motif de dérogation obligatoire.')
        derogation = {'reason':reason.strip(),'signed_by':actor['id'],'issues':reasons}
    if reasons and not derogation:
        raise Problem('Inscription à contrôler : ' + ' '.join(reasons))
    if incoming.get('confirmed') and person['sex'] != category['sex']:
        raise Problem('Le sexe de la catégorie doit correspondre.')
    if person['section'] != category['section']:
        raise Problem('Le cumul amateur/pro est interdit.')
    entry = {'id':old.get('id') or incoming.get('id') or uid(),'person_id':person['id'],'category_id':category['id'],'bib':old.get('bib'),'confirmed':bool(incoming.get('confirmed',False)),'derogation':derogation,'origin_category_id':old.get('origin_category_id',category['id'])}
    if old and old['category_id'] != category['id']:
        _before_round(state,old['category_id'])
        origin=get_item(state,'categories',old['category_id'])
        origin['entry_ids']=[eid for eid in origin.get('entry_ids',[]) if eid != entry['id']]
    _upsert(state,'entries',entry)
    if entry['id'] not in category.setdefault('entry_ids',[]):
        category['entry_ids'].append(entry['id'])
    return entry


def _refresh_pending_category(state, category):
    """Garde les IDs existants et insère les phases devenues nécessaires."""
    rounds = [r for r in state['rounds'] if r['category_id'] == category['id']]
    if not rounds:
        return
    if any(r['status'] != 'pending' or r.get('ballots') for r in rounds):
        raise Problem('Le programme de la catégorie est déjà engagé.')
    from .workflow import make_round
    participants = [e['id'] for e in state['entries'] if e['category_id'] == category['id'] and e.get('confirmed')]
    count = len(participants)
    first = category.get('phase_override') or ('final' if count <= 6 else 'semi' if count <= 15 else 'elimination')
    phases = ['elimination', 'semi', 'final']
    if first not in phases:
        raise Problem('Phase de départ inconnue.')
    by_phase = {r['phase']: r for r in rounds}
    previous = None
    for phase in phases[phases.index(first):]:
        r = by_phase.get(phase)
        quota = min(category.get('elimination_quota', 15), count) if phase == 'elimination' else min(category.get('quota', 6), count) if phase == 'semi' else None
        if r is None:
            r = make_round(state, category, phase, [], quota)
            state['rounds'].append(r)
        elif r.get('quota') is not None:
            quota = min(r['quota'], count)
        r.update(participant_ids=participants[:] if previous is None else [], dependency_id=previous, quota=quota)
        r['version'] = r.get('version', 1) + 1
        previous = r['id']


def apply_preparation(store, conn, state, actor, kind, payload):
    """Le serveur possède transaction/version/audit ; retourne l'objet créé/modifié."""
    require(actor, PREPARATION)
    if state.get('status') == 'finished':
        raise Problem('Événement terminé.')
    try:
        candidate = deepcopy(state)
        result = _apply(candidate, actor, kind, payload)
        state.clear(); state.update(candidate)
        return result
    except DomainError as exc:
        raise Problem(str(exc)) from exc


def _apply(state, actor, kind, payload):
    if kind == 'event.update':
        require(actor, ADMIN)
        if state.get('status') != 'preparation' and any(k in payload and payload[k] != state[k] for k in ('mode','date')):
            raise Problem('Date et mode figés après démarrage.')
        if 'date' in payload:
            try: date.fromisoformat(payload['date'])
            except (ValueError,TypeError): raise Problem('Date invalide.') from None
        if 'mode' in payload and payload['mode'] not in ('national','international'):
            raise Problem('Mode inconnu.')
        admission_changed = any(k in payload and payload[k] != state[k] for k in ('date', 'mode'))
        for key in ('name','date','location','mode'):
            if key in payload: state[key]=payload[key]
        if 'settings' in payload:
            require(actor,SPORT)
            if state.get('status') != 'preparation' and 'collective_tiebreak' in payload['settings'] and payload['settings']['collective_tiebreak'] != state['settings'].get('collective_tiebreak'):
                raise Problem('Le critère collectif est figé dès le démarrage.')
            allowed={'collective_tiebreak','regulations_checked','network_checked','backup_checked','backup_directory'}
            if 'backup_directory' in payload['settings'] and not isinstance(payload['settings']['backup_directory'],str):raise Problem('Chemin de sauvegarde invalide.')
            state['settings'].update({k:v for k,v in payload['settings'].items() if k in allowed})
        if admission_changed:
            validate_confirmed_entries(state)
        return {'updated':True}
    if kind == 'person.save':
        return _person(state,actor,payload['person'])
    if kind == 'measurement.save':
        person=get_item(state,'people',payload['person_id'])
        for e in state['entries']:
            if e['person_id']==person['id']: _before_round(state,e['category_id'])
        candidate={**person,'height_cm':str(measure(payload['height_cm'])),'weight_kg':str(measure(payload['weight_kg'])),'measurements_confirmed':True}
        for e in state['entries']:
            if e['person_id']==person['id'] and e.get('confirmed') and _admission(state,candidate,get_item(state,'categories',e['category_id'])):
                raise Problem('Mesures incompatibles avec une inscription confirmée.')
        person.update(candidate); return person
    if kind == 'entry.save':
        return _entry(state,actor,payload['entry'])
    if kind == 'category.save':
        require(actor,SPORT)
        if state.get('bibs_distributed'): raise Problem('Catégories figées après attribution des dossards.')
        incoming=payload['category']; rules={r['id']:r for r in load_catalogue()['rules']}
        if incoming.get('rule_id') not in rules: raise Problem('Règle de catégorie inconnue.')
        rule=rules[incoming['rule_id']]
        old=next((c for c in state['categories'] if c['id']==incoming.get('id')),{})
        if old:
            _before_round(state,old['id'])
            if old.get('entry_ids') and (old['rule_id']!=rule['id'] or incoming.get('section',old['section'])!=old['section']):
                raise Problem('Une catégorie inscrite ne peut changer de règle ou section.')
        section=incoming.get('section','amateur')
        if section not in ('amateur','pro'): raise Problem('Section invalide.')
        category={**old,'id':old.get('id') or incoming.get('id') or uid(),'name':incoming.get('name') or rule['name'],'discipline':rule['discipline'],'sex':rule['sex'],'section':section,'division':rule['division'],'age_min':rule['age_min'],'age_max':rule['age_max'],'rule_id':rule['id'],'order':old.get('order',len(state['categories'])),'entry_ids':old.get('entry_ids',[]),'quota':incoming.get('quota',old.get('quota',6)),'elimination_quota':incoming.get('elimination_quota',old.get('elimination_quota',15)),'phase_override':incoming.get('phase_override',old.get('phase_override')),'merged_from':old.get('merged_from',[]),'archived':False}
        if any(type(category[k]) is not int or category[k]<1 for k in ('quota','elimination_quota')): raise Problem('Quotas entiers positifs requis.')
        return _upsert(state,'categories',category)
    if kind == 'programme.reorder':
        require(actor,SPORT)
        ids=payload['category_ids']; active=[c for c in state['categories'] if not c.get('archived')]
        if len(ids)!=len(set(ids)) or set(ids)!={c['id'] for c in active}: raise Problem('Liste exacte des catégories actives requise.')
        before = [c['id'] for c in sorted(active, key=lambda c: c['order'])]
        engaged = {r['category_id'] for r in state['rounds'] if r.get('status') != 'pending' or r.get('opened_at') is not None or r.get('ballots')}
        if any(identifier in engaged and before.index(identifier) != i for i, identifier in enumerate(ids)):
            raise Problem('La position des catégories engagées ne peut être déplacée, même indirectement.')
        for i,identifier in enumerate(ids): get_item(state,'categories',identifier)['order']=i
        return {'category_ids':ids}
    if kind == 'category.fuse':
        require(actor,{'chief'})
        if state.get('bibs_distributed'): raise Problem('Fusion interdite après attribution des dossards.')
        ids=payload['category_ids']
        if len(ids)<2 or len(set(ids))!=len(ids): raise Problem('Au moins deux catégories distinctes requises.')
        cats=[get_item(state,'categories',i) for i in ids]
        keys=('discipline','sex','section','division','age_min','age_max')
        if any(c.get('archived') or any(c.get(k)!=cats[0].get(k) for k in keys) for c in cats): raise Problem('Fusion incompatible : discipline, sexe, section et groupe d’âge doivent correspondre.')
        for c in cats: _before_round(state,c['id'])
        entries=[e for e in state['entries'] if e['category_id'] in ids]
        if len({e['person_id'] for e in entries}) != len(entries): raise Problem('Fusion refusée : une personne figurerait deux fois.')
        merged={**deepcopy(cats[0]),'id':uid(),'name':payload.get('name') or ' / '.join(c['name'] for c in cats),'entry_ids':[e['id'] for e in entries],'merged_from':ids,'source_rule_ids':list(dict.fromkeys(r for c in cats for r in c.get('source_rule_ids',[c['rule_id']])))}
        for c in cats: c['archived']=True; c['entry_ids']=[]
        for e in entries: e['category_id']=merged['id']
        state['rounds']=[r for r in state['rounds'] if r['category_id'] not in ids]
        state['categories'].append(merged); return merged
    if kind == 'bibs.assign':
        require(actor,SPORT)
        if state.get('bibs_distributed'): raise Problem('Dossards déjà attribués.')
        number=0
        categories=sorted(state['categories'],key=lambda c:c.get('order',0))
        for category in categories:
            if category.get('archived'): continue
            for entry in state['entries']:
                if entry['category_id']!=category['id'] or not entry.get('confirmed'): continue
                number+=1; entry['bib']=number
        if number == 0:
            raise Problem('Aucune inscription confirmée : attribution des dossards impossible.')
        state['bibs_distributed']=True; return {'count':number}
    if kind == 'entry.late':
        require(actor,SPORT)
        if not str(payload.get('reason','')).strip(): raise Problem('Motif d’inscription tardive obligatoire.')
        category=get_item(state,'categories',payload['category_id']); _before_round(state,category['id'])
        person=_person(state,actor,payload['person'])
        entry=_entry(state,actor,{'person_id':person['id'],'category_id':category['id'],'confirmed':True,'derogation':payload.get('derogation')},late=True)
        entry['bib']=max((e.get('bib') or 0 for e in state['entries']),default=0)+1
        entry['late_reason']=payload['reason'].strip()
        _refresh_pending_category(state, category)
        return entry
    if kind == 'official.save':
        incoming=payload['official']; old=next((o for o in state['officials'] if o['id']==incoming.get('id')), {})
        allowed={'first_name','last_name','post','organization','country','pedigree','photo_consent'}
        official={**old,**{k:v for k,v in incoming.items() if k in allowed},'id':old.get('id') or incoming.get('id') or uid()}
        if not all(str(official.get(k,'')).strip() for k in ('first_name','last_name','post')): raise Problem('Identité et poste obligatoires.')
        if official.get('country') and not _country(official['country']): raise Problem('Code pays invalide.')
        return _upsert(state,'officials',official)
    raise Problem('Commande de préparation inconnue.')
