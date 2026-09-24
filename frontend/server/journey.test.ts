import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "./app";
import { Store } from "./store";

// Portage de backend/tests/test_event_journey.py : parcours métier complet via HTTP sur la
// démonstration officielle de trois catégories (mêmes commandes, mêmes payloads, mêmes attendus).
// Différences acceptées avec le Python : pas de WebSocket ; le peuplement démo exige le jeton
// de configuration ; le Python ne fait jamais avancer son horloge (tick est appelé dans
// ballot.submit), une horloge contrôlable fixe suffit donc ici.

const json = (body: any, headers: Record<string, string> = {}) => ({ method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
const cookieOf = (r: Response) => (r.headers.get("set-cookie") ?? "").split(";")[0];
const body = async (r: Response | Promise<Response>): Promise<any> => { const t = await (await r).text(); try { return JSON.parse(t); } catch { return t; } };

test("démonstration nationale, trois catégories jusqu'à la clôture", async () => {
  let now = 1000;
  const store = new Store({ url: ":memory:", demo: true, clock: () => now });
  const app = createApp({ store, setupToken: "jeton-test", testing: true });

  // Peuplement démo : le chef est connecté par le cookie renvoyé.
  let r = await app.request("/api/v1/demo", { method: "POST", headers: { "x-setup-token": "jeton-test" } });
  const seeded = await body(r);
  assert.equal(r.status, 200, JSON.stringify(seeded));
  let state = seeded.state;
  assert.equal(state.categories.length, 3);
  assert.equal(state.entries.length, 24);
  const chief = cookieOf(r);
  const clients: Record<string, string> = { [state.me.id]: chief };
  for (const [uidUser, access] of Object.entries<any>(seeded.codes)) {
    if (access.roles.some((x: string) => ["judge", "trainee"].includes(x))) {
      const login = await app.request("/api/v1/auth/login", json({ code: access.code }));
      assert.equal(login.status, 200, await login.text());
      clients[uidUser] = cookieOf(login);
    }
  }

  const read = async (): Promise<any> => {
    const r = await app.request("/api/v1/state", { headers: { cookie: chief } });
    const s = await body(r);
    assert.equal(r.status, 200, JSON.stringify(s));
    return s;
  };
  const command = async (kind: string, payload: any = {}, client: string = chief, status = 200): Promise<any> => {
    const version = (await read()).version;
    const r = await app.request("/api/v1/command", json({ id: randomUUID(), version, type: kind, payload }, { cookie: client }));
    const b = await body(r);
    assert.equal(r.status, status, JSON.stringify(b));
    return b.state;
  };

  await command("event.update", { settings: { collective_tiebreak: "Décision motivée chef et directeur après égalité des places" } });
  const planned = await command("programme.generate");
  const trainee: string = planned.users.find((u: any) => u.roles.includes("trainee")).id;
  await command("exam.program", { user_id: trainee, round_ids: planned.rounds.filter((x: any) => x.phase !== "elimination").map((x: any) => x.id) });
  state = await command("event.start");
  const sequence: [string, string][] = [];

  // Juge le tour actif avec tout le panel et les stagiaires, puis le valide et contrôle le résultat.
  const judgeActive = async (): Promise<any> => {
    const s = await read();
    const round = s.rounds.find((x: any) => x.id === s.active_round_id);
    assert.ok(round, "aucun tour actif");
    sequence.push([round.discipline, round.phase]);
    const people: Record<string, any> = Object.fromEntries(s.people.map((p: any) => [p.id, p]));
    const entries: Record<string, any> = Object.fromEntries(s.entries.map((e: any) => [e.id, e]));
    const isCI = (eid: string) => people[entries[eid].person_id].nationalities.includes("CI");
    // Le concurrent HC gagne le classement commun ; il doit être absent du national.
    const ranking: string[] = [...round.participant_ids].sort((a: string, b: string) => (Number(isCI(a)) - Number(isCI(b))) || (entries[a].bib - entries[b].bib));
    for (const user of [...round.panel, ...round.trainees]) {
      await command("ballot.submit", { round_id: round.id, restore_id: s.restore_id, ranking }, clients[user]);
    }
    const before = await read();
    const closed = before.rounds.find((x: any) => x.id === round.id);
    assert.equal(closed.status, "awaiting_validation");
    assert.equal((await body(app.request("/api/v1/public/main"))).scene.kind, "idle");
    const after = await command("round.validate", { round_id: round.id });
    const result = after.rounds.find((x: any) => x.id === round.id).result;
    assert.deepEqual(result.common.map((x: any) => x.entry_id), ranking);
    const nationals = ranking.filter(isCI);
    assert.deepEqual(result.official.map((x: any) => x.entry_id), nationals);
    assert.deepEqual(result.official.map((x: any) => x.total), nationals.map((_: string, i: number) => 3 * (i + 1)));
    if (round.phase === "semi") {
      assert.deepEqual(result.qualified, ranking.slice(0, 6));
      assert.ok(result.qualified.includes(ranking[0]));
    }
    return after;
  };

  const deliver = async (phase: string): Promise<void> => {
    for (const reward of (await read()).rewards) {
      if (reward.kind === phase && !reward.delivered) await command("reward.update", { reward_id: reward.id, prepared: true, delivered: true });
    }
  };

  // Les deux demi-finales Men’s Physique précèdent chacune des finales.
  state = await judgeActive();
  assert.ok(state.rounds.filter((x: any) => x.phase === "final").every((x: any) => x.status === "pending"));
  assert.equal(state.rounds.find((x: any) => x.id === state.active_round_id).phase, "semi");
  await judgeActive();
  await judgeActive();
  state = await judgeActive();
  assert.deepEqual(sequence, [["mens_physique", "semi"], ["mens_physique", "semi"], ["mens_physique", "final"], ["mens_physique", "final"]]);
  assert.equal(state.active_round_id, null);
  await command("discipline.advance", { discipline: "mens_physique" }, chief, 422);
  await deliver("final");
  await command("rewards.complete", { discipline: "mens_physique", kind: "category" });
  state = await command("overall.create", { discipline: "mens_physique", section: "amateur", exam_user_ids: [trainee] });
  let overall = state.rounds[state.rounds.length - 1];
  assert.equal(overall.participant_ids.length, 2);
  assert.ok(state.exam_programs.find((p: any) => p.user_id === trainee).round_ids.includes(overall.id));
  assert.equal(overall.status, "open");
  await judgeActive();
  await deliver("overall");
  await command("rewards.complete", { discipline: "mens_physique", kind: "overall" });
  state = await command("discipline.advance", { discipline: "mens_physique" });
  assert.equal(state.rounds.find((x: any) => x.id === state.active_round_id).discipline, "bikini");
  await judgeActive();
  await judgeActive();
  await deliver("final");
  await command("rewards.complete", { discipline: "bikini", kind: "category" });
  state = await command("overall.create", { discipline: "bikini", section: "amateur", exam_user_ids: [trainee] });
  overall = state.rounds[state.rounds.length - 1];
  assert.equal(overall.participant_ids.length, 1);
  assert.equal(overall.status, "pending");
  await command("overall.confirm", { round_id: overall.id });
  await deliver("overall");
  await command("rewards.complete", { discipline: "bikini", kind: "overall" });
  await command("discipline.advance", { discipline: "bikini" });
  // Décision PO du 24/09 : un overall par discipline, pas de finale entre disciplines ; la commande
  // overall.final est désactivée et ne peut plus bloquer la clôture.
  await command("overall.final", { section: "amateur" }, chief, 422);
  state = await command("event.finish");
  assert.equal(state.status, "finished");
  assert.equal(state.rounds.length, 8);
  assert.ok(state.rounds.every((x: any) => x.status === "validated"));
  assert.equal(state.rewards.filter((x: any) => x.kind === "final").length, 9);
  assert.equal(state.rewards.filter((x: any) => x.kind === "overall").length, 2);
  assert.ok(state.rewards.filter((x: any) => ["final", "overall"].includes(x.kind)).every((x: any) => x.delivered));
});
