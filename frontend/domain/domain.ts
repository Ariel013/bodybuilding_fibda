/**
 * Calculs sportifs FIBDA purs ; aucune mutation ni publication implicite.
 *
 * Portage fonction par fonction de `backend/fibda/domain.py`, à l'identique :
 * mêmes signatures, mêmes formes de retour (clés JSON du contrat d'API),
 * mêmes messages d'erreur, même ordre de tri (tri stable, clés composites),
 * même algorithme de composantes fortement connexes (Tarjan tel qu'écrit en Python).
 *
 * Conventions de portage :
 * - un `dict` Python ordonné est représenté par un objet `Record` ou une `Map` ;
 *   l'ordre d'itération d'un `Record` JavaScript place les clés « entières »
 *   (ex. "0", "1") avant les autres — les ids réels sont des UUID, sans effet ;
 * - les `Fraction` Python sont des rationnels exacts en BigInt, réduits par pgcd,
 *   sérialisés `{numerator, denominator, display}` comme `_fraction` en Python.
 */

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

/** Profil utilisateur minimal tel que consommé par `validate_panel`. */
export interface JuryUser {
  id: string;
  roles?: string[];
  active?: boolean;
  approved?: boolean;
  [key: string]: unknown;
}

/** Bulletin de classement : liste ou objet `{ranking}` (comme `_rankings` en Python). */
export type RankingBallot = string[] | { ranking: string[]; [key: string]: unknown };
/** Bulletin d'élimination : liste ou objet `{selected}`. */
export type SelectionBallot = string[] | { selected?: string[]; [key: string]: unknown };

export type Ballots<T> = Record<string, T> | Map<string, T>;

export interface RankRow {
  entry_id: string;
  rank: number;
  total: number;
  ranks: number[];
  removed_min: number;
  removed_max: number;
}

export interface EliminationOutcome {
  counts: Record<string, number>;
  qualified: string[];
  tied: string[];
  slots: number;
  pending: boolean;
}

export interface FractionJson {
  numerator: number;
  denominator: number;
  display: string;
}

/** Rationnel exact (équivalent de `fractions.Fraction`). */
export interface Fraction {
  num: bigint;
  den: bigint;
}

/** Itère un `Record` ou une `Map` dans l'ordre d'insertion (dict Python). */
function entriesOf<T>(ballots: Ballots<T>): [string, T][] {
  return ballots instanceof Map ? Array.from(ballots.entries()) : Object.entries(ballots);
}

function sizeOf<T>(ballots: Ballots<T>): number {
  return ballots instanceof Map ? ballots.size : Object.keys(ballots).length;
}

/** `key in dict` pour un Record ou une Map. */
function hasKey<T>(ballots: Ballots<T>, key: string | null | undefined): boolean {
  if (key === null || key === undefined) return false;
  return ballots instanceof Map ? ballots.has(key) : Object.prototype.hasOwnProperty.call(ballots, key);
}

/** Vrai si `roles` partage au moins un rôle avec `wanted` (`set(roles) & {...}`). */
function intersects(roles: string[], wanted: string[]): boolean {
  return roles.some((r) => wanted.includes(r));
}

export function validatePanel(
  panel: string[],
  users: JuryUser[] | Record<string, JuryUser>,
  chiefId: string | null = null,
): true {
  if (![5, 7, 9, 11].includes(panel.length) || new Set(panel).size !== panel.length) {
    throw new DomainError('Jury distinct de 5, 7, 9 ou 11 requis.');
  }
  const profiles: Record<string, JuryUser> = Array.isArray(users)
    ? Object.fromEntries(users.map((u) => [u.id, u]))
    : users;
  for (const uid of panel) {
    const u: Partial<JuryUser> = Object.prototype.hasOwnProperty.call(profiles, uid) ? profiles[uid] : {};
    const roles = 'roles' in u && u.roles !== undefined ? u.roles : [];
    const active = 'active' in u && u.active !== undefined ? u.active : true;
    const approved = 'approved' in u && u.approved !== undefined ? u.approved : false;
    if (
      !active ||
      !approved ||
      roles.includes('director') ||
      roles.includes('trainee') ||
      !intersects(roles, ['chief', 'responsable', 'judge'])
    ) {
      throw new DomainError('Membre de jury non autorisé.');
    }
  }
  const chiefs = panel.filter((uid) => (profiles[uid].roles as string[]).includes('chief'));
  if (chiefs.length !== 1 || (chiefId !== null && !(chiefs.length === 1 && chiefs[0] === chiefId))) {
    throw new DomainError('Un chef de jury est requis dans le panel.');
  }
  return true;
}

function sameSet(a: string[], b: string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const x of sa) if (!sb.has(x)) return false;
  return true;
}

export function validateRanking(ranking: string[], participants: string[]): true {
  if (
    new Set(participants).size !== participants.length ||
    ranking.length !== participants.length ||
    new Set(ranking).size !== ranking.length ||
    !sameSet(ranking, participants)
  ) {
    throw new DomainError('Le classement doit être une permutation exacte des participants.');
  }
  return true;
}

/** `_rankings` : liste ordonnée [juge, classement] (dict Python ordonné). */
function rankingsOf(ballots: Ballots<RankingBallot>): [string, string[]][] {
  return entriesOf(ballots).map(([uid, value]) => [
    uid,
    Array.isArray(value) ? [...value] : [...(value as { ranking: string[] }).ranking],
  ]);
}

/** `itertools.combinations(items, 2)` dans le même ordre. */
function pairs<T>(items: T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) out.push([items[i], items[j]]);
  }
  return out;
}

/** SCC du graphe majoritaire ; seul un cycle utilise l'ordre du chef. */
export function majorityOrder(tiedInput: Iterable<string>, rankings: string[][], chiefRanking: string[]): string[] {
  const tied = Array.from(tiedInput);
  const positions = rankings.map((r) => new Map(r.map((p, i) => [p, i] as [string, number])));
  const chief = new Map(chiefRanking.map((p, i) => [p, i] as [string, number]));
  // `chief.__getitem__` lève KeyError en Python si le participant est absent du bulletin du chef.
  const chiefPos = (p: string): number => {
    const v = chief.get(p);
    if (v === undefined) throw new Error(`KeyError: ${p}`);
    return v;
  };
  const graph = new Map<string, string[]>(tied.map((p) => [p, []]));
  for (const [a, b] of pairs(tied)) {
    let votes = 0;
    for (const pos of positions) if ((pos.get(a) as number) < (pos.get(b) as number)) votes += 1;
    if (votes * 2 > positions.length) (graph.get(a) as string[]).push(b);
    else if (votes * 2 < positions.length) (graph.get(b) as string[]).push(a);
  }
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onstack = new Set<string>();
  const components: string[][] = [];
  const visit = (v: string): void => {
    index.set(v, index.size);
    low.set(v, index.get(v) as number);
    stack.push(v);
    onstack.add(v);
    for (const w of graph.get(v) as string[]) {
      if (!index.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v) as number, low.get(w) as number));
      } else if (onstack.has(w)) {
        low.set(v, Math.min(low.get(v) as number, index.get(w) as number));
      }
    }
    if (low.get(v) === index.get(v)) {
      const comp: string[] = [];
      for (;;) {
        const w = stack.pop() as string;
        onstack.delete(w);
        comp.push(w);
        if (w === v) break;
      }
      // `sorted(comp, key=chief.__getitem__)` : tri stable par position chez le chef.
      components.push(comp.map((p, i) => [p, i] as [string, number])
        .sort((x, y) => chiefPos(x[0]) - chiefPos(y[0]) || x[1] - y[1])
        .map(([p]) => p));
    }
  };
  for (const p of tied) if (!index.has(p)) visit(p);
  const owner = new Map<string, number>();
  components.forEach((c, i) => c.forEach((p) => owner.set(p, i)));
  const edges: [number, number][] = [];
  const seenEdges = new Set<string>();
  for (const [a, targets] of graph) {
    for (const b of targets) {
      const oa = owner.get(a) as number;
      const ob = owner.get(b) as number;
      if (oa !== ob && !seenEdges.has(`${oa}>${ob}`)) {
        seenEdges.add(`${oa}>${ob}`);
        edges.push([oa, ob]);
      }
    }
  }
  const remaining = new Set<number>(components.map((_, i) => i));
  const result: string[] = [];
  while (remaining.size) {
    const ready = Array.from(remaining).filter(
      (i) => !edges.some(([a, b]) => b === i && remaining.has(a)),
    );
    // `min(ready, key=...)` : les composantes sont disjointes, les clés sont distinctes.
    let selected = ready[0];
    let bestKey = Infinity;
    for (const i of ready) {
      const key = Math.min(...components[i].map(chiefPos));
      if (key < bestKey) {
        bestKey = key;
        selected = i;
      }
    }
    result.push(...components[selected]);
    remaining.delete(selected);
  }
  return result;
}

export function rankBallots(
  ballots: Ballots<RankingBallot>,
  participants: string[] | null = null,
  chiefId: string | null = null,
  eligibleIds: Iterable<string> | null = null,
): RankRow[] {
  let rankings = rankingsOf(ballots);
  if (![5, 7, 9, 11].includes(rankings.length)) {
    throw new DomainError('Tous les bulletins du jury autorisé sont requis.');
  }
  if (chiefId === null || !rankings.some(([uid]) => uid === chiefId)) {
    throw new DomainError('Bulletin du chef manquant.');
  }
  let people = [...(participants !== null ? participants : rankings[0][1])];
  for (const [, ranking] of rankings) validateRanking(ranking, people);
  if (eligibleIds !== null) {
    const allowed = new Set(eligibleIds);
    people = people.filter((p) => allowed.has(p));
    rankings = rankings.map(([j, r]) => [j, r.filter((p) => allowed.has(p))]);
  }
  const positions = rankings.map(([, r]) => new Map(r.map((p, i) => [p, i + 1] as [string, number])));
  const posOf = (pos: Map<string, number>, p: string): number => {
    const v = pos.get(p);
    if (v === undefined) throw new Error(`KeyError: ${p}`);
    return v;
  };
  const totals = new Map<string, number>();
  for (const p of people) {
    const values = positions.map((pos) => posOf(pos, p)).sort((a, b) => a - b);
    totals.set(p, values.slice(1, -1).reduce((s, v) => s + v, 0));
  }
  const groups = new Map<number, string[]>();
  for (const [p, total] of totals) {
    if (!groups.has(total)) groups.set(total, []);
    (groups.get(total) as string[]).push(p);
  }
  const chiefRanking = (rankings.find(([uid]) => uid === chiefId) as [string, string[]])[1];
  const order: string[] = [];
  for (const total of Array.from(groups.keys()).sort((a, b) => a - b)) {
    order.push(...majorityOrder(groups.get(total) as string[], rankings.map(([, r]) => r), chiefRanking));
  }
  return order.map((p, i) => {
    const ranks = positions.map((pos) => posOf(pos, p));
    return {
      entry_id: p,
      rank: i + 1,
      total: totals.get(p) as number,
      ranks,
      removed_min: Math.min(...ranks),
      removed_max: Math.max(...ranks),
    };
  });
}

export function eliminationResult(
  ballots: Ballots<SelectionBallot>,
  participants: string[],
  quota: unknown,
  _chiefId: string | null = null,
): EliminationOutcome {
  // `isinstance(quota, int) and not bool` : entier strict, ni booléen ni flottant.
  if (
    typeof quota !== 'number' ||
    !Number.isInteger(quota) ||
    !(0 < quota && quota <= participants.length) ||
    new Set(participants).size !== participants.length
  ) {
    throw new DomainError('Quota ou participants invalides.');
  }
  if (![5, 7, 9, 11].includes(sizeOf(ballots))) {
    throw new DomainError('Panel incomplet.');
  }
  const counts = new Map<string, number>(participants.map((p) => [p, 0]));
  const participantSet = new Set(participants);
  for (const [, value] of entriesOf(ballots)) {
    const selected: string[] = Array.isArray(value)
      ? value
      : 'selected' in value && value.selected !== undefined
        ? value.selected
        : [];
    if (
      selected.length !== quota ||
      new Set(selected).size !== quota ||
      !selected.every((p) => participantSet.has(p))
    ) {
      throw new DomainError('Sélection exacte du quota requise.');
    }
    for (const p of selected) counts.set(p, (counts.get(p) as number) + 1);
  }
  const threshold = Array.from(counts.values()).sort((a, b) => b - a)[quota - 1];
  const above = participants.filter((p) => (counts.get(p) as number) > threshold);
  const tied = participants.filter((p) => (counts.get(p) as number) === threshold);
  const pending = above.length + tied.length > quota;
  return {
    counts: Object.fromEntries(counts),
    qualified: pending ? above : [...above, ...tied],
    tied: pending ? tied : [],
    slots: pending ? quota - above.length : 0,
    pending,
  };
}

export interface EntryRef {
  id: string;
  person_id: string;
  [key: string]: unknown;
}

export interface ResultRow {
  entry_id: string;
  rank: number;
  phase?: string;
  [key: string]: unknown;
}

function lookup<T>(map: Map<string, T>, key: string): T {
  const v = map.get(key);
  if (v === undefined) throw new Error(`KeyError: ${key}`);
  return v;
}

export function overallCandidates(
  results: ResultRow[],
  entries: EntryRef[],
  eligibleIds: Iterable<string> | null = null,
): string[] {
  const entrymap = new Map(entries.map((e) => [e.id, e]));
  const allowed = eligibleIds === null ? null : new Set(eligibleIds);
  const seen = new Set<string>();
  const selected: string[] = [];
  for (const row of results) {
    const eid = row.entry_id;
    if (row.rank !== 1 || (allowed !== null && !allowed.has(eid))) continue;
    const pid = lookup(entrymap, eid).person_id;
    if (!seen.has(pid)) {
      seen.add(pid);
      selected.push(eid);
    }
  }
  return selected;
}

// ---------------------------------------------------------------------------
// Rationnels exacts (Fraction)
// ---------------------------------------------------------------------------

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

export function fraction(num: bigint | number, den: bigint | number = 1n): Fraction {
  let n = BigInt(num);
  let d = BigInt(den);
  if (d === 0n) throw new Error('ZeroDivisionError');
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return g === 0n ? { num: 0n, den: 1n } : { num: n / g, den: d / g };
}

function fractionAdd(a: Fraction, b: Fraction): Fraction {
  return fraction(a.num * b.den + b.num * a.den, a.den * b.den);
}

function fractionDiv(a: Fraction, b: Fraction): Fraction {
  return fraction(a.num * b.den, a.den * b.num);
}

export function fractionEquals(a: Fraction, b: Fraction): boolean {
  return a.num === b.num && a.den === b.den;
}

/**
 * `f'{float(value):.2f}'` : conversion en double (division correctement arrondie),
 * puis formatage à deux décimales avec arrondi au plus proche, pair en cas d'égalité
 * exacte (comportement de Python sur la valeur binaire exacte du double).
 */
function formatTwoDecimals(x: number): string {
  const exact = x.toFixed(30); // développement décimal exact du double, largement suffisant
  const dot = exact.indexOf('.');
  const tail = exact.slice(dot + 3); // chiffres au-delà de la deuxième décimale
  const isTie = /^50*$/.test(tail);
  if (!isTie) return x.toFixed(2);
  // Égalité exacte : arrondi vers le chiffre pair (ROUND_HALF_EVEN), toFixed arrondirait vers le haut.
  const truncated = exact.slice(0, dot + 3);
  const lastDigit = Number(truncated[truncated.length - 1]);
  if (lastDigit % 2 === 0) return truncated;
  return x.toFixed(2);
}

function fractionJson(value: Fraction): FractionJson {
  return {
    numerator: Number(value.num),
    denominator: Number(value.den),
    display: formatTwoDecimals(Number(value.num) / Number(value.den)),
  };
}

export function pairConcordance(ranking: string[], reference: string[]): [Fraction, number] {
  validateRanking(ranking, reference);
  const positions = new Map(ranking.map((p, i) => [p, i] as [string, number]));
  const count = Math.floor((reference.length * (reference.length - 1)) / 2);
  if (!count) throw new DomainError('Au moins deux participants pour une comparaison.');
  let correct = 0;
  for (const [a, b] of pairs(reference)) {
    if ((positions.get(a) as number) < (positions.get(b) as number)) correct += 1;
  }
  return [fraction(correct * 100, count), count];
}

export interface ExamRound {
  id: string;
  category_id?: string;
  phase?: string;
  status?: string;
  participant_ids?: string[] | null;
  dependency_id?: string | null;
  ballots?: Record<string, { ranking?: string[]; original?: { ranking?: string[] } | null } | null>;
  result?: { reference_ranking?: string[] | null; reference_version?: unknown; qualified?: string[] | null } | null;
  [key: string]: unknown;
}

export interface ExamDetail {
  round_id: string;
  score: FractionJson;
  pairs: number;
  reference_version: unknown;
}

export interface ExamReport {
  mean: FractionJson | null;
  categories: number;
  pairs: number;
  missing: string[];
  complete: boolean;
  sufficient: boolean;
  passed: boolean;
  details: ExamDetail[];
}

/** Vérité Python (`not x`) pour une liste ou une valeur nulle. */
function truthy(value: unknown): boolean {
  if (value === null || value === undefined || value === false || value === 0 || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  return true;
}

export function examReport(
  program: { round_ids?: string[]; [key: string]: unknown } | string[],
  rounds: ExamRound[],
  userId: string,
): ExamReport {
  const planned: string[] = Array.isArray(program)
    ? [...program]
    : 'round_ids' in program && program.round_ids !== undefined
      ? program.round_ids
      : [];
  const byid = new Map(rounds.map((r) => [r.id, r]));
  const scores: Fraction[] = [];
  const categories = new Set<string>();
  const details: ExamDetail[] = [];
  const missing: string[] = [];
  let totalPairs = 0;
  const evaluatedPlanned: string[] = [];
  for (const rid of Array.from(new Set(planned))) {
    const r = byid.get(rid);
    if (r !== undefined) {
      if (r.phase === 'elimination') continue;
      // `r.get('participant_ids', ...)` : la valeur par défaut ne s'applique qu'à une clé absente.
      let participants: string[] | null | undefined =
        'participant_ids' in r
          ? r.participant_ids
          : (r.result ?? {}).reference_ranking !== undefined
            ? ((r.result ?? {}).reference_ranking as string[] | null)
            : [];
      // Une liste vide avant qualification signifie « inconnue », pas zéro athlète.
      let unresolved = false;
      if (!truthy(participants) && truthy(r.dependency_id) && r.status === 'pending') {
        const dependency = byid.get(r.dependency_id as string);
        if (dependency && ['validated', 'published'].includes(dependency.status as string)) {
          const qualified = (dependency.result ?? {}).qualified;
          participants = qualified === undefined ? null : qualified;
          unresolved = participants === null;
        } else {
          unresolved = true;
        }
      }
      if (!unresolved && (participants as string[]).length < 2) continue;
    }
    evaluatedPlanned.push(rid);
    if (r === undefined) {
      missing.push(rid);
      continue;
    }
    const ballot = (r.ballots ?? {})[userId];
    const result = r.result ?? {};
    const reference = result.reference_ranking;
    // `(ballot.get('original') or ballot) if ballot else {}` : le bulletin original prime.
    let original: { ranking?: string[] } = {};
    if (truthy(ballot)) {
      const b = ballot as { ranking?: string[]; original?: { ranking?: string[] } | null };
      original = truthy(b.original) ? (b.original as { ranking?: string[] }) : b;
    }
    if (
      !truthy(original.ranking) ||
      reference === null ||
      reference === undefined ||
      !['validated', 'published'].includes(r.status as string)
    ) {
      missing.push(rid);
      continue;
    }
    const [score, count] = pairConcordance(original.ranking as string[], reference);
    scores.push(score);
    totalPairs += count;
    if (r.phase !== 'overall') {
      if (!('category_id' in r)) throw new Error('KeyError: category_id');
      categories.add(r.category_id as string);
    }
    details.push({
      round_id: rid,
      score: fractionJson(score),
      pairs: count,
      // `result.get('reference_version')` → None absent : sérialisé `null`, jamais omis.
      reference_version: result.reference_version ?? null,
    });
  }
  const mean = scores.length
    ? fractionDiv(scores.reduce(fractionAdd, fraction(0n)), fraction(scores.length))
    : null;
  const complete = evaluatedPlanned.length > 0 && missing.length === 0;
  const sufficient = categories.size >= 4 && totalPairs >= 60 && complete;
  return {
    mean: mean !== null ? fractionJson(mean) : null,
    categories: categories.size,
    pairs: totalPairs,
    missing,
    complete,
    sufficient,
    passed: sufficient && mean !== null && mean.num >= 85n * mean.den,
    details,
  };
}

export interface PersonRef {
  id: string;
  club?: string | null;
  country?: string | null;
  [key: string]: unknown;
}

export interface CollectiveRow {
  name: string;
  points: number;
  counts: number[];
  people: string[];
  rank: number;
}

/** Comparaison de chaînes par points de code, comme `<` sur des `str` Python. */
function compareCodePoints(a: string, b: string): number {
  const ia = a[Symbol.iterator]();
  const ib = b[Symbol.iterator]();
  for (;;) {
    const x = ia.next();
    const y = ib.next();
    if (x.done && y.done) return 0;
    if (x.done) return -1;
    if (y.done) return 1;
    const cx = x.value.codePointAt(0) as number;
    const cy = y.value.codePointAt(0) as number;
    if (cx !== cy) return cx - cy;
  }
}

export function collectiveResults(
  results: ResultRow[],
  entries: EntryRef[],
  people: PersonRef[],
  kind: string = 'club',
  eligibleIds: Iterable<string> | null = null,
  _tiebreak: unknown = null,
): CollectiveRow[] {
  if (!['club', 'country'].includes(kind)) throw new DomainError('Collectif inconnu.');
  const emap = new Map(entries.map((e) => [e.id, e]));
  const pmap = new Map(people.map((p) => [p.id, p]));
  const allowed = eligibleIds === null ? null : new Set(eligibleIds);
  const best = new Map<string, ResultRow>();
  for (const row of results) {
    const eid = row.entry_id;
    if (row.phase === 'overall' || (allowed !== null && !allowed.has(eid))) continue;
    const pid = lookup(emap, eid).person_id;
    const current = best.get(pid);
    if (current === undefined || row.rank < current.rank) best.set(pid, row);
  }
  const groups = new Map<string, CollectiveRow>();
  const points = [10, 6, 4, 3, 2, 1];
  for (const [pid, row] of best) {
    const name = lookup(pmap, pid)[kind] as string | null | undefined;
    if (!truthy(name)) continue;
    const key = name as string;
    if (!groups.has(key)) groups.set(key, { name: key, points: 0, counts: [0, 0, 0, 0, 0, 0], people: [], rank: 0 });
    const group = groups.get(key) as CollectiveRow;
    const rank = row.rank;
    if (1 <= rank && rank <= 6) {
      group.points += points[rank - 1];
      group.counts[rank - 1] += 1;
    }
    group.people.push(pid);
  }
  const useCounts = true; // Départage sportif obligatoire avant tout critère personnalisé.
  // Clé Python : (-points, tuple(-counts) si use_counts, name) ; tri stable.
  const compareKey = (g: CollectiveRow, h: CollectiveRow): number => {
    if (g.points !== h.points) return h.points - g.points;
    if (useCounts) {
      for (let i = 0; i < 6; i++) if (g.counts[i] !== h.counts[i]) return h.counts[i] - g.counts[i];
    }
    return compareCodePoints(g.name, h.name);
  };
  const rows = Array.from(groups.values()).sort(compareKey);
  let previous: string | null = null;
  let rank = 0;
  rows.forEach((row, i) => {
    const key = JSON.stringify([row.points, useCounts ? row.counts : []]);
    if (key !== previous) rank = i + 1;
    row.rank = rank;
    previous = key;
  });
  return rows;
}
