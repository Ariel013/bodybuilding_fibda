// Régressions du workflow, indépendantes du transport HTTP.
// Port test par test de `backend/tests/test_workflow.py` (partie ne dépendant que de workflow).
// Les tests qui appellent `apply_command`, `project_state`, `public_state` ou `collective`
// seront portés avec commands.ts / projections.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Problem } from "./problem";
import { newState, type User } from "./state";
import { makeRound, applySport, tick } from "./workflow";

const throwsProblem = (fn: () => unknown) => assert.throws(fn, (e: unknown) => e instanceof Problem);

export class Fixture {
  users: User[];
  chief: User;
  s: any;
  cat: any;
  r: any;
  constructor() {
    this.users = [0, 1, 2, 3, 4].map((i) => ({ id: String(i), name: String(i), roles: [i === 0 ? "chief" : "judge"], approved: true, active: true }));
    this.users.push({ id: "t", name: "t", roles: ["trainee"], approved: true, active: true }, { id: "d", name: "d", roles: ["director"], approved: true, active: true });
    this.chief = this.users[0];
    this.s = newState();
    this.s.status = "running";
    this.s.jury = { panel: ["0", "1", "2", "3", "4"], trainees: ["t"], withdrawal_order: ["4", "3", "2", "1"] };
    this.cat = { id: "cat", name: "Catégorie", discipline: "bodybuilding", section: "amateur", order: 0, archived: false };
    this.s.categories = [this.cat];
    this.s.people = ["a", "b", "c"].map((x) => ({ id: x, first_name: x, last_name: "Test", nationalities: ["CI"], country: "CI", club: "Club", private_contact: "secret", birth_date: "1990-01-01", photo_portrait: "secret-photo", photo_approved: false, photo_consent: false }));
    this.s.entries = ["a", "b", "c"].map((x, i) => ({ id: x, person_id: x, category_id: "cat", bib: i + 1, confirmed: true }));
    this.r = makeRound(this.s, this.cat, "final", ["a", "b", "c"]);
    Object.assign(this.r, { status: "open", opened_at: 0 });
    this.s.rounds = [this.r];
    this.s.active_round_id = this.r.id;
  }
  submit(j: string, ranking: string[] | null = null, now = 100) {
    const actor = this.users.find((u) => u.id === j)!;
    return applySport(this.s, actor, "ballot.submit", { round_id: this.r.id, restore_id: this.s.restore_id, ranking: ranking ?? ["a", "b", "c"] }, this.users, now);
  }
  officialBallots(now = 100) {
    for (let i = 0; i < 5; i++) this.submit(String(i), null, now + i);
  }
  validate() {
    return applySport(this.s, this.chief, "round.validate", { round_id: this.r.id }, this.users, 200);
  }
  completed() {
    this.officialBallots();
    this.submit("t", null, 105);
    this.validate();
  }
}

test("deadline starts only after last official and closes exactly 60", () => {
  const f = new Fixture();
  for (let i = 0; i < 4; i++) f.submit(String(i), null, 100 + i);
  assert.equal(f.r.trainee_deadline, null);
  tick(f.s, f.users, 1000);
  assert.equal(f.r.status, "open");
  f.submit("4", null, 1001);
  assert.equal(f.r.trainee_deadline, 1061);
  tick(f.s, f.users, 1060.999);
  assert.equal(f.r.status, "open");
  tick(f.s, f.users, 1061);
  assert.equal(f.r.status, "awaiting_validation");
  assert.deepEqual(f.r.expired_trainees, ["t"]);
  const version = f.r.version;
  const alerts = f.s.alerts.length;
  tick(f.s, f.users, 1100);
  assert.equal(f.r.version, version);
  assert.equal(f.s.alerts.length, alerts);
  throwsProblem(() => f.submit("t", null, 1100));
});

test("all trainees advance early without reveal", () => {
  const f = new Fixture();
  f.submit("t", null, 10);
  f.officialBallots();
  assert.equal(f.r.status, "awaiting_validation");
  assert.equal(f.r.transitioned, true);
  assert.deepEqual(f.s.public.main, { kind: "idle" });
});

test("manual next same guard as automatic", () => {
  const f = new Fixture();
  throwsProblem(() => applySport(f.s, f.chief, "round.next", {}, f.users, 100));
  f.officialBallots();
  throwsProblem(() => applySport(f.s, f.chief, "round.next", {}, f.users, 150));
});

test("qualification waits validation", () => {
  const f = new Fixture();
  f.r.phase = "semi";
  f.r.quota = 2;
  const following = makeRound(f.s, f.cat, "final", [], null, f.r.id);
  f.s.rounds.push(following);
  f.officialBallots();
  f.submit("t", null, 105);
  assert.equal(following.status, "pending");
  assert.deepEqual(following.participant_ids, []);
  f.validate();
  assert.equal(following.status, "open");
  assert.deepEqual(following.participant_ids, ["a", "b"]);
});

test("national filters nationality not country and renumbers", () => {
  const f = new Fixture();
  f.s.people[0].nationalities = ["FR"];
  f.s.people[0].country = "CI";
  f.s.people[1].country = "FR";
  f.completed();
  assert.deepEqual(f.r.result.official.map((r: any) => r.entry_id), ["b", "c"]);
  assert.deepEqual(f.r.result.official.map((r: any) => r.total), [3, 6]);
  assert.deepEqual(f.r.result.common.map((r: any) => r.entry_id), ["a", "b", "c"]);
});

test("final zero no semifinal carry", () => {
  const f = new Fixture();
  f.r.result = { version: 99, common: [{ entry_id: "a", total: 99999 }], official: [] };
  f.officialBallots();
  f.submit("t", null, 105);
  f.validate();
  assert.equal(f.r.result.common[0].total, 3);
});

test("director and wrong restore cannot vote", () => {
  const f = new Fixture();
  throwsProblem(() => f.submit("d"));
  throwsProblem(() => applySport(f.s, f.chief, "ballot.submit", { round_id: f.r.id, restore_id: "old", ranking: ["a", "b", "c"] }, f.users, 100));
  assert.deepEqual(f.r.ballots, {});
});

// Partie workflow de `test_published_correction_requires_distinct_director_and_preserves_original` :
// la suite (signatures chef + directeur via `correction.sign`) sera portée avec commands.ts.
test("published correction stays pending and preserves original (partie workflow)", () => {
  const f = new Fixture();
  f.completed();
  f.r.status = "published";
  f.s.public.main = { kind: "ranking", round_id: f.r.id };
  const result = applySport(f.s, f.chief, "round.correct", { round_id: f.r.id, judge_id: "1", ranking: ["c", "b", "a"], reason: "Erreur signée" }, f.users, 220);
  assert.equal(result.pending_signatures, true);
  assert.deepEqual(f.r.ballots["1"].ranking, ["a", "b", "c"]);
  assert.notEqual(f.r.correction, null);
  assert.deepEqual(f.r.correction.signatures, ["0"]);
  assert.equal(f.r.correction.published, true);
});

test("overall cycle requires rewards and explicit single confirmation", () => {
  const f = new Fixture();
  f.completed();
  throwsProblem(() => applySport(f.s, f.chief, "overall.create", { discipline: "bodybuilding", section: "amateur" }, f.users, 210));
  applySport(f.s, f.chief, "rewards.complete", { discipline: "bodybuilding", kind: "category" }, f.users, 210);
  const created = applySport(f.s, f.chief, "overall.create", { discipline: "bodybuilding", section: "amateur" }, f.users, 211);
  const overall = f.s.rounds[f.s.rounds.length - 1];
  assert.equal(overall.status, "pending");
  throwsProblem(() => applySport(f.s, f.chief, "discipline.advance", { discipline: "bodybuilding" }, f.users, 212));
  applySport(f.s, f.chief, "overall.confirm", { round_id: created.round_id }, f.users, 213);
  applySport(f.s, f.chief, "rewards.complete", { discipline: "bodybuilding", kind: "overall" }, f.users, 214);
  applySport(f.s, f.chief, "discipline.advance", { discipline: "bodybuilding" }, f.users, 215);
  assert.equal(f.s.discipline_progress.bodybuilding.completed, true);
});

test("repeated incident cannot destroy resume status", () => {
  const f = new Fixture();
  applySport(f.s, f.chief, "round.incident", { round_id: f.r.id, reason: "Incident initial" }, f.users, 100);
  throwsProblem(() => applySport(f.s, f.chief, "round.incident", { round_id: f.r.id, reason: "Double clic" }, f.users, 101));
});

test("elimination unknown qualification blocks dependent round", () => {
  const f = new Fixture();
  f.r.phase = "elimination";
  f.r.quota = 1;
  f.r.trainees = [];
  const following = makeRound(f.s, f.cat, "semi", [], 1, f.r.id);
  f.s.rounds.push(following);
  ["a", "a", "b", "b", "c"].forEach((selection, i) => {
    applySport(f.s, f.users[i], "ballot.submit", { round_id: f.r.id, restore_id: f.s.restore_id, selected: [selection] }, f.users, 100 + i);
  });
  assert.equal(f.r.status, "awaiting_validation");
  throwsProblem(() => f.validate());
  assert.equal(following.status, "pending");
  applySport(f.s, f.chief, "round.validate", { round_id: f.r.id, qualified_ids: ["a", "b"] }, f.users, 200);
  assert.deepEqual(following.participant_ids, ["a", "b"]);
  assert.equal(following.status, "open");
});
