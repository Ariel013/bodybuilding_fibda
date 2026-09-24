// Portage un pour un de backend/tests/test_domain.py : mêmes données, mêmes attendus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DomainError,
  validatePanel,
  validateRanking,
  majorityOrder,
  rankBallots,
  eliminationResult,
  overallCandidates,
  pairConcordance,
  examReport,
  collectiveResults,
  fraction,
  fractionEquals,
  type JuryUser,
  type ExamRound,
  type RankingBallot,
} from './domain';

const chars = (s: string): string[] => s.split('');
const range = (n: number): string[] => Array.from({ length: n }, (_, i) => String(i));

/** `self.ballots(rankings)` : clés '0', '1', … ; une Map préserve l'ordre d'insertion comme un dict. */
function ballots(rankings: string[][]): Map<string, RankingBallot> {
  return new Map(rankings.map((r, i) => [String(i), { ranking: r }]));
}

test('test_panel_and_permutation', () => {
  const users: JuryUser[] = range(5).map((id, i) => ({ id, approved: true, roles: [i === 0 ? 'chief' : 'judge'] }));
  assert.equal(validatePanel(range(5), users, '0'), true);
  (users[2].roles as string[]).push('director');
  assert.throws(() => validatePanel(range(5), users, '0'), DomainError);
  assert.throws(() => validateRanking(['a', 'a'], ['a', 'b']), DomainError);
});

test('test_single_minmax_all_panels', () => {
  for (const count of [5, 7, 9, 11]) {
    const result = rankBallots(ballots(Array.from({ length: count }, () => ['a', 'b', 'c'])), null, '0');
    assert.equal(result[0].total, count - 2);
    assert.equal(result[2].total, 3 * (count - 2));
  }
});

test('test_national_renumbers_each_ballot', () => {
  const b = ballots([chars('axb'), chars('abx'), chars('xab'), chars('bxa'), chars('xba')]);
  const result = rankBallots(b, null, '0', ['a', 'b']);
  assert.deepEqual(Object.fromEntries(result.map((r) => [r.entry_id, r.total])), { a: 4, b: 5 });
});

test('test_majority_cycle_uses_chief', () => {
  assert.deepEqual(
    majorityOrder(chars('abc'), [chars('abc'), chars('bca'), chars('cab')], chars('bca')),
    chars('bca'),
  );
  assert.deepEqual(
    majorityOrder(chars('abcd'), [chars('dabc'), chars('dbca'), chars('dcab')], chars('dbca')),
    chars('dbca'),
  );
});

test('test_elimination_boundary_is_unresolved', () => {
  const r = eliminationResult({ '0': ['a'], '1': ['a'], '2': ['b'], '3': ['b'], '4': ['c'] }, chars('abc'), 1);
  assert.equal(r.pending, true);
  assert.deepEqual(r.tied, chars('ab'));
  assert.deepEqual(r.qualified, []);
});

test('test_overall_dedup_and_collective', () => {
  // Décision FIBDA du 24/09/2026 : barème 15/10/5/4/3 puis 1, chaque inscription compte,
  // overall inclus. L'overall reste dédupliqué par personne ; le collectif ne l'est plus.
  const entries = [
    { id: 'a', person_id: 'p' },
    { id: 'b', person_id: 'p' },
    { id: 'c', person_id: 'q' },
  ];
  const rows = [
    { entry_id: 'a', rank: 1 },
    { entry_id: 'b', rank: 1 },
    { entry_id: 'c', rank: 2 },
  ];
  assert.deepEqual(overallCandidates(rows, entries), ['a']);
  const groups = collectiveResults(rows, entries, [
    { id: 'p', club: 'A' },
    { id: 'q', club: 'A' },
  ]);
  // p : deux inscriptions, deux 1res places = 15 + 15 ; q : 2e place = 10.
  assert.equal(groups[0].points, 40);
  assert.deepEqual(groups[0].counts, [2, 1, 0, 0, 0, 0]);
  assert.deepEqual(groups[0].people, ['p', 'q']);
});

test('test_collective_scale_finale_overall_and_participation', () => {
  // Une finale à 7 (ranks 1–7), un éliminé en demi (rang 99, participation) et un overall gagné par a.
  const ids = chars('abcdefgh');
  const entries = ids.map((x) => ({ id: x, person_id: x }));
  const people = ids.map((x) => ({ id: x, club: 'A' }));
  const rows = [
    ...ids.slice(0, 7).map((x, i) => ({ entry_id: x, rank: i + 1, phase: 'final' })),
    { entry_id: 'h', rank: 99, phase: 'final', participation: true },
    { entry_id: 'a', rank: 1, phase: 'overall' },
  ];
  const [group] = collectiveResults(rows, entries, people);
  // 15 + 10 + 5 + 4 + 3 + 1 (6e) + 1 (7e) + 1 (participation h) + 15 (overall a) = 55.
  assert.equal(group.points, 55);
  assert.deepEqual(group.counts, [2, 1, 1, 1, 1, 3]);
  // Un athlète sans club ne compte pour personne ; un non éligible non plus.
  assert.deepEqual(collectiveResults(rows, entries, ids.map((x) => ({ id: x, club: null }))), []);
  assert.equal(collectiveResults(rows, entries, people, 'club', ['a'])[0].points, 30);
});

test('test_collective_tiebreak_by_places_then_persistent_tie', () => {
  const entries = chars('abcdef').map((x) => ({ id: x, person_id: x }));
  const people = [
    { id: 'a', club: 'A' }, { id: 'b', club: 'A' }, { id: 'c', club: 'A' },
    { id: 'd', club: 'B' }, { id: 'e', club: 'B' }, { id: 'f', club: 'B' },
  ];
  // A : 15 + 5 + 5 = 25 ; B : 10 + 10 + 5 = 25 ; A a une 1re place, B aucune → A devant.
  let groups = collectiveResults(
    [
      { entry_id: 'a', rank: 1 }, { entry_id: 'b', rank: 3 }, { entry_id: 'c', rank: 3 },
      { entry_id: 'd', rank: 2 }, { entry_id: 'e', rank: 2 }, { entry_id: 'f', rank: 3 },
    ],
    entries,
    people,
  );
  assert.deepEqual(groups.map((g) => [g.name, g.points, g.rank]), [['A', 25, 1], ['B', 25, 2]]);
  // Égalité persistante (mêmes points, mêmes places) : même rang, l'ordre alphabétique n'attribue rien.
  groups = collectiveResults([{ entry_id: 'd', rank: 1 }, { entry_id: 'a', rank: 1 }], entries, people);
  assert.deepEqual(groups.map((g) => [g.name, g.rank]), [['A', 1], ['B', 1]]);
});

test('test_exam_original_exact_mean_and_requirements', () => {
  const rounds: ExamRound[] = [];
  for (let i = 0; i < 4; i++) {
    rounds.push({
      id: String(i),
      category_id: String(i),
      phase: 'final',
      status: 'validated',
      ballots: { t: { ranking: chars('fedcba'), original: { ranking: chars('abcdef') } } },
      result: { reference_ranking: chars('abcdef'), reference_version: 2 },
    });
  }
  let result = examReport({ round_ids: range(4) }, rounds, 't');
  assert.equal(result.passed, true);
  assert.equal(result.pairs, 60);
  assert.equal(result.mean?.numerator, 100);
  rounds[0].ballots = {};
  result = examReport({ round_ids: range(4) }, rounds, 't');
  assert.equal(result.passed, false);
  assert.equal(result.mean?.numerator, 100);
  assert.deepEqual(result.missing, ['0']);
  assert.equal(fractionEquals(pairConcordance(chars('bacdef'), chars('abcdef'))[0], fraction(280, 3)), true);
});

test('test_mean_not_rounded_for_pass', () => {
  const reference = range(100);
  const remaining = [...reference];
  const ranking: string[] = [];
  let inversions = 2971;
  while (remaining.length) {
    const index = Math.min(inversions, remaining.length - 1);
    ranking.push(remaining.splice(index, 1)[0]);
    inversions -= index;
  }
  const rounds: ExamRound[] = range(4).map((id, i) => ({
    id,
    category_id: id,
    phase: 'final',
    status: 'validated',
    ballots: { t: { original: { ranking: i === 0 ? ranking : reference } } },
    result: { reference_ranking: reference, reference_version: 1 },
  }));
  const report = examReport({ round_ids: range(4) }, rounds, 't');
  assert.equal(report.sufficient, true);
  assert.equal(report.passed, false);
  const mean = report.mean as { numerator: number; denominator: number };
  assert.ok(mean.numerator / mean.denominator > 84.99);
  assert.throws(() => pairConcordance(['a'], ['a']), DomainError);
});

test('test_responsable_sits_and_non_evaluable_rounds_excluded', () => {
  const users: JuryUser[] = range(5).map((id, i) => ({
    id,
    approved: true,
    roles: [i === 0 ? 'chief' : i === 1 ? 'responsable' : 'judge'],
  }));
  assert.equal(validatePanel(range(5), users, '0'), true);
  const rounds: ExamRound[] = range(4).map((id) => ({
    id,
    category_id: id,
    participant_ids: chars('abcdef'),
    phase: 'final',
    status: 'validated',
    ballots: { t: { original: { ranking: chars('abcdef') } } },
    result: { reference_ranking: chars('abcdef'), reference_version: 1 },
  }));
  rounds.push(
    { id: 'elim', phase: 'elimination', participant_ids: chars('abcdef'), result: null },
    { id: 'alone', phase: 'final', participant_ids: ['a'], result: null },
  );
  const report = examReport({ round_ids: rounds.map((r) => r.id) }, rounds, 't');
  assert.equal(report.passed, true);
  assert.deepEqual(report.missing, []);
});

test('test_exam_resolved_single_qualifier_is_excluded_but_unknown_is_missing', () => {
  const rounds: ExamRound[] = range(4).map((id) => ({
    id,
    category_id: id,
    phase: 'final',
    status: 'validated',
    participant_ids: chars('abcdef'),
    ballots: { t: { ranking: chars('abcdef') } },
    result: { reference_ranking: chars('abcdef'), reference_version: 1 },
  }));
  const source: ExamRound = { id: 'source', phase: 'elimination', status: 'pending', result: null };
  const future: ExamRound = {
    id: 'future',
    category_id: 'fifth',
    phase: 'final',
    status: 'pending',
    dependency_id: 'source',
    participant_ids: [],
    ballots: {},
    result: null,
  };
  rounds.push(source, future);
  const program = { round_ids: [...range(4), 'future'] };
  assert.deepEqual(examReport(program, rounds, 't').missing, ['future']);
  source.status = 'validated';
  source.result = { qualified: ['a'] };
  assert.equal(examReport(program, rounds, 't').passed, true);
  source.result.qualified = ['a', 'b'];
  assert.deepEqual(examReport(program, rounds, 't').missing, ['future']);
});
