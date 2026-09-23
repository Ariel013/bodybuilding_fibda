// Portage un pour un de backend/tests/test_catalogue.py : mêmes données, mêmes attendus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from './domain';
import { ExactDecimal, loadCatalogue, measure, weightLimit, eligibility, type Catalogue } from './catalogue';

const D = (s: string | number) => ExactDecimal.of(s);
/** `assertEqual(a, Decimal(b))` : égalité numérique de Decimal. */
const assertDecimalEqual = (actual: ExactDecimal | null, expected: ExactDecimal) => {
  assert.ok(actual !== null, 'valeur nulle inattendue');
  assert.equal((actual as ExactDecimal).compare(expected), 0, `${actual} ≠ ${expected}`);
};

test('test_catalogue_complete', () => {
  const c = loadCatalogue();
  assert.equal(c.disciplines.length, 9);
  assert.equal(new Set(c.rules.map((r) => r.id)).size, c.rules.length);
  assert.equal(c.rules.filter((r) => r.discipline === 'bodybuilding' && r.division === 'masters').length, 14);
  assert.equal(
    c.rules.some((r) => r.division === 'junior' && ['muscular', 'womens_physique'].includes(r.discipline)),
    false,
  );
});

test('test_exact_tenth_and_limits', () => {
  assertDecimalEqual(measure('175,1'), D('175.1'));
  for (const v of ['175.11', 'NaN', 'Infinity', 0, true]) {
    assert.throws(() => measure(v), DomainError, `measure(${JSON.stringify(v)})`);
  }
  assertDecimalEqual(weightLimit('classic_bodybuilding', 'senior', '175.0'), D('79.0'));
  assertDecimalEqual(weightLimit('classic_bodybuilding', 'senior', '175.1'), D('82.1'));
  // Représentation textuelle identique à `str(Decimal)` en Python.
  assert.equal(String(weightLimit('classic_bodybuilding', 'senior', '175.0')), '79.0');
  assert.equal(String(weightLimit('classic_bodybuilding', 'senior', '175.1')), '82.1');
  const cases: [string, string, string][] = [
    ['classic_bodybuilding', 'junior', '82'],
    ['classic_bodybuilding', 'senior', '85'],
    ['classic_physique', 'junior', '84'],
    ['classic_physique', 'masters', '89'],
  ];
  for (const [d, division, expected] of cases) {
    assertDecimalEqual(weightLimit(d, division, '178'), D(expected));
    assert.equal(String(weightLimit(d, division, '178')), expected);
  }
});

test('test_annual_age_and_fifteen_uncertainty', () => {
  const p: Record<string, unknown> = {
    birth_date: '1976-12-31',
    sex: 'F',
    height_cm: '163',
    weight_kg: '60',
    measurements_confirmed: true,
  };
  let result = eligibility(p, 2026, null, 'masters', 'bikini');
  assert.equal(result.length, 1);
  assert.equal(result[0].age, 50);
  p.birth_date = '2011-12-31';
  p.sex = 'M';
  for (const d of ['bodybuilding', 'classic_bodybuilding', 'mens_physique']) {
    result = eligibility(p, 2026, null, 'junior', d);
    assert.equal(result.length, 1, d);
    assert.equal(result[0].status, 'confirmation_required');
  }
  assert.deepEqual(eligibility(p, 2026, null, 'junior', 'muscular'), []);
});

test('test_versioned_coefficients_and_rule_provenance', () => {
  const c = loadCatalogue();
  assert.equal(c.version, 'FIBDA-2026-09-22.2');
  const expected: [string, string, number[]][] = [
    ['classic_bodybuilding', 'junior', [0, 1, 2, 4, 5, 6, 7]],
    ['classic_bodybuilding', 'senior', [0, 2, 4, 7, 9, 11, 13]],
    ['classic_physique', 'junior', [2, 3, 4, 6, 7, 8, 9]],
    ['classic_physique', 'senior', [4, 6, 8, 11, 13, 15, 17]],
  ];
  const heights = ['168', '171', '175', '180', '188', '196', '196.1'];
  for (const [discipline, division, coefficients] of expected) {
    assert.deepEqual(c.classic_limits.coefficients[discipline][division], coefficients);
    heights.forEach((h, i) => {
      const k = coefficients[i];
      assertDecimalEqual(weightLimit(discipline, division, h), D(h).sub(100).add(k));
      if (division === 'senior') assertDecimalEqual(weightLimit(discipline, 'masters', h), D(h).sub(100).add(k));
    });
  }
  assert.equal(Object.keys(c.sources).length, 9);
  for (const source of Object.values(c.sources)) {
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(source.bytes > 0);
    assert.ok(source.archive_path.endsWith('.pdf'));
  }
  for (const rule of c.rules) {
    assert.ok(rule.source_id in c.sources);
    assert.ok(rule.source_pages.length > 0);
    assert.ok(rule.normalization_ids.length > 0);
    for (const identifier of rule.normalization_ids) assert.ok(identifier in c.normalizations);
  }
});

test('test_explicit_snapshot_drives_limit_and_eligibility', () => {
  const snapshot: Catalogue = loadCatalogue();
  snapshot.classic_limits.coefficients.classic_physique.junior[0] = 10;
  assertDecimalEqual(weightLimit('classic_physique', 'junior', '168', snapshot), D('78'));
  const person = {
    birth_date: '2006-01-01',
    sex: 'M',
    height_cm: '168',
    weight_kg: '77',
    measurements_confirmed: true,
  };
  assert.deepEqual(eligibility(person, 2026, null, 'junior', 'classic_physique'), []);
  assert.equal(eligibility(person, 2026, null, 'junior', 'classic_physique', snapshot).length, 1);
});
