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

test("cumulation_chief_and_drafts", () => {
  const a = category(); const b = category(); let p = person();
  entry(p, a, sec);
  rejects(() => entry(p, b, sec));
  p = person("q", "80");
  const draft = run("entry.save", { entry: { person_id: p.id, category_id: a.id, confirmed: false } }, sec);
  assert.equal(draft.confirmed, false);
  rejects(() => entry(p, b, sec));
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
