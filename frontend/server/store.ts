import { createClient as createWebClient, type Client, type Transaction, type InValue } from "@libsql/client/web";
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

export type StoreOptions = { url: string; authToken?: string; demo?: boolean; clock?: Clock };

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
    for (const sql of SCHEMA) await client.execute(sql);
    const tx = await client.transaction("write");
    try {
      const row = (await tx.execute("SELECT id, data FROM events LIMIT 1")).rows[0];
      if (!row) {
        const state = newState(this.demo);
        await tx.execute({ sql: "INSERT INTO events (id, version, data) VALUES (?, 0, ?)", args: [state.id, dump(state)] });
      } else if (Boolean(JSON.parse(String(row.data)).demo) !== this.demo) {
        throw new Error("Cette base contient une autre nature de données : démonstration et officiel doivent rester séparés.");
      }
      await tx.commit();
    } catch (e) {
      await tx.rollback().catch(() => undefined);
      throw e;
    }
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

  // Journal d'audit : codes, jetons et fichiers n'y entrent jamais.
  async record(conn: Conn, state: any, userId: string, action: string, data: Record<string, unknown>): Promise<void> {
    const redacted = Object.fromEntries(Object.entries(data).filter(([k]) => !["code", "token", "password", "file"].includes(k)));
    await conn.execute({ sql: "INSERT INTO audit (id, event_id, user_id, action, at, data) VALUES (?, ?, ?, ?, ?, ?)", args: [uid(), state.id, userId, action, this.clock(), dump(redacted)] });
  }

  // `auth.add_user` : contrôles puis insertion, hachage PBKDF2 identique au Python.
  async addUser(conn: Conn, name: string, roles: string[], code: unknown, approved = false): Promise<User> {
    const valid = validateNewUser(name, roles, code);
    const rows = (await conn.execute("SELECT * FROM users")).rows as unknown as UserRow[];
    if (await findByCode(code as string, rows)) throw new Problem("Ce code personnel est déjà utilisé.", 409);
    if (valid.roles.includes("chief") && rows.some((r) => (JSON.parse(r.roles) as string[]).includes("chief"))) throw new Problem("Un chef existe déjà pour cet événement.", 409);
    const user: User = { id: uid(), name: valid.name, roles: valid.roles, approved, active: true };
    await conn.execute({
      sql: "INSERT INTO users (id, name, roles, approved, active, code_hash, created_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
      args: [user.id, user.name, dump(user.roles), approved ? 1 : 0, await hashCodeAsync(code as string), this.clock()],
    });
    return user;
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
    await this.init();
    const now = this.clock();
    await (await this.db()).execute({ sql: "DELETE FROM attempts WHERE at < ?", args: [now - 300] });
    // Purge des sessions expirées au passage : la table ne grossit pas indéfiniment.
    await (await this.db()).execute({ sql: "DELETE FROM sessions WHERE expires < ?", args: [now] });
    // Purge des aperçus d'import expirés (données personnelles) au passage également.
    await (await this.db()).execute({ sql: "DELETE FROM import_previews WHERE created_at < ?", args: [now - 3600] });
    const n = Number((await (await this.db()).execute({ sql: "SELECT COUNT(*) AS n FROM attempts WHERE address = ?", args: [address] })).rows[0]!.n);
    return n < 15;
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
