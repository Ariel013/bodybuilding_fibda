/**
 * Commandes de préparation : mutations d'état contrôlées, sans persistance.
 *
 * Portage à l'identique de `backend/fibda/preparation.py` : mêmes contrôles dans le
 * même ordre, mêmes messages d'erreur, mêmes codes HTTP, mêmes mutations, même forme
 * de retour. Le serveur possède transaction, version et audit ; ici, seul un état
 * candidat réussi remplace `state` (copie profonde, remplacement en place).
 *
 * Le Python recevait `store` et `conn` sans jamais les utiliser (aucun accès SQL, aucune
 * lecture d'horloge : l'âge se calcule sur `state.date`, jamais sur la date du jour) ;
 * la signature TypeScript les omet donc.
 *
 * Conventions de portage :
 * - `truthy()` reproduit la vérité Python (`{}`, `[]`, `''`, `0`, `None` sont faux) là où
 *   le Python testait un objet ou une chaîne « nue » ;
 * - `has(obj, k)` reproduit `k in dict` / `dict.get(k, défaut)` : le défaut ne s'applique
 *   qu'à une clé absente, pas à une clé présente à `null` ;
 * - `PyValueError` / `PyKeyError` reproduisent les exceptions Python non métier (elles
 *   remontent en 500 côté serveur, comme en Python), sauf là où le Python les convertit
 *   explicitement en `Problem`.
 */
import { makeRound } from "./rounds";
import { ADMIN, PREPARATION, SPORT, require as requireRole } from "./auth";
import { Problem, DomainError as ServerDomainError } from "./problem";
import { deepcopy, uid } from "./util";
import { DomainError } from "../domain/domain";
import { loadCatalogue, eligibility, measure } from "../domain/catalogue";

type Actor = { id: string; roles: string[] };
type Dict = Record<string, any>;

// ---------------------------------------------------------------------------
// Helpers de sémantique Python
// ---------------------------------------------------------------------------

/** `ValueError` Python (date invalide, entier non convertible) : pas une erreur métier. */
export class PyValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PyValueError";
  }
}

/** `KeyError` Python (clé de payload obligatoire absente) : pas une erreur métier. */
export class PyKeyError extends Error {
  constructor(key: string) {
    super("KeyError: " + key);
    this.name = "PyKeyError";
  }
}

/** Vérité Python : `None`, `False`, `0`, `''`, `[]`, `{}` sont faux. */
function truthy(value: unknown): boolean {
  if (value === null || value === undefined || value === false || value === 0 || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return Boolean(value);
}

const isDict = (value: unknown): value is Dict => typeof value === "object" && value !== null && !Array.isArray(value);

/** `k in dict` Python. */
const has = (obj: Dict | null | undefined, key: string): boolean => isDict(obj) && Object.prototype.hasOwnProperty.call(obj, key);

/** `dict.get(k, défaut)` Python : défaut uniquement si la clé est absente. */
const get = (obj: Dict | null | undefined, key: string, fallback: any = null): any => (has(obj, key) ? obj![key] : fallback);

/** `dict[k]` Python : `KeyError` si la clé est absente. */
function req(obj: Dict, key: string): any {
  if (!has(obj, key)) throw new PyKeyError(key);
  return obj[key];
}

/** Égalité `==` Python entre valeurs JSON scalaires (None == None, pas d'identité d'objet). */
const same = (a: unknown, b: unknown): boolean => (a ?? null) === (b ?? null);

/** `str(value)` Python pour les valeurs JSON. */
function pyStr(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  return String(value);
}

/** `str.strip()` : erreur (non métier) si ce n'est pas une chaîne, comme l'AttributeError Python. */
function strip(value: unknown): string {
  if (typeof value !== "string") throw new TypeError("'" + typeof value + "' object has no attribute 'strip'");
  return value.trim();
}

/** `date.fromisoformat()` restreint à `AAAA-MM-JJ` (date calendaire valide) ; `PyValueError` sinon. */
function parseIsoDate(value: unknown): Date {
  if (typeof value !== "string") throw new TypeError("fromisoformat: argument must be str");
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) throw new PyValueError("Invalid isoformat string: " + value);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    throw new PyValueError("Invalid isoformat string: " + value);
  }
  return date;
}

/** `int(s[:4])` Python : quatre premiers caractères convertis en entier, `PyValueError` sinon. */
function year4(value: unknown): number {
  if (typeof value !== "string") throw new TypeError("string indices must be str");
  const head = value.slice(0, 4).trim();
  if (!/^[+-]?\d+$/.test(head)) throw new PyValueError("invalid literal for int(): " + head);
  return Number(head);
}

/** `str(measure(value))` : représentation textuelle exacte de la mesure, sans arithmétique flottante. */
const measureText = (value: unknown): string => String(measure(value as any));

/** `list(dict.fromkeys(items))` : dédoublonnage en conservant l'ordre. */
const dedupe = <T>(items: T[]): T[] => [...new Set(items)];

/** `min(a, b)` sur des entiers. */
const min = (a: number, b: number): number => (b < a ? b : a);

const isPyInt = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);

const isDomainError = (exc: unknown): boolean => exc instanceof DomainError || exc instanceof ServerDomainError;

// ---------------------------------------------------------------------------
// Portage fonction par fonction
// ---------------------------------------------------------------------------

export function getItem(state: Dict, collection: string, identifier: unknown): Dict {
  const item = (state[collection] as Dict[]).find((x) => x.id === identifier);
  if (item === undefined) throw new Problem("Élément introuvable : " + collection, 404);
  return item;
}

function beforeRound(state: Dict, categoryId: unknown): void {
  if ((state.rounds as Dict[]).some((r) => r.category_id === categoryId && (get(r, "status") !== "pending" || truthy(get(r, "ballots"))))) {
    throw new Problem("La catégorie a déjà commencé.");
  }
}

/**
 * Catégorie prise en compte par la compétition (PO, 26/09/2026) : ni archivée par une fusion,
 * ni désactivée. Les états antérieurs n'ont pas le champ `active` : absent = active.
 */
export function categoryActive(category: Dict): boolean {
  return !truthy(get(category, "archived")) && get(category, "active", true) !== false;
}

/** Désactivation : les manches encore en attente (sans bulletin) de la catégorie sont retirées. */
function deactivateCategory(state: Dict, category: Dict): void {
  beforeRound(state, category.id);
  state.rounds = (state.rounds as Dict[]).filter((r) => r.category_id !== category.id);
  category.active = false;
}

function country(value: unknown): boolean {
  return typeof value === "string" && /^[A-Z]{2}$/.test(value);
}

function admission(state: Dict, person: Dict, category: Dict): string[] {
  let catalogue = get(state, "status") !== "preparation" ? get(state, "rules_snapshot") : null;
  catalogue = truthy(catalogue) ? catalogue : loadCatalogue();
  const reasons: string[] = [];
  if (req(person, "sex") !== req(category, "sex") || req(person, "section") !== req(category, "section")) {
    reasons.push("Sexe ou section incompatible.");
  }
  if (truthy(get(category, "archived"))) reasons.push("Catégorie archivée.");
  else if (!categoryActive(category)) reasons.push("Catégorie désactivée.");
  for (const flag of ["status_approved", "licence_ok", "payment_ok", "measurements_confirmed"]) {
    if (!truthy(get(person, flag))) reasons.push("Contrôle requis : " + flag);
  }
  if (req(state, "mode") === "international") {
    for (const flag of ["delegation_approved", "organizer_approved"]) {
      if (!truthy(get(person, flag))) reasons.push("Contrôle requis : " + flag);
    }
  }
  const age = year4(req(state, "date")) - year4(req(person, "birth_date"));
  if (req(category, "division") === "senior") {
    const ageGroups = (catalogue.rules as Dict[]).filter((r) => r.discipline === category.discipline && r.division !== "senior");
    const inGroup = ageGroups.some((r) => (r.age_min === null || age >= r.age_min) && (r.age_max === null || age <= r.age_max));
    if (inGroup && !truthy(get(person, "crossover_approved"))) {
      reasons.push("Crossover Junior/Masters vers Senior à autoriser par le chef.");
    }
  }
  if (age < 18 && !truthy(get(person, "minor_authorization"))) reasons.push("Autorisation du représentant légal requise.");
  const proposals = eligibility(person, req(state, "date"), null, req(category, "division"), req(category, "discipline"), catalogue) as Dict[];
  const origins = new Set<string>(get(category, "source_rule_ids", [req(category, "rule_id")]));
  const matching = proposals.filter((p) => origins.has(p.rule_id));
  if (matching.length === 0) reasons.push("Âge ou mesures hors catégorie.");
  else if (matching.some((p) => (p.reasons as string[]).some((reason) => reason.includes("15 ans")))) {
    reasons.push("Confirmation IFBB à 15 ans requise ; une dérogation locale ne certifie pas l’admission internationale.");
  }
  return reasons;
}

/** Recontrôle les confirmations avant ouverture ; ne modifie aucun objet. */
export function validateConfirmedEntries(state: Dict): true {
  const invalid: string[] = [];
  for (const entry of state.entries as Dict[]) {
    if (!truthy(get(entry, "confirmed"))) continue;
    const person = getItem(state, "people", req(entry, "person_id"));
    const category = getItem(state, "categories", req(entry, "category_id"));
    // Une catégorie désactivée ne concourt pas : ses inscriptions ne sont pas recontrôlées.
    if (!truthy(get(category, "archived")) && !categoryActive(category)) continue;
    let reasons: string[];
    try {
      reasons = admission(state, person, category);
    } catch (exc) {
      if (isDomainError(exc) || exc instanceof PyValueError || exc instanceof PyKeyError || exc instanceof TypeError) {
        throw new Problem("Inscription confirmée invalide : " + req(entry, "id"));
      }
      throw exc;
    }
    const derogation = truthy(get(entry, "derogation")) ? get(entry, "derogation") : {};
    const covered = new Set<string>(
      isDict(derogation) && truthy(get(derogation, "signed_by")) && pyStr(get(derogation, "reason", "")).trim()
        ? get(derogation, "issues", [])
        : [],
    );
    const outstanding = reasons.filter((reason) => !covered.has(reason));
    if (get(person, "sex") !== get(category, "sex") || get(person, "section") !== get(category, "section") || truthy(get(category, "archived"))) {
      outstanding.push("Sexe, section ou catégorie incompatible.");
    }
    if (outstanding.length > 0) invalid.push(req(entry, "id") + " : " + outstanding.join(" "));
  }
  if (invalid.length > 0) throw new Problem("Inscriptions confirmées à recontrôler : " + invalid.join(" ; "));
  return true;
}

function upsert(state: Dict, collection: string, item: Dict): Dict {
  const items = state[collection] as Dict[];
  const old = items.findIndex((x) => x.id === item.id);
  if (old === -1) items.push(item);
  else items[old] = item;
  return item;
}

const PERSON_FIELDS = new Set([
  "id", "first_name", "last_name", "birth_date", "sex", "nationalities", "country", "club", "section",
  "status_approved", "delegation_approved", "organizer_approved", "licence_ok", "payment_ok", "minor_authorization",
  "height_cm", "weight_kg", "measurements_confirmed", "photo_consent", "private_contact", "pronunciation",
  "crossover_approved",
]);

function savePerson(state: Dict, actor: Actor, incoming: Dict): Dict {
  const previous: Dict = (state.people as Dict[]).find((p) => p.id === get(incoming, "id")) ?? {};
  const person: Dict = { ...previous };
  for (const [k, v] of Object.entries(incoming)) if (PERSON_FIELDS.has(k)) person[k] = v;
  person.id = [get(previous, "id"), get(incoming, "id")].find(truthy) ?? uid();
  if (truthy(get(person, "crossover_approved")) && !truthy(get(previous, "crossover_approved"))) requireRole(actor, ["chief"]);
  for (const key of ["first_name", "last_name"]) {
    if (typeof get(person, key) !== "string" || !person[key].trim()) throw new Problem("Prénom et nom obligatoires.");
    person[key] = person[key].trim();
  }
  try {
    const birth = parseIsoDate(get(person, "birth_date", ""));
    if (birth.getTime() > parseIsoDate(req(state, "date")).getTime()) throw new PyValueError("");
  } catch (exc) {
    if (exc instanceof PyValueError || exc instanceof TypeError) throw new Problem("Date de naissance complète valide requise.");
    throw exc;
  }
  if (!["M", "F"].includes(get(person, "sex")) || !["amateur", "pro"].includes(get(person, "section"))) {
    throw new Problem("Sexe et section obligatoires.");
  }
  const nationalities = get(person, "nationalities");
  if (!country(get(person, "country")) || !Array.isArray(nationalities) || nationalities.length === 0 || !nationalities.every(country)) {
    throw new Problem("Pays et nationalités : codes pays de deux lettres majuscules requis.");
  }
  person.nationalities = dedupe(nationalities);
  for (const key of ["height_cm", "weight_kg"]) {
    const value = get(person, key);
    if (value !== null && value !== undefined && value !== "") person[key] = measureText(value);
  }
  if (truthy(previous) && ["height_cm", "weight_kg"].some((k) => !same(get(person, k), get(previous, k)))) {
    person.measurements_confirmed = false;
  }
  for (const entry of state.entries as Dict[]) {
    if (req(entry, "person_id") === person.id) {
      beforeRound(state, req(entry, "category_id"));
      if (truthy(get(entry, "confirmed")) && admission(state, person, getItem(state, "categories", req(entry, "category_id"))).length > 0) {
        throw new Problem("Modification incompatible avec une inscription confirmée ; déconfirmer avant correction.");
      }
    }
  }
  return upsert(state, "people", person);
}

function saveEntry(state: Dict, actor: Actor, incoming: Dict, late = false): Dict {
  const person = getItem(state, "people", get(incoming, "person_id"));
  const category = getItem(state, "categories", get(incoming, "category_id"));
  beforeRound(state, category.id);
  if (truthy(get(category, "archived"))) throw new Problem("Catégorie archivée.");
  if (!categoryActive(category)) throw new Problem("Catégorie désactivée.");
  const old: Dict = (state.entries as Dict[]).find((e) => e.id === get(incoming, "id")) ?? {};
  if (truthy(old) && get(old, "bib") !== null && get(old, "bib") !== undefined && req(old, "category_id") !== category.id) {
    throw new Problem("Inscription figée après attribution du dossard.");
  }
  if (truthy(get(state, "bibs_distributed")) && !truthy(old) && !late) {
    throw new Problem("Utiliser l’inscription tardive après attribution des dossards.");
  }
  const others = (state.entries as Dict[]).filter((e) => req(e, "person_id") === person.id && e.id !== get(old, "id"));
  if (others.some((e) => req(e, "category_id") === category.id)) throw new Problem("Personne déjà inscrite dans cette catégorie.");
  // Multi-inscription (PO, 26/09/2026) : un athlète peut concourir dans plusieurs catégories actives,
  // sans validation du chef ; restent interdits le doublon de catégorie et le cumul amateur/pro.
  const reasons = truthy(get(incoming, "confirmed", false)) ? admission(state, person, category) : [];
  let derogation: any = get(incoming, "derogation");
  if (truthy(derogation)) {
    requireRole(actor, ["chief"]);
    const reason = isDict(derogation) ? get(derogation, "reason", "") : pyStr(derogation);
    if (!strip(reason)) throw new Problem("Motif de dérogation obligatoire.");
    derogation = { reason: strip(reason), signed_by: actor.id, issues: reasons };
  }
  if (reasons.length > 0 && !truthy(derogation)) throw new Problem("Inscription à contrôler : " + reasons.join(" "));
  if (truthy(get(incoming, "confirmed")) && req(person, "sex") !== req(category, "sex")) {
    throw new Problem("Le sexe de la catégorie doit correspondre.");
  }
  if (req(person, "section") !== req(category, "section")) throw new Problem("Le cumul amateur/pro est interdit.");
  const entry: Dict = {
    id: [get(old, "id"), get(incoming, "id")].find(truthy) ?? uid(),
    person_id: person.id,
    category_id: category.id,
    bib: get(old, "bib"),
    confirmed: truthy(get(incoming, "confirmed", false)),
    derogation: derogation ?? null,
    origin_category_id: get(old, "origin_category_id", category.id),
  };
  if (truthy(old) && req(old, "category_id") !== category.id) {
    beforeRound(state, old.category_id);
    const origin = getItem(state, "categories", old.category_id);
    origin.entry_ids = (get(origin, "entry_ids", []) as string[]).filter((eid) => eid !== entry.id);
  }
  upsert(state, "entries", entry);
  if (!has(category, "entry_ids")) category.entry_ids = [];
  if (!(category.entry_ids as string[]).includes(entry.id)) category.entry_ids.push(entry.id);
  return entry;
}


/** Garde les IDs existants et insère les phases devenues nécessaires. */
function refreshPendingCategory(state: Dict, category: Dict): void {
  const rounds = (state.rounds as Dict[]).filter((r) => r.category_id === category.id);
  if (rounds.length === 0) return;
  if (rounds.some((r) => req(r, "status") !== "pending" || truthy(get(r, "ballots")))) {
    throw new Problem("Le programme de la catégorie est déjà engagé.");
  }
  const participants = (state.entries as Dict[]).filter((e) => e.category_id === category.id && truthy(get(e, "confirmed"))).map((e) => e.id as string);
  const count = participants.length;
  const first: string = truthy(get(category, "phase_override"))
    ? get(category, "phase_override")
    : count <= 6 ? "final" : count <= 15 ? "semi" : "elimination";
  const phases = ["elimination", "semi", "final"];
  if (!phases.includes(first)) throw new Problem("Phase de départ inconnue.");
  const byPhase = new Map<string, Dict>();
  for (const r of rounds) byPhase.set(req(r, "phase"), r);
  let previous: string | null = null;
  for (const phase of phases.slice(phases.indexOf(first))) {
    let r = byPhase.get(phase);
    let quota: number | null =
      phase === "elimination" ? min(get(category, "elimination_quota", 15), count)
      : phase === "semi" ? min(get(category, "quota", 6), count)
      : null;
    if (r === undefined) {
      r = makeRound(state, category, phase, [], quota) as Dict;
      (state.rounds as Dict[]).push(r);
    } else if (get(r, "quota") !== null && get(r, "quota") !== undefined) {
      quota = min(r.quota, count);
    }
    Object.assign(r as Dict, { participant_ids: previous === null ? [...participants] : [], dependency_id: previous, quota });
    (r as Dict).version = get(r as Dict, "version", 1) + 1;
    previous = r.id;
  }
}

/**
 * Point d'entrée : le serveur possède transaction/version/audit ; retourne l'objet créé/modifié.
 * `state` est remplacé en place par l'état candidat uniquement en cas de succès.
 */
export function applyPreparation(state: Dict, actor: Actor, kind: string, payload: Dict): any {
  requireRole(actor, PREPARATION);
  if (get(state, "status") === "finished") throw new Problem("Événement terminé.");
  try {
    const candidate = deepcopy(state);
    const result = apply(candidate, actor, kind, payload);
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, candidate);
    return result;
  } catch (exc) {
    if (isDomainError(exc)) throw new Problem((exc as Error).message);
    throw exc;
  }
}

function apply(state: Dict, actor: Actor, kind: string, payload: Dict): any {
  if (kind === "event.update") {
    requireRole(actor, ADMIN);
    const changed = (keys: string[]) => keys.some((k) => has(payload, k) && !same(payload[k], req(state, k)));
    if (get(state, "status") !== "preparation" && changed(["mode", "date"])) throw new Problem("Date et mode figés après démarrage.");
    if (has(payload, "date")) {
      try {
        parseIsoDate(payload.date);
      } catch (exc) {
        if (exc instanceof PyValueError || exc instanceof TypeError) throw new Problem("Date invalide.");
        throw exc;
      }
    }
    if (has(payload, "mode") && !["national", "international"].includes(payload.mode)) throw new Problem("Mode inconnu.");
    const admissionChanged = changed(["date", "mode"]);
    for (const key of ["name", "date", "location", "mode"]) if (has(payload, key)) state[key] = payload[key];
    if (has(payload, "settings")) {
      requireRole(actor, SPORT);
      const settings: Dict = payload.settings;
      if (get(state, "status") !== "preparation" && has(settings, "collective_tiebreak") && !same(settings.collective_tiebreak, get(state.settings, "collective_tiebreak"))) {
        throw new Problem("Le critère collectif est figé dès le démarrage.");
      }
      const allowed = new Set(["collective_tiebreak", "regulations_checked", "network_checked", "backup_checked", "backup_directory"]);
      if (has(settings, "backup_directory") && typeof settings.backup_directory !== "string") throw new Problem("Chemin de sauvegarde invalide.");
      for (const [k, v] of Object.entries(settings)) if (allowed.has(k)) state.settings[k] = v;
    }
    if (admissionChanged) validateConfirmedEntries(state);
    return { updated: true };
  }
  if (kind === "person.save") return savePerson(state, actor, req(payload, "person"));
  if (kind === "measurement.save") {
    const person = getItem(state, "people", req(payload, "person_id"));
    for (const e of state.entries as Dict[]) if (req(e, "person_id") === person.id) beforeRound(state, req(e, "category_id"));
    const candidate: Dict = {
      ...person,
      height_cm: measureText(req(payload, "height_cm")),
      weight_kg: measureText(req(payload, "weight_kg")),
      measurements_confirmed: true,
    };
    for (const e of state.entries as Dict[]) {
      if (req(e, "person_id") === person.id && truthy(get(e, "confirmed")) && admission(state, candidate, getItem(state, "categories", req(e, "category_id"))).length > 0) {
        throw new Problem("Mesures incompatibles avec une inscription confirmée.");
      }
    }
    Object.assign(person, candidate);
    return person;
  }
  if (kind === "entry.save") return saveEntry(state, actor, req(payload, "entry"));
  if (kind === "category.save") {
    requireRole(actor, SPORT);
    if (truthy(get(state, "bibs_distributed"))) throw new Problem("Catégories figées après attribution des dossards.");
    const incoming: Dict = req(payload, "category");
    const rules = new Map<string, Dict>();
    for (const r of loadCatalogue().rules as Dict[]) rules.set(r.id, r);
    const rule = rules.get(get(incoming, "rule_id"));
    if (rule === undefined) throw new Problem("Règle de catégorie inconnue.");
    const old: Dict = (state.categories as Dict[]).find((c) => c.id === get(incoming, "id")) ?? {};
    if (truthy(old)) {
      beforeRound(state, old.id);
      if (truthy(get(old, "entry_ids")) && (req(old, "rule_id") !== rule.id || get(incoming, "section", req(old, "section")) !== req(old, "section"))) {
        throw new Problem("Une catégorie inscrite ne peut changer de règle ou section.");
      }
    }
    const section = get(incoming, "section", "amateur");
    if (!["amateur", "pro"].includes(section)) throw new Problem("Section invalide.");
    const active = get(incoming, "active", get(old, "active", true));
    if (typeof active !== "boolean") throw new Problem("Indicateur d’activation invalide.");
    const category: Dict = {
      ...old,
      id: [get(old, "id"), get(incoming, "id")].find(truthy) ?? uid(),
      name: truthy(get(incoming, "name")) ? incoming.name : rule.name,
      discipline: rule.discipline,
      sex: rule.sex,
      section,
      division: rule.division,
      age_min: rule.age_min,
      age_max: rule.age_max,
      rule_id: rule.id,
      order: get(old, "order", (state.categories as Dict[]).length),
      entry_ids: get(old, "entry_ids", []),
      quota: get(incoming, "quota", get(old, "quota", 6)),
      elimination_quota: get(incoming, "elimination_quota", get(old, "elimination_quota", 15)),
      phase_override: get(incoming, "phase_override", get(old, "phase_override")),
      merged_from: get(old, "merged_from", []),
      archived: false,
      active,
    };
    if (["quota", "elimination_quota"].some((k) => !isPyInt(category[k]) || category[k] < 1)) throw new Problem("Quotas entiers positifs requis.");
    const saved = upsert(state, "categories", category);
    if (!active) deactivateCategory(state, saved);
    return saved;
  }
  if (kind === "category.activate") {
    // Catégories modulables (PO, 26/09/2026) : seules les catégories actives reçoivent des athlètes et
    // donnent lieu à des manches. Autorisé après les dossards et pendant la compétition tant que la
    // catégorie n'a pas commencé ; désactiver retire ses manches en attente, réactiver n'en recrée pas.
    requireRole(actor, SPORT);
    const category = getItem(state, "categories", req(payload, "category_id"));
    const active = req(payload, "active");
    if (typeof active !== "boolean") throw new Problem("Indicateur d’activation invalide.");
    if (truthy(get(category, "archived"))) throw new Problem("Catégorie archivée.");
    beforeRound(state, category.id);
    if (active) category.active = true;
    else deactivateCategory(state, category);
    return category;
  }
  if (kind === "programme.reorder") {
    requireRole(actor, SPORT);
    const ids: string[] = req(payload, "category_ids");
    const active = (state.categories as Dict[]).filter((c) => !truthy(get(c, "archived")));
    const activeIds = new Set(active.map((c) => c.id as string));
    const idSet = new Set(ids);
    if (ids.length !== idSet.size || idSet.size !== activeIds.size || ![...idSet].every((i) => activeIds.has(i))) {
      throw new Problem("Liste exacte des catégories actives requise.");
    }
    const before = [...active].sort((a, b) => req(a, "order") - req(b, "order")).map((c) => c.id as string);
    const engaged = new Set<string>(
      (state.rounds as Dict[])
        .filter((r) => get(r, "status") !== "pending" || (get(r, "opened_at") !== null && get(r, "opened_at") !== undefined) || truthy(get(r, "ballots")))
        .map((r) => r.category_id),
    );
    if (ids.some((identifier, i) => engaged.has(identifier) && before.indexOf(identifier) !== i)) {
      throw new Problem("La position des catégories engagées ne peut être déplacée, même indirectement.");
    }
    ids.forEach((identifier, i) => { getItem(state, "categories", identifier).order = i; });
    return { category_ids: ids };
  }
  if (kind === "category.fuse") {
    requireRole(actor, SPORT); // chef ou responsable, comme category.save (aligné le 24/09/2026)
    if (truthy(get(state, "bibs_distributed"))) throw new Problem("Fusion interdite après attribution des dossards.");
    const ids: string[] = req(payload, "category_ids");
    if (ids.length < 2 || new Set(ids).size !== ids.length) throw new Problem("Au moins deux catégories distinctes requises.");
    const cats = ids.map((i) => getItem(state, "categories", i));
    const keys = ["discipline", "sex", "section", "division", "age_min", "age_max"];
    if (cats.some((c) => truthy(get(c, "archived")) || keys.some((k) => !same(get(c, k), get(cats[0], k))))) {
      throw new Problem("Fusion incompatible : discipline, sexe, section et groupe d’âge doivent correspondre.");
    }
    for (const c of cats) beforeRound(state, c.id);
    const entries = (state.entries as Dict[]).filter((e) => ids.includes(e.category_id));
    if (new Set(entries.map((e) => e.person_id)).size !== entries.length) throw new Problem("Fusion refusée : une personne figurerait deux fois.");
    const merged: Dict = {
      ...deepcopy(cats[0]),
      id: uid(),
      name: truthy(get(payload, "name")) ? payload.name : cats.map((c) => req(c, "name")).join(" / "),
      entry_ids: entries.map((e) => e.id),
      merged_from: ids,
      source_rule_ids: dedupe(cats.flatMap((c) => get(c, "source_rule_ids", [req(c, "rule_id")]) as string[])),
    };
    for (const c of cats) { c.archived = true; c.entry_ids = []; }
    for (const e of entries) e.category_id = merged.id;
    state.rounds = (state.rounds as Dict[]).filter((r) => !ids.includes(r.category_id));
    (state.categories as Dict[]).push(merged);
    return merged;
  }
  if (kind === "bibs.assign") {
    requireRole(actor, SPORT);
    if (truthy(get(state, "bibs_distributed"))) throw new Problem("Dossards déjà attribués.");
    let number = 0;
    const categories = [...(state.categories as Dict[])].sort((a, b) => get(a, "order", 0) - get(b, "order", 0));
    for (const category of categories) {
      if (!categoryActive(category)) continue;
      for (const entry of state.entries as Dict[]) {
        if (req(entry, "category_id") !== category.id || !truthy(get(entry, "confirmed"))) continue;
        number += 1;
        entry.bib = number;
      }
    }
    if (number === 0) throw new Problem("Aucune inscription confirmée : attribution des dossards impossible.");
    state.bibs_distributed = true;
    return { count: number };
  }
  if (kind === "entry.late") {
    requireRole(actor, SPORT);
    if (!pyStr(get(payload, "reason", "")).trim()) throw new Problem("Motif d’inscription tardive obligatoire.");
    const category = getItem(state, "categories", req(payload, "category_id"));
    beforeRound(state, category.id);
    const person = savePerson(state, actor, req(payload, "person"));
    const entry = saveEntry(state, actor, { person_id: person.id, category_id: category.id, confirmed: true, derogation: get(payload, "derogation") }, true);
    entry.bib = Math.max(0, ...(state.entries as Dict[]).map((e) => (truthy(get(e, "bib")) ? (e.bib as number) : 0))) + 1;
    entry.late_reason = strip(req(payload, "reason"));
    refreshPendingCategory(state, category);
    return entry;
  }
  if (kind === "official.save") {
    const incoming: Dict = req(payload, "official");
    const old: Dict = (state.officials as Dict[]).find((o) => o.id === get(incoming, "id")) ?? {};
    const allowed = new Set(["first_name", "last_name", "post", "organization", "country", "pedigree", "photo_consent"]);
    const official: Dict = { ...old };
    for (const [k, v] of Object.entries(incoming)) if (allowed.has(k)) official[k] = v;
    official.id = [get(old, "id"), get(incoming, "id")].find(truthy) ?? uid();
    if (!["first_name", "last_name", "post"].every((k) => pyStr(get(official, k, "")).trim())) throw new Problem("Identité et poste obligatoires.");
    if (truthy(get(official, "country")) && !country(official.country)) throw new Problem("Code pays invalide.");
    return upsert(state, "officials", official);
  }
  if (kind === "entry.remove") {
    // Retrait d'une inscription (PO, 26/09/2026) : l'athlète quitte une catégorie, sa fiche reste. Rôles de
    // préparation, refusé dès que la catégorie a commencé ; l'inscription disparaît de la catégorie et des
    // manches encore en attente. Un dossard libéré n'est pas réattribué.
    requireRole(actor, PREPARATION);
    const entry = getItem(state, "entries", get(payload, "entry_id"));
    beforeRound(state, req(entry, "category_id"));
    for (const c of state.categories as Dict[]) if (Array.isArray(c.entry_ids)) c.entry_ids = (c.entry_ids as string[]).filter((id) => id !== entry.id);
    for (const r of state.rounds as Dict[]) if (Array.isArray(r.participant_ids)) r.participant_ids = (r.participant_ids as string[]).filter((id) => id !== entry.id);
    state.entries = (state.entries as Dict[]).filter((e) => e.id !== entry.id);
    return { entry_id: entry.id, person_id: req(entry, "person_id"), category_id: req(entry, "category_id") };
  }
  if (kind === "person.delete") {
    // Suppression d'athlètes (PO, 26/09/2026) : un ou plusieurs à la fois, direction seulement. Refusée dès
    // qu'une catégorie de la personne a commencé (même garde que la modification d'une fiche). Les
    // inscriptions disparaissent des catégories et des manches encore en attente ; les photos sont
    // retirées de la base par le dispatch (commands.ts), qui a accès à la connexion.
    requireRole(actor, ADMIN);
    const ids: unknown = get(payload, "person_ids");
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === "string")) throw new Problem("Liste d’athlètes requise.");
    const people = dedupe(ids as string[]).map((id) => getItem(state, "people", id));
    const personIds = new Set(people.map((p) => p.id as string));
    const entries = (state.entries as Dict[]).filter((e) => personIds.has(req(e, "person_id")));
    for (const e of entries) beforeRound(state, req(e, "category_id"));
    const entryIds = new Set(entries.map((e) => e.id as string));
    for (const c of state.categories as Dict[]) if (Array.isArray(c.entry_ids)) c.entry_ids = (c.entry_ids as string[]).filter((id) => !entryIds.has(id));
    for (const r of state.rounds as Dict[]) if (Array.isArray(r.participant_ids)) r.participant_ids = (r.participant_ids as string[]).filter((id) => !entryIds.has(id));
    state.entries = (state.entries as Dict[]).filter((e) => !entryIds.has(e.id));
    state.people = (state.people as Dict[]).filter((p) => !personIds.has(p.id));
    return { supprimes: people.length, person_ids: [...personIds], inscriptions_retirees: entries.length };
  }
  throw new Problem("Commande de préparation inconnue.");
}
