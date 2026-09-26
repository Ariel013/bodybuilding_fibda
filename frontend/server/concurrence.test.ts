import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "./app";
import { Store } from "./store";
import { TRANSACTIONAL } from "./commands";

// Route /api/v1/command en écriture optimiste (26/09/2026) : une lecture, une écriture atomique
// conditionnée à la version lue, relecture et rejeu si un autre appareil a écrit entre les deux.
// L'entrelacement est simulé en interceptant `store.commit` : pendant qu'une commande est entre
// sa lecture et son écriture, une autre commande complète s'exécute.

const json = (body: any, headers: Record<string, string> = {}) => ({ method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
const cookieOf = (r: Response) => (r.headers.get("set-cookie") ?? "").split(";")[0];
const body = async (r: Response | Promise<Response>): Promise<any> => { const t = await (await r).text(); try { return JSON.parse(t); } catch { return t; } };

// Démonstration jusqu'au premier tour ouvert : chef, juges connectés, tour actif et classement figé.
async function openRound() {
  let now = 1000;
  const store = new Store({ url: ":memory:", demo: true, clock: () => now });
  const app = createApp({ store, setupToken: "jeton-test", testing: true });
  let r = await app.request("/api/v1/demo", { method: "POST", headers: { "x-setup-token": "jeton-test" } });
  const seeded = await body(r);
  assert.equal(r.status, 200, JSON.stringify(seeded));
  const chief = cookieOf(r);
  // Le chef siège aussi dans le panel : son cookie compte parmi les juges connectés.
  const judges: Record<string, string> = { [seeded.state.me.id]: chief };
  for (const [id, access] of Object.entries<any>(seeded.codes)) {
    if (access.roles.includes("judge")) judges[id] = cookieOf(await app.request("/api/v1/auth/login", json({ code: access.code })));
  }
  const read = async (cookie = chief): Promise<any> => body(app.request("/api/v1/state", { headers: { cookie } }));
  const command = async (kind: string, payload: any = {}, cookie = chief, id = randomUUID()) => {
    const r = await app.request("/api/v1/command", json({ id, version: (await read()).version, type: kind, payload }, { cookie }));
    return { status: r.status, body: await body(r) };
  };
  for (const [kind, payload] of [
    ["event.update", { settings: { collective_tiebreak: "Décision motivée chef et directeur après égalité des places" } }],
    ["programme.generate", {}],
    ["event.start", {}],
  ] as const) {
    const out = await command(kind, payload);
    assert.equal(out.status, 200, JSON.stringify(out.body));
  }
  const s = await read();
  const round = s.rounds.find((x: any) => x.id === s.active_round_id);
  assert.ok(round, "aucun tour actif");
  return { app, store, chief, judges, read, command, round, restore_id: s.restore_id, advance: (seconds: number) => (now += seconds) };
}

// Pendant l'écriture de `first`, `during` s'exécute entièrement ; puis l'écriture initiale reprend.
function interleave(store: Store, during: () => Promise<unknown>) {
  const original = store.commit.bind(store);
  let calls = 0;
  store.commit = async (...args: Parameters<Store["commit"]>) => {
    calls += 1;
    if (calls === 1) await during();
    return original(...args);
  };
  return () => calls;
}

test("deux bulletins envoyés au même instant sont tous deux reçus, le second rejoué sur l'état à jour", async () => {
  const t = await openRound();
  const [a, b] = Object.keys(t.judges).filter((j) => t.round.panel.includes(j));
  const ranking = [...t.round.participant_ids];
  const payload = { round_id: t.round.id, restore_id: t.restore_id, ranking };
  const version = (await t.read()).version;
  const calls = interleave(t.store, async () => {
    const r = await t.app.request("/api/v1/command", json({ id: "bulletin-b", version, type: "ballot.submit", payload }, { cookie: t.judges[b] }));
    assert.equal(r.status, 200, await r.text());
  });
  const r = await t.app.request("/api/v1/command", json({ id: "bulletin-a", version, type: "ballot.submit", payload }, { cookie: t.judges[a] }));
  const out = await body(r);
  assert.equal(r.status, 200, JSON.stringify(out));
  // Trois écritures : celle de B (pendant), celle de A refusée (version dépassée), celle de A rejouée.
  assert.equal(calls(), 3);
  assert.equal(out.state.version, version + 2);
  const round = (await t.read()).rounds.find((x: any) => x.id === t.round.id);
  assert.deepEqual(Object.keys(round.ballots).sort(), [a, b].sort());
  // Journal des commandes et audit : une ligne chacun par bulletin, aucune ligne orpheline de l'essai refusé.
  const commands = await t.store.execute("SELECT id FROM commands WHERE id IN ('bulletin-a', 'bulletin-b') ORDER BY id");
  assert.deepEqual(commands.map((x) => x.id), ["bulletin-a", "bulletin-b"]);
  const audits = await t.store.execute("SELECT COUNT(*) AS n FROM audit WHERE action = 'ballot.submit'");
  assert.equal(Number(audits[0].n), 2);
});

test("une commande ordinaire dont la version est dépassée pendant l'écriture est refusée (409), sans rien écrire", async () => {
  const t = await openRound();
  const version = (await t.read()).version;
  const auditBefore = Number((await t.store.execute("SELECT COUNT(*) AS n FROM audit"))[0].n);
  interleave(t.store, async () => {
    const r = await t.app.request("/api/v1/command", json({ id: "autre", version, type: "event.update", payload: { name: "Coupe A" } }, { cookie: t.chief }));
    assert.equal(r.status, 200, await r.text());
  });
  const r = await t.app.request("/api/v1/command", json({ id: "perdant", version, type: "event.update", payload: { name: "Coupe B" } }, { cookie: t.chief }));
  assert.equal(r.status, 409);
  const s = await t.read();
  assert.equal(s.name, "Coupe A");
  assert.equal(s.version, version + 1);
  assert.equal((await t.store.execute("SELECT id FROM commands WHERE id = 'perdant'")).length, 0);
  assert.equal(Number((await t.store.execute("SELECT COUNT(*) AS n FROM audit"))[0].n), auditBefore + 1);
});

test("le même bulletin rejoué au même instant (double clic, deux onglets) n'est reçu qu'une fois et renvoie le même accusé", async () => {
  const t = await openRound();
  const judge = Object.keys(t.judges).find((j) => t.round.panel.includes(j))!;
  const cmd = { id: "double", version: (await t.read()).version, type: "ballot.submit", payload: { round_id: t.round.id, restore_id: t.restore_id, ranking: [...t.round.participant_ids] } };
  let inner: any;
  interleave(t.store, async () => {
    const r = await t.app.request("/api/v1/command", json(cmd, { cookie: t.judges[judge] }));
    inner = await body(r);
    assert.equal(r.status, 200, JSON.stringify(inner));
  });
  const r = await t.app.request("/api/v1/command", json(cmd, { cookie: t.judges[judge] }));
  const out = await body(r);
  assert.equal(r.status, 200, JSON.stringify(out));
  assert.deepEqual(out.result, inner.result);
  assert.equal(out.state.version, inner.state.version);
  assert.equal((await t.store.execute("SELECT id FROM commands WHERE id = 'double'")).length, 1);
  assert.equal(Number((await t.store.execute("SELECT COUNT(*) AS n FROM audit WHERE action = 'ballot.submit'"))[0].n), 1);
});

test("la transition temporisée est écrite en base par GET /state et jamais renvoyée sans l'être", async () => {
  const t = await openRound();
  const panel = t.round.panel.filter((j: string) => j in t.judges);
  assert.equal(panel.length, t.round.panel.length, "tous les officiels du tour sont connectés");
  for (const j of panel) {
    const out = await t.command("ballot.submit", { round_id: t.round.id, restore_id: t.restore_id, ranking: [...t.round.participant_ids] }, t.judges[j]);
    assert.equal(out.status, 200, JSON.stringify(out.body));
  }
  // Dernier officiel reçu : le délai stagiaire s'arme ; passé 60 s, le tour attend la validation.
  t.advance(120);
  const seen = (await t.read()).rounds.find((x: any) => x.id === t.round.id);
  assert.equal(seen.status, "awaiting_validation");
  const stored = JSON.parse(String((await t.store.execute("SELECT data FROM events"))[0].data)).rounds.find((x: any) => x.id === t.round.id);
  assert.equal(stored.status, "awaiting_validation");
  assert.equal(Number((await t.store.execute("SELECT COUNT(*) AS n FROM audit WHERE action = 'timer.transition'"))[0].n), 1);
});

test("une commande classée « état seul » qui écrirait ailleurs est arrêtée, jamais écrite hors lot", async () => {
  // Les commandes qui touchent comptes, sessions ou photos sont listées ; toute autre commande
  // reçoit une connexion qui refuse d'exécuter du SQL (garde-fou contre un oubli).
  assert.deepEqual([...TRANSACTIONAL].sort(), ["event.purge", "person.delete", "user.approve", "user.deactivate", "user.invite"]);
  const t = await openRound();
  // user.invite passe par la transaction explicite : le compte est créé et visible dans l'état renvoyé.
  const out = await t.command("user.invite", { name: "Nouveau", roles: ["speaker"], code: "speak001" });
  assert.equal(out.status, 200, JSON.stringify(out.body));
  assert.ok(out.body.state.users.some((u: any) => u.name === "Nouveau"));
});
