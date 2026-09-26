import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./app";
import { Store } from "./store";
import { inspectImage, detectImage } from "./photos";
import { Problem } from "./problem";
import { loadCatalogue } from "../domain/catalogue";

// Photos en serverless : contrôle du fichier (photos.ts), routes /photos* (app.ts), écran public,
// sauvegarde et restauration avec photo. Mêmes attendus que backend/tests (photo_get, save_photo).

function make() {
  const store = new Store({ url: ":memory:", clock: () => 1000 });
  return { store, app: createApp({ store, setupToken: "jeton-test", testing: true }) };
}
const json = (body: any, headers: Record<string, string> = {}) => ({ method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
const cookieOf = (r: Response) => (r.headers.get("set-cookie") ?? "").split(";")[0];
const body = async (r: Response | Promise<Response>): Promise<any> => { const t = await (await r).text(); try { return JSON.parse(t); } catch { return t; } };

// PNG 1×1 réel (base64) ; JPEG réduit à son en-tête (SOI, SOF0 1×1, EOI) ; WEBP VP8L 1×1 (en-tête).
const PNG = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x02, 0x00, 0x03, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x1a, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c, 0x0d, 0, 0, 0, 0x2f, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
// PNG dont l'en-tête annonce 6000 × 5000 = 30 Mpx.
const PNG_HUGE = (() => { const b = new Uint8Array(PNG); b.set([0, 0, 0x17, 0x70], 16); b.set([0, 0, 0x13, 0x88], 20); return b; })();

async function setup() {
  const { app, store } = make();
  await app.request("/api/v1/auth/setup", json({ name: "Chef", code: "abcd1234" }, { "x-setup-token": "jeton-test" }));
  const cookie = cookieOf(await app.request("/api/v1/auth/login", json({ code: "abcd1234" })));
  const person = { id: "p1", first_name: "Jean", last_name: "Test", birth_date: "1990-01-01", sex: "M", section: "amateur", country: "CI", nationalities: ["CI"], height_cm: "170", weight_kg: "69", measurements_confirmed: true, status_approved: true, licence_ok: true, payment_ok: true };
  let r = await app.request("/api/v1/command", json({ id: "c1", version: 0, type: "person.save", payload: { person } }, { cookie }));
  assert.equal(r.status, 200, JSON.stringify(await body(r)));
  r = await app.request("/api/v1/command", json({ id: "c2", version: 1, type: "user.invite", payload: { name: "Juge", roles: ["judge"], code: "juge0001" } }, { cookie }));
  assert.equal(r.status, 200);
  // Catégorie, inscription confirmée et scène « catégorie » : l'écran public ne montre que les athlètes en scène.
  const rule = loadCatalogue().rules.find((x) => x.discipline === "bodybuilding" && x.division === "senior" && x.upper_inclusive === "70")!;
  r = await app.request("/api/v1/command", json({ id: "c3", version: 2, type: "category.save", payload: { category: { id: "cat1", rule_id: rule.id, section: "amateur" } } }, { cookie }));
  assert.equal(r.status, 200, JSON.stringify(await body(r)));
  r = await app.request("/api/v1/command", json({ id: "c4", version: 3, type: "entry.save", payload: { entry: { person_id: "p1", category_id: "cat1", confirmed: true } } }, { cookie }));
  assert.equal(r.status, 200, JSON.stringify(await body(r)));
  r = await app.request("/api/v1/command", json({ id: "c5", version: 4, type: "scene.set", payload: { screen: "main", scene: { kind: "category", category_id: "cat1" } } }, { cookie }));
  assert.equal(r.status, 200, JSON.stringify(await body(r)));
  const judge = cookieOf(await app.request("/api/v1/auth/login", json({ code: "juge0001" })));
  return { app, store, cookie, judge };
}

function upload(app: any, cookie: string, bytes: Uint8Array, name = "photo.jpg", fields: Record<string, string> = {}) {
  const fd = new FormData();
  fd.append("file", new File([bytes], name, { type: "image/jpeg" }));
  fd.append("owner_type", fields.owner_type ?? "person");
  fd.append("owner_id", fields.owner_id ?? "p1");
  fd.append("kind", fields.kind ?? "portrait");
  if (fields.crop) fd.append("crop", fields.crop);
  return app.request("/api/v1/photos", { method: "POST", body: fd, headers: { cookie } });
}

test("photos.ts : type par octets magiques, dimensions dans l'en-tête, refus au-delà de 25 Mpx", () => {
  assert.deepEqual(inspectImage(PNG), { mime: "image/png", width: 1, height: 1 });
  assert.deepEqual(inspectImage(JPEG), { mime: "image/jpeg", width: 3, height: 2 });
  assert.deepEqual(inspectImage(WEBP), { mime: "image/webp", width: 1, height: 1 });
  assert.equal(detectImage(new TextEncoder().encode("<html>")), null);
  assert.throws(() => inspectImage(new TextEncoder().encode("GIF89a....")), (e: any) => e instanceof Problem && e.status === 422);
  assert.throws(() => inspectImage(PNG_HUGE), (e: any) => e instanceof Problem && e.status === 422 && /dimensions/.test(e.message));
  assert.throws(() => inspectImage(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])), (e: any) => e instanceof Problem && /illisible/.test(e.message));
  assert.throws(() => inspectImage(new Uint8Array(1024 * 1024 + 1)), (e: any) => e instanceof Problem && e.status === 413);
});

test("upload JPEG valide : état mis à jour, non approuvé ; crop accepté et ignoré", async () => {
  const { app, cookie } = await setup();
  const r = await upload(app, cookie, JPEG, "photo.jpg", { crop: "[0,0,1,1]" });
  const out = await body(r);
  assert.equal(r.status, 200, JSON.stringify(out));
  assert.equal(typeof out.id, "string");
  assert.deepEqual([out.width, out.height], [3, 2]);
  const s = await body(app.request("/api/v1/state", { headers: { cookie } }));
  const p = s.people.find((x: any) => x.id === "p1");
  assert.equal(p.photo_portrait, out.id);
  assert.equal(p.photo_approved, false);
  assert.equal(p.photo_consent, false);
  assert.equal(s.version, 6);
  const audit = await body(app.request("/api/v1/audit", { headers: { cookie } }));
  assert.ok(audit.some((a: any) => a.action === "photo.upload" && a.data.photo_id === out.id));
  // Propriétaire inconnu ou type invalide.
  assert.equal((await upload(app, cookie, JPEG, "x.jpg", { owner_id: "inconnu" })).status, 404);
  assert.equal((await upload(app, cookie, JPEG, "x.jpg", { kind: "autre" })).status, 422);
});

test("contenu non image renommé .jpg → 422 ; plus de 1 Mo → 413 ; juge → 403", async () => {
  const { app, cookie, judge } = await setup();
  let r = await upload(app, cookie, new TextEncoder().encode("<script>alert(1)</script>"), "photo.jpg");
  assert.equal(r.status, 422);
  assert.match((await body(r)).detail, /JPEG, PNG ou WEBP/);
  const big = new Uint8Array(1024 * 1024 + 1);
  big.set(PNG);
  r = await upload(app, cookie, big, "grand.png");
  assert.equal(r.status, 413);
  r = await upload(app, cookie, PNG_HUGE, "immense.png");
  assert.equal(r.status, 422);
  r = await upload(app, cookie, PNG, "photo.png");
  assert.equal(r.status, 200);
  assert.equal((await upload(app, judge, PNG, "photo.png")).status, 403);
  assert.equal((await upload(app, "", PNG, "photo.png")).status, 401);
  assert.equal((await app.request("/api/v1/photos", { method: "POST", body: new FormData(), headers: { cookie } })).status, 422);
});

test("lecture : privée avant approbation, publique après, avec consentement obligatoire", async () => {
  const { app, cookie, judge } = await setup();
  const { id } = await body(upload(app, cookie, PNG, "photo.png"));
  // Sans session et avec une session de juge : refusé tant que non approuvée.
  assert.equal((await app.request("/api/v1/photos/" + id)).status, 401);
  assert.equal((await app.request("/api/v1/photos/" + id, { headers: { cookie: judge } })).status, 403);
  let r = await app.request("/api/v1/photos/" + id, { headers: { cookie } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "image/png");
  assert.equal(r.headers.get("cache-control"), "private, no-store");
  assert.equal(r.headers.get("content-disposition"), "inline");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await app.request("/api/v1/photos/inconnue", { headers: { cookie } })).status, 404);
  // Approbation : consentement explicite exigé, préparation seulement.
  r = await app.request("/api/v1/photos/" + id + "/approve", json({}, { cookie }));
  assert.equal(r.status, 422);
  r = await app.request("/api/v1/photos/" + id + "/approve", json({ consent: "oui" }, { cookie }));
  assert.equal(r.status, 422);
  assert.equal((await app.request("/api/v1/photos/" + id + "/approve", json({ consent: true }, { cookie: judge }))).status, 403);
  assert.equal((await app.request("/api/v1/photos/inconnue/approve", json({ consent: true }, { cookie }))).status, 404);
  // Écran public : aucune photo avant approbation.
  let pub = await body(app.request("/api/v1/public/main"));
  assert.equal(pub.people.find((x: any) => x.id === "p1").photo_portrait, undefined);
  r = await app.request("/api/v1/photos/" + id + "/approve", json({ consent: true }, { cookie }));
  assert.deepEqual(await body(r), { approved: true });
  const s = await body(app.request("/api/v1/state", { headers: { cookie } }));
  const p = s.people.find((x: any) => x.id === "p1");
  assert.equal(p.photo_approved, true);
  assert.equal(p.photo_consent, true);
  assert.deepEqual(p.approved_photo_ids, [id]);
  assert.equal(s.version, 7);
  r = await app.request("/api/v1/photos/" + id);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type") ?? "", /^image\//);
  assert.equal(r.headers.get("cache-control"), "private, max-age=300");
  assert.deepEqual(new Uint8Array(await r.arrayBuffer()), PNG);
  pub = await body(app.request("/api/v1/public/main"));
  assert.equal(pub.people.find((x: any) => x.id === "p1").photo_portrait, id);
  // Nouvelle photo : l'ancienne n'est plus courante et redevient privée, la nouvelle n'est pas approuvée.
  const second = (await body(upload(app, cookie, JPEG, "autre.jpg"))).id;
  assert.equal((await app.request("/api/v1/photos/" + id)).status, 401);
  assert.equal((await app.request("/api/v1/photos/" + second)).status, 401);
  pub = await body(app.request("/api/v1/public/main"));
  assert.equal(pub.people.find((x: any) => x.id === "p1").photo_portrait, undefined);
});

test("officiel : photo_id, approbation et écran public", async () => {
  const { app, cookie } = await setup();
  let r = await app.request("/api/v1/command", json({ id: "c6", version: 5, type: "official.save", payload: { official: { id: "o1", first_name: "Aya", last_name: "Koné", post: "Juge" } } }, { cookie }));
  assert.equal(r.status, 200, JSON.stringify(await body(r)));
  r = await app.request("/api/v1/command", json({ id: "c7", version: 6, type: "scene.set", payload: { screen: "main", scene: { kind: "official", official_id: "o1" } } }, { cookie }));
  assert.equal(r.status, 200, JSON.stringify(await body(r)));
  const { id } = await body(upload(app, cookie, PNG, "o.png", { owner_type: "official", owner_id: "o1" }));
  assert.equal((await app.request("/api/v1/photos/" + id)).status, 401);
  await app.request("/api/v1/photos/" + id + "/approve", json({ consent: true }, { cookie }));
  assert.equal((await app.request("/api/v1/photos/" + id)).status, 200);
  const pub = await body(app.request("/api/v1/public/main"));
  assert.equal(pub.officials.find((x: any) => x.id === "o1").photo_id, id);
});

test("import ZIP : 501 avec message explicite", async () => {
  const { app, cookie, judge } = await setup();
  const r = await app.request("/api/v1/photos/batch", { method: "POST", body: new FormData(), headers: { cookie } });
  assert.equal(r.status, 501);
  assert.equal((await body(r)).detail, "Import ZIP de photos indisponible sur cette version : ajouter les photos une par une.");
  assert.equal((await app.request("/api/v1/photos/batch", { method: "POST", body: new FormData(), headers: { cookie: judge } })).status, 403);
});

test("sauvegarde et restauration avec une photo approuvée ; sauvegarde sans photos → fiche remise à zéro", async () => {
  const a = await setup();
  const { id } = await body(upload(a.app, a.cookie, PNG, "photo.png"));
  await a.app.request("/api/v1/photos/" + id + "/approve", json({ consent: true }, { cookie: a.cookie }));
  const archive = await body(a.app.request("/api/v1/backup", { method: "POST", headers: { cookie: a.cookie } }));
  assert.equal(archive.photos_omitted, false);
  assert.equal(archive.photos.length, 1);
  assert.equal(archive.photos[0].data, Buffer.from(PNG).toString("base64"));
  assert.equal(archive.photos[0].approved, 1);
  const restoreInto = async (text: string) => {
    const b = make();
    await b.app.request("/api/v1/auth/setup", json({ name: "Chef B", code: "efgh5678" }, { "x-setup-token": "jeton-test" }));
    const cb = cookieOf(await b.app.request("/api/v1/auth/login", json({ code: "efgh5678" })));
    const r = await b.app.request("/api/v1/restore", { method: "POST", body: text, headers: { cookie: cb, "x-setup-token": "jeton-test" } });
    assert.equal(r.status, 200, JSON.stringify(await body(r)));
    const cookie = cookieOf(await b.app.request("/api/v1/auth/login", json({ code: "abcd1234" })));
    return { app: b.app, cookie };
  };
  // Restauration complète : la photo est de nouveau servie publiquement.
  const full = await restoreInto(JSON.stringify(archive));
  let r = await full.app.request("/api/v1/photos/" + id);
  assert.equal(r.status, 200);
  assert.deepEqual(new Uint8Array(await r.arrayBuffer()), PNG);
  let s = await body(full.app.request("/api/v1/state", { headers: { cookie: full.cookie } }));
  assert.equal(s.people[0].photo_portrait, id);
  assert.equal(s.people[0].photo_approved, true);
  // Sauvegarde allégée (photos omises) : plus de photo, plus d'approbation, état cohérent.
  const { sha256: _old, ...rest } = archive;
  const light: any = { ...rest, photos: [], photos_omitted: true };
  const { createHash } = await import("node:crypto");
  light.sha256 = createHash("sha256").update(JSON.stringify(light)).digest("hex");
  const partial = await restoreInto(JSON.stringify(light));
  assert.equal((await partial.app.request("/api/v1/photos/" + id, { headers: { cookie: partial.cookie } })).status, 404);
  s = await body(partial.app.request("/api/v1/state", { headers: { cookie: partial.cookie } }));
  assert.equal(s.people[0].photo_portrait, null);
  assert.equal(s.people[0].photo_approved, false);
  assert.deepEqual(s.people[0].approved_photo_ids, []);
  // Photo altérée dans l'archive : refusée avant toute écriture.
  const bad: any = { ...rest, photos: [{ ...archive.photos[0], data: Buffer.from("pas une image").toString("base64") }] };
  bad.sha256 = createHash("sha256").update(JSON.stringify(bad)).digest("hex");
  const b = make();
  await b.app.request("/api/v1/auth/setup", json({ name: "Chef B", code: "efgh5678" }, { "x-setup-token": "jeton-test" }));
  const cb = cookieOf(await b.app.request("/api/v1/auth/login", json({ code: "efgh5678" })));
  r = await b.app.request("/api/v1/restore", { method: "POST", body: JSON.stringify(bad), headers: { cookie: cb, "x-setup-token": "jeton-test" } });
  assert.equal(r.status, 422);
});

// Logo de club : owner_type « club », owner_id = nom exact du club (trim, 1 à 80 caractères),
// kind « logo » ; `club_logos[nom]` = logo courant, `club_logos_approved[nom]` = logo autorisé.
test("logo de club : club_logos renseigné, privé avant autorisation, public après, remplacement", async () => {
  const { app, cookie, judge } = await setup();
  const logo = (name: string, bytes = PNG) => upload(app, cookie, bytes, "logo.png", { owner_type: "club", owner_id: name, kind: "logo" });
  let r = await logo("  Club Abidjan  ");
  const out = await body(r);
  assert.equal(r.status, 200, JSON.stringify(out));
  let s = await body(app.request("/api/v1/state", { headers: { cookie } }));
  assert.deepEqual(s.club_logos, { "Club Abidjan": out.id });
  assert.deepEqual(s.club_logos_approved, {});
  assert.equal(s.version, 6);
  const audit = await body(app.request("/api/v1/audit", { headers: { cookie } }));
  assert.ok(audit.some((a: any) => a.action === "photo.upload" && a.data.photo_id === out.id && a.data.owner_id === "Club Abidjan"));
  // Privé : sans session 401, juge 403, préparation 200.
  assert.equal((await app.request("/api/v1/photos/" + out.id)).status, 401);
  assert.equal((await app.request("/api/v1/photos/" + out.id, { headers: { cookie: judge } })).status, 403);
  r = await app.request("/api/v1/photos/" + out.id, { headers: { cookie } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "private, no-store");
  // Autorisation d'usage : consentement explicite, préparation seulement.
  assert.equal((await app.request("/api/v1/photos/" + out.id + "/approve", json({}, { cookie }))).status, 422);
  assert.equal((await app.request("/api/v1/photos/" + out.id + "/approve", json({ consent: true }, { cookie: judge }))).status, 403);
  r = await app.request("/api/v1/photos/" + out.id + "/approve", json({ consent: true }, { cookie }));
  assert.deepEqual(await body(r), { approved: true });
  s = await body(app.request("/api/v1/state", { headers: { cookie } }));
  assert.deepEqual(s.club_logos_approved, { "Club Abidjan": out.id });
  assert.equal(s.version, 7);
  r = await app.request("/api/v1/photos/" + out.id);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "image/png");
  assert.equal(r.headers.get("cache-control"), "private, max-age=300");
  // Remplacement : le nouveau logo devient courant et n'est pas autorisé ; l'ancien redevient privé.
  const second = (await body(logo("Club Abidjan", JPEG))).id;
  s = await body(app.request("/api/v1/state", { headers: { cookie } }));
  assert.deepEqual(s.club_logos, { "Club Abidjan": second });
  assert.deepEqual(s.club_logos_approved, {});
  assert.equal((await app.request("/api/v1/photos/" + out.id)).status, 401);
  assert.equal((await app.request("/api/v1/photos/" + second)).status, 401);
  // L'ancien logo ne peut plus être autorisé : il n'est plus courant.
  assert.equal((await app.request("/api/v1/photos/" + out.id + "/approve", json({ consent: true }, { cookie }))).status, 409);
  // Un autre club a son propre logo, sans toucher au premier.
  const other = (await body(logo("Club Bouaké"))).id;
  s = await body(app.request("/api/v1/state", { headers: { cookie } }));
  assert.deepEqual(s.club_logos, { "Club Abidjan": second, "Club Bouaké": other });
});

test("logo de club : nom vide ou trop long → 422, type incohérent → 422, juge → 403", async () => {
  const { app, cookie, judge } = await setup();
  const logo = (fields: Record<string, string>, c = cookie) => upload(app, c, PNG, "logo.png", { owner_type: "club", kind: "logo", ...fields });
  let r = await logo({ owner_id: "   " });
  assert.equal(r.status, 422);
  assert.match((await body(r)).detail, /Nom du club obligatoire/);
  r = await logo({ owner_id: "x".repeat(81) });
  assert.equal(r.status, 422);
  assert.match((await body(r)).detail, /trop long/);
  assert.equal((await logo({ owner_id: "x".repeat(80) })).status, 200);
  // « logo » sans club, « portrait » pour un club : refusés.
  assert.equal((await logo({ owner_type: "person", owner_id: "p1" })).status, 422);
  assert.equal((await logo({ owner_id: "Club", kind: "portrait" })).status, 422);
  assert.equal((await logo({ owner_id: "Club" }, judge)).status, 403);
  assert.equal((await logo({ owner_id: "Club" }, "")).status, 401);
});

test("logo de club : sauvegarde et restauration ; sans photos, les logos sont retirés de l'état", async () => {
  const a = await setup();
  const { id } = await body(upload(a.app, a.cookie, PNG, "logo.png", { owner_type: "club", owner_id: "Club Abidjan", kind: "logo" }));
  await a.app.request("/api/v1/photos/" + id + "/approve", json({ consent: true }, { cookie: a.cookie }));
  const archive = await body(a.app.request("/api/v1/backup", { method: "POST", headers: { cookie: a.cookie } }));
  assert.equal(archive.photos.length, 1);
  assert.equal(archive.photos[0].owner_type, "club");
  const restoreInto = async (text: string) => {
    const b = make();
    await b.app.request("/api/v1/auth/setup", json({ name: "Chef B", code: "efgh5678" }, { "x-setup-token": "jeton-test" }));
    const cb = cookieOf(await b.app.request("/api/v1/auth/login", json({ code: "efgh5678" })));
    const r = await b.app.request("/api/v1/restore", { method: "POST", body: text, headers: { cookie: cb, "x-setup-token": "jeton-test" } });
    assert.equal(r.status, 200, JSON.stringify(await body(r)));
    const cookie = cookieOf(await b.app.request("/api/v1/auth/login", json({ code: "abcd1234" })));
    return { app: b.app, cookie };
  };
  const full = await restoreInto(JSON.stringify(archive));
  assert.equal((await full.app.request("/api/v1/photos/" + id)).status, 200);
  let s = await body(full.app.request("/api/v1/state", { headers: { cookie: full.cookie } }));
  assert.deepEqual(s.club_logos, { "Club Abidjan": id });
  assert.deepEqual(s.club_logos_approved, { "Club Abidjan": id });
  const { sha256: _old, ...rest } = archive;
  const light: any = { ...rest, photos: [], photos_omitted: true };
  const { createHash } = await import("node:crypto");
  light.sha256 = createHash("sha256").update(JSON.stringify(light)).digest("hex");
  const partial = await restoreInto(JSON.stringify(light));
  s = await body(partial.app.request("/api/v1/state", { headers: { cookie: partial.cookie } }));
  assert.deepEqual(s.club_logos, {});
  assert.deepEqual(s.club_logos_approved, {});
  // Archive avec un logo mal typé (kind « portrait » pour un club) : refusée.
  const bad: any = { ...rest, photos: [{ ...archive.photos[0], kind: "portrait" }] };
  bad.sha256 = createHash("sha256").update(JSON.stringify(bad)).digest("hex");
  const b = make();
  await b.app.request("/api/v1/auth/setup", json({ name: "Chef B", code: "efgh5678" }, { "x-setup-token": "jeton-test" }));
  const cb = cookieOf(await b.app.request("/api/v1/auth/login", json({ code: "efgh5678" })));
  assert.equal((await b.app.request("/api/v1/restore", { method: "POST", body: JSON.stringify(bad), headers: { cookie: cb, "x-setup-token": "jeton-test" } })).status, 422);
});

test("person.delete retire la photo de la base ; event.purge vide tout sauf les comptes et l'événement", async () => {
  const { app, store, cookie, judge } = await setup();
  const photo = await body(upload(app, cookie, JPEG));
  assert.equal((await store.execute("SELECT id FROM photos")).length, 1);
  let r = await app.request("/api/v1/command", json({ id: "d1", version: 6, type: "person.delete", payload: { person_ids: ["p1"] } }, { cookie: judge }));
  assert.equal(r.status, 403);
  r = await app.request("/api/v1/command", json({ id: "d2", version: 6, type: "person.delete", payload: { person_ids: ["p1"] } }, { cookie }));
  assert.equal(r.status, 200, JSON.stringify(await body(r)));
  assert.deepEqual(await store.execute("SELECT id FROM photos"), []);
  assert.equal((await app.request("/api/v1/photos/" + photo.id, { headers: { cookie } })).status, 404);
  let s = await body(app.request("/api/v1/state", { headers: { cookie } }));
  assert.deepEqual([s.people, s.entries, s.categories[0].entry_ids], [[], [], []]);
  // Vidage : chef seulement, confirmation exacte, comptes et identité de l'événement conservés.
  r = await app.request("/api/v1/command", json({ id: "e0", version: 7, type: "event.update", payload: { name: "Coupe FIBDA", location: "Abidjan" } }, { cookie }));
  assert.equal(r.status, 200);
  assert.equal((await upload(app, cookie, JPEG, "logo.jpg", { owner_type: "club", owner_id: "Club Test", kind: "logo" })).status, 200);
  assert.equal((await store.execute("SELECT id FROM photos")).length, 1);
  const version = (await body(app.request("/api/v1/state", { headers: { cookie } }))).version;
  r = await app.request("/api/v1/command", json({ id: "e1", version, type: "event.purge", payload: { confirm: "VIDER" } }, { cookie: judge }));
  assert.equal(r.status, 403);
  r = await app.request("/api/v1/command", json({ id: "e2", version, type: "event.purge", payload: { confirm: "vider" } }, { cookie }));
  assert.equal(r.status, 422);
  r = await app.request("/api/v1/command", json({ id: "e3", version, type: "event.purge", payload: { confirm: "VIDER" } }, { cookie }));
  const out = await body(r);
  assert.equal(r.status, 200, JSON.stringify(out));
  assert.deepEqual(out.result, { athletes_effaces: 0, categories_effacees: 1, manches_effacees: 0 });
  s = await body(app.request("/api/v1/state", { headers: { cookie } }));
  assert.equal(s.version, version + 1);
  assert.deepEqual(s.club_logos ?? {}, {});
  assert.deepEqual([s.name, s.location, s.status], ["Coupe FIBDA", "Abidjan", "preparation"]);
  assert.deepEqual([s.people, s.categories, s.rounds, s.officials], [[], [], [], []]);
  assert.equal(s.users.length, 2);
  assert.deepEqual(await store.execute("SELECT id FROM photos"), []);
  // La session du juge survit : les comptes ne sont pas touchés.
  assert.equal((await app.request("/api/v1/state", { headers: { cookie: judge } })).status, 200);
});

test("user.delete et official.delete : chef seulement ; compte ayant siégé refusé ; photo d'officiel effacée", async () => {
  const { app, store, cookie, judge } = await setup();
  let s = await body(app.request("/api/v1/state", { headers: { cookie } }));
  const judgeId = s.users.find((u: any) => u.roles.includes("judge")).id;
  const chiefId = s.me.id;
  const cmd = async (id: string, type: string, payload: any, c = cookie) => {
    const v = (await body(app.request("/api/v1/state", { headers: { cookie } }))).version;
    return app.request("/api/v1/command", json({ id, version: v, type, payload }, { cookie: c }));
  };
  // Officiel avec photo.
  let r = await cmd("o1", "official.save", { official: { id: "off1", first_name: "Ali", last_name: "Koné", post: "Président" } });
  assert.equal(r.status, 200, await r.text());
  assert.equal((await upload(app, cookie, JPEG, "p.jpg", { owner_type: "official", owner_id: "off1", kind: "portrait" })).status, 200);
  assert.equal((await store.execute("SELECT id FROM photos WHERE owner_type = 'official'")).length, 1);
  assert.equal((await cmd("o2", "official.delete", { official_id: "off1" }, judge)).status, 403);
  r = await cmd("o3", "official.delete", { official_id: "off1" });
  assert.equal(r.status, 200, await r.text());
  assert.deepEqual(await store.execute("SELECT id FROM photos WHERE owner_type = 'official'"), []);
  s = await body(app.request("/api/v1/state", { headers: { cookie } }));
  assert.deepEqual(s.officials, []);
  // Compte : le juge ne peut pas, le chef ne peut pas se supprimer, un compte vierge se supprime et perd sa session.
  assert.equal((await cmd("u1", "user.delete", { user_id: chiefId }, judge)).status, 403);
  assert.equal((await cmd("u2", "user.delete", { user_id: chiefId })).status, 422);
  r = await cmd("u3", "user.delete", { user_id: judgeId });
  assert.equal(r.status, 200, await r.text());
  assert.equal((await app.request("/api/v1/state", { headers: { cookie: judge } })).status, 401);
  s = await body(app.request("/api/v1/state", { headers: { cookie } }));
  assert.equal(s.users.length, 1);
  // Compte ayant siégé : refusé.
  r = await cmd("u4", "user.invite", { name: "Juge B", roles: ["judge"], code: "juge0002" });
  const jb = (await body(r)).result.user.id;
  // Modification : nom et fonctions, nouveau code (ancien code refusé), rôle chef intouchable.
  r = await cmd("m1", "user.update", { user_id: jb, name: "Juge Bé", roles: ["judge", "speaker"], code: "juge0003" });
  const updated = await body(r);
  assert.equal(r.status, 200, JSON.stringify(updated));
  assert.deepEqual(updated.result.user.roles, ["judge", "speaker"]);
  assert.equal((await app.request("/api/v1/auth/login", json({ code: "juge0002" }))).status, 401);
  assert.equal((await app.request("/api/v1/auth/login", json({ code: "juge0003" }))).status, 200);
  assert.equal((await cmd("m2", "user.update", { user_id: jb, roles: ["chief"] })).status, 422);
  assert.equal((await cmd("m3", "user.update", { user_id: jb, name: "X" }, judge)).status, 401);
  s = await body(app.request("/api/v1/state", { headers: { cookie } }));
  s.rounds = [];
  await store.transact(async (tx: any) => {
    const st = await store.read(tx);
    st.rounds = [{ id: "r", category_id: "cat1", phase: "final", status: "pending", panel: [jb], trainees: [], ballots: {} }];
    await store.write(tx, st, st.version);
  });
  r = await cmd("u5", "user.delete", { user_id: jb });
  assert.equal(r.status, 422);
  assert.match(await r.text(), /siégé/);
});
