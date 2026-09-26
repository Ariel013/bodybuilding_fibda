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

// Décision PO du 24/09/2026 : « Un athlète absent est absent, il ne compte aucun point ! »
test("absent on pending semi is removed from the semi and from the dependent final", () => {
  const f = new Fixture();
  Object.assign(f.r, { phase: "semi", quota: 3, status: "pending", opened_at: null });
  f.s.active_round_id = null;
  const following = makeRound(f.s, f.cat, "final", [], null, f.r.id);
  f.s.rounds.push(following);
  const out = applySport(f.s, f.chief, "round.absent", { round_id: f.r.id, entry_id: "c", reason: "Non présenté" }, f.users, 50);
  assert.deepEqual(out.absent_ids, ["c"]);
  assert.deepEqual(f.r.participant_ids, ["a", "b"]);
  assert.deepEqual(f.r.absent_ids, ["c"]);
  assert.equal(f.r.absences[0].reason, "Non présenté");
  assert.equal(f.r.absences[0].by, "0");
  // Quota 3 > effectif 2 : ramené à l'effectif, comme l'exige quotaValid.
  assert.equal(f.r.quota, 2);
  assert.deepEqual(following.absent_ids, ["c"]);
  // Idempotence : rejouer → 422.
  assert.throws(() => applySport(f.s, f.chief, "round.absent", { round_id: f.r.id, entry_id: "c", reason: "Encore" }, f.users, 51), (e: any) => e instanceof Problem && e.status === 422);
  // Le tour reste jugeable ; la finale dépendante ne reprend pas l'absent par la qualification.
  tick(f.s, f.users, 60);
  assert.equal(f.r.status, "open");
  for (let i = 0; i < 5; i++) f.submit(String(i), ["a", "b"], 100 + i);
  f.submit("t", ["a", "b"], 105);
  f.validate();
  assert.deepEqual(f.r.result.qualified, ["a", "b"]);
  assert.equal(following.status, "open");
  assert.deepEqual(following.participant_ids, ["a", "b"]);
});

test("absent on open round without ballot, refused after a ballot, restored before", () => {
  const f = new Fixture();
  applySport(f.s, f.chief, "round.absent", { round_id: f.r.id, entry_id: "b", reason: "Blessure" }, f.users, 50);
  assert.deepEqual(f.r.participant_ids, ["a", "c"]);
  throwsProblem(() => applySport(f.s, f.chief, "round.absent", { round_id: f.r.id, entry_id: "b", reason: "" }, f.users, 50));
  throwsProblem(() => applySport(f.s, f.chief, "round.present", { round_id: f.r.id, entry_id: "a" }, f.users, 51));
  applySport(f.s, f.chief, "round.present", { round_id: f.r.id, entry_id: "b" }, f.users, 52);
  assert.deepEqual(f.r.participant_ids, ["a", "b", "c"]);
  assert.deepEqual(f.r.absent_ids, []);
  assert.equal(f.r.absences[0].restored.by, "0");
  f.submit("1", null, 100);
  assert.throws(() => applySport(f.s, f.chief, "round.absent", { round_id: f.r.id, entry_id: "b", reason: "Tard" }, f.users, 101), (e: any) => e instanceof Problem && e.status === 409 && /incident/.test(e.message));
  throwsProblem(() => applySport(f.s, f.chief, "round.present", { round_id: f.r.id, entry_id: "b" }, f.users, 101));
  // Le juge ne peut pas être surpris par la commande : le directeur en est exclu, un juge aussi.
  throwsProblem(() => applySport(f.s, f.users[1], "round.absent", { round_id: f.r.id, entry_id: "c", reason: "X" }, f.users, 101));
});

test("last participant cannot be declared absent; a single participant stays judgeable", () => {
  const f = new Fixture();
  applySport(f.s, f.chief, "round.absent", { round_id: f.r.id, entry_id: "a", reason: "Forfait" }, f.users, 50);
  applySport(f.s, f.chief, "round.absent", { round_id: f.r.id, entry_id: "b", reason: "Forfait" }, f.users, 51);
  throwsProblem(() => applySport(f.s, f.chief, "round.absent", { round_id: f.r.id, entry_id: "c", reason: "Forfait" }, f.users, 52));
  assert.deepEqual(f.r.participant_ids, ["c"]);
  for (let i = 0; i < 5; i++) f.submit(String(i), ["c"], 100 + i);
  f.submit("t", ["c"], 105);
  f.validate();
  assert.deepEqual(f.r.result.official.map((x: any) => x.entry_id), ["c"]);
});

// --- Ordre de passage (PO 24/09/2026 : tiré au sort à chaque tour parmi les athlètes en lice) ---

const isPermutation = (order: string[], ids: string[]) => order.length === ids.length && new Set(order).size === order.length && ids.every((i) => order.includes(i));

test("ouverture : l'ordre de passage est une permutation des participants, tracée comme tirage automatique", () => {
  const f = new Fixture();
  Object.assign(f.r, { status: "pending", opened_at: null });
  f.s.active_round_id = null;
  assert.equal(f.r.passage_order, undefined);
  applySport(f.s, f.chief, "round.open", { round_id: f.r.id }, f.users, 10);
  assert.equal(f.r.status, "open");
  assert.ok(isPermutation(f.r.passage_order, ["a", "b", "c"]), JSON.stringify(f.r.passage_order));
  assert.deepEqual(f.r.draws, [{ at: 10, by: null, automatic: true }]);
});

test("round.draw : nouvelle permutation sur un tour en attente, variabilité, conservée à l'ouverture", () => {
  const f = new Fixture();
  const ids = ["a", "b", "c", "d", "e", "g"];
  f.s.people.push(...["d", "e", "g"].map((x) => ({ id: x, first_name: x, last_name: "Test", nationalities: ["CI"], country: "CI", club: "Club" })));
  f.s.entries.push(...["d", "e", "g"].map((x, i) => ({ id: x, person_id: x, category_id: "cat", bib: 4 + i, confirmed: true })));
  Object.assign(f.r, { status: "pending", opened_at: null, participant_ids: [...ids] });
  f.s.active_round_id = null;
  const seen = new Set<string>();
  for (let i = 0; i < 20; i++) {
    const out = applySport(f.s, f.chief, "round.draw", { round_id: f.r.id }, f.users, 20 + i);
    assert.ok(isPermutation(out.passage_order, ids), JSON.stringify(out.passage_order));
    assert.deepEqual(out.passage_order, f.r.passage_order);
    seen.add(out.passage_order.join(","));
  }
  // 720 permutations possibles : 20 tirages identiques seraient un signe d'aléa cassé.
  assert.ok(seen.size >= 2, "au moins deux ordres distincts sur 20 tirages");
  assert.equal(f.r.draws.length, 20);
  assert.equal(f.r.draws[19].by, "0");
  assert.equal(f.r.draws[19].automatic, false);
  // Un tirage manuel fait sur le même effectif est conservé à l'ouverture (pas de second tirage).
  const before = [...f.r.passage_order];
  applySport(f.s, f.chief, "round.open", { round_id: f.r.id }, f.users, 50);
  assert.deepEqual(f.r.passage_order, before);
  assert.equal(f.r.draws.length, 20);
  // Le responsable peut tirer ; un juge et le directeur non.
  const responsable: User = { id: "resp", name: "resp", roles: ["responsable"], approved: true, active: true };
  applySport(f.s, responsable, "round.draw", { round_id: f.r.id }, [...f.users, responsable], 51);
  assert.equal(f.r.draws.length, 21);
  throwsProblem(() => applySport(f.s, f.users[1], "round.draw", { round_id: f.r.id }, f.users, 52));
  throwsProblem(() => applySport(f.s, f.users.find((u) => u.id === "d")!, "round.draw", { round_id: f.r.id }, f.users, 52));
});

test("round.draw refusé dès qu'un bulletin est reçu, et sur un tour dont les participants sont inconnus", () => {
  const f = new Fixture();
  f.submit("1", null, 100);
  assert.throws(() => applySport(f.s, f.chief, "round.draw", { round_id: f.r.id }, f.users, 101), (e: any) => e instanceof Problem && e.status === 409 && e.message === "Un bulletin a déjà été reçu : l’ordre de passage est figé.");
  // Finale dépendante d'une demi non close : participants inconnus.
  const following = makeRound(f.s, f.cat, "final", [], null, f.r.id);
  f.s.rounds.push(following);
  assert.throws(() => applySport(f.s, f.chief, "round.draw", { round_id: following.id }, f.users, 102), (e: any) => e instanceof Problem && /participants/.test(e.message));
  // Tour validé : plus de tirage.
  for (const j of ["0", "2", "3", "4"]) f.submit(j, null, 110 + Number(j));
  f.submit("t", null, 105);
  f.validate();
  throwsProblem(() => applySport(f.s, f.chief, "round.draw", { round_id: f.r.id }, f.users, 300));
});

test("round.draw sur une finale en attente dont la demi est close prend les qualifiés moins les absents", () => {
  const f = new Fixture();
  Object.assign(f.r, { phase: "semi", quota: 2 });
  const following = makeRound(f.s, f.cat, "final", [], null, f.r.id);
  f.s.rounds.push(following);
  for (let i = 0; i < 5; i++) f.submit(String(i), ["a", "b", "c"], 100 + i);
  f.submit("t", null, 105);
  f.validate();
  // La finale s'est ouverte d'elle-même avec un tirage sur les deux qualifiés.
  assert.equal(following.status, "open");
  assert.ok(isPermutation(following.passage_order, ["a", "b"]));
  // Nouveau tirage manuel sur le tour ouvert, sans bulletin : permutation des mêmes qualifiés.
  applySport(f.s, f.chief, "round.draw", { round_id: following.id }, f.users, 300);
  assert.ok(isPermutation(following.passage_order, ["a", "b"]));
});

test("absence : l'athlète sort de l'ordre de passage sans déplacer les autres ; retour en dernière position", () => {
  const f = new Fixture();
  f.r.passage_order = ["c", "a", "b"];
  f.r.draws = [{ at: 0, by: null, automatic: true }];
  applySport(f.s, f.chief, "round.absent", { round_id: f.r.id, entry_id: "a", reason: "Forfait" }, f.users, 50);
  assert.deepEqual(f.r.passage_order, ["c", "b"]);
  assert.deepEqual(f.r.participant_ids, ["b", "c"]);
  applySport(f.s, f.chief, "round.present", { round_id: f.r.id, entry_id: "a" }, f.users, 51);
  assert.deepEqual(f.r.passage_order, ["c", "b", "a"]);
  assert.deepEqual(f.r.participant_ids, ["a", "b", "c"]);
  // Une absence sur une demi retire aussi l'athlète d'un éventuel ordre déjà tiré de la finale dépendante.
  Object.assign(f.r, { phase: "semi", quota: 2 });
  const following = makeRound(f.s, f.cat, "final", ["a", "b"], null, f.r.id);
  following.passage_order = ["b", "a"];
  f.s.rounds.push(following);
  applySport(f.s, f.chief, "round.absent", { round_id: f.r.id, entry_id: "b", reason: "Blessure" }, f.users, 52);
  assert.deepEqual(following.passage_order, ["a"]);
});

test("le résultat sportif ne dépend pas de l'ordre de passage", () => {
  const results: any[] = [];
  for (const order of [["a", "b", "c"], ["c", "b", "a"], undefined]) {
    const f = new Fixture();
    if (order) f.r.passage_order = order;
    f.submit("0", ["b", "a", "c"], 100);
    f.submit("1", ["a", "b", "c"], 101);
    f.submit("2", ["b", "c", "a"], 102);
    f.submit("3", ["c", "a", "b"], 103);
    f.submit("4", ["b", "a", "c"], 104);
    f.submit("t", ["a", "b", "c"], 105);
    f.validate();
    results.push({ common: f.r.result.common, official: f.r.result.official, qualified: f.r.result.qualified });
  }
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[0], results[2]);
  assert.deepEqual(results[0].official.map((x: any) => x.entry_id), ["b", "a", "c"]);
});

test("event.reset : retour en préparation, chef seulement, confirmation exigée, données de préparation conservées", () => {
  const f = new Fixture();
  f.completed();
  const oldRestore = f.s.restore_id;
  throwsProblem(() => applySport(f.s, f.users[1], "event.reset", { confirm: "REINITIALISER" }, f.users, 300));
  throwsProblem(() => applySport(f.s, f.chief, "event.reset", { confirm: "oui" }, f.users, 300));
  const r = applySport(f.s, f.chief, "event.reset", { confirm: "REINITIALISER" }, f.users, 300);
  assert.equal(r.rounds_effaces, 1);
  assert.equal(f.s.status, "preparation");
  assert.deepEqual(f.s.rounds, []);
  assert.equal(f.s.active_round_id, null);
  assert.deepEqual(f.s.rewards, []);
  assert.notEqual(f.s.restore_id, oldRestore);
  assert.equal(f.s.people.length, 3);
  assert.equal(f.s.entries.length, 3);
  assert.deepEqual(f.s.jury.panel, ["0", "1", "2", "3", "4"]);
  throwsProblem(() => applySport(f.s, f.chief, "event.reset", { confirm: "REINITIALISER" }, f.users, 301));
});

test("programme.generate ignore les catégories désactivées comme les archivées (PO, 26/09/2026)", () => {
  const f = new Fixture();
  f.s.status = "preparation";
  f.s.bibs_distributed = true;
  f.s.rounds = [];
  f.s.categories.push(
    { id: "off", name: "Désactivée", discipline: "bodybuilding", section: "amateur", order: 1, archived: false, active: false },
    { id: "old", name: "Archivée", discipline: "bodybuilding", section: "amateur", order: 2, archived: true },
    { id: "legacy", name: "Sans champ active", discipline: "bikini", section: "amateur", order: 3, archived: false },
  );
  f.s.entries.push(
    { id: "d", person_id: "a", category_id: "off", bib: 4, confirmed: true },
    { id: "e", person_id: "b", category_id: "old", bib: 5, confirmed: true },
    { id: "g", person_id: "c", category_id: "legacy", bib: 6, confirmed: true },
  );
  const planned = applySport(f.s, f.chief, "programme.generate", {}, f.users, 0);
  assert.equal(planned.count, 2);
  assert.deepEqual(f.s.rounds.map((r: any) => r.category_id), ["cat", "legacy"]);
});
