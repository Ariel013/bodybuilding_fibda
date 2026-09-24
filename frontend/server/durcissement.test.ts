// Relecture sécurité du 24/09/2026 : droits de la fiche d'inscription, refus du secrétariat sur la
// création de catégorie et l'inscription tardive, plafond des motifs libres, motifs d'absence masqués.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./app";
import { Store } from "./store";

const json = (b: any, h: Record<string, string> = {}) => ({ method: "POST", body: JSON.stringify(b), headers: { "content-type": "application/json", ...h } });
const cookieOf = (r: Response) => (r.headers.get("set-cookie") ?? "").split(";")[0];
const body = async (r: Response | Promise<Response>): Promise<any> => { const t = await (await r).text(); try { return JSON.parse(t); } catch { return t; } };

async function demo() {
  let now = 1000;
  const store = new Store({ url: ":memory:", demo: true, clock: () => now });
  const app = createApp({ store, setupToken: "jeton-test", testing: true });
  const seed = await body(app.request("/api/v1/demo", { method: "POST", headers: { "x-setup-token": "jeton-test" } }));
  const codes: Record<string, string> = {};
  for (const c of Object.values(seed.codes) as any[]) codes[c.roles[0]] = c.code;
  const login = async (code: string) => cookieOf(await app.request("/api/v1/auth/login", json({ code })));
  const chief = await login(codes.chief);
  let v = seed.state.version;
  const cmd = async (kind: string, payload: any, cookie = chief, id = kind + Math.random()) => {
    const r = await app.request("/api/v1/command", json({ id, version: v, type: kind, payload }, { cookie }));
    const out = await body(r);
    if (r.status === 200) v = out.state.version;
    return { status: r.status, out };
  };
  return { app, store, codes, login, chief, cmd, state: async (cookie = chief) => body(app.request("/api/v1/state", { headers: { cookie } })), tick: (s: number) => { now += s; } };
}

test("fiche d'inscription : préparation seulement, paramètre blank borné", async () => {
  const d = await demo();
  const sec = await d.cmd("user.invite", { name: "Secrétariat", roles: ["secretariat"], code: "secr0001" });
  assert.equal(sec.status, 200);
  const secretariat = await d.login("secr0001");
  const judge = await d.login(d.codes.judge);
  const regie = await d.login(d.codes.regie);
  assert.equal((await d.app.request("/api/v1/print/fiche", { headers: { cookie: secretariat } })).status, 200);
  assert.equal((await d.app.request("/api/v1/print/fiche", { headers: { cookie: judge } })).status, 403);
  assert.equal((await d.app.request("/api/v1/print/fiche", { headers: { cookie: regie } })).status, 403);
  assert.equal((await d.app.request("/api/v1/export/fiche?format=xlsx", { headers: { cookie: regie } })).status, 403);
  for (const b of ["0", "51", "abc"]) assert.equal((await d.app.request("/api/v1/print/fiche?blank=" + b, { headers: { cookie: d.chief } })).status, 422, b);
});

test("le secrétariat ne peut ni créer une catégorie ni une inscription tardive", async () => {
  const d = await demo();
  await d.cmd("user.invite", { name: "Secrétariat", roles: ["secretariat"], code: "secr0001" });
  const secretariat = await d.login("secr0001");
  const s = await d.state();
  const rule = s.rules_snapshot?.rules?.[0]?.id ?? "bikini-senior-all-158";
  const c = await d.cmd("category.save", { category: { rule_id: rule, section: "amateur" } }, secretariat);
  assert.equal(c.status, 403);
  const late = await d.cmd("entry.late", { person: { first_name: "A", last_name: "B", birth_date: "1996-01-01", sex: "F", section: "amateur", country: "CI", nationalities: ["CI"], height_cm: "160.0", weight_kg: "55.0", measurements_confirmed: true, status_approved: true, licence_ok: true, payment_ok: true }, category_id: s.categories[0].id, reason: "Retard" }, secretariat);
  assert.equal(late.status, 403);
});

test("un motif de plus de 500 caractères est refusé ; le motif d'une absence n'est pas visible d'un juge", async () => {
  const d = await demo();
  await d.cmd("event.update", { settings: { collective_tiebreak: "Décision motivée", regulations_checked: true, network_checked: true, backup_checked: true } });
  assert.equal((await d.cmd("programme.generate", {})).status, 200);
  assert.equal((await d.cmd("event.start", {})).status, 200);
  const s = await d.state();
  const r = s.rounds.find((x: any) => x.id === s.active_round_id);
  assert.ok(r, "manche ouverte");
  const long = await d.cmd("round.absent", { round_id: r.id, entry_id: r.participant_ids[0], reason: "x".repeat(501) });
  assert.equal(long.status, 422);
  assert.match(long.out.detail, /500/);
  const ok = await d.cmd("round.absent", { round_id: r.id, entry_id: r.participant_ids[0], reason: "Blessure à l'échauffement" });
  assert.equal(ok.status, 200, JSON.stringify(ok.out));
  const judge = await d.login(d.codes.judge);
  const sj = await d.state(judge);
  const rj = sj.rounds.find((x: any) => x.id === r.id);
  assert.equal(rj.absences.length, 1);
  assert.equal(rj.absences[0].reason, undefined);
  assert.equal(rj.absences[0].entry_id, r.participant_ids[0]);
  const sc = await d.state();
  assert.equal(sc.rounds.find((x: any) => x.id === r.id).absences[0].reason, "Blessure à l'échauffement");
});
