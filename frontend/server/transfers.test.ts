import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./app";
import { Store } from "./store";
import { Problem } from "./problem";
import { previewImport, parseCsv, detectDelimiter } from "./transfers";
import { loadCatalogue } from "../domain/catalogue";

// Portage des tests d'import de backend/tests/test_operations.py (preview_import) et
// backend/tests/test_http_operations.py (routes /imports/preview et /imports/commit).
// Le XLSX n'est pas porté : aucune bibliothèque npm propre à l'audit, la route répond 415.

const enc = (s: string) => new TextEncoder().encode(s);
const HEAD = "first_name,last_name,birth_date,sex,section,country,nationalities\n";

test("preview CSV : ligne valide avec séparateur point-virgule, mesures normalisées", () => {
  const valid = previewImport(enc("first_name;last_name;sex;height_cm;birth_date;section;country;nationalities\nAnne;Dupont;F;165;1990-01-01;amateur;CI;CI\n"), "people.csv");
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.rows[0].height_cm, "165");
  assert.deepEqual(valid.rows[0].nationalities, ["CI"]);
  const weight = previewImport(enc(HEAD.replace("\n", ",weight_kg\n") + "Anne,Dupont,1990-01-01,F,amateur,CI,CI|FR,70.5\n"), "people.csv");
  assert.deepEqual(weight.errors, []);
  assert.equal(weight.rows[0].weight_kg, "70.5");
  assert.deepEqual(weight.rows[0].nationalities, ["CI", "FR"]);
});

test("preview CSV : formule =HYPERLINK refusée, sexe invalide, entêtes manquantes", () => {
  const invalid = previewImport(enc("first_name,last_name,sex\n=HYPERLINK(1),X,Z\n"), "people.csv");
  assert.ok(invalid.errors.some((e) => e.message.includes("Formule")));
  assert.ok(invalid.errors.some((e) => e.message.includes("Sexe")));
  assert.ok(invalid.errors.some((e) => e.row === 1 && e.message.startsWith("Entêtes uniques obligatoires")));
  // Les autres préfixes exécutables, même après des espaces, sont refusés ; la valeur reste telle quelle.
  for (const prefix of ["+1", "-1", "@SUM", " =1+1"]) {
    const r = previewImport(enc(HEAD + `${prefix},Nom,1990-01-01,M,amateur,CI,CI\n`), "x.csv");
    assert.ok(r.errors.some((e) => e.row === 2 && e.message === "Formule ou préfixe exécutable refusé"), prefix);
    assert.equal(r.rows[0].first_name, prefix.trim());
  }
  // Colonne inconnue et entête dupliquée.
  const unknown = previewImport(enc(HEAD.replace("\n", ",email\n") + "A,B,1990-01-01,M,amateur,CI,CI,a@b\n"), "x.csv");
  assert.ok(unknown.errors.some((e) => e.message === "Colonnes inconnues : email"));
  const dup = previewImport(enc("first_name,first_name,last_name,birth_date,sex,section,country,nationalities\nA,A,B,1990-01-01,M,amateur,CI,CI\n"), "x.csv");
  assert.ok(dup.errors.some((e) => e.message.startsWith("Entêtes uniques obligatoires")));
});

test("preview CSV : contrôles ligne à ligne (date, pays, nombres, colonnes, identité répétée, lignes vides)", () => {
  const r = previewImport(
    enc(
      HEAD.replace("\n", ",height_cm\n") +
        "A,B,01/01/1990,X,elite,ci,,abc\n" + // date, sexe, section, pays, nombre
        "\n" +
        "A,B,1990-01-01,M,amateur,CI,CI,170,extra\n" + // colonnes en trop
        "a,b,1990-01-01,M,amateur,CI,CI,170\n" + // identité répétée (casse ignorée)
        ",,,,,,,\n", // ligne sans contenu : ignorée
    ),
    "x.csv",
  );
  const messages = (row: number) => r.errors.filter((e) => e.row === row).map((e) => e.message);
  assert.deepEqual(messages(2), ["Sexe attendu M ou F", "Section attendue amateur ou pro", "height_cm doit être un nombre positif", "Date attendue AAAA-MM-JJ", "Pays et nationalités obligatoires : codes de deux lettres majuscules ; séparer les nationalités par |"]);
  assert.deepEqual(messages(4), ["Nombre de colonnes incohérent"]);
  assert.deepEqual(r.warnings, [{ row: 5, message: "Identité répétée : vérifier avant import" }]);
  assert.equal(r.rows.length, 3);
  const missing = previewImport(enc(HEAD + "A,B,,M,amateur,CI,CI\n"), "x.csv");
  assert.ok(missing.errors.some((e) => e.message === "Date de naissance obligatoire"));
  assert.ok(previewImport(enc(HEAD + "A,B,1990-02-30,M,amateur,CI,CI\n"), "x.csv").errors.some((e) => e.message === "Date attendue AAAA-MM-JJ"));
});

test("preview : fichier vide, format inconnu, XLSX indisponible (415), 10 001 lignes refusées, 4 Mo refusés", () => {
  assert.deepEqual(previewImport(enc(""), "x.csv"), { rows: [], errors: [{ row: 1, message: "Fichier vide" }], warnings: [] });
  assert.throws(() => previewImport(enc("a"), "x.txt"), (e: any) => e instanceof Problem && e.status === 422 && e.message === "Formats acceptés : CSV UTF-8 et XLSX");
  assert.throws(() => previewImport(enc("PK"), "athletes.xlsx"), (e: any) => e instanceof Problem && e.status === 415 && e.message === "Format XLSX indisponible : convertir en CSV");
  const line = "A,B,1990-01-01,M,amateur,CI,CI\n";
  assert.doesNotThrow(() => previewImport(enc(HEAD + line.repeat(10000)), "x.csv"));
  assert.throws(() => previewImport(enc(HEAD + line.repeat(10001)), "x.csv"), (e: any) => e instanceof Problem && e.message === "Maximum 10000 lignes");
  assert.throws(() => previewImport(new Uint8Array(4 * 1024 * 1024 + 1), "x.csv"), (e: any) => e instanceof Problem && e.message === "Fichier trop volumineux");
  assert.throws(() => previewImport(new Uint8Array([0xff, 0xfe, 0x41]), "x.csv"), (e: any) => e instanceof Problem && e.message.includes("UTF-8"));
});

test("parseur CSV : BOM, CRLF, guillemets, tabulation, lignes mal formées", () => {
  const rows = parseCsv("﻿a;b\r\n\"x;y\";\"il a dit \"\"non\"\"\"\r\n1;2\n");
  assert.deepEqual(rows, [["a", "b"], ["x;y", 'il a dit "non"'], ["1", "2"]]);
  assert.equal(detectDelimiter("a\tb\tc\n1;2"), "\t");
  assert.equal(detectDelimiter('"a;b",c\n'), ",");
  assert.deepEqual(parseCsv('"multi\nligne",z\n'), [["multi\nligne", "z"]]);
  assert.throws(() => parseCsv('a,b\n"ouvert,c\n'), (e: any) => e instanceof Problem && e.message === "Ligne 2 mal formée : guillemets incorrects");
  assert.throws(() => parseCsv('a,b\nx"y,c\n'), (e: any) => e instanceof Problem && /Ligne 2 mal formée/.test(e.message));
  assert.throws(() => parseCsv('a,b\n"x"y,c\n'), (e: any) => e instanceof Problem && /Ligne 2 mal formée/.test(e.message));
  // Le BOM ne pollue pas la première entête : il serait sinon une « colonne inconnue ».
  assert.deepEqual(previewImport(enc("﻿" + HEAD + "A,B,1990-01-01,M,amateur,CI,CI\n"), "x.csv").errors, []);
});

// --- Parcours HTTP ----------------------------------------------------------------------------

function make(clock: () => number = () => 1000) {
  const store = new Store({ url: ":memory:", clock });
  return { store, app: createApp({ store, setupToken: "jeton-test", testing: true }) };
}
const json = (body: any, headers: Record<string, string> = {}) => ({ method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
const cookieOf = (r: Response) => (r.headers.get("set-cookie") ?? "").split(";")[0];
const body = async (r: Response | Promise<Response>): Promise<any> => { const t = await (await r).text(); try { return JSON.parse(t); } catch { return t; } };
const upload = (name: string, content: string, cookie: string) => {
  const fd = new FormData();
  fd.append("file", new File([content], name, { type: "text/csv" }));
  return { method: "POST", body: fd, headers: { cookie } };
};
async function chief(app: ReturnType<typeof createApp>): Promise<string> {
  const r = await app.request("/api/v1/auth/setup", json({ name: "Chef", code: "abcd1234" }, { "x-setup-token": "jeton-test" }));
  assert.equal(r.status, 200);
  return cookieOf(r);
}

test("HTTP : aperçu puis import, aperçu consommé, erreurs bloquantes, état modifié entre-temps (409)", async () => {
  const { app, store } = make();
  const cookie = await chief(app);
  let r = await app.request("/api/v1/imports/preview", upload("people.csv", HEAD + "Test,Personne,1990-01-01,M,amateur,CI,CI\n", cookie));
  const preview = await body(r);
  assert.equal(r.status, 200, JSON.stringify(preview));
  assert.ok(preview.preview_id && preview.rows.length === 1 && preview.errors.length === 0);
  assert.equal((await store.read()).people.length, 0);
  r = await app.request("/api/v1/imports/commit", json({ preview_id: preview.preview_id }, { cookie }));
  assert.deepEqual(await body(r), { count: 1 });
  // Personnes présentes dans /api/v1/state, version incrémentée, audit tracé.
  const state = await body(app.request("/api/v1/state", { headers: { cookie } }));
  assert.equal(state.people.length, 1);
  assert.equal(state.people[0].first_name, "Test");
  assert.deepEqual(state.people[0].nationalities, ["CI"]);
  assert.equal(state.version, 1);
  const audit = await body(app.request("/api/v1/audit", { headers: { cookie } }));
  assert.ok(audit.some((a: any) => a.action === "import.commit" && a.data.count === 1));
  // Un aperçu déjà appliqué ne se rejoue pas.
  r = await app.request("/api/v1/imports/commit", json({ preview_id: preview.preview_id }, { cookie }));
  assert.equal(r.status, 422);
  assert.equal((await body(r)).detail, "Aperçu expiré ou inconnu.");
  // Aperçu avec erreurs : jamais applicable.
  const bad = await body(app.request("/api/v1/imports/preview", upload("bad.csv", "first_name,last_name\n=1+1,Nom\n", cookie)));
  assert.ok(bad.errors.length);
  r = await app.request("/api/v1/imports/commit", json({ preview_id: bad.preview_id }, { cookie }));
  assert.equal(r.status, 422);
  assert.equal((await body(r)).detail, "Corrigez les erreurs avant import.");
  // État modifié après l'aperçu : refus 409.
  const next = await body(app.request("/api/v1/imports/preview", upload("good.csv", HEAD + "Autre,Nom,1990-01-01,M,amateur,CI,CI\n", cookie)));
  const person = { first_name: "Manuel", last_name: "Saisi", birth_date: "1991-05-05", sex: "M", section: "amateur", country: "CI", nationalities: ["CI"] };
  r = await app.request("/api/v1/command", json({ id: "cmd-1", version: 1, type: "person.save", payload: { person } }, { cookie }));
  assert.equal(r.status, 200, await r.text());
  r = await app.request("/api/v1/imports/commit", json({ preview_id: next.preview_id }, { cookie }));
  assert.equal(r.status, 409);
  assert.equal((await body(r)).detail, "Refaites l’aperçu après les modifications récentes.");
  // Identifiant absent ou inconnu.
  assert.equal((await app.request("/api/v1/imports/commit", json({}, { cookie }))).status, 422);
  assert.equal((await app.request("/api/v1/imports/commit", json({ preview_id: "inconnu" }, { cookie }))).status, 422);
});

test("HTTP : un juge n'importe pas (403), fichier absent ou XLSX refusés", async () => {
  const { app } = make();
  const cookie = await chief(app);
  let r = await app.request("/api/v1/command", json({ id: "cmd-1", version: 0, type: "user.invite", payload: { name: "Juge A", roles: ["judge"], code: "juge0001" } }, { cookie }));
  assert.equal(r.status, 200, await r.text());
  r = await app.request("/api/v1/auth/login", json({ code: "juge0001" }));
  const judge = cookieOf(r);
  r = await app.request("/api/v1/imports/preview", upload("a.csv", "first_name,last_name\nA,B\n", judge));
  assert.equal(r.status, 403);
  r = await app.request("/api/v1/imports/commit", json({ preview_id: "x" }, { cookie: judge }));
  assert.equal(r.status, 403);
  // Sans session : 401.
  r = await app.request("/api/v1/imports/preview", upload("a.csv", "first_name,last_name\nA,B\n", ""));
  assert.equal(r.status, 401);
  // Multipart sans champ file.
  const fd = new FormData();
  fd.append("autre", "x");
  r = await app.request("/api/v1/imports/preview", { method: "POST", body: fd, headers: { cookie } });
  assert.equal(r.status, 422);
  r = await app.request("/api/v1/imports/preview", upload("test.xlsx", "PK", cookie));
  assert.equal(r.status, 415);
  assert.equal((await body(r)).detail, "Format XLSX indisponible : convertir en CSV");
});

test("HTTP : aperçu expiré après une heure, purge des aperçus anciens, aperçu d'un autre utilisateur refusé", async () => {
  let now = 1000;
  const { app, store } = make(() => now);
  const cookie = await chief(app);
  const old = await body(app.request("/api/v1/imports/preview", upload("a.csv", HEAD + "A,B,1990-01-01,M,amateur,CI,CI\n", cookie)));
  now += 3601;
  let r = await app.request("/api/v1/imports/commit", json({ preview_id: old.preview_id }, { cookie }));
  assert.equal(r.status, 422);
  assert.equal((await body(r)).detail, "Aperçu expiré ou inconnu.");
  // Un nouvel aperçu purge ceux de plus d'une heure.
  const fresh = await body(app.request("/api/v1/imports/preview", upload("b.csv", HEAD + "C,D,1990-01-01,F,pro,CI,CI\n", cookie)));
  const ids = (await store.execute("SELECT id FROM import_previews")).map((x: any) => x.id);
  assert.deepEqual(ids, [fresh.preview_id]);
  // Le secrétariat a le droit d'importer, mais pas d'appliquer l'aperçu d'un autre compte.
  r = await app.request("/api/v1/command", json({ id: "cmd-1", version: 0, type: "user.invite", payload: { name: "Secr", roles: ["secretariat"], code: "secr0001" } }, { cookie }));
  assert.equal(r.status, 200, await r.text());
  const secretariat = cookieOf(await app.request("/api/v1/auth/login", json({ code: "secr0001" })));
  r = await app.request("/api/v1/imports/commit", json({ preview_id: fresh.preview_id }, { cookie: secretariat }));
  assert.equal(r.status, 422);
  r = await app.request("/api/v1/imports/preview", upload("c.csv", HEAD + "E,F,1990-01-01,F,pro,CI,CI\n", secretariat));
  assert.equal(r.status, 200);
});

test("HTTP : import avec category_id crée l'inscription non confirmée", async () => {
  const { app } = make();
  const cookie = await chief(app);
  const rule = loadCatalogue().rules.find((r) => r.discipline === "bodybuilding" && r.division === "senior" && r.upper_inclusive === "70")!;
  let r = await app.request("/api/v1/command", json({ id: "cmd-1", version: 0, type: "category.save", payload: { category: { rule_id: rule.id, section: "amateur" } } }, { cookie }));
  const created = await body(r);
  assert.equal(r.status, 200, JSON.stringify(created));
  const category = created.result;
  const csv = "first_name,last_name,birth_date,sex,section,country,nationalities,category_id\n" + `Importé,Test,1995-01-01,${category.sex},amateur,CI,CI,${category.id}\n`;
  const preview = await body(app.request("/api/v1/imports/preview", upload("d.csv", csv, cookie)));
  assert.deepEqual(preview.errors, [], JSON.stringify(preview));
  // La ligne d'aperçu conserve category_id ; la personne enregistrée ne le porte pas.
  assert.equal(preview.rows[0].category_id, category.id);
  r = await app.request("/api/v1/imports/commit", json({ preview_id: preview.preview_id }, { cookie }));
  assert.equal(r.status, 200, await r.text());
  const state = await body(app.request("/api/v1/state", { headers: { cookie } }));
  const person = state.people.find((p: any) => p.first_name === "Importé");
  assert.ok(person);
  assert.equal(person.category_id, undefined);
  assert.equal(state.entries.length, 1);
  assert.equal(state.entries[0].person_id, person.id);
  assert.equal(state.entries[0].category_id, category.id);
  assert.equal(state.entries[0].confirmed, false);
  // Catégorie inconnue : l'import entier est refusé, aucune personne créée.
  const bad = await body(app.request("/api/v1/imports/preview", upload("e.csv", csv.replace(category.id, "inconnue").replace("Importé", "Autre"), cookie)));
  r = await app.request("/api/v1/imports/commit", json({ preview_id: bad.preview_id }, { cookie }));
  assert.equal(r.status, 404);
  assert.equal((await body(app.request("/api/v1/state", { headers: { cookie } }))).people.length, 1);
});
