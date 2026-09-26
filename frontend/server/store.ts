import { createClient as createWebClient, type Client, type Transaction, type InValue, type InStatement, type ResultSet } from "@libsql/client/web";
import { Problem } from "./problem";
import { newState, type User } from "./state";
import { findByCode, hashCodeAsync, newToken, safeUser, sessionId, validateNewUser, SESSION_SECONDS, type UserRow } from "./auth";
import { dump, uid, wallClock, type Clock } from "./util";

// Même schéma que le backend Python (store.py) ; les photos sont en base plutôt que sur disque.
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, version INTEGER NOT NULL, data TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, roles TEXT NOT NULL, approved INTEGER NOT NULL, active INTEGER NOT NULL, code_hash TEXT NOT NULL, created_at REAL NOT NULL)",
  "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires REAL NOT NULL)",
  "CREATE TABLE IF NOT EXISTS commands (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, fingerprint TEXT NOT NULL, result TEXT NOT NULL, version INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, event_id TEXT NOT NULL, user_id TEXT NOT NULL, action TEXT NOT NULL, at REAL NOT NULL, data TEXT NOT NULL)",
  // Tentatives de connexion par adresse : en serverless, la mémoire ne survit pas entre deux appels.
  "CREATE TABLE IF NOT EXISTS attempts (address TEXT NOT NULL, at REAL NOT NULL)",
  // Aperçus d'import : en base plutôt qu'en mémoire, deux appels serverless pouvant tomber sur deux instances.
  "CREATE TABLE IF NOT EXISTS import_previews (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at REAL NOT NULL, data TEXT NOT NULL)",
  // Photos : en base (BLOB) et non sur disque, Vercel n'ayant pas de disque persistant. Voir photos.ts.
  "CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, owner_type TEXT NOT NULL, kind TEXT NOT NULL, approved INTEGER NOT NULL, consent INTEGER NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, data BLOB NOT NULL, created_at REAL NOT NULL)",
];

export type Conn = Transaction | Client;

// Coût réseau (client HTTP Turso) : chaque `execute`, chaque `batch` et chaque `COMMIT` est un
// aller-retour vers la base ; le `BEGIN` part regroupé avec la première instruction. Les routes
// chaudes (état, commande) lisent donc tout en un seul `batch` et écrivent tout en un seul
// `batch` atomique, sans transaction ouverte à travers le réseau.
export type Snapshot = { user: User; state: any; users: User[]; prior: { user_id: string; fingerprint: string; result: string } | null };

export type StoreOptions = { url: string; authToken?: string; demo?: boolean; clock?: Clock };

export const MAX_CHIEFS = 3;

export class Store {
  readonly demo: boolean;
  readonly clock: Clock;
  private ready: Promise<void> | null = null;
  private clientPromise: Promise<Client>;

  constructor(opts: StoreOptions) {
    // Base distante (Turso) : client HTTP pur, sans module natif, le seul qui fonctionne en
    // serverless. Base fichier ou mémoire (tests, développement) : client natif chargé à la demande.
    const remote = /^(libsql|https?|wss?):/.test(opts.url);
    this.clientPromise = remote
      ? Promise.resolve(createWebClient({ url: opts.url, authToken: opts.authToken }))
      : import("@libsql/client").then((m) => m.createClient({ url: opts.url, authToken: opts.authToken }));
    this.demo = opts.demo ?? false;
    this.clock = opts.clock ?? wallClock;
  }

  db(): Promise<Client> {
    return this.clientPromise;
  }

  // Crée le schéma et l'événement initial une seule fois par instance.
  init(): Promise<void> {
    if (!this.ready) this.ready = this.bootstrap();
    return this.ready;
  }

  private async bootstrap(): Promise<void> {
    const client = await this.db();
    // Schéma et événement initial en une seule requête atomique : l'insertion ne se fait que si la
    // table est vide, deux instances démarrant en même temps ne créent donc pas deux événements.
    const state = newState(this.demo);
    await client.batch([...SCHEMA, { sql: "INSERT INTO events (id, version, data) SELECT ?, 0, ? WHERE NOT EXISTS (SELECT 1 FROM events)", args: [state.id, dump(state)] }], "write");
    const row = (await client.execute("SELECT data FROM events LIMIT 1")).rows[0];
    if (!row || Boolean(JSON.parse(String(row.data)).demo) !== this.demo) {
      throw new Error("Cette base contient une autre nature de données : démonstration et officiel doivent rester séparés.");
    }
  }

  // Un lot d'instructions en une seule requête, atomique (annulé entièrement si l'une échoue).
  // Sur une transaction ouverte, le lot s'exécute dedans ; sinon dans sa propre transaction.
  async batch(stmts: InStatement[], mode: "read" | "write", conn?: Conn): Promise<ResultSet[]> {
    await this.init();
    if (conn && "commit" in conn) return conn.batch(stmts);
    return (conn ?? (await this.db())).batch(stmts, mode);
  }

  private static readonly SESSION_SQL = "SELECT users.* FROM users JOIN sessions ON sessions.user_id = users.id WHERE sessions.id = ? AND sessions.expires > ? AND users.active = 1";
  private static readonly STATE_SQL = "SELECT data FROM events LIMIT 1";
  private static readonly USERS_SQL = "SELECT * FROM users ORDER BY created_at";

  // Session, état et comptes en un seul aller-retour ; `commandId` ajoute la commande déjà
  // exécutée sous cet identifiant (idempotence). Mêmes contrôles que `authenticate`.
  async snapshot(token: string | undefined, commandId?: string, conn?: Conn): Promise<Snapshot> {
    if (!token) throw new Problem("Connectez-vous avec votre code personnel.", 401);
    const stmts: InStatement[] = [{ sql: Store.SESSION_SQL, args: [sessionId(token), this.clock()] }, Store.STATE_SQL, Store.USERS_SQL];
    if (commandId !== undefined) stmts.push({ sql: "SELECT user_id, fingerprint, result FROM commands WHERE id = ?", args: [commandId] });
    const [session, event, users, commands] = await this.batch(stmts, "read", conn);
    const row = session.rows[0] as unknown as UserRow | undefined;
    if (!row) throw new Problem("Session expirée. Reconnectez-vous.", 401);
    if (!row.approved) throw new Problem("Votre accès attend la validation du chef des juges.", 403);
    const prior = commands?.rows[0];
    return {
      user: safeUser(row),
      state: JSON.parse(String(event.rows[0]!.data)),
      users: users.rows.map((r) => safeUser(r as unknown as UserRow)),
      prior: prior ? { user_id: String(prior.user_id), fingerprint: String(prior.fingerprint), result: String(prior.result) } : null,
    };
  }

  // État et comptes en un seul aller-retour, sans session (santé du serveur).
  async readAll(): Promise<{ state: any; users: User[] }> {
    const [event, users] = await this.batch([Store.STATE_SQL, Store.USERS_SQL], "read");
    return { state: JSON.parse(String(event.rows[0]!.data)), users: users.rows.map((r) => safeUser(r as unknown as UserRow)) };
  }

  // Écriture sous version optimiste en un seul lot atomique : les insertions (`extra`, écrites
  // sous la forme `INSERT ... SELECT ... WHERE <gate>`) ne prennent effet que si la version lue
  // est encore la version en base, puis l'état est remplacé à la même condition. Renvoie faux si
  // quelqu'un a écrit entre-temps : rien n'a alors été écrit, l'appelant relit et recommence.
  async commit(state: any, expectedVersion: number, extra: Array<{ sql: string; args: InValue[] }>, conn?: Conn): Promise<boolean> {
    const gate = [state.id, expectedVersion];
    const stmts: InStatement[] = extra.map((x) => ({ sql: x.sql, args: [...x.args, ...gate] }));
    stmts.push({ sql: "UPDATE events SET version = ?, data = ? WHERE id = ? AND version = ?", args: [state.version, dump(state), state.id, expectedVersion] });
    const results = await this.batch(stmts, "write", conn);
    return results[results.length - 1]!.rowsAffected === 1;
  }

  // Erreur d'unicité (identifiant de commande déjà inscrit par un rejeu simultané) : le lot a été annulé.
  static isConstraintError(e: unknown): boolean {
    const text = String((e as any)?.code ?? "") + " " + String((e as any)?.message ?? e);
    return /SQLITE_CONSTRAINT|UNIQUE constraint failed/i.test(text);
  }

  async read(conn?: Conn): Promise<any> {
    await this.init();
    conn ??= await this.db();
    const row = (await conn.execute("SELECT data FROM events LIMIT 1")).rows[0];
    return JSON.parse(String(row!.data));
  }

  // Écriture sous version optimiste : la ligne n'est remplacée que si personne n'a écrit entre-temps.
  async write(conn: Conn, state: any, expectedVersion: number): Promise<void> {
    const r = await conn.execute({ sql: "UPDATE events SET version = ?, data = ? WHERE id = ? AND version = ?", args: [state.version, dump(state), state.id, expectedVersion] });
    if (r.rowsAffected !== 1) throw new Problem("Les données ont changé. Rechargez avant de confirmer votre action.", 409);
  }

  async allUsers(conn?: Conn): Promise<User[]> {
    await this.init();
    conn ??= await this.db();
    return (await conn.execute("SELECT * FROM users ORDER BY created_at")).rows.map((r) => safeUser(r as unknown as UserRow));
  }

  // Transaction d'écriture : libSQL sérialise les écrivains, comme BEGIN IMMEDIATE côté Python.
  async transact<T>(operation: (tx: Transaction) => Promise<T>): Promise<T> {
    await this.init();
    const tx = await (await this.db()).transaction("write");
    try {
      const result = await operation(tx);
      await tx.commit();
      return result;
    } catch (e) {
      await tx.rollback().catch(() => undefined);
      throw e;
    }
  }

  // Journal d'audit : codes, jetons et fichiers n'y entrent jamais. Forme conditionnelle, pour `commit`.
  auditStatement(state: any, userId: string, action: string, data: Record<string, unknown>): { sql: string; args: InValue[] } {
    const redacted = Object.fromEntries(Object.entries(data).filter(([k]) => !["code", "token", "password", "file"].includes(k)));
    return { sql: "INSERT INTO audit (id, event_id, user_id, action, at, data) SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT version FROM events WHERE id = ?) = ?", args: [uid(), state.id, userId, action, this.clock(), dump(redacted)] };
  }
  // Forme inconditionnelle, pour les transactions explicites (configuration, démonstration, imports, photos, restauration).
  async record(conn: Conn, state: any, userId: string, action: string, data: Record<string, unknown>): Promise<void> {
    const a = this.auditStatement(state, userId, action, data);
    await conn.execute({ sql: "INSERT INTO audit (id, event_id, user_id, action, at, data) VALUES (?, ?, ?, ?, ?, ?)", args: a.args });
  }

  // `auth.add_user` : contrôles puis insertion, hachage PBKDF2 identique au Python.
  async addUser(conn: Conn, name: string, roles: string[], code: unknown, approved = false): Promise<User> {
    if (typeof code === "string") code = code.trim(); // même règle qu'à la connexion
    const valid = validateNewUser(name, roles, code);
    const rows = (await conn.execute("SELECT * FROM users")).rows as unknown as UserRow[];
    if (await findByCode(code as string, rows)) throw new Problem("Ce code personnel est déjà utilisé.", 409);
    // Jusqu'à trois chefs de jury (PO, 26/09/2026) : chaque manche garde un chef unique dans son panel.
    if (valid.roles.includes("chief") && rows.filter((r) => (JSON.parse(r.roles) as string[]).includes("chief")).length >= MAX_CHIEFS) throw new Problem(`Au plus ${MAX_CHIEFS} chefs de jury pour cet événement.`, 409);
    const user: User = { id: uid(), name: valid.name, roles: valid.roles, approved, active: true };
    await conn.execute({
      sql: "INSERT INTO users (id, name, roles, approved, active, code_hash, created_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
      args: [user.id, user.name, dump(user.roles), approved ? 1 : 0, await hashCodeAsync(code as string), this.clock()],
    });
    return user;
  }

  // Modification d'un compte (chef) : nom, fonctions, et nouveau code si fourni. Mêmes contrôles qu'à la
  // création ; le rôle chef ne se donne ni ne se retire ici. Un nouveau code coupe les sessions du compte.
  async updateUser(conn: Conn, id: string, name: string, roles: string[], code: unknown): Promise<User> {
    if (typeof code === "string") code = code.trim();
    const rows = (await conn.execute("SELECT * FROM users")).rows as unknown as UserRow[];
    const row = rows.find((r) => r.id === id);
    if (!row) throw new Problem("Utilisateur introuvable.", 404);
    const wasChief = (JSON.parse(row.roles) as string[]).includes("chief");
    const valid = validateNewUser(name, roles, code === undefined || code === null || code === "" ? "x".repeat(8) : code);
    if (wasChief !== valid.roles.includes("chief")) throw new Problem("Le rôle de chef ne se modifie pas ici.");
    if (typeof code === "string" && code) {
      const holder = await findByCode(code, rows);
      if (holder && holder.id !== id) throw new Problem("Ce code personnel est déjà utilisé.", 409);
      await conn.execute({ sql: "UPDATE users SET name = ?, roles = ?, code_hash = ? WHERE id = ?", args: [valid.name, dump(valid.roles), await hashCodeAsync(code), id] });
      await conn.execute({ sql: "DELETE FROM sessions WHERE user_id = ?", args: [id] });
    } else await conn.execute({ sql: "UPDATE users SET name = ?, roles = ? WHERE id = ?", args: [valid.name, dump(valid.roles), id] });
    return { id, name: valid.name, roles: valid.roles, approved: Boolean(row.approved), active: Boolean(row.active) };
  }

  async newSession(conn: Conn, userId: string): Promise<string> {
    const token = newToken();
    await conn.execute({ sql: "INSERT INTO sessions (id, user_id, expires) VALUES (?, ?, ?)", args: [sessionId(token), userId, this.clock() + SESSION_SECONDS] });
    return token;
  }

  async deleteSession(token: string): Promise<void> {
    await this.init();
    await (await this.db()).execute({ sql: "DELETE FROM sessions WHERE id = ?", args: [sessionId(token)] });
  }

  // `auth.authenticate` : session valide, compte actif et approuvé.
  async authenticate(token: string | undefined): Promise<User> {
    if (!token) throw new Problem("Connectez-vous avec votre code personnel.", 401);
    await this.init();
    const row = (
      await (await this.db()).execute({
        sql: "SELECT users.* FROM users JOIN sessions ON sessions.user_id = users.id WHERE sessions.id = ? AND sessions.expires > ? AND users.active = 1",
        args: [sessionId(token), this.clock()],
      })
    ).rows[0] as unknown as UserRow | undefined;
    if (!row) throw new Problem("Session expirée. Reconnectez-vous.", 401);
    if (!row.approved) throw new Problem("Votre accès attend la validation du chef des juges.", 403);
    return safeUser(row);
  }

  // Compte actif dont le code correspond, ou null. Le hachage se fait hors transaction.
  async userByCode(code: string): Promise<UserRow | null> {
    await this.init();
    const rows = (await (await this.db()).execute("SELECT * FROM users WHERE active = 1")).rows as unknown as UserRow[];
    return findByCode(code, rows);
  }

  // Limitation des tentatives de connexion : 15 échecs par adresse sur 5 minutes.
  async loginAllowed(address: string): Promise<boolean> {
    const now = this.clock();
    const results = await this.batch(
      [
        { sql: "DELETE FROM attempts WHERE at < ?", args: [now - 300] },
        // Purge des sessions expirées au passage : la table ne grossit pas indéfiniment.
        { sql: "DELETE FROM sessions WHERE expires < ?", args: [now] },
        // Purge des aperçus d'import expirés (données personnelles) au passage également.
        { sql: "DELETE FROM import_previews WHERE created_at < ?", args: [now - 3600] },
        { sql: "SELECT COUNT(*) AS n FROM attempts WHERE address = ?", args: [address] },
      ],
      "write",
    );
    return Number(results[3]!.rows[0]!.n) < 15;
  }
  // Connexion réussie : session ouverte, compteur d'échecs de l'adresse remis à zéro, identifiant
  // de l'événement lu, en un seul aller-retour.
  async loginSession(userId: string, address: string): Promise<{ token: string; eventId: string }> {
    const token = newToken();
    const results = await this.batch(
      [
        { sql: "INSERT INTO sessions (id, user_id, expires) VALUES (?, ?, ?)", args: [sessionId(token), userId, this.clock() + SESSION_SECONDS] },
        { sql: "DELETE FROM attempts WHERE address = ?", args: [address] },
        "SELECT id FROM events LIMIT 1",
      ],
      "write",
    );
    return { token, eventId: String(results[2]!.rows[0]!.id) };
  }
  async loginFailed(address: string): Promise<void> {
    await (await this.db()).execute({ sql: "INSERT INTO attempts (address, at) VALUES (?, ?)", args: [address, this.clock()] });
  }
  async loginSucceeded(address: string): Promise<void> {
    await (await this.db()).execute({ sql: "DELETE FROM attempts WHERE address = ?", args: [address] });
  }

  async execute(sql: string, args: InValue[] = []): Promise<any[]> {
    await this.init();
    return (await (await this.db()).execute({ sql, args })).rows as any[];
  }
}
