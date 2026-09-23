import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "./store";
import { Problem } from "./problem";

const memory = () => new Store({ url: ":memory:", clock: () => 1000 });

test("état initial créé, lecture et écriture versionnée", async () => {
  const store = memory();
  const s = await store.read();
  assert.equal(s.version, 0);
  assert.equal(s.status, "preparation");
  await store.transact(async (tx) => {
    const state = await store.read(tx);
    state.name = "Coupe";
    state.version += 1;
    await store.write(tx, state, 0);
  });
  assert.equal((await store.read()).name, "Coupe");
  // Une écriture fondée sur une version dépassée est refusée (409), rien n'est modifié.
  await assert.rejects(
    store.transact(async (tx) => {
      const state = await store.read(tx);
      state.name = "Perdu";
      state.version = 5;
      await store.write(tx, state, 0);
    }),
    (e: any) => e instanceof Problem && e.status === 409,
  );
  assert.equal((await store.read()).name, "Coupe");
});

test("comptes : hachage, doublon de code, chef unique, session et authentification", async () => {
  const store = memory();
  const chief = await store.transact((tx) => store.addUser(tx, "Chef", ["chief"], "abcd5678", true));
  assert.equal(chief.approved, true);
  await assert.rejects(store.transact((tx) => store.addUser(tx, "Autre", ["judge"], "abcd5678")), /déjà utilisé/);
  await assert.rejects(store.transact((tx) => store.addUser(tx, "Chef 2", ["chief"], "efgh1234")), /Un chef existe déjà/);
  await assert.rejects(store.transact((tx) => store.addUser(tx, "Dir", ["director", "judge"], "ijkl1234")), /directeur/);
  const rows = await store.execute("SELECT code_hash FROM users");
  assert.match(String(rows[0].code_hash), /^[0-9a-f]{32}:[0-9a-f]{64}$/);
  const token = await store.transact((tx) => store.newSession(tx, chief.id));
  const me = await store.authenticate(token);
  assert.equal(me.id, chief.id);
  await assert.rejects(store.authenticate("faux"), /Session expirée/);
  await assert.rejects(store.transact((tx) => store.addUser(tx, "Resp", ["responsable"], "court")), /au moins 8/);
  assert.equal((await store.userByCode("abcd5678"))?.id, chief.id);
  assert.equal(await store.userByCode("zzzz"), null);
  const judge = await store.transact((tx) => store.addUser(tx, "Juge", ["judge"], "mnop"));
  const t2 = await store.transact((tx) => store.newSession(tx, judge.id));
  await assert.rejects(store.authenticate(t2), /attend la validation/);
});

test("journal d'audit expurgé et limiteur de tentatives", async () => {
  const store = memory();
  const s = await store.read();
  await store.transact((tx) => store.record(tx, s, "u", "user.invite", { name: "X", code: "secret", roles: ["judge"] }));
  const audit = await store.execute("SELECT data FROM audit");
  assert.equal(String(audit[0].data).includes("secret"), false);
  for (let i = 0; i < 15; i++) await store.loginFailed("1.2.3.4");
  assert.equal(await store.loginAllowed("1.2.3.4"), false);
  assert.equal(await store.loginAllowed("5.6.7.8"), true);
  await store.loginSucceeded("1.2.3.4");
  assert.equal(await store.loginAllowed("1.2.3.4"), true);
});
