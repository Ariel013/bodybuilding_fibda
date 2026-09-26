// Portage test par test de `backend/tests/test_preparation.py` (oracle) : mêmes données, mêmes attendus.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { newState } from "./state";
import { applyPreparation, validateConfirmedEntries } from "./preparation";
import { Problem } from "./problem";
import { loadCatalogue } from "../domain/catalogue";
import { deepcopy } from "./util";

type Actor = { id: string; roles: string[] };

let state: any;
const chief: Actor = { id: "chief", roles: ["chief"] };
const sec: Actor = { id: "secretary", roles: ["secretariat"] };
const responsable: Actor = { id: "r", roles: ["responsable"] };

beforeEach(() => {
  state = newState();
  state.date = "2026-09-22";
});

const run = (kind: string, payload: any, actor?: Actor) => applyPreparation(state, actor ?? chief, kind, payload);

function category(upper = "70") {
  const rule = loadCatalogue().rules.find((r) => r.discipline === "bodybuilding" && r.division === "senior" && r.upper_inclusive === upper)!;
  return run("category.save", { category: { rule_id: rule.id, section: "amateur" } });
}

function person(id = "p", weight = "69") {
  return run("person.save", {
    person: {
      id, first_name: "Jean", last_name: "Test", birth_date: "1990-01-01", sex: "M", section: "amateur",
      country: "FR", nationalities: ["FR"], height_cm: "170", weight_kg: weight, measurements_confirmed: true,
      status_approved: true, licence_ok: true, payment_ok: true,
    },
  });
}

const entry = (p: any, c: any, actor?: Actor) => run("entry.save", { entry: { person_id: p.id, category_id: c.id, confirmed: true } }, actor);

// `with self.assertRaises(Problem)`
const rejects = (fn: () => unknown) => assert.throws(fn, Problem);

test("national_hc_and_bibs_per_entry_in_programme_order", () => {
  const a = category(); const b = category(); const p = person();
  entry(p, a); entry(p, b);
  run("programme.reorder", { category_ids: [b.id, a.id] });
  run("bibs.assign", {});
  assert.deepEqual(state.entries.map((e: any) => e.bib), [2, 1]);
});

test("multi-inscription : plusieurs catégories actives par le secrétariat, jamais deux fois la même, brouillons admis", () => {
  // PO, 26/09/2026 : le cumul n'exige plus le chef (règle antérieure « cumulation_chief_and_drafts »).
  const a = category(); const b = category(); let p = person();
  entry(p, a, sec);
  const second = entry(p, b, sec);
  assert.equal(second.category_id, b.id);
  assert.deepEqual(state.entries.filter((e: any) => e.person_id === p.id).map((e: any) => e.category_id), [a.id, b.id]);
  rejects(() => entry(p, a, sec)); // doublon de catégorie
  rejects(() => entry(p, b, sec));
  assert.equal(state.entries.length, 2);
  p = person("q", "80");
  const draft = run("entry.save", { entry: { person_id: p.id, category_id: a.id, confirmed: false } }, sec);
  assert.equal(draft.confirmed, false);
  const draft2 = run("entry.save", { entry: { person_id: p.id, category_id: b.id, confirmed: false } }, sec);
  assert.equal(draft2.confirmed, false);
  // Le résultat de person.save reste la personne, sans inscription.
  const saved = person("z", "69");
  assert.equal(saved.id, "z");
  assert.equal("category_id" in saved, false);
});

test("multi-inscription : cumul amateur/pro interdit, sexe cohérent", () => {
  const a = category(); const p = person(); entry(p, a, sec);
  const proRule = loadCatalogue().rules.find((r) => r.discipline === "bodybuilding" && r.division === "senior" && r.upper_inclusive === "70")!;
  const pro = run("category.save", { category: { rule_id: proRule.id, section: "pro" } });
  rejects(() => run("entry.save", { entry: { person_id: p.id, category_id: pro.id, confirmed: false } }, sec));
  const womenRule = loadCatalogue().rules.find((r) => r.sex === "F")!;
  const women = run("category.save", { category: { rule_id: womenRule.id, section: "amateur" } });
  rejects(() => entry(p, women, sec));
  assert.equal(state.entries.length, 1);
});

test("catégorie : active par défaut, category.save accepte active, anciens états sans le champ = actifs", () => {
  const a = category();
  assert.equal(a.active, true);
  const b = run("category.save", { category: { rule_id: a.rule_id, section: "amateur", active: false } });
  assert.equal(b.active, false);
  rejects(() => run("category.save", { category: { rule_id: a.rule_id, section: "amateur", active: "oui" } }));
  delete state.categories[0].active;
  const p = person(); entry(p, state.categories[0], sec);
  assert.equal(state.entries.length, 1);
  const again = run("category.save", { category: { ...state.categories[0], name: "Renommée" } });
  assert.equal(again.active, true);
});

test("category.activate : rôle SPORT, autorisé après dossards, refusé si la catégorie a commencé ou est archivée", () => {
  const a = category(); const b = category("75"); entry(person(), a); entry(person("q", "74"), b);
  rejects(() => run("category.activate", { category_id: a.id, active: false }, sec));
  rejects(() => run("category.activate", { category_id: a.id, active: "non" }));
  run("bibs.assign", {});
  rejects(() => run("category.save", { category: { ...a, active: false } })); // figé après dossards
  const off = run("category.activate", { category_id: a.id, active: false }, responsable);
  assert.equal(off.active, false);
  assert.equal(state.entries.filter((e: any) => e.category_id === a.id).length, 1); // inscriptions conservées
  state.status = "running";
  assert.equal(run("category.activate", { category_id: a.id, active: true }).active, true);
  state.rounds = [{ id: "r", category_id: a.id, status: "open", ballots: {} }];
  rejects(() => run("category.activate", { category_id: a.id, active: false }));
  state.rounds = [{ id: "r", category_id: a.id, status: "pending", ballots: { j: {} } }];
  rejects(() => run("category.activate", { category_id: a.id, active: false }));
  state.rounds = []; state.status = "preparation"; state.bibs_distributed = false;
  const merged = run("category.fuse", { category_ids: [a.id, b.id] });
  rejects(() => run("category.activate", { category_id: a.id, active: true }));
  assert.equal(run("category.activate", { category_id: merged.id, active: false }).active, false);
});

test("category.activate : désactiver retire les manches en attente sans bulletin, réactiver n'en recrée pas", () => {
  const a = category(); const b = category("75"); entry(person(), a); entry(person("q", "74"), b);
  state.rounds = [
    { id: "ra", category_id: a.id, status: "pending", ballots: {} },
    { id: "rb", category_id: b.id, status: "pending", ballots: {} },
  ];
  run("category.activate", { category_id: a.id, active: false });
  assert.deepEqual(state.rounds.map((r: any) => r.id), ["rb"]);
  run("category.activate", { category_id: a.id, active: true });
  assert.deepEqual(state.rounds.map((r: any) => r.id), ["rb"]);
});

test("catégorie désactivée : entry.save et entry.late refusés, contrôle avant démarrage et dossards l'ignorent", () => {
  const a = category(); const b = category("75");
  const p = person(); const q = person("q", "74");
  entry(p, a); entry(q, b);
  run("category.activate", { category_id: b.id, active: false });
  assert.throws(() => run("entry.save", { entry: { person_id: p.id, category_id: b.id, confirmed: false } }), /Catégorie désactivée\./);
  assert.throws(() => run("entry.late", { person: { ...q, id: "z" }, category_id: b.id, reason: "Retard" }), /Catégorie désactivée\./);
  // Inscription confirmée devenue invalide dans la catégorie désactivée : ignorée par le contrôle.
  state.people[1].payment_ok = false;
  assert.equal(validateConfirmedEntries(state), true);
  run("category.activate", { category_id: b.id, active: true });
  rejects(() => validateConfirmedEntries(state));
  run("category.activate", { category_id: b.id, active: false });
  const bibs = run("bibs.assign", {});
  assert.equal(bibs.count, 1);
  assert.deepEqual(state.entries.map((e: any) => [e.category_id, e.bib]), [[a.id, 1], [b.id, null]]);
});

test("derogation_and_atomic_failure", () => {
  const a = category(); const p = person("p", "80"); const before = deepcopy(state);
  rejects(() => entry(p, a));
  assert.deepEqual(state, before);
  const result = run("entry.save", { entry: { person_id: p.id, category_id: a.id, confirmed: true, derogation: { reason: "Décision sportive documentée" } } });
  assert.equal(result.derogation.signed_by, "chief");
});

test("fusion_and_age_mismatch", () => {
  const a = category(); const b = category("75"); const p = person(); const q = person("q", "74");
  entry(p, a); entry(q, b);
  const merged = run("category.fuse", { category_ids: [a.id, b.id], name: "Fusion" });
  assert.equal(merged.entry_ids.length, 2);
  assert.deepEqual(new Set(state.entries.map((e: any) => e.category_id)), new Set([merged.id]));
  assert.ok(state.categories.slice(0, 2).every((c: any) => c.archived));
});

test("late_max_plus_one_and_started_block", () => {
  const a = category(); entry(person(), a); run("bibs.assign", {});
  const q = person("q");
  const late = run("entry.late", { person: q, category_id: a.id, reason: "Transport retardé" }, responsable);
  assert.equal(late.bib, 2);
  state.rounds = [{ id: "r", category_id: a.id, status: "open", ballots: {} }];
  rejects(() => run("entry.late", { person: { ...q, id: "z" }, category_id: a.id, reason: "Retard" }));
});

test("sex_section_and_international_flags", () => {
  const a = category(); const p = person(); state.mode = "international";
  rejects(() => entry(p, a));
  state.mode = "national"; state.people[0].section = "pro";
  rejects(() => entry(p, a));
});

test("collective_criterion_frozen_after_start", () => {
  state.settings.collective_tiebreak = "Critère publié"; state.status = "running";
  const before = deepcopy(state);
  rejects(() => run("event.update", { name: "Autre", settings: { collective_tiebreak: "Nouveau critère" } }));
  assert.deepEqual(state, before);
  run("event.update", { settings: { collective_tiebreak: "Critère publié" } });
});

test("reorder_preserves_engaged_positions_including_indirect_shifts", () => {
  const cats = [category(), category(), category(), category()];
  const ids = cats.map((c) => c.id);
  state.rounds = [{ id: "started", category_id: ids[1], status: "validated", opened_at: 10, ballots: {} }];
  const before = deepcopy(state);
  rejects(() => run("programme.reorder", { category_ids: [ids[2], ids[0], ids[1], ids[3]] }));
  assert.deepEqual(state, before);
  run("programme.reorder", { category_ids: [ids[0], ids[1], ids[3], ids[2]] });
  assert.equal(state.categories.find((c: any) => c.id === ids[1]).order, 1);
});

test("bibs_refuse_zero_confirmations_and_leave_state_intact", () => {
  const before = deepcopy(state);
  rejects(() => run("bibs.assign", {}));
  assert.deepEqual(state, before);
});

test("mode_change_rechecks_confirmed_entries", () => {
  const cat = category(); entry(person(), cat);
  const before = deepcopy(state);
  rejects(() => run("event.update", { mode: "international" }));
  assert.deepEqual(state, before);
  Object.assign(state.people[0], { delegation_approved: true, organizer_approved: true });
  run("event.update", { mode: "international" });
  assert.equal(state.mode, "international");
});

test("date_change_rechecks_junior_age", () => {
  const rule = loadCatalogue().rules.find((r) => r.discipline === "bodybuilding" && r.division === "junior" && r.age_min === 21 && r.upper_inclusive === "75")!;
  const cat = run("category.save", { category: { rule_id: rule.id, section: "amateur" } });
  person(); state.people[0].birth_date = "2003-12-31";
  entry(state.people[0], cat);
  const before = deepcopy(state);
  rejects(() => run("event.update", { date: "2027-01-01" }));
  assert.deepEqual(state, before);
});

test("start_helper_honours_only_signed_existing_derogation_issues", () => {
  const cat = category(); const p = person("p", "80");
  run("entry.save", { entry: { person_id: p.id, category_id: cat.id, confirmed: true, derogation: { reason: "Décision sportive documentée" } } });
  assert.equal(validateConfirmedEntries(state), true);
  state.people[0].payment_ok = false;
  rejects(() => validateConfirmedEntries(state));
});

test("person.delete : plusieurs athlètes, inscriptions et dossards retirés, direction seulement, refusé après le début", () => {
  const cat = category();
  const a = person("a", "69"); const b = person("b", "68"); person("c", "67");
  entry(a, cat); entry(b, cat);
  state.rounds = [{ id: "r", category_id: cat.id, status: "pending", participant_ids: state.entries.map((e: any) => e.id) }];
  rejects(() => run("person.delete", { person_ids: ["a"] }, sec));
  rejects(() => run("person.delete", { person_ids: ["a"] }, responsable));
  rejects(() => run("person.delete", { person_ids: [] }));
  rejects(() => run("person.delete", { person_ids: ["inconnu"] }));
  const r = run("person.delete", { person_ids: ["a", "b", "a"] });
  assert.deepEqual(r, { supprimes: 2, person_ids: ["a", "b"], inscriptions_retirees: 2 });
  assert.deepEqual(state.people.map((p: any) => p.id), ["c"]);
  assert.deepEqual(state.entries, []);
  assert.deepEqual(state.categories[0].entry_ids, []);
  assert.deepEqual(state.rounds[0].participant_ids, []);
  // Une catégorie engagée protège ses athlètes ; une fiche sans inscription reste supprimable.
  const d = person("d", "66"); entry(d, cat);
  state.rounds = [{ id: "r2", category_id: cat.id, status: "open", ballots: {} }];
  rejects(() => run("person.delete", { person_ids: ["d"] }));
  run("person.delete", { person_ids: ["c"] });
  assert.deepEqual(state.people.map((p: any) => p.id), ["d"]);
});

test("entry.remove : l'athlète quitte la catégorie, sa fiche reste ; refusé après le début", () => {
  const cat = category();
  const a = person("a", "69"); const b = person("b", "68");
  const ea = entry(a, cat); entry(b, cat);
  state.rounds = [{ id: "r", category_id: cat.id, status: "pending", participant_ids: state.entries.map((e: any) => e.id) }];
  rejects(() => run("entry.remove", { entry_id: "inconnu" }));
  const r = run("entry.remove", { entry_id: ea.id }, sec);
  assert.deepEqual(r, { entry_id: ea.id, person_id: "a", category_id: cat.id });
  assert.deepEqual(state.people.map((p: any) => p.id), ["a", "b"]);
  assert.deepEqual(state.entries.map((e: any) => e.person_id), ["b"]);
  assert.equal(state.categories[0].entry_ids.length, 1);
  assert.equal(state.rounds[0].participant_ids.length, 1);
  state.rounds = [{ id: "r2", category_id: cat.id, status: "open", ballots: {} }];
  rejects(() => run("entry.remove", { entry_id: state.entries[0].id }));
});

test("category.delete : chef seulement, inscriptions et manches en attente retirées, fiches conservées, refusé après le début", () => {
  const cat = category(); const other = category("75");
  const a = person("a", "69"); entry(a, cat);
  state.rounds = [{ id: "r", category_id: cat.id, status: "pending", participant_ids: [] }, { id: "r2", category_id: other.id, status: "pending" }];
  rejects(() => run("category.delete", { category_id: cat.id }, responsable));
  rejects(() => run("category.delete", { category_id: "inconnue" }));
  assert.deepEqual(run("category.delete", { category_id: cat.id }), { category_id: cat.id, inscriptions_retirees: 1 });
  assert.deepEqual(state.categories.map((c: any) => c.id), [other.id]);
  assert.deepEqual(state.entries, []);
  assert.deepEqual(state.rounds.map((r: any) => r.id), ["r2"]);
  assert.equal(state.people.length, 1);
  state.rounds = [{ id: "r3", category_id: other.id, status: "open", ballots: {} }];
  rejects(() => run("category.delete", { category_id: other.id }));
});

test("règle personnalisée : catégorie hors référentiel, admission contrôlée sur ses bornes, classe ouverte, validations", () => {
  // Men's Physique 176–182 cm (ordre de passage FIBDA du 26/09), absent du référentiel IFBB.
  const cat = run("category.save", { category: { section: "amateur", custom: { discipline: "mens_physique", division: "senior", metric: "height_cm", lower_exclusive: "176", upper_inclusive: "182", name: "Men's Physique 176–182 cm" } } });
  assert.match(cat.rule_id, /^custom-/);
  assert.equal(cat.rule.custom, true);
  assert.deepEqual([cat.discipline, cat.sex, cat.name], ["mens_physique", "M", "Men's Physique 176–182 cm"]);
  const dedans = run("person.save", { person: { id: "d", first_name: "A", last_name: "B", birth_date: "1995-01-01", sex: "M", section: "amateur", country: "CI", nationalities: ["CI"], height_cm: "180", weight_kg: "80", measurements_confirmed: true, status_approved: true, licence_ok: true, payment_ok: true, crossover_approved: true } });
  const dehors = run("person.save", { person: { id: "h", first_name: "C", last_name: "D", birth_date: "1995-01-01", sex: "M", section: "amateur", country: "CI", nationalities: ["CI"], height_cm: "176", weight_kg: "80", measurements_confirmed: true, status_approved: true, licence_ok: true, payment_ok: true, crossover_approved: true } });
  run("entry.save", { entry: { person_id: dedans.id, category_id: cat.id, confirmed: true } });
  rejects(() => run("entry.save", { entry: { person_id: dehors.id, category_id: cat.id, confirmed: true } })); // 176 exactement : hors (> 176 requis)
  // Modification : l'identifiant de règle reste, les bornes changent.
  const cat2 = run("category.save", { category: { id: cat.id, section: "amateur", custom: { discipline: "mens_physique", metric: "height_cm", lower_exclusive: "175", upper_inclusive: "182", name: "MP 175–182" } } });
  assert.equal(cat2.rule_id, cat.rule_id);
  run("entry.save", { entry: { person_id: dehors.id, category_id: cat.id, confirmed: true } });
  // Classe ouverte (sans mesure) : tout athlète du bon sexe admis.
  const open = run("category.save", { category: { section: "amateur", custom: { discipline: "wellness", name: "Wellness Open" } } });
  assert.equal(open.sex, "F");
  assert.deepEqual([open.rule.lower_exclusive, open.rule.upper_inclusive], [null, null]);
  // Validations.
  rejects(() => run("category.save", { category: { section: "amateur", custom: { discipline: "inconnue", name: "X" } } }));
  rejects(() => run("category.save", { category: { section: "amateur", custom: { discipline: "bikini", name: "" } } }));
  rejects(() => run("category.save", { category: { section: "amateur", custom: { discipline: "bikini", name: "X", upper_inclusive: "160" } } })); // borne sans mesure
  rejects(() => run("category.save", { category: { section: "amateur", custom: { discipline: "bikini", name: "X", metric: "height_cm", lower_exclusive: "170", upper_inclusive: "160" } } }));
  rejects(() => run("category.save", { category: { section: "amateur", custom: { discipline: "bikini", name: "X", metric: "age" } } }));
});
