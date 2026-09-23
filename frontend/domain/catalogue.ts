/**
 * Catalogue versionné et contrôles morphologiques exacts au dixième.
 *
 * Portage à l'identique de `backend/fibda/catalogue.py`. Les mesures sont des
 * décimaux exacts (`ExactDecimal` : coefficient entier + exposant, comme
 * `decimal.Decimal`) ; aucune arithmétique flottante, refus de toute précision
 * inférieure au dixième (« refuser plutôt que convertir »).
 *
 * Le catalogue est lu depuis `./catalogue.json`, copie conforme de
 * `backend/fibda/catalogue.json` : les deux fichiers doivent rester identiques.
 */
import catalogueJson from './catalogue.json' with { type: 'json' };
import { DomainError } from './domain';

// ---------------------------------------------------------------------------
// Décimal exact (sous-ensemble de `decimal.Decimal` suffisant pour ce module)
// ---------------------------------------------------------------------------

type Special = 'NaN' | 'sNaN' | 'Infinity' | null;

/** Grammaire de `Decimal(str)` : signe, chiffres, point, exposant, Inf/NaN (insensible à la casse). */
const DECIMAL_RE = /^([-+])?(?:(?:(\d*)(?:\.(\d*))?)(?:[eE]([-+]?\d+))?|(inf(?:inity)?)|(s)?(nan)(\d*))$/i;

export class ExactDecimal {
  /** `-1` pour négatif (y compris `-0`), `1` sinon. */
  readonly sign: 1 | -1;
  /** Coefficient sans signe (`_int` Python), `0n` pour zéro. */
  readonly coef: bigint;
  /** Exposant décimal : valeur = coef × 10^exp. */
  readonly exp: number;
  readonly special: Special;

  private constructor(sign: 1 | -1, coef: bigint, exp: number, special: Special = null) {
    this.sign = sign;
    this.coef = coef;
    this.exp = exp;
    this.special = special;
  }

  /** `Decimal(str(value))` ; lève une Error générique (≈ InvalidOperation) si la chaîne est invalide. */
  static parse(text: string): ExactDecimal {
    // CPython : `value.strip().replace('_', '')` avant analyse.
    const cleaned = text.trim().replaceAll('_', '');
    const m = DECIMAL_RE.exec(cleaned);
    if (!m) throw new Error(`InvalidOperation: ${JSON.stringify(text)}`);
    const sign: 1 | -1 = m[1] === '-' ? -1 : 1;
    if (m[5] !== undefined) return new ExactDecimal(sign, 0n, 0, 'Infinity');
    if (m[7] !== undefined) return new ExactDecimal(sign, BigInt(m[8] || '0'), 0, m[6] ? 'sNaN' : 'NaN');
    const intpart = m[2] ?? '';
    const fracpart = m[3] ?? '';
    if (intpart === '' && fracpart === '') throw new Error(`InvalidOperation: ${JSON.stringify(text)}`);
    const exp = (m[4] !== undefined ? parseInt(m[4], 10) : 0) - fracpart.length;
    return new ExactDecimal(sign, BigInt(intpart + fracpart || '0'), exp);
  }

  static of(value: string | number | ExactDecimal): ExactDecimal {
    return value instanceof ExactDecimal ? value : ExactDecimal.parse(String(value));
  }

  isFinite(): boolean {
    return this.special === null;
  }

  /** Valeur signée alignée sur l'exposant `exp` (≤ this.exp). */
  private scaled(exp: number): bigint {
    return BigInt(this.sign) * this.coef * 10n ** BigInt(this.exp - exp);
  }

  private assertFinite(): void {
    if (!this.isFinite()) throw new Error('InvalidOperation: opération sur une valeur non finie.');
  }

  /** Addition exacte ; exposant du résultat = min des exposants (comme Decimal sans arrondi). */
  add(other: string | number | ExactDecimal): ExactDecimal {
    const b = ExactDecimal.of(other);
    this.assertFinite();
    b.assertFinite();
    const exp = Math.min(this.exp, b.exp);
    const sum = this.scaled(exp) + b.scaled(exp);
    return new ExactDecimal(sum < 0n ? -1 : 1, sum < 0n ? -sum : sum, exp);
  }

  sub(other: string | number | ExactDecimal): ExactDecimal {
    const b = ExactDecimal.of(other);
    b.assertFinite();
    return this.add(new ExactDecimal(b.sign === 1 ? -1 : 1, b.coef, b.exp));
  }

  /** `number * 10` avec un entier : coefficient multiplié, exposant conservé. */
  times(factor: bigint | number): ExactDecimal {
    this.assertFinite();
    const f = BigInt(factor);
    const v = BigInt(this.sign) * this.coef * f;
    return new ExactDecimal(v < 0n ? -1 : 1, v < 0n ? -v : v, this.exp);
  }

  /** Vrai si `self == self.to_integral_value()`. */
  isIntegral(): boolean {
    this.assertFinite();
    if (this.exp >= 0) return true;
    return this.coef % 10n ** BigInt(-this.exp) === 0n;
  }

  /** Comparaison numérique exacte entre valeurs finies (-1, 0, 1). */
  compare(other: string | number | ExactDecimal): number {
    const b = ExactDecimal.of(other);
    this.assertFinite();
    b.assertFinite();
    const exp = Math.min(this.exp, b.exp);
    const x = this.scaled(exp);
    const y = b.scaled(exp);
    return x < y ? -1 : x > y ? 1 : 0;
  }

  equals(other: string | number | ExactDecimal): boolean {
    return this.compare(other) === 0;
  }

  /** `str(Decimal)` de CPython (`__str__`, notation non ingénieur). */
  toString(): string {
    const sign = this.sign === -1 ? '-' : '';
    if (this.special === 'Infinity') return sign + 'Infinity';
    if (this.special !== null) return sign + this.special + (this.coef ? this.coef.toString() : '');
    const digits = this.coef.toString();
    const leftdigits = this.exp + digits.length;
    const dotplace = this.exp <= 0 && leftdigits > -6 ? leftdigits : 1;
    let intpart: string;
    let fracpart: string;
    if (dotplace <= 0) {
      intpart = '0';
      fracpart = '.' + '0'.repeat(-dotplace) + digits;
    } else if (dotplace >= digits.length) {
      intpart = digits + '0'.repeat(dotplace - digits.length);
      fracpart = '';
    } else {
      intpart = digits.slice(0, dotplace);
      fracpart = '.' + digits.slice(dotplace);
    }
    const e = leftdigits - dotplace;
    const expText = e === 0 ? '' : 'E' + (e >= 0 ? '+' : '-') + Math.abs(e);
    return sign + intpart + fracpart + expText;
  }
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export interface CatalogueRule {
  id: string;
  discipline: string;
  name: string;
  sex: string;
  division: string;
  sections: string[];
  age_min: number | null;
  age_max: number | null;
  metric: string;
  lower_exclusive: string | null;
  upper_inclusive: string | null;
  source_id: string;
  source_pages: number[];
  decision: string;
  age_uncertain_at: number[];
  classic_limit: unknown;
  normalization_ids: string[];
}

export interface Catalogue {
  version: string;
  verified_at: string;
  scope: string;
  sources: Record<string, { sha256: string; bytes: number; archive_path: string; [key: string]: unknown }>;
  disciplines: { id: string; name: string; sex: string; source_id: string; divisions: string[] }[];
  rules: CatalogueRule[];
  classic_limits: {
    formula: string;
    upper_inclusive_cm: (string | null)[];
    coefficients: Record<string, Record<string, number[]>>;
    [key: string]: unknown;
  };
  normalizations: Record<string, unknown>;
  [key: string]: unknown;
}

/** Dictionnaire indépendant à chaque appel (`json.loads` du fichier en Python). */
export function loadCatalogue(): Catalogue {
  return JSON.parse(JSON.stringify(catalogueJson)) as Catalogue;
}

export function measure(value: unknown): ExactDecimal {
  if (typeof value === 'boolean') throw new DomainError('Mesure positive au dixième requise.');
  let number: ExactDecimal;
  try {
    // `str(value)` : seuls une chaîne ou un nombre ont une représentation textuelle numérique.
    if (typeof value !== 'string' && typeof value !== 'number') throw new Error('InvalidOperation');
    number = ExactDecimal.parse(String(value).replaceAll(',', '.'));
  } catch {
    throw new DomainError('Mesure invalide.');
  }
  if (!number.isFinite() || number.compare(0) <= 0 || !number.times(10).isIntegral()) {
    throw new DomainError('Mesure positive au dixième requise, sans arrondi.');
  }
  return number;
}

export function weightLimit(
  discipline: string,
  division: string,
  height: unknown,
  catalogue: Catalogue | null = null,
): ExactDecimal | null {
  if (!['junior', 'senior', 'masters'].includes(division)) throw new DomainError('Division inconnue.');
  const limits = (catalogue !== null ? catalogue : loadCatalogue()).classic_limits;
  const coefficients = limits.coefficients;
  if (!Object.prototype.hasOwnProperty.call(coefficients, discipline)) return null;
  const h = measure(height);
  const band = limits.upper_inclusive_cm.findIndex(
    (maximum) => maximum === null || h.compare(ExactDecimal.of(maximum)) <= 0,
  );
  if (band < 0) throw new Error('StopIteration: aucune bande de taille.');
  return h.sub(100).add(ExactDecimal.parse(String(coefficients[discipline][division][band])));
}

export interface Person {
  birth_date?: unknown;
  sex?: string;
  section?: string | null;
  height_cm?: unknown;
  weight_kg?: unknown;
  measurements_confirmed?: unknown;
  [key: string]: unknown;
}

export interface Proposal {
  rule_id: string;
  discipline: string;
  name: string;
  division: string;
  section: string;
  age: number;
  status: 'confirmation_required' | 'eligible_measurements_age';
  reasons: string[];
  weight_limit: string | null;
  catalogue_version: string;
  source_id: string;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * `date.fromisoformat` restreint aux formes `YYYY-MM-DD` et `YYYYMMDD` avec contrôle
 * calendaire ; retourne l'année. Les formes semaine ISO (`YYYY-Www-D`) ne sont pas portées.
 */
function isoYear(text: unknown): number {
  if (typeof text !== 'string') throw new Error('TypeError');
  const m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(text);
  if (!m || (text.length !== 10 && text.length !== 8)) throw new Error('ValueError');
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const maxDay = month === 2 && leap ? 29 : DAYS_IN_MONTH[month - 1];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > (maxDay ?? 0)) throw new Error('ValueError');
  return year;
}

/** `int(text)` Python : blancs, signe, chiffres avec soulignés simples. */
function pyInt(text: string): number {
  const m = /^\s*([-+]?)(\d+(?:_\d+)*)\s*$/.exec(text);
  if (!m) throw new Error('ValueError');
  return Number(m[1] + m[2].replaceAll('_', ''));
}

function blank(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

export function eligibility(
  person: Person,
  eventYear: unknown,
  section: string | null = null,
  division: string | null = null,
  discipline: string | null = null,
  catalogue: Catalogue | null = null,
): Proposal[] {
  const cat = catalogue !== null ? catalogue : loadCatalogue();
  let age: number;
  try {
    const birthYear = isoYear('birth_date' in person ? person.birth_date : '');
    const year = pyInt(String(eventYear).slice(0, 4));
    age = year - birthYear;
  } catch {
    throw new DomainError('Date complète et année de compétition requises.');
  }
  if (age < 0) throw new DomainError('Naissance postérieure à la compétition.');
  const sec = section ? section : 'section' in person ? person.section : 'amateur';
  if (sec !== 'amateur' && sec !== 'pro') throw new DomainError('Section inconnue.');
  const proposals: Proposal[] = [];
  for (const rule of cat.rules) {
    if (
      rule.sex !== person.sex ||
      (division && rule.division !== division) ||
      (discipline && rule.discipline !== discipline)
    ) {
      continue;
    }
    const uncertain = age === 15 && ['bodybuilding', 'classic_bodybuilding', 'mens_physique'].includes(rule.discipline);
    if (
      rule.age_min !== null &&
      age < rule.age_min &&
      !(uncertain && rule.division === 'junior' && rule.age_min === 16)
    ) {
      continue;
    }
    if (rule.age_max !== null && age > rule.age_max) continue;
    const reasons: string[] = [];
    if (uncertain) reasons.push('Admissibilité à confirmer — contradiction IFBB à 15 ans.');
    if (rule.division === 'senior') {
      reasons.push('Conditions Senior et autorisation de crossover à contrôler ; aucune borne d’âge Senior inventée.');
    }
    const raw = person[rule.metric];
    const value = !blank(raw) ? measure(raw) : null;
    if (value !== null) {
      if (rule.lower_exclusive !== null && value.compare(ExactDecimal.of(rule.lower_exclusive)) <= 0) continue;
      if (rule.upper_inclusive !== null && value.compare(ExactDecimal.of(rule.upper_inclusive)) > 0) continue;
    } else {
      reasons.push('Mesure manquante.');
    }
    let limit: ExactDecimal | null = null;
    if (rule.classic_limit && !blank(person.height_cm)) {
      limit = weightLimit(rule.discipline, rule.division, person.height_cm, cat);
      if (blank(person.weight_kg)) {
        reasons.push('Poids manquant pour le plafond classique.');
      } else if (measure(person.weight_kg).compare(limit as ExactDecimal) > 0) {
        continue;
      }
    }
    if (!person.measurements_confirmed) reasons.push('Mesures à confirmer.');
    proposals.push({
      rule_id: rule.id,
      discipline: rule.discipline,
      name: rule.name,
      division: rule.division,
      section: sec,
      age,
      status: reasons.length ? 'confirmation_required' : 'eligible_measurements_age',
      reasons,
      weight_limit: limit !== null ? limit.toString() : null,
      catalogue_version: cat.version,
      source_id: rule.source_id,
    });
  }
  return proposals;
}
