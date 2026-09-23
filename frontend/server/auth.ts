import { createHash, pbkdf2, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const pbkdf2Async = promisify(pbkdf2);
import { Problem } from "./problem";
import type { User } from "./state";

// Rôles et groupes d'habilitation : copie de `auth.py`.
export const ROLES = new Set(["chief", "responsable", "director", "judge", "trainee", "secretariat", "regie", "speaker", "commission"]);
export const ADMIN = new Set(["chief", "responsable", "director"]);
export const SPORT = new Set(["chief", "responsable"]);
export const PREPARATION = new Set([...ADMIN, "secretariat"]);
export const REGIE = new Set([...ADMIN, "regie"]);

export const union = (...sets: Iterable<string>[]): Set<string> => new Set(sets.flatMap((s) => [...s]));
export const intersects = (a: Iterable<string>, b: Iterable<string>): boolean => {
  const sb = new Set(b);
  for (const x of a) if (sb.has(x)) return true;
  return false;
};

// Vérification de rôle côté serveur : un bouton masqué n'est jamais un contrôle d'accès.
export function require(actor: { roles: string[] }, allowed: Iterable<string>): void {
  if (!intersects(actor.roles, allowed)) throw new Problem("Cette action ne relève pas de vos habilitations.", 403);
}

// PBKDF2-HMAC-SHA256, 100 000 itérations, sel de 16 octets hexadécimal, format `sel:hex` identique au Python.
// 100 000 itérations : des codes courts sont protégés d’abord par le limiteur de tentatives ;
// au-delà, chaque connexion et chaque création de compte coûteraient plusieurs secondes en serverless.
const ITERATIONS = 100000;
export function hashCode(code: string, salt?: string): string {
  const s = salt ?? randomBytes(16).toString("hex");
  return s + ":" + pbkdf2Sync(code, s, ITERATIONS, 32, "sha256").toString("hex");
}

export function matches(code: string, stored: string): boolean {
  const a = Buffer.from(hashCode(code, stored.split(":")[0]));
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Variantes asynchrones : le hachage part dans le pool de threads de Node, plusieurs comptes
// se vérifient en parallèle sans bloquer la fonction serverless.
export async function hashCodeAsync(code: string, salt?: string): Promise<string> {
  const s = salt ?? randomBytes(16).toString("hex");
  return s + ":" + (await pbkdf2Async(code, s, ITERATIONS, 32, "sha256")).toString("hex");
}
export async function matchesAsync(code: string, stored: string): Promise<boolean> {
  const a = Buffer.from(await hashCodeAsync(code, stored.split(":")[0]));
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}
// Parmi des lignes, celle dont le code correspond (toutes vérifiées en parallèle), sinon null.
export async function findByCode<T extends { code_hash: string }>(code: string, rows: T[]): Promise<T | null> {
  const results = await Promise.all(rows.map((r) => matchesAsync(code, r.code_hash)));
  const i = results.indexOf(true);
  return i === -1 ? null : rows[i];
}

export const sessionId = (token: string): string => createHash("sha256").update(token).digest("hex");
export const newToken = (): string => randomBytes(40).toString("base64url");
export const SESSION_SECONDS = 16 * 3600;

// Contrôles de création de compte, identiques à `auth.add_user` ; la persistance est faite par le magasin.
export function validateNewUser(name: string, roles: string[], code: unknown): { name: string; roles: string[] } {
  if (typeof code !== "string" || code.length < 4 || code.length > 128) throw new Problem("Le code personnel doit contenir de 4 à 128 caractères.");
  if (!name.trim() || !roles.length || !roles.every((r) => ROLES.has(r))) throw new Problem("Nom et fonctions valides obligatoires.");
  // Décision PO du 23/09/2026 : 8 caractères minimum pour chef, responsable et directeur.
  if (intersects(roles, ADMIN) && code.length < 8) throw new Problem("Le code d’un accès de direction doit contenir au moins 8 caractères.");
  if (roles.includes("director") && intersects(roles, ["chief", "responsable", "judge", "trainee"])) throw new Problem("Le directeur ne peut cumuler une fonction de vote.");
  if (roles.includes("trainee") && intersects(roles, ["chief", "responsable", "judge"])) throw new Problem("Un stagiaire ne siège pas simultanément comme juge officiel.");
  return { name: name.trim(), roles: [...new Set(roles)] };
}

export type UserRow = { id: string; name: string; roles: string; approved: number; active: number; code_hash: string };
export const safeUser = (row: UserRow): User => ({ id: row.id, name: row.name, roles: JSON.parse(row.roles), approved: Boolean(row.approved), active: Boolean(row.active) });
