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
