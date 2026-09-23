"""Calculs sportifs FIBDA purs ; aucune mutation ni publication implicite."""
from collections import Counter, defaultdict
from fractions import Fraction
from itertools import combinations


class DomainError(ValueError):
    pass


def validate_panel(panel, users, chief_id=None):
    if len(panel) not in (5, 7, 9, 11) or len(set(panel)) != len(panel):
        raise DomainError('Jury distinct de 5, 7, 9 ou 11 requis.')
    profiles = users if isinstance(users, dict) else {u['id']: u for u in users}
    for uid in panel:
        u = profiles.get(uid, {})
        roles = u.get('roles', [])
        if not u.get('active', True) or not u.get('approved', False) or 'director' in roles or 'trainee' in roles or not set(roles) & {'chief', 'responsable', 'judge'}:
            raise DomainError('Membre de jury non autorisé.')
    chiefs = [uid for uid in panel if 'chief' in profiles[uid]['roles']]
    if len(chiefs) != 1 or (chief_id is not None and chiefs != [chief_id]):
        raise DomainError('Un chef de jury est requis dans le panel.')
    return True


def validate_ranking(ranking, participants):
    if len(set(participants)) != len(participants) or len(ranking) != len(participants) or len(set(ranking)) != len(ranking) or set(ranking) != set(participants):
        raise DomainError('Le classement doit être une permutation exacte des participants.')
    return True


def _rankings(ballots):
    return {uid: list(value['ranking'] if isinstance(value, dict) else value) for uid, value in ballots.items()}


def majority_order(tied, rankings, chief_ranking):
    """SCC du graphe majoritaire ; seul un cycle utilise l'ordre du chef."""
    tied = list(tied)
    positions = [{p: i for i, p in enumerate(r)} for r in rankings]
    chief = {p: i for i, p in enumerate(chief_ranking)}
    graph = {p: [] for p in tied}
    for a, b in combinations(tied, 2):
        votes = sum(pos[a] < pos[b] for pos in positions)
        if votes * 2 > len(positions):
            graph[a].append(b)
        elif votes * 2 < len(positions):
            graph[b].append(a)
    index, low, stack, onstack, components = {}, {}, [], set(), []
    def visit(v):
        index[v] = low[v] = len(index)
        stack.append(v); onstack.add(v)
        for w in graph[v]:
            if w not in index:
                visit(w); low[v] = min(low[v], low[w])
            elif w in onstack:
                low[v] = min(low[v], index[w])
        if low[v] == index[v]:
            comp = []
            while True:
                w = stack.pop(); onstack.remove(w); comp.append(w)
                if w == v:
                    break
            components.append(sorted(comp, key=chief.__getitem__))
    for p in tied:
        if p not in index:
            visit(p)
    owner = {p: i for i, c in enumerate(components) for p in c}
    edges = {(owner[a], owner[b]) for a in graph for b in graph[a] if owner[a] != owner[b]}
    remaining = set(range(len(components))); result = []
    while remaining:
        ready = [i for i in remaining if not any(b == i and a in remaining for a, b in edges)]
        selected = min(ready, key=lambda i: min(chief[p] for p in components[i]))
        result.extend(components[selected]); remaining.remove(selected)
    return result


def rank_ballots(ballots, participants=None, chief_id=None, eligible_ids=None):
    rankings = _rankings(ballots)
    if len(rankings) not in (5, 7, 9, 11):
        raise DomainError('Tous les bulletins du jury autorisé sont requis.')
    if chief_id not in rankings:
        raise DomainError('Bulletin du chef manquant.')
    participants = list(participants if participants is not None else next(iter(rankings.values())))
    for ranking in rankings.values():
        validate_ranking(ranking, participants)
    if eligible_ids is not None:
        allowed = set(eligible_ids)
        participants = [p for p in participants if p in allowed]
        rankings = {j: [p for p in r if p in allowed] for j, r in rankings.items()}
    positions = [{p: i + 1 for i, p in enumerate(r)} for r in rankings.values()]
    totals = {}
    for p in participants:
        values = sorted(pos[p] for pos in positions)
        totals[p] = sum(values[1:-1])
    groups = defaultdict(list)
    for p, total in totals.items():
        groups[total].append(p)
    order = []
    for total in sorted(groups):
        order.extend(majority_order(groups[total], list(rankings.values()), rankings[chief_id]))
    return [{'entry_id': p, 'rank': i + 1, 'total': totals[p],
             'ranks': [pos[p] for pos in positions],
             'removed_min': min(pos[p] for pos in positions),
             'removed_max': max(pos[p] for pos in positions)} for i, p in enumerate(order)]


def elimination_result(ballots, participants, quota, chief_id=None):
    if not isinstance(quota, int) or isinstance(quota, bool) or not 0 < quota <= len(participants) or len(set(participants)) != len(participants):
        raise DomainError('Quota ou participants invalides.')
    if len(ballots) not in (5, 7, 9, 11):
        raise DomainError('Panel incomplet.')
    counts = Counter({p: 0 for p in participants})
    for value in ballots.values():
        selected = value.get('selected', []) if isinstance(value, dict) else value
        if len(selected) != quota or len(set(selected)) != quota or not set(selected) <= set(participants):
            raise DomainError('Sélection exacte du quota requise.')
        counts.update(selected)
    threshold = sorted(counts.values(), reverse=True)[quota - 1]
    above = [p for p in participants if counts[p] > threshold]
    tied = [p for p in participants if counts[p] == threshold]
    pending = len(above) + len(tied) > quota
    return {'counts': dict(counts), 'qualified': above if pending else above + tied,
            'tied': tied if pending else [], 'slots': quota - len(above) if pending else 0, 'pending': pending}


def overall_candidates(results, entries, eligible_ids=None):
    entrymap = {e['id']: e for e in entries}
    allowed = None if eligible_ids is None else set(eligible_ids)
    seen, selected = set(), []
    for row in results:
        eid = row['entry_id']
        if row['rank'] != 1 or (allowed is not None and eid not in allowed):
            continue
        pid = entrymap[eid]['person_id']
        if pid not in seen:
            seen.add(pid); selected.append(eid)
    return selected


def pair_concordance(ranking, reference):
    validate_ranking(ranking, reference)
    positions = {p: i for i, p in enumerate(ranking)}
    pairs = len(reference) * (len(reference) - 1) // 2
    if not pairs:
        raise DomainError('Au moins deux participants pour une comparaison.')
    correct = sum(positions[a] < positions[b] for a, b in combinations(reference, 2))
    return Fraction(correct * 100, pairs), pairs


def _fraction(value):
    return {'numerator': value.numerator, 'denominator': value.denominator, 'display': f'{float(value):.2f}'}


def exam_report(program, rounds, user_id):
    planned = program.get('round_ids', []) if isinstance(program, dict) else list(program)
    byid = {r['id']: r for r in rounds}
    scores, categories, details, missing, total_pairs = [], set(), [], [], 0
    evaluated_planned = []
    for rid in dict.fromkeys(planned):
        r = byid.get(rid)
        if r is not None:
            if r.get('phase') == 'elimination':
                continue
            participants = r.get('participant_ids', (r.get('result') or {}).get('reference_ranking', []))
            # Une liste vide avant qualification signifie « inconnue », pas zéro athlète.
            unresolved = False
            if not participants and r.get('dependency_id') and r.get('status') == 'pending':
                dependency = byid.get(r['dependency_id'])
                if dependency and dependency.get('status') in ('validated', 'published'):
                    participants = (dependency.get('result') or {}).get('qualified')
                    unresolved = participants is None
                else:
                    unresolved = True
            if not unresolved and len(participants) < 2:
                continue
        evaluated_planned.append(rid)
        if r is None:
            missing.append(rid); continue
        ballot = r.get('ballots', {}).get(user_id)
        result = r.get('result') or {}
        reference = result.get('reference_ranking')
        original = (ballot.get('original') or ballot) if ballot else {}
        if not original.get('ranking') or reference is None or r.get('status') not in ('validated', 'published'):
            missing.append(rid); continue
        score, pairs = pair_concordance(original['ranking'], reference)
        scores.append(score); total_pairs += pairs
        if r.get('phase') != 'overall':
            categories.add(r['category_id'])
        details.append({'round_id': rid, 'score': _fraction(score), 'pairs': pairs, 'reference_version': result.get('reference_version')})
    mean = sum(scores, Fraction()) / len(scores) if scores else None
    complete = bool(evaluated_planned) and not missing
    sufficient = len(categories) >= 4 and total_pairs >= 60 and complete
    return {'mean': _fraction(mean) if mean is not None else None, 'categories': len(categories), 'pairs': total_pairs,
            'missing': missing, 'complete': complete, 'sufficient': sufficient,
            'passed': sufficient and mean is not None and mean >= 85, 'details': details}


def collective_results(results, entries, people, kind='club', eligible_ids=None, tiebreak=None):
    if kind not in ('club', 'country'):
        raise DomainError('Collectif inconnu.')
    emap, pmap = {e['id']: e for e in entries}, {p['id']: p for p in people}
    allowed = None if eligible_ids is None else set(eligible_ids)
    best = {}
    for row in results:
        eid = row['entry_id']
        if row.get('phase') == 'overall' or (allowed is not None and eid not in allowed):
            continue
        pid = emap[eid]['person_id']
        if pid not in best or row['rank'] < best[pid]['rank']:
            best[pid] = row
    groups = {}
    points = (10, 6, 4, 3, 2, 1)
    for pid, row in best.items():
        name = pmap[pid].get(kind)
        if not name:
            continue
        group = groups.setdefault(name, {'name': name, 'points': 0, 'counts': [0] * 6, 'people': []})
        rank = row['rank']
        if 1 <= rank <= 6:
            group['points'] += points[rank - 1]; group['counts'][rank - 1] += 1
        group['people'].append(pid)
    use_counts = True  # Départage sportif obligatoire avant tout critère personnalisé.
    rows = sorted(groups.values(), key=lambda g: (-g['points'], tuple(-c for c in g['counts']) if use_counts else (), g['name']))
    previous, rank = None, 0
    for i, row in enumerate(rows):
        key = (row['points'], tuple(row['counts']) if use_counts else ())
        if key != previous:
            rank = i + 1
        row['rank'] = rank; previous = key
    return rows
