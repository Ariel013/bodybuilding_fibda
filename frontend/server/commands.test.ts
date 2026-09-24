// Suite des tests de test_workflow.py qui passent par apply_command, project_state, public_state ou collective.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Problem } from "./problem";
import { deepcopy } from "./util";
import { applySport, makeRound } from "./workflow";
import { applyCommand } from "./commands";
import { projectState, publicState, collective } from "./projections";
import { Fixture } from "./workflow.test";
import { loadCatalogue } from "../domain/catalogue";

// Magasin factice : comme FakeStore côté Python, fournit les comptes et l'horloge, rien d'autre.
const fakeStore = (f: Fixture, now = 100) => ({ allUsers: async () => f.users, clock: () => now }) as any;
const rejectsProblem = (p: Promise<unknown>) => assert.rejects(p, (e: unknown) => e instanceof Problem);

test("published correction requires distinct director and preserves original", async () => {
  const f = new Fixture();
  f.completed();
  f.r.status = "published";
  f.s.public.main = { kind: "ranking", round_id: f.r.id };
  const result = applySport(f.s, f.chief, "round.correct", { round_id: f.r.id, judge_id: "1", ranking: ["c", "b", "a"], reason: "Erreur signée" }, f.users, 220);
  assert.equal(result.pending_signatures, true);
  assert.deepEqual(f.r.ballots["1"].ranking, ["a", "b", "c"]);
  await applyCommand(fakeStore(f), null as any, f.s, f.chief, "correction.sign", { round_id: f.r.id });
  assert.notEqual(f.r.correction, null);
  await applyCommand(fakeStore(f), null as any, f.s, f.users[f.users.length - 1], "correction.sign", { round_id: f.r.id });
  assert.equal(f.r.correction, null);
  assert.deepEqual(f.r.ballots["1"].ranking, ["c", "b", "a"]);
  assert.deepEqual(f.r.ballots["1"].original.ranking, ["a", "b", "c"]);
  assert.equal(f.s.public.main.kind, "idle");
});

test("confidentiality projection and public consent", () => {
  const f = new Fixture();
  f.completed();
  const out = projectState(f.s, f.users[1], f.users, 100);
  assert.deepEqual(Object.keys(out.rounds[0].ballots), ["1"]);
  assert.equal(out.rounds[0].result, null);
  assert.equal("private_contact" in out.people[0], false);
  f.s.public.main = { kind: "reveal", round_id: f.r.id, revealed_count: 1 };
  const pub = publicState(f.s, "main");
  assert.equal("ballots" in pub.rounds[0], false);
  assert.equal("photo_portrait" in pub.people[0], false);
  assert.deepEqual(pub.rounds[0].result.official, [{ entry_id: "c", rank: 3 }]);
});

test("collective place counts precede custom criterion", () => {
  const f = new Fixture();
  // 10 points chacun : une victoire contre une 2e et une 3e place.
  f.s.people[0].club = "A";
  f.s.people[1].club = "B";
  f.s.people[2].club = "B";
  f.r.status = "validated";
  f.r.result = { official: [{ entry_id: "a", rank: 1 }, { entry_id: "b", rank: 2 }, { entry_id: "c", rank: 3 }] };
  f.s.settings.collective_tiebreak = "Décision motivée chef et directeur";
  const rows = collective(f.s).club;
  assert.deepEqual(rows.map((r: any) => r.rank), [1, 2]);
});

test("collective scale 15/10/5/4/3/1 with finals, overall and participation (décision PO 24/09/2026)", () => {
  const f = new Fixture();
  // Catégorie « cat » : 8 inscrits a..h. Demi-finale validée à 8, finale validée à 7 (h éliminé en demi).
  // Un 9e inscrit confirmé, i (club B), déclaré absent : aligné sur aucun tour → 0 point (PO 24/09/2026).
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
  f.s.people = [...ids, "i"].map((x) => ({ id: x, first_name: x, last_name: "Test", nationalities: ["CI"], country: "CI", club: ["a", "c", "e", "g", "h"].includes(x) ? "A" : "B" }));
  f.s.entries = [...ids, "i"].map((x, i) => ({ id: x, person_id: x, category_id: "cat", bib: i + 1, confirmed: true }));
  const semi = makeRound(f.s, f.cat, "semi", ids);
  semi.absent_ids = ["i"];
  semi.status = "validated";
  semi.result = { official: ids.map((x, i) => ({ entry_id: x, rank: i + 1 })), version: 1 };
  f.r.participant_ids = ids.slice(0, 7);
  f.r.status = "published";
  f.r.result = { official: ids.slice(0, 7).map((x, i) => ({ entry_id: x, rank: i + 1 })), version: 2 };
  // Overall de discipline : champion seul confirmé (a, rang 1).
  const overall = makeRound(f.s, { id: "overall-bodybuilding-amateur", discipline: "bodybuilding", section: "amateur" }, "overall", ["a"]);
  overall.status = "validated";
  overall.result = { official: [{ entry_id: "a", rank: 1, total: null }], version: 1, single_champion: true };
  f.s.rounds = [semi, f.r, overall];
  f.s.settings.collective_tiebreak = "Décision motivée chef et directeur";
  let out = collective(f.s);
  // Club A : a 1er = 15, c 3e = 5, e 5e = 3, g 7e = 1, h éliminé en demi = 1 (participation),
  //          a champion overall = 15 → 40. Places : deux 1res (finale + overall), une 3e, une 5e, deux « 6e et au-delà ».
  // Club B : b 2e = 10, d 4e = 4, f 6e = 1 → 15 ; i absent = 0. Places : une 2e, une 4e, une « 6e et au-delà ».
  assert.deepEqual(out.club.map((r: any) => [r.name, r.points, r.counts, r.rank]), [
    ["A", 40, [2, 0, 1, 0, 1, 2], 1],
    ["B", 15, [0, 1, 0, 1, 0, 1], 2],
  ]);
  assert.deepEqual([...out.club[0].people].sort(), ["a", "c", "e", "g", "h"]);
  assert.deepEqual([...out.club[1].people].sort(), ["b", "d", "f"]);
  assert.equal(out.complete, true);
  assert.equal(out.winners.club, "A");
  // L'empreinte change avec la version de l'overall.
  const revision = out.revision;
  overall.result.version = 2;
  assert.notEqual(collective(f.s).revision, revision);
  // Un overall encore ouvert ne rapporte rien ; la finale seule donne A = 25, B = 15.
  overall.status = "open";
  out = collective(f.s);
  assert.equal(out.club[0].points, 25);
  // Finale non validée mais demi validée : chaque inscrit aligné en demi vaut 1 point provisoire ; i absent reste à 0.
  f.r.status = "open";
  out = collective(f.s);
  assert.equal(out.complete, false);
  assert.deepEqual(out.club.map((r: any) => [r.name, r.points]), [["A", 5], ["B", 3]]);
  assert.equal(out.club[1].people.includes("i"), false);
});

test("corrected result requires new reveal before podium", async () => {
  const f = new Fixture();
  f.completed();
  f.r.status = "published";
  f.r.reveals = { main: 3 };
  f.s.public.main = { kind: "ranking", round_id: f.r.id };
  applySport(f.s, f.chief, "round.correct", { round_id: f.r.id, judge_id: "1", ranking: ["c", "b", "a"], reason: "Erreur" }, f.users, 220);
  await applyCommand(fakeStore(f), null as any, f.s, f.users[f.users.length - 1], "correction.sign", { round_id: f.r.id });
  await rejectsProblem(applyCommand(fakeStore(f), null as any, f.s, f.chief, "scene.set", { screen: "main", scene: { kind: "podium", round_id: f.r.id } }));
});

const lateRule = (): any => loadCatalogue().rules.find((r: any) => r.discipline === "bodybuilding" && r.division === "senior" && r.upper_inclusive === "70");
const latePerson = { first_name: "Nouveau", last_name: "Concurrent", birth_date: "1990-01-01", sex: "M", section: "amateur", country: "CI", nationalities: ["CI"], height_cm: "170", weight_kg: "69", measurements_confirmed: true, status_approved: true, licence_ok: true, payment_ok: true };

test("late entry is included in already generated pending first round", async () => {
  const f = new Fixture();
  Object.assign(f.s, { status: "preparation", active_round_id: null, bibs_distributed: true });
  Object.assign(f.r, { status: "pending", opened_at: null });
  Object.assign(f.cat, { rule_id: lateRule().id, sex: "M", division: "senior", age_min: null, age_max: null, entry_ids: ["a", "b", "c"] });
  const result = await applyCommand(fakeStore(f), null as any, f.s, f.chief, "entry.late", { person: latePerson, category_id: "cat", reason: "Transport retardé" });
  assert.equal(f.s.rounds[0].participant_ids.includes(result.id), true);
});

test("late thresholds insert phases preserving ids, bibs and other categories", async () => {
  const rule = lateRule();
  for (const [initialCount, expectedPhases] of [[6, ["semi", "final"]], [15, ["elimination", "semi", "final"]]] as [number, string[]][]) {
    const f = new Fixture();
    Object.assign(f.s, { status: "preparation", active_round_id: null, bibs_distributed: true });
    Object.assign(f.cat, { rule_id: rule.id, sex: "M", division: "senior", age_min: null, age_max: null, entry_ids: [], quota: 6, elimination_quota: 15 });
    f.s.people = [];
    f.s.entries = [];
    for (let i = 0; i < initialCount; i++) {
      f.s.people.push({ id: String(i), nationalities: ["CI"] });
      f.s.entries.push({ id: String(i), person_id: String(i), category_id: "cat", confirmed: true, bib: i + 1 });
    }
    const firstPhase = initialCount === 6 ? "final" : "semi";
    const first = makeRound(f.s, f.cat, firstPhase, [...Array(initialCount).keys()].map(String), firstPhase === "final" ? null : 6);
    const existing = [first];
    if (firstPhase === "semi") existing.push(makeRound(f.s, f.cat, "final", [], null, first.id));
    const other = makeRound(f.s, { ...f.cat, id: "other" }, "final", ["other-entry"]);
    const otherSnapshot = deepcopy(other);
    f.s.rounds = [...existing, other];
    const oldIds: Record<string, string> = Object.fromEntries(existing.map((r) => [r.phase, r.id]));
    const result = await applyCommand(fakeStore(f), null as any, f.s, f.chief, "entry.late", { person: latePerson, category_id: "cat", reason: "Transport retardé" });
    const rounds: Record<string, any> = Object.fromEntries(f.s.rounds.filter((r: any) => r.category_id === "cat").map((r: any) => [r.phase, r]));
    assert.deepEqual(Object.keys(rounds).sort(), [...expectedPhases].sort(), `n=${initialCount}`);
    assert.equal(result.bib, initialCount + 1);
    assert.deepEqual(f.s.entries.slice(0, -1).map((e: any) => e.bib), [...Array(initialCount).keys()].map((i) => i + 1));
    assert.equal(rounds[expectedPhases[0]].participant_ids.length, initialCount + 1);
    for (const [phase, identifier] of Object.entries(oldIds)) assert.equal(rounds[phase].id, identifier);
    for (let i = 0; i + 1 < expectedPhases.length; i++) {
      assert.equal(rounds[expectedPhases[i + 1]].dependency_id, rounds[expectedPhases[i]].id);
      assert.deepEqual(rounds[expectedPhases[i + 1]].participant_ids, []);
    }
    assert.deepEqual(f.s.rounds.find((r: any) => r.id === other.id), otherSnapshot);
  }
});
