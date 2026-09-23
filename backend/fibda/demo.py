"""Explicit demo-only fixtures; generated access codes never seed an official event."""
import secrets
from .auth import add_user
from .catalogue import load_catalogue
from .store import uid


def seed_demo(store, conn, state):
    if not store.demo or not state.get('demo'):
        raise ValueError('Les données fictives sont réservées au mode démonstration')
    if state.get('demo_seeded'):
        return {}
    if state.get('people') or state.get('rounds') or state.get('categories'):
        raise ValueError('Le peuplement démo exige un événement vide')
    codes = {}
    existing = store.all_users(conn)
    chief = next((user for user in existing if 'chief' in user['roles']), None)
    def account(name, roles):
        code = secrets.token_urlsafe(12)
        user = add_user(store, conn, name, roles, code, approved=True)
        codes[user['id']] = {'name': name, 'roles': roles, 'code': code}
        return user
    if chief is None:
        chief = account('Chef démonstration', ['chief'])
    judges = [account(f'Juge fictif {i}', ['judge']) for i in range(1,5)]
    trainee = account('Stagiaire démonstration', ['trainee'])
    account('Direction démonstration', ['director'])
    account('Régie démonstration', ['regie'])
    account('Secrétariat démonstration', ['secretariat'])
    rules = {rule['id']: rule for rule in load_catalogue()['rules']}
    specifications = [('mens_physique-senior-all-170','169.0'),('mens_physique-senior-all-173','172.0'),('bikini-senior-all-164','163.0')]
    for order, (rule_id, height) in enumerate(specifications):
        rule = rules[rule_id]
        category = dict(id=uid(), name=rule['name'], discipline=rule['discipline'], sex=rule['sex'], section='amateur', division='senior', age_min=None, age_max=None, rule_id=rule_id, order=order, entry_ids=[], quota=6, elimination_quota=15, phase_override=None, merged_from=[], archived=False)
        state['categories'].append(category)
        for i in range(8):
            number = order * 8 + i + 1
            person = dict(id=uid(), first_name=f'Athlète {number:02}', last_name='FICTIF', birth_date='1995-06-15', sex=rule['sex'], nationalities=['CI'] if i != 7 else ['FR'],country='CI' if i != 7 else 'FR',club=f'Club fictif {i%3+1}',section='amateur',status_approved=True,delegation_approved=True,organizer_approved=True,licence_ok=True,payment_ok=True,minor_authorization=False,height_cm=height,weight_kg='65.0' if rule['sex']=='F' else '75.0',measurements_confirmed=True,photo_portrait=None,photo_full=None,photo_approved=False,photo_consent=False,private_contact='',pronunciation='')
            entry = dict(id=uid(),person_id=person['id'],category_id=category['id'],bib=number,confirmed=True,derogation=None,origin_category_id=category['id'])
            state['people'].append(person); state['entries'].append(entry); category['entry_ids'].append(entry['id'])
    state.update(name='Démonstration FIBDA - données fictives',date='2026-09-23',location='Formation',bibs_distributed=True,demo_seeded=True)
    state['jury'] = {'panel':[chief['id']]+[judge['id'] for judge in judges], 'trainees':[trainee['id']], 'withdrawal_order':[judge['id'] for judge in reversed(judges)]}
    state['settings'].update(regulations_checked=True,network_checked=True,backup_checked=True)
    state['rules_snapshot'] = load_catalogue()
    state['version'] += 1
    store.write(conn, state)
    store.record(conn,state,chief['id'],'demo.seed',{'athletes':24,'notice':'Données et contrôles fictifs uniquement'})
    return codes
