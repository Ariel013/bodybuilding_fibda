import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "./app";
import { Store } from "./store";
import { concordanceReport } from "./concordance";
import type { User } from "./state";

// Concordance des juges avec le bulletin du chef (PO, 26/09/2026) : même formule que l'examen
// des stagiaires (paires concordantes, moyenne non pondérée), réservée au chef et au responsable.

const json = (body: any, headers: Record<string, string> = {}) => ({ method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
const cookieOf = (r: Response) => (r.headers.get("set-cookie") ?? "").split(";")[0];
const body = async (r: Response | Promise<Response>): Promise<any> => { const t = await (await r).text(); try { return JSON.parse(t); } catch { return t; } };
const user = (id: string, roles: string[], active = true): User => ({ id, name: id, roles, approved: true, active });

test("calcul pur : formule de l'examen, original du juge, éliminatoire ignorée, sans chef rien", () => {
  const users = [user("chef", ["chief"]), user("j1", ["judge"]), user("j2", ["judge"]), user("s1", ["trainee"])];
  const ref = ["a", "b", "c", "d", "e", "f"];
  const state = {
    rounds: [
      // Éliminatoire : bulletins de sélection, pas de classement → ignorée comme dans l'examen.
      { id: "elim", category_id: "c1", phase: "elimination", status: "validated", panel: ["chef", "j1", "j2"], trainees: [], ballots: { chef: { selected: ref }, j1: { selected: ref } } },
      // Manche sans bulletin du chef : ignorée, jamais de pourcentage inventé.
      { id: "sans-chef", category_id: "c1", phase: "semi", status: "open", panel: ["chef", "j1", "j2"], trainees: [], ballots: { j1: { ranking: ref } } },
      // Manche ouverte : référence = bulletin courant du chef.
      { id: "ouverte", category_id: "c1", phase: "semi", status: "open", panel: ["chef", "j1", "j2"], trainees: ["s1"], ballots: { chef: { ranking: ref, version: 3 }, j1: { ranking: ["b", "a", "c", "d", "e", "f"] }, s1: { ranking: [...ref].reverse() } } },
      // Manche validée : référence gelée ; le bulletin original du juge prime sur sa correction.
      { id: "validee", category_id: "c2", phase: "final", status: "validated", panel: ["chef", "j1", "j2"], trainees: [], ballots: { chef: { ranking: [...ref].reverse() }, j1: { ranking: [...ref].reverse(), original: { ranking: ref } }, j2: { ranking: ["a", "b", "c", "d", "f"] } }, result: { reference_ranking: ref, reference_version: 7 } },
    ],
  };
  const out = concordanceReport(state, users);
  assert.equal(out.chief_id, "chef");
  assert.deepEqual(out.rounds.map((r) => r.round_id), ["ouverte", "validee"]);
  const ouverte = out.rounds[0];
  assert.equal(ouverte.reference_source, "ballot");
  assert.equal(ouverte.reference_version, 3);
  // Le chef n'est pas comparé à lui-même ; stagiaire inclus et signalé.
  assert.deepEqual(ouverte.judges.map((j) => [j.user_id, j.trainee]), [["j1", false], ["j2", false], ["s1", true]]);
  // Une inversion adjacente sur 15 paires : 14/15 = 93,33 % (valeur de l'examen pour `bacdef` : 280/3).
  assert.deepEqual(ouverte.judges[0].score, { numerator: 280, denominator: 3, display: "93.33" });
  assert.equal(ouverte.judges[0].pairs, 15);
  assert.equal(ouverte.judges[1].score, null);
  assert.equal(ouverte.judges[1].comparable, false);
  assert.deepEqual(ouverte.judges[2].score, { numerator: 0, denominator: 1, display: "0.00" });
  const validee = out.rounds[1];
  assert.equal(validee.reference_source, "validated");
  assert.equal(validee.reference_version, 7);
  assert.deepEqual(validee.judges[0].score, { numerator: 100, denominator: 1, display: "100.00" });
  // Bulletin sur d'autres athlètes que la référence : non comparable, pas d'erreur, pas de score.
  assert.equal(validee.judges[1].comparable, false);
  assert.equal(validee.judges[1].score, null);
  // Moyenne non pondérée par juge : j1 = (280/3 + 100) / 2 = 290/3.
  assert.deepEqual(out.judges.map((j) => [j.user_id, j.rounds, j.pairs, j.mean?.display ?? null]), [["j1", 2, 30, "96.67"], ["j2", 0, 0, null], ["s1", 1, 15, "0.00"]]);
  // Deux chefs actifs ou aucun : aucune référence, rapport vide.
  assert.deepEqual(concordanceReport(state, [user("a", ["chief"]), user("b", ["chief"])]), { chief_id: null, rounds: [], judges: [] });
  assert.deepEqual(concordanceReport(state, [user("chef", ["chief"], false)]), { chief_id: null, rounds: [], judges: [] });
});

test("route /concordance : droits chef/responsable, calcul sur la démo, référence gelée à la validation", async () => {
  const store = new Store({ url: ":memory:", demo: true, clock: () => 1000 });
  const app = createApp({ store, setupToken: "jeton-test", testing: true });
  let r = await app.request("/api/v1/demo", { method: "POST", headers: { "x-setup-token": "jeton-test" } });
  const seeded = await body(r);
  assert.equal(r.status, 200, JSON.stringify(seeded));
  const chief = cookieOf(r);
  const chiefId: string = seeded.state.me.id;
  const clients: Record<string, string> = {};
  const byRole: Record<string, string> = {};
  for (const [id, access] of Object.entries<any>(seeded.codes)) {
    const login = await app.request("/api/v1/auth/login", json({ code: access.code }));
    assert.equal(login.status, 200, await login.text());
    clients[id] = cookieOf(login);
    byRole[access.roles[0]] = cookieOf(login);
  }
  const read = async (): Promise<any> => body(app.request("/api/v1/state", { headers: { cookie: chief } }));
  const command = async (kind: string, payload: any = {}, client: string = chief): Promise<any> => {
    const version = (await read()).version;
    const r = await app.request("/api/v1/command", json({ id: randomUUID(), version, type: kind, payload }, { cookie: client }));
    const b = await body(r);
    assert.equal(r.status, 200, JSON.stringify(b));
    return b;
  };
  const concordance = async (cookie?: string) => app.request("/api/v1/concordance", cookie ? { headers: { cookie } } : {});

  // Responsable créé par le chef.
  const invited = await command("user.invite", { name: "Responsable", roles: ["responsable"], code: "resp-12345" });
  r = await app.request("/api/v1/auth/login", json({ code: "resp-12345" }));
  assert.equal(r.status, 200, await r.text());
  const responsable = cookieOf(r);
  assert.ok(invited.result.user.roles.includes("responsable"));

  // Droits : jamais aux juges, stagiaires, directeur, régie, secrétariat ni sans session.
  assert.equal((await concordance()).status, 401);
  for (const role of ["judge", "trainee", "director", "regie", "secretariat"]) {
    const res = await concordance(byRole[role]);
    assert.equal(res.status, 403, role + " : " + (await res.text()));
  }
  assert.equal((await concordance(chief)).status, 200);
  assert.equal((await concordance(responsable)).status, 200);
  // Session révoquée : un responsable désactivé après connexion ne lit plus rien.
  const second = await command("user.invite", { name: "Responsable bis", roles: ["responsable"], code: "resp-67890" });
  const revoked = cookieOf(await app.request("/api/v1/auth/login", json({ code: "resp-67890" })));
  assert.equal((await concordance(revoked)).status, 200);
  await command("user.deactivate", { user_id: second.result.user.id });
  assert.equal((await concordance(revoked)).status, 401);

  await command("event.update", { settings: { collective_tiebreak: "Décision motivée chef et directeur après égalité des places" } });
  await command("programme.generate");
  let state = (await command("event.start")).state;
  const round = state.rounds.find((x: any) => x.id === state.active_round_id);
  assert.equal(round.phase, "semi");
  assert.equal(round.participant_ids.length, 8);
  const judges: string[] = round.panel.filter((id: string) => id !== chiefId);
  const trainee: string = round.trainees[0];
  assert.equal(judges.length, 4);
  assert.ok(trainee);
  const ranking: string[] = [...round.participant_ids];
  const submit = (client: string, ordered: string[]) => command("ballot.submit", { round_id: round.id, restore_id: state.restore_id, ranking: ordered }, client);

  // Avant tout bulletin du chef : la manche n'apparaît pas, même avec un bulletin de juge.
  await submit(clients[judges[0]], ranking);
  let out = await body(concordance(chief));
  assert.equal(out.chief_id, chiefId);
  assert.deepEqual(out.rounds, []);
  assert.deepEqual(out.judges, []);

  // Bulletin du chef reçu : comparaison immédiate sur son bulletin courant.
  await submit(chief, ranking);
  out = await body(concordance(responsable));
  assert.equal(out.rounds.length, 1);
  assert.equal(out.rounds[0].round_id, round.id);
  assert.equal(out.rounds[0].reference_source, "ballot");
  const scoreOf = (report: any, id: string) => report.rounds[0].judges.find((j: any) => j.user_id === id);
  assert.deepEqual(scoreOf(out, judges[0]).score, { numerator: 100, denominator: 1, display: "100.00" });
  assert.equal(scoreOf(out, judges[0]).pairs, 28);
  assert.equal(scoreOf(out, judges[1]).score, null);
  assert.equal(scoreOf(out, judges[1]).comparable, false);
  assert.equal(scoreOf(out, chiefId), undefined);

  // Autres bulletins : inversion adjacente (27/28), inversé (0), identique (100), stagiaire inversé (0).
  await submit(clients[judges[1]], [ranking[1], ranking[0], ...ranking.slice(2)]);
  await submit(clients[judges[2]], [...ranking].reverse());
  await submit(clients[judges[3]], ranking);
  await submit(clients[trainee], [...ranking].reverse());
  out = await body(concordance(chief));
  assert.deepEqual(scoreOf(out, judges[1]).score, { numerator: 675, denominator: 7, display: "96.43" });
  assert.deepEqual(scoreOf(out, judges[2]).score, { numerator: 0, denominator: 1, display: "0.00" });
  assert.deepEqual(scoreOf(out, judges[3]).score, { numerator: 100, denominator: 1, display: "100.00" });
  assert.equal(scoreOf(out, trainee).trainee, true);
  assert.deepEqual(scoreOf(out, trainee).score, { numerator: 0, denominator: 1, display: "0.00" });

  // Validation : la référence devient celle gelée dans le résultat, les scores ne changent pas.
  state = (await read());
  assert.equal(state.rounds.find((x: any) => x.id === round.id).status, "validated"); // automatique (PO 26/09)
  state = (await command("round.validate", { round_id: round.id })).state;
  const validated = state.rounds.find((x: any) => x.id === round.id);
  out = await body(concordance(chief));
  assert.equal(out.rounds[0].reference_source, "validated");
  assert.equal(out.rounds[0].reference_version, validated.result.reference_version);
  assert.deepEqual(scoreOf(out, judges[1]).score, { numerator: 675, denominator: 7, display: "96.43" });
  // Récapitulatif par juge sur la compétition : une manche comparée, 28 paires, chef absent.
  const summary = Object.fromEntries(out.judges.map((j: any) => [j.user_id, j]));
  assert.equal(summary[chiefId], undefined);
  assert.deepEqual([summary[judges[1]].rounds, summary[judges[1]].pairs, summary[judges[1]].mean.display], [1, 28, "96.43"]);
  assert.deepEqual([summary[judges[2]].rounds, summary[judges[2]].mean.display, summary[judges[2]].trainee], [1, "0.00", false]);
  assert.equal(summary[trainee].trainee, true);

  // Les bulletins des autres restent invisibles dans l'état d'un juge (confidentialité inchangée).
  const judgeState = await body(app.request("/api/v1/state", { headers: { cookie: clients[judges[0]] } }));
  assert.deepEqual(Object.keys(judgeState.rounds.find((x: any) => x.id === round.id).ballots), [judges[0]]);
});
