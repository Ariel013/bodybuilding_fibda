import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./app";
import { Store } from "./store";

// Parcours HTTP : configuration, connexion, état, commande idempotente, version optimiste, sauvegarde/restauration.
function make() {
  const store = new Store({ url: ":memory:", clock: () => 1000 });
  return { store, app: createApp({ store, setupToken: "jeton-test", testing: true }) };
}
const json = (body: any, headers: Record<string, string> = {}) => ({ method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
const cookieOf = (r: Response) => (r.headers.get("set-cookie") ?? "").split(";")[0];
// Lit le corps une seule fois : JSON si possible, texte sinon.
const body = async (r: Response | Promise<Response>): Promise<any> => { const t = await (await r).text(); try { return JSON.parse(t); } catch { return t; } };

test("setup exige le jeton, crée le chef, refuse un second chef", async () => {
  const { app } = make();
  let r = await app.request("/api/v1/health");
  assert.equal((await body(r)).setup_required, true);
  r = await app.request("/api/v1/auth/setup", json({ name: "Chef", code: "abcd1234" }));
  assert.equal(r.status, 403);
  r = await app.request("/api/v1/auth/setup", json({ name: "Chef", code: "abcd1234" }, { "x-setup-token": "jeton-test" }));
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie") ?? "", /HttpOnly/);
  assert.match(r.headers.get("set-cookie") ?? "", /SameSite=Strict/);
  r = await app.request("/api/v1/auth/setup", json({ name: "X", code: "zzzz9999" }, { "x-setup-token": "jeton-test" }));
  assert.equal(r.status, 409);
});

test("connexion, état filtré, commande idempotente et conflit de version", async () => {
  const { app } = make();
  await app.request("/api/v1/auth/setup", json({ name: "Chef", code: "abcd1234" }, { "x-setup-token": "jeton-test" }));
  let r = await app.request("/api/v1/auth/login", json({ code: "mauvais" }));
  assert.equal(r.status, 401);
  r = await app.request("/api/v1/auth/login", json({ code: "abcd1234" }));
  assert.equal(r.status, 200);
  const cookie = cookieOf(r);
  r = await app.request("/api/v1/state", { headers: { cookie } });
  const state = await body(r);
  assert.equal(state.version, 0);
  assert.equal(state.me.roles[0], "chief");
  const cmd = { id: "cmd-1", version: 0, type: "user.invite", payload: { name: "Juge A", roles: ["judge"], code: "juge0001" } };
  r = await app.request("/api/v1/command", json(cmd, { cookie }));
  const first = await body(r);
  assert.equal(r.status, 200, JSON.stringify(first));
  assert.equal(first.state.version, 1);
  assert.equal(first.result.user.roles[0], "judge");
  // Rejouer la même commande ne crée pas de second compte et renvoie le même résultat.
  r = await app.request("/api/v1/command", json(cmd, { cookie }));
  assert.equal(r.status, 200);
  assert.equal((await body(r)).result.user.id, first.result.user.id);
  const users = await body(app.request("/api/v1/state", { headers: { cookie } }));
  assert.equal(users.users.length, 2);
  // Même identifiant, autre contenu : refusé.
  r = await app.request("/api/v1/command", json({ ...cmd, payload: { ...cmd.payload, name: "Autre" } }, { cookie }));
  assert.equal(r.status, 409);
  // Version dépassée : refusé.
  r = await app.request("/api/v1/command", json({ id: "cmd-2", version: 0, type: "event.update", payload: { name: "Coupe" } }, { cookie }));
  assert.equal(r.status, 409);
  // Le code d'invitation n'est ni dans l'audit ni dans l'empreinte de commande.
  const audit = JSON.stringify(await body(app.request("/api/v1/audit", { headers: { cookie } })));
  assert.equal(audit.includes("juge0001"), false);
  // Le juge invité par le chef est approuvé et peut se connecter ; il ne voit que lui-même.
  r = await app.request("/api/v1/auth/login", json({ code: "juge0001" }));
  assert.equal(r.status, 200);
  const judge = await body(app.request("/api/v1/state", { headers: { cookie: cookieOf(r) } }));
  assert.equal(judge.users.length, 1);
  // Révocation : le juge désactivé perd sa session.
  const jc = cookieOf(r);
  r = await app.request("/api/v1/command", json({ id: "cmd-3", version: 1, type: "user.deactivate", payload: { user_id: first.result.user.id } }, { cookie }));
  assert.equal(r.status, 200, JSON.stringify(await body(r)));
  r = await app.request("/api/v1/state", { headers: { cookie: jc } });
  assert.equal(r.status, 401);
  r = await app.request("/api/v1/auth/login", json({ code: "juge0001" }));
  assert.equal(r.status, 401);
});

test("sauvegarde puis restauration sur un serveur vierge, archive altérée refusée", async () => {
  const a = make();
  await a.app.request("/api/v1/auth/setup", json({ name: "Chef", code: "abcd1234" }, { "x-setup-token": "jeton-test" }));
  const ca = cookieOf(await a.app.request("/api/v1/auth/login", json({ code: "abcd1234" })));
  await a.app.request("/api/v1/command", json({ id: "c1", version: 0, type: "event.update", payload: { name: "Coupe FIBDA" } }, { cookie: ca }));
  const archive = await (await a.app.request("/api/v1/backup", { method: "POST", headers: { cookie: ca } })).text();
  const b = make();
  await b.app.request("/api/v1/auth/setup", json({ name: "Chef B", code: "efgh5678" }, { "x-setup-token": "jeton-test" }));
  const cb = cookieOf(await b.app.request("/api/v1/auth/login", json({ code: "efgh5678" })));
  let r = await b.app.request("/api/v1/restore", { method: "POST", body: archive.replace("Coupe FIBDA", "Coupe XXXXX"), headers: { cookie: cb, "x-setup-token": "jeton-test" } });
  assert.equal(r.status, 422);
  assert.match((await body(r)).detail, /Empreinte/);
  // Chemin réel de l'écran Préparation : le fichier JSON est envoyé en multipart, champ « file ».
  const fd = new FormData();
  fd.append("file", new File([archive], "fibda-sauvegarde.json", { type: "application/json" }));
  r = await b.app.request("/api/v1/restore", { method: "POST", body: fd, headers: { cookie: cb, "x-setup-token": "jeton-test" } });
  const restored = await body(r);
  assert.equal(r.status, 200, JSON.stringify(restored));
  assert.equal(restored.relogin_required, true);
  r = await b.app.request("/api/v1/state", { headers: { cookie: cb } });
  assert.equal(r.status, 401);
  r = await b.app.request("/api/v1/auth/login", json({ code: "abcd1234" }));
  assert.equal(r.status, 200);
  const s = await body(b.app.request("/api/v1/state", { headers: { cookie: cookieOf(r) } }));
  assert.equal(s.name, "Coupe FIBDA");
});

test("écran public sans session, jamais de données privées", async () => {
  const { app } = make();
  const r = await app.request("/api/v1/public/main");
  assert.equal(r.status, 200);
  const pub = await body(r);
  // `club_logos` (24/09/2026) : nom de club → identifiant de photo, limité aux clubs affichés ; jamais de donnée personnelle.
  assert.deepEqual(Object.keys(pub).sort(), ["categories", "club_logos", "demo", "entries", "mode", "name", "officials", "people", "rounds", "scene", "version"]);
  assert.deepEqual(pub.club_logos, {});
  assert.equal((await app.request("/api/v1/public/regie")).status, 404);
  assert.equal((await app.request("/api/v1/state")).status, 401);
});

test("une erreur du moteur sportif ou de la préparation est rendue en 422 avec son message", async () => {
  const { app } = make();
  await app.request("/api/v1/auth/setup", json({ name: "Chef", code: "abcd1234" }, { "x-setup-token": "jeton-test" }));
  const cookie = cookieOf(await app.request("/api/v1/auth/login", json({ code: "abcd1234" })));
  // Jury vide : DomainError du moteur, pas une erreur serveur.
  let r = await app.request("/api/v1/command", json({ id: "j1", version: 0, type: "jury.configure", payload: {} }, { cookie }));
  assert.equal(r.status, 422);
  assert.match((await body(r)).detail, /Jury distinct de 5, 7, 9 ou 11/);
  // Date de naissance postérieure à l'événement : erreur de valeur de la préparation.
  r = await app.request("/api/v1/command", json({ id: "j2", version: 0, type: "person.save", payload: { person: { first_name: "A", last_name: "B", birth_date: "2099-01-01", sex: "M", section: "amateur" } } }, { cookie }));
  assert.notEqual(r.status, 500);
  assert.ok(typeof (await body(r)).detail === "string");
});
