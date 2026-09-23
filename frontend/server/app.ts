import { Hono, type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createHash, timingSafeEqual } from "node:crypto";
import { ADMIN, PREPARATION, require, intersects, union } from "./auth";
import { Problem, DomainError } from "./problem";
import { Store } from "./store";
import type { User } from "./state";
import { dump, find, uid } from "./util";
import { applyCommand } from "./commands";
import { projectState, publicState, exams, collective, syncCollectiveRewards } from "./projections";
import { tick } from "./workflow";
import { loadCatalogue, eligibility } from "../domain/catalogue";
import { seedDemo } from "./demo";
import { previewImport, savePreview, commitPreview, MAX_FILE as MAX_IMPORT } from "./transfers";
import { KINDS, renderPrint, exportDocument, type Filters } from "./printing";
import { inspectImage, photoHeaders, MAX_PHOTO, OWNER_TYPES, KINDS as PHOTO_KINDS } from "./photos";

// Routes HTTP : même contrat que backend/fibda/app.py (docs/CONTRACT.md), sans WebSocket ; photos en base.
export const VERSION = "0.2.0";
export const COOKIE = "fibda_session";
const MAX_BODY = 20 * 1024 * 1024;
// Au-delà, la réponse de sauvegarde dépasserait la limite Vercel (4,5 Mo) : les photos en sont retirées.
const MAX_BACKUP = 4 * 1024 * 1024;

// Un BLOB libSQL revient en ArrayBuffer (client HTTP) ou en Buffer (client natif).
const blobBytes = (v: unknown): Uint8Array<ArrayBuffer> => {
  const source = v instanceof ArrayBuffer ? new Uint8Array(v) : v instanceof Uint8Array ? v : new Uint8Array(0);
  const copy = new Uint8Array(source.length);
  copy.set(source);
  return copy;
};

// Retire des fiches toute référence à une photo absente de la base, avec son approbation.
function reconcilePhotos(state: any, present: Set<string>): void {
  for (const owner of [...(state.people ?? []), ...(state.officials ?? [])]) {
    let missing = false;
    for (const k of ["photo_portrait", "photo_full", "photo_id"]) {
      if (owner[k] && !present.has(owner[k])) {
        owner[k] = null;
        missing = true;
      }
    }
    if (missing) {
      owner.photo_approved = false;
      owner.approved_photo_ids = [];
    } else if (Array.isArray(owner.approved_photo_ids)) owner.approved_photo_ids = owner.approved_photo_ids.filter((id: string) => present.has(id));
  }
}

export type AppOptions = {
  store: Store;
  // Jeton secret exigé pour la configuration initiale, la restauration et la démonstration :
  // en serverless il n'existe pas de « boucle locale », ce jeton en tient lieu.
  setupToken?: string;
  testing?: boolean;
};

export function createApp(opts: AppOptions) {
  const { store } = opts;
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof Problem) return c.json({ detail: err.message }, err.status as any);
    // Erreurs métier du moteur (domain/domain.ts a sa propre classe DomainError) et erreurs de
    // valeur de la préparation (équivalent ValueError → 422 côté Python) : message rendu au client.
    if (err instanceof DomainError || (err as any)?.name === "DomainError" || (err as any)?.name === "PyValueError") return c.json({ detail: err.message }, 422);
    if (!opts.testing) console.error(err);
    return c.json({ detail: "Erreur serveur." }, 500);
  });
  app.notFound((c) => c.json({ detail: "Route inconnue." }, 404));

  app.use("*", async (c, next) => {
    const origin = c.req.header("origin");
    if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method) && origin) {
      const parsed = new URL(origin);
      if (parsed.host !== c.req.header("host") || parsed.protocol.replace(":", "") !== scheme(c)) return c.json({ detail: "Origine de commande refusée." }, 403);
    }
    const length = Number(c.req.header("content-length") ?? 0);
    if (length > MAX_BODY + 1024 * 1024) return c.json({ detail: "Requête trop volumineuse." }, 413);
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "same-origin");
    c.header("X-Frame-Options", "SAMEORIGIN");
    // Les photos approuvées posent leur propre politique de cache (photos.ts) ; tout le reste : jamais en cache.
    if (!c.res.headers.has("Cache-Control")) c.header("Cache-Control", "no-store");
    c.header("Content-Security-Policy", "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
  });

  const scheme = (c: Context) => c.req.header("x-forwarded-proto") ?? new URL(c.req.url).protocol.replace(":", "");
  const address = (c: Context) => (c.req.header("x-forwarded-for") ?? "local").split(",")[0].trim();
  const actor = (c: Context) => store.authenticate(getCookie(c, COOKIE));
  const view = async (state: any, u: User) => projectState(state, u, await store.allUsers(), store.clock());
  const setSession = (c: Context, token: string) => setCookie(c, COOKIE, token, { httpOnly: true, secure: scheme(c) === "https", sameSite: "Strict", maxAge: 16 * 3600, path: "/" });
  const requireSetupToken = (c: Context) => {
    // Comparaison en temps constant sur les empreintes ; aucune porte ouverte si le jeton n'est pas configuré.
    const given = c.req.header("x-setup-token") ?? "";
    const digest = (s: string) => createHash("sha256").update(s).digest();
    if (!opts.setupToken || !timingSafeEqual(digest(given), digest(opts.setupToken))) throw new Problem("Cette opération exige le jeton de configuration du serveur.", 403);
  };

  // Transitions temporisées (délai stagiaires) : exécutées à la demande, il n'y a pas de boucle serveur.
  async function tickOnce(): Promise<void> {
    await store.transact(async (tx) => {
      const state = await store.read(tx);
      const users = await store.allUsers(tx);
      const before = state.version;
      if (tick(state, users, store.clock())) {
        state.version += 1;
        await store.write(tx, state, before);
        await store.record(tx, state, "server", "timer.transition", {});
      }
    });
  }

  app.get("/api/v1/health", async (c) => {
    const state = await store.read();
    return c.json({ status: "ok", version: VERSION, setup_required: (await store.allUsers()).length === 0, demo: state.demo, restore_id: state.restore_id, runtime: "serverless" });
  });

  app.post("/api/v1/auth/setup", async (c) => {
    requireSetupToken(c);
    const p = await c.req.json();
    const [u, token] = await store.transact(async (tx) => {
      if ((await store.allUsers(tx)).length) throw new Problem("Le chef est déjà configuré.", 409);
      const u = await store.addUser(tx, p.name ?? "", ["chief"], p.code ?? "", true);
      const token = await store.newSession(tx, u.id);
      await store.record(tx, await store.read(tx), u.id, "auth.setup", {});
      return [u, token] as const;
    });
    setSession(c, token);
    return c.json({ user: u, event_id: (await store.read()).id });
  });

  app.post("/api/v1/auth/login", async (c) => {
    const p = await c.req.json();
    const code = p.code ?? "";
    const addr = address(c);
    if (!(await store.loginAllowed(addr))) throw new Problem("Trop de tentatives. Réessayez dans quelques minutes.", 429);
    if (typeof code !== "string" || code.length > 128) throw new Problem("Code incorrect.", 401);
    // Le hachage se fait hors transaction : un essai n'immobilise jamais les autres écritures.
    const row = await store.userByCode(code);
    if (!row) {
      await store.loginFailed(addr);
      throw new Problem("Code incorrect.", 401);
    }
    if (!row.approved) {
      await store.loginFailed(addr);
      throw new Problem("Accès en attente de validation du chef.", 403);
    }
    const token = await store.transact((tx) => store.newSession(tx, row.id));
    await store.loginSucceeded(addr);
    setSession(c, token);
    return c.json({ user: { id: row.id, name: row.name, roles: JSON.parse(row.roles), approved: true, active: true }, event_id: (await store.read()).id });
  });

  app.post("/api/v1/auth/logout", async (c) => {
    const token = getCookie(c, COOKIE);
    if (token) await store.deleteSession(token);
    deleteCookie(c, COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  app.get("/api/v1/auth/me", async (c) => c.json({ user: await actor(c), event_id: (await store.read()).id }));

  app.get("/api/v1/state", async (c) => {
    const u = await actor(c);
    await tickOnce();
    return c.json(await view(await store.read(), u));
  });

  app.get("/api/v1/catalogue", async (c) => {
    await actor(c);
    return c.json(loadCatalogue());
  });

  app.get("/api/v1/eligibility/:person_id", async (c) => {
    require(await actor(c), PREPARATION);
    const s = await store.read();
    return c.json({ proposals: eligibility(find(s.people, c.req.param("person_id"), "Personne"), Number(s.date.slice(0, 4))) });
  });

  app.post("/api/v1/command", async (c) => {
    const u = await actor(c);
    const p = await c.req.json();
    if (!p || typeof p !== "object" || typeof p.id !== "string" || !p.id || p.id.length > 100 || !Number.isInteger(p.version) || !p.payload || typeof p.payload !== "object") throw new Problem("Commande, version et paramètres requis.");
    const kind: string = p.type ?? "";
    // Empreinte d'idempotence : le code personnel d'un user.invite n'y entre jamais (sinon il serait retrouvable hors ligne).
    const fingerprinted = kind === "user.invite" ? { ...p.payload, code: undefined } : p.payload;
    const fingerprint = createHash("sha256").update(dump({ type: kind, payload: fingerprinted })).digest("hex");
    await tickOnce();
    const [s, result] = await store.transact(async (tx) => {
      const prior = (await tx.execute({ sql: "SELECT user_id, fingerprint, result FROM commands WHERE id = ?", args: [p.id] })).rows[0];
      const s = await store.read(tx);
      if (prior) {
        if (prior.user_id !== u.id || prior.fingerprint !== fingerprint) throw new Problem("Identifiant de commande déjà utilisé pour une autre action.", 409);
        return [s, JSON.parse(String(prior.result))] as const;
      }
      // Les votes concurrents portent une liste figée par tour : une mise à jour sans rapport ne bloque pas leur réception.
      if (s.version !== p.version && kind !== "ballot.submit") throw new Problem("Les données ont changé. Rechargez avant de confirmer votre action.", 409);
      const before = s.version;
      let result: any;
      try {
        result = (await applyCommand(store, tx, s, u, kind, p.payload)) ?? {};
      } catch (e: any) {
        if (e instanceof TypeError) throw new Problem("Paramètres incomplets ou invalides : " + e.message);
        throw e;
      }
      syncCollectiveRewards(s);
      s.version += 1;
      await store.write(tx, s, before);
      await store.record(tx, s, u.id, kind, p.payload);
      await tx.execute({ sql: "INSERT INTO commands (id, user_id, fingerprint, result, version) VALUES (?, ?, ?, ?, ?)", args: [p.id, u.id, fingerprint, dump(result), s.version] });
      return [s, result] as const;
    });
    return c.json({ state: await view(s, u), result });
  });

  app.get("/api/v1/public/:screen", async (c) => c.json(publicState(await store.read(), c.req.param("screen"))));

  app.get("/api/v1/speaker", async (c) => {
    const u = await actor(c);
    require(u, union(ADMIN, ["speaker", "regie"]));
    return c.json(await view(await store.read(), u));
  });
  app.get("/api/v1/exams", async (c) => c.json(exams(await store.read(), await actor(c))));
  app.get("/api/v1/collective", async (c) => {
    require(await actor(c), union(ADMIN, ["regie", "speaker"]));
    return c.json(collective(await store.read()));
  });
  app.get("/api/v1/audit", async (c) => {
    require(await actor(c), ADMIN);
    const rows = await store.execute("SELECT id, user_id, action, at, data FROM audit ORDER BY at");
    return c.json(rows.map((r) => ({ id: r.id, user_id: r.user_id, action: r.action, at: r.at, data: JSON.parse(String(r.data)) })));
  });

  // Sauvegarde : export JSON des tables (état, comptes hachés, commandes, audit). Contient des données personnelles.
  app.post("/api/v1/backup", async (c) => {
    require(await actor(c), ADMIN);
    const tables = ["events", "users", "commands", "audit"];
    const out: any = { format: "fibda-backup-json-1", version: VERSION, created_at: store.clock() };
    for (const t of tables) out[t] = await store.execute(`SELECT * FROM ${t}`);
    // Photos : BLOB encodé en base64. Au-delà de ~4 Mo (limite de réponse Vercel : 4,5 Mo), les
    // photos sont omises et la sauvegarde le dit ; la restauration remet alors les fiches sans photo.
    out.photos = (await store.execute("SELECT * FROM photos")).map((r) => ({ ...r, data: Buffer.from(blobBytes(r.data)).toString("base64") }));
    out.photos_omitted = false;
    if (dump(out).length > MAX_BACKUP) {
      out.photos = [];
      out.photos_omitted = true;
    }
    const body = dump(out);
    out.sha256 = createHash("sha256").update(body).digest("hex");
    c.header("Content-Disposition", 'attachment; filename="fibda-sauvegarde.json"');
    return c.body(dump(out), 200, { "Content-Type": "application/json" });
  });

  // Restauration : chef ou directeur, jeton de configuration, archive contrôlée, sessions et commandes purgées.
  app.post("/api/v1/restore", async (c) => {
    const u = await actor(c);
    require(u, ["chief", "director"]);
    requireSetupToken(c);
    // L'écran envoie le fichier en multipart (champ « file ») ; curl peut envoyer le JSON brut.
    let body: string;
    if ((c.req.header("content-type") ?? "").startsWith("multipart/form-data")) {
      const form = await c.req.parseBody();
      const file = form["file"];
      if (!(file instanceof File)) throw new Problem("Fichier de sauvegarde requis.");
      if (file.size > MAX_BODY) throw new Problem("Fichier trop volumineux.", 413);
      body = await file.text();
    } else body = await c.req.text();
    let archive: any;
    try {
      archive = JSON.parse(body);
    } catch {
      throw new Problem("Archive illisible.");
    }
    if (archive?.format !== "fibda-backup-json-1" || !Array.isArray(archive.events) || archive.events.length !== 1 || typeof archive.events[0]?.data !== "string" || !Array.isArray(archive.users)) throw new Problem("Archive FIBDA attendue.");
    // Photos (facultatives, sauvegardes antérieures ou allégées) : chaque fichier est recontrôlé comme à l'envoi.
    const photos: any[] = archive.photos === undefined ? [] : archive.photos;
    if (!Array.isArray(photos)) throw new Problem("Archive FIBDA attendue.");
    const photoRows = photos.map((r) => {
      if (!r || typeof r.id !== "string" || typeof r.owner_id !== "string" || !OWNER_TYPES.has(r.owner_type) || !PHOTO_KINDS.has(r.kind) || typeof r.data !== "string") throw new Problem("Archive FIBDA attendue : photo mal formée.");
      const bytes = new Uint8Array(Buffer.from(r.data, "base64"));
      const info = inspectImage(bytes);
      return { id: r.id, owner_id: r.owner_id, owner_type: r.owner_type, kind: r.kind, approved: r.approved ? 1 : 0, consent: r.consent ? 1 : 0, mime: info.mime, size: bytes.length, data: bytes, created_at: Number(r.created_at) || store.clock() };
    });
    const { sha256, ...rest } = archive;
    if (createHash("sha256").update(dump(rest)).digest("hex") !== sha256) throw new Problem("Empreinte incorrecte : archive altérée.");
    let raw: any;
    try {
      raw = JSON.parse(archive.events[0].data);
    } catch {
      throw new Problem("Archive FIBDA attendue.");
    }
    if (Boolean(raw.demo) !== store.demo) throw new Problem("Une sauvegarde de démonstration ne remplace pas une compétition officielle, et inversement.");
    const restoreId = await store.transact(async (tx) => {
      const before = await store.read(tx);
      // L'état antérieur est conservé dans l'audit, jamais écrasé sans trace.
      await store.record(tx, before, u.id, "restore.previous_state", { previous: before });
      for (const t of ["events", "users", "sessions", "commands", "audit", "import_previews", "photos"]) await tx.execute(`DELETE FROM ${t}`);
      for (const r of photoRows) await tx.execute({ sql: "INSERT INTO photos (id, owner_id, owner_type, kind, approved, consent, mime, size, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", args: [r.id, r.owner_id, r.owner_type, r.kind, r.approved, r.consent, r.mime, r.size, r.data, r.created_at] });
      // État cohérent : une fiche dont la photo manque (sauvegarde allégée) perd sa référence et son approbation.
      reconcilePhotos(raw, new Set(photoRows.map((r) => r.id)));
      raw.restore_id = uid();
      raw.version += 1;
      await tx.execute({ sql: "INSERT INTO events (id, version, data) VALUES (?, ?, ?)", args: [raw.id, raw.version, dump(raw)] });
      for (const r of archive.users) await tx.execute({ sql: "INSERT INTO users (id, name, roles, approved, active, code_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [r.id, r.name, r.roles, r.approved, r.active, r.code_hash, r.created_at] });
      for (const r of archive.audit ?? []) await tx.execute({ sql: "INSERT INTO audit (id, event_id, user_id, action, at, data) VALUES (?, ?, ?, ?, ?, ?)", args: [r.id, r.event_id, r.user_id, r.action, r.at, r.data] });
      await store.record(tx, raw, u.id, "restore", {});
      return raw.restore_id;
    });
    return c.json({ restore_id: restoreId, relogin_required: true });
  });

  // Démonstration : peuplement fictif, jeton de configuration exigé, base de démonstration uniquement.
  app.post("/api/v1/demo", async (c) => {
    requireSetupToken(c);
    if (!store.demo) throw new Problem("Ce serveur utilise les données officielles.", 403);
    const [codes, chief, token] = await store.transact(async (tx) => {
      const s = await store.read(tx);
      const codes = await seedDemo(store, tx, s);
      const chief = (await store.allUsers(tx)).find((u) => u.roles.includes("chief"))!;
      const token = await store.newSession(tx, chief.id);
      return [codes, chief, token] as const;
    });
    setSession(c, token);
    return c.json({ codes, state: await view(await store.read(), chief) });
  });

  // Documents imprimables et exports : habilitations copiées de `printable` (backend/fibda/app.py:333-350).
  // Les documents privés (blank, ballot, recap, results) : direction sans restriction ; un juge ou
  // stagiaire ne voit que ses propres bulletins (judge_id forcé à lui-même, tours où il siège), jamais
  // les résultats. Les examens : direction ou commission ; sinon rapport personnel uniquement.
  // Tout le reste (inscriptions, programme, mesures, récompenses, diplômes, officiels) : préparation, régie, speaker.
  async function printable(c: Context, kind: string): Promise<[any, Filters]> {
    const u = await actor(c);
    const s = await store.read();
    const roles = new Set(u.roles);
    let judgeId: string | null = c.req.query("judge_id") || null;
    const filters: Filters = { category_id: c.req.query("category_id") || null, round_id: c.req.query("round_id") || null, judge_id: judgeId };
    const isPrivate = ["blank", "ballot", "recap", "results"].includes(kind);
    if (isPrivate) {
      if (!intersects(roles, ADMIN)) {
        require(u, ["judge", "trainee"]); // app.py:338
        if (judgeId && judgeId !== u.id) throw new Problem("Seuls vos bulletins sont accessibles.", 403); // app.py:339
        judgeId = u.id; // app.py:340 : jamais le bulletin d'un autre juge
        if (kind === "results") throw new Problem("Document réservé à la direction.", 403); // app.py:341
        s.rounds = s.rounds.filter((r: any) => [...(r.panel ?? []), ...(r.trainees ?? [])].includes(u.id)); // app.py:342
      }
    } else if (kind === "exams") {
      if (!intersects(roles, union(ADMIN, ["commission"]))) {
        require(u, ["judge", "trainee"]); // app.py:345
        if (judgeId && judgeId !== u.id) throw new Problem("Rapport personnel uniquement.", 403); // app.py:346
        judgeId = u.id; // app.py:347
      }
    } else require(u, union(PREPARATION, ["regie", "speaker"])); // app.py:348
    // Les droits sont vérifiés avant de reconnaître le document : un juge n'apprend pas quels noms existent.
    if (!KINDS.has(kind)) throw new Problem("Document inconnu");
    // app.py:349 : noms des comptes pour libeller les juges, rapports d'examen filtrés, horodatage.
    s.users = await store.allUsers();
    s.exam_reports = exams(s, u).reports;
    s.printed_at = store.clock();
    filters.judge_id = judgeId;
    return [s, filters];
  }

  app.get("/api/v1/print/:kind", async (c) => {
    const kind = c.req.param("kind");
    const [s, filters] = await printable(c, kind);
    return c.html(renderPrint(s, kind, filters));
  });

  app.get("/api/v1/export/:kind", async (c) => {
    const kind = c.req.param("kind");
    const format = c.req.query("format") ?? "pdf"; // même défaut que le Python (app.py:357)
    const [s, filters] = await printable(c, kind);
    // Hors périmètre de cette version : pas de reportlab ni d'openpyxl en serverless.
    if (format === "xlsx" || format === "pdf") return c.json({ detail: "Format non disponible sur cette version : utiliser csv ou l'impression HTML." }, 501);
    const { data, mime, name } = exportDocument(s, kind, format, filters);
    c.header("Content-Disposition", 'attachment; filename="' + name + '"');
    return c.body(data, 200, { "Content-Type": mime });
  });

  // Imports d'inscriptions : aperçu contrôlé (CSV ; XLSX répond 415, voir transfers.ts) conservé en
  // base une heure, puis application par les commandes de préparation. Réservé à la préparation.
  app.post("/api/v1/imports/preview", async (c) => {
    const u = await actor(c);
    require(u, PREPARATION);
    const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
    const file = (form as Record<string, unknown>).file;
    if (!(file instanceof File)) throw new Problem("Fichier requis (champ « file »).");
    if (file.size > MAX_IMPORT) throw new Problem("Fichier trop volumineux.", 413);
    const preview = previewImport(new Uint8Array(await file.arrayBuffer()), file.name ?? "");
    const previewId = await savePreview(store, u.id, preview);
    return c.json({ preview_id: previewId, ...preview });
  });

  app.post("/api/v1/imports/commit", async (c) => {
    const u = await actor(c);
    require(u, PREPARATION);
    const p = await c.req.json().catch(() => ({}));
    return c.json({ count: await commitPreview(store, u, p?.preview_id) });
  });

  // Photos : même contrat et même mutation d'état que backend/fibda/app.py (save_photo, photo_approve,
  // photo_get). Le fichier est contrôlé (photos.ts) et conservé tel quel en base.
  app.post("/api/v1/photos", async (c) => {
    const u = await actor(c);
    require(u, PREPARATION);
    const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
    const file = form["file"];
    const ownerType = String(form["owner_type"] ?? "");
    const ownerId = String(form["owner_id"] ?? "");
    const kind = String(form["kind"] ?? "");
    // Le champ « crop » du contrat est accepté mais ignoré : le recadrage se fait dans le navigateur.
    if (!(file instanceof File)) throw new Problem("Fichier requis (champ « file »).");
    if (file.size > MAX_PHOTO) throw new Problem("Photo trop volumineuse : 1 Mo au maximum après réduction par le navigateur.", 413);
    if (!OWNER_TYPES.has(ownerType) || !PHOTO_KINDS.has(kind)) throw new Problem("Type de photo invalide.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const info = inspectImage(bytes);
    const photoId = await store.transact(async (tx) => {
      const s = await store.read(tx);
      const owner = find(ownerType === "person" ? s.people : s.officials, ownerId, "Personne");
      const ident = uid();
      await tx.execute({
        sql: "INSERT INTO photos (id, owner_id, owner_type, kind, approved, consent, mime, size, data, created_at) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?)",
        args: [ident, ownerId, ownerType, kind, info.mime, bytes.length, bytes, store.clock()],
      });
      owner[ownerType === "official" ? "photo_id" : "photo_" + kind] = ident;
      owner.photo_approved = false;
      owner.photo_consent = false;
      const before = s.version;
      s.version += 1;
      await store.write(tx, s, before);
      await store.record(tx, s, u.id, "photo.upload", { photo_id: ident, owner_id: ownerId, kind, mime: info.mime, width: info.width, height: info.height });
      return ident;
    });
    return c.json({ id: photoId, width: info.width, height: info.height });
  });

  app.post("/api/v1/photos/batch", async (c) => {
    require(await actor(c), PREPARATION);
    return c.json({ detail: "Import ZIP de photos indisponible sur cette version : ajouter les photos une par une." }, 501);
  });

  app.post("/api/v1/photos/:photo_id/approve", async (c) => {
    const u = await actor(c);
    require(u, PREPARATION);
    const p = await c.req.json().catch(() => ({}));
    if (p?.consent !== true) throw new Problem("Autorisation de diffusion obligatoire.");
    const photoId = c.req.param("photo_id");
    await store.transact(async (tx) => {
      const row = (await tx.execute({ sql: "SELECT owner_id, owner_type FROM photos WHERE id = ?", args: [photoId] })).rows[0];
      if (!row) throw new Problem("Photo inconnue.", 404);
      const s = await store.read(tx);
      const owner = find(row.owner_type === "person" ? s.people : s.officials, String(row.owner_id), "Personne");
      owner.photo_approved = true;
      owner.photo_consent = true;
      owner.approved_photo_ids = [...new Set([...(owner.approved_photo_ids ?? []), photoId])];
      await tx.execute({ sql: "UPDATE photos SET approved = 1, consent = 1 WHERE id = ?", args: [photoId] });
      const before = s.version;
      s.version += 1;
      await store.write(tx, s, before);
      await store.record(tx, s, u.id, "photo.approve", { photo_id: photoId });
    });
    return c.json({ approved: true });
  });

  // Servie sans session uniquement si approuvée, consentie, listée dans approved_photo_ids du
  // propriétaire et encore sa photo courante ; sinon, session de préparation exigée.
  app.get("/api/v1/photos/:photo_id", async (c) => {
    const photoId = c.req.param("photo_id");
    const row = (await store.execute("SELECT * FROM photos WHERE id = ?", [photoId]))[0];
    if (!row) throw new Problem("Photo inconnue.", 404);
    const s = await store.read();
    const owner = (row.owner_type === "person" ? s.people : s.officials).find((x: any) => x.id === row.owner_id);
    const current = Boolean(owner) && [owner.photo_portrait, owner.photo_full, owner.photo_id].includes(photoId);
    const isPublic = Boolean(row.approved && row.consent && owner && owner.photo_consent && owner.photo_approved && (owner.approved_photo_ids ?? []).includes(photoId) && current);
    if (!isPublic) require(await actor(c), PREPARATION);
    return c.body(blobBytes(row.data), 200, photoHeaders(String(row.mime), isPublic));
  });

  app.get("/api/v1/ws", (c) => c.json({ detail: "Pas de WebSocket en serverless : interrogation périodique." }, 404));

  return app;
}
