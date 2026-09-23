import { Problem } from "./problem";
import { uid } from "./util";
import type { Store, Conn } from "./store";
import type { User } from "./state";
import { applyCommand } from "./commands";

// Portage de backend/fibda/transfers.py (partie imports) : contrôle borné, sans exécution,
// d'un fichier d'inscriptions avant son import. Mêmes messages et même forme de réponse que
// le Python ({rows, errors, warnings}), consommés tels quels par frontend/src/Preparation.tsx.
//
// Différences assumées avec le Python :
// - taille maximale 4 Mo (Vercel refuse un corps de requête au-delà de 4,5 Mo) au lieu de 20 Mo ;
// - XLSX indisponible : les bibliothèques npm candidates (exceljs 4.4.0, xlsx 0.18.5) ont des
//   vulnérabilités connues à l'audit (voir rapport de tâche), on répond 415 « convertir en CSV » ;
// - la prévisualisation est conservée en base (table import_previews), pas en mémoire, car deux
//   appels serverless peuvent tomber sur deux instances distinctes.

export const MAX_FILE = 4 * 1024 * 1024;
export const MAX_ROWS = 10000;
export const PREVIEW_SECONDS = 3600;
export const FIELDS = new Set(["first_name", "last_name", "birth_date", "sex", "nationalities", "country", "club", "section", "height_cm", "weight_kg", "category_id"]);
const REQUIRED = ["first_name", "last_name", "birth_date", "sex", "section", "country", "nationalities"];

export type ImportMessage = { row: number; message: string };
export type ImportPreview = { rows: Record<string, any>[]; errors: ImportMessage[]; warnings: ImportMessage[] };

// --- CSV : parseur maison strict, sans dépendance ---------------------------------------------

// Séparateur détecté sur la première ligne, hors guillemets : le plus fréquent parmi ; , et
// tabulation (comme le Sniffer Python) ; virgule par défaut.
export function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "\n" || ch === "\r")) break;
    else if (!quoted && ch in counts) counts[ch] += 1;
  }
  let best = ",";
  for (const d of [";", "\t"]) if (counts[d] > counts[best]) best = d;
  return best;
}

// Découpe en lignes et cellules. Guillemets doublés à l'intérieur d'un champ entre guillemets,
// retours de ligne CRLF ou LF. Une ligne mal formée (guillemet ouvrant non fermé, guillemet au
// milieu d'un champ, texte après le guillemet fermant) est refusée avec son numéro.
export function parseCsv(text: string, delimiter?: string): string[][] {
  if (text.startsWith("\uFEFF")) text = text.slice(1);
  delimiter ??= detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let atFieldStart = true;
  let line = 1;
  // Ligne où le champ en cours a commencé : c'est elle qu'on signale, même si un champ entre
  // guillemets s'étend sur plusieurs lignes.
  let fieldLine = 1;
  const malformed = (at = fieldLine) => new Problem(`Ligne ${at} mal formée : guillemets incorrects`);
  const endRow = () => {
    row.push(field);
    // Ligne vide : conservée comme ligne sans cellule, ignorée ensuite comme en Python.
    rows.push(row.length === 1 && row[0] === "" ? [] : row);
    row = [];
    field = "";
    atFieldStart = true;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
          // Après le guillemet fermant : séparateur ou fin de ligne uniquement.
          const next = text[i + 1];
          if (next !== undefined && next !== delimiter && next !== "\n" && next !== "\r") throw malformed();
        }
      } else {
        if (ch === "\n") line += 1;
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      if (!atFieldStart) throw malformed(line);
      quoted = true;
      fieldLine = line;
      atFieldStart = false;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
      atFieldStart = true;
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      endRow();
      line += 1;
    } else {
      field += ch;
      atFieldStart = false;
    }
  }
  if (quoted) throw malformed();
  if (field !== "" || row.length) endRow();
  return rows;
}

// --- Contrôles ligne à ligne : copie de preview_import -----------------------------------------

const asText = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const isFormula = (v: string): boolean => /^\s*[=+\-@]/.test(v);
const isCountry = (c: string): boolean => /^[A-Z]{2}$/.test(c);
// Nombre positif fini, comme Decimal(...) > 0 côté Python ; la virgule décimale est acceptée.
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const isIsoDate = (value: string): boolean => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
};

function decodeUtf8(data: Uint8Array): string {
  try {
    // « utf-8-sig » : le BOM est retiré, un octet invalide refuse le fichier.
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(data);
  } catch {
    throw new Problem("Fichier non lisible : encodage UTF-8 attendu");
  }
}

export function previewImport(data: Uint8Array, filename: string): ImportPreview {
  if (data.byteLength > MAX_FILE) throw new Problem("Fichier trop volumineux");
  const lower = filename.toLowerCase();
  let raw: unknown[][];
  if (lower.endsWith(".csv")) raw = parseCsv(decodeUtf8(data));
  else if (lower.endsWith(".xlsx")) throw new Problem("Format XLSX indisponible : convertir en CSV", 415);
  else throw new Problem("Formats acceptés : CSV UTF-8 et XLSX");
  const errors: ImportMessage[] = [];
  const warnings: ImportMessage[] = [];
  const rows: Record<string, any>[] = [];
  if (!raw.length) return { rows: [], errors: [{ row: 1, message: "Fichier vide" }], warnings: [] };
  const headers = raw[0].map((x) => asText(x).trim());
  if (new Set(headers).size !== headers.length || !REQUIRED.every((h) => headers.includes(h))) {
    errors.push({ row: 1, message: "Entêtes uniques obligatoires : first_name, last_name, birth_date, sex, section, country, nationalities" });
  }
  const unknown = headers.filter((h) => !FIELDS.has(h)).sort();
  if (unknown.length) errors.push({ row: 1, message: "Colonnes inconnues : " + unknown.join(", ") });
  if (raw.length > MAX_ROWS + 1) throw new Problem("Maximum 10000 lignes");
  const seen = new Set<string>();
  for (let index = 1; index < raw.length; index++) {
    const values = raw[index];
    const n = index + 1;
    if (!values.some((x) => x !== null && x !== undefined && asText(x).trim())) continue;
    const row: Record<string, any> = {};
    headers.forEach((k, i) => {
      if (i < values.length) row[k] = asText(values[i]).trim();
    });
    if (values.length !== headers.length) errors.push({ row: n, message: "Nombre de colonnes incohérent" });
    if (values.some((v) => v !== null && v !== undefined && isFormula(String(v)))) errors.push({ row: n, message: "Formule ou préfixe exécutable refusé" });
    if (!row.first_name || !row.last_name) errors.push({ row: n, message: "Nom et prénom obligatoires" });
    if (!["M", "F"].includes(row.sex)) errors.push({ row: n, message: "Sexe attendu M ou F" });
    if (!["amateur", "pro"].includes(row.section)) errors.push({ row: n, message: "Section attendue amateur ou pro" });
    for (const key of ["height_cm", "weight_kg"]) {
      if (row[key]) {
        const normalized = String(row[key]).replace(",", ".");
        const value = Number(normalized);
        if (!NUMBER.test(normalized) || !Number.isFinite(value) || value <= 0) errors.push({ row: n, message: key + " doit être un nombre positif" });
        else row[key] = normalized;
      }
    }
    if (!row.birth_date) errors.push({ row: n, message: "Date de naissance obligatoire" });
    else if (!isIsoDate(row.birth_date)) errors.push({ row: n, message: "Date attendue AAAA-MM-JJ" });
    const identity = JSON.stringify([(row.first_name ?? "").toLowerCase(), (row.last_name ?? "").toLowerCase(), row.birth_date]);
    if (seen.has(identity)) warnings.push({ row: n, message: "Identité répétée : vérifier avant import" });
    seen.add(identity);
    if (row.nationalities) {
      row.nationalities = String(row.nationalities)
        .split("|")
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean);
    }
    const countries: string[] = Array.isArray(row.nationalities) ? [row.country ?? "", ...row.nationalities] : [];
    if (countries.length < 2 || !countries.every(isCountry)) {
      errors.push({ row: n, message: "Pays et nationalités obligatoires : codes de deux lettres majuscules ; séparer les nationalités par |" });
    }
    rows.push(row);
  }
  return { rows, errors, warnings };
}

// --- Prévisualisations en base : table import_previews ------------------------------------------

type StoredPreview = { preview: ImportPreview; version: number };

// Enregistre l'aperçu pour l'utilisateur et purge ceux de plus d'une heure.
export async function savePreview(store: Store, userId: string, preview: ImportPreview): Promise<string> {
  const now = store.clock();
  const version = (await store.read()).version;
  const id = uid();
  const stored: StoredPreview = { preview, version };
  await store.execute("DELETE FROM import_previews WHERE created_at < ?", [now - PREVIEW_SECONDS]);
  await store.execute("INSERT INTO import_previews (id, user_id, created_at, data) VALUES (?, ?, ?, ?)", [id, userId, now, JSON.stringify(stored)]);
  return id;
}

// Applique l'aperçu : mêmes commandes person.save / entry.save que le Python, sous une seule
// transaction, refus si l'état a changé depuis l'aperçu (409). Renvoie le nombre de personnes créées.
export async function commitPreview(store: Store, actor: User, previewId: unknown): Promise<number> {
  const row = typeof previewId === "string" && previewId ? (await store.execute("SELECT user_id, created_at, data FROM import_previews WHERE id = ?", [previewId]))[0] : undefined;
  if (!row || row.user_id !== actor.id || store.clock() - Number(row.created_at) > PREVIEW_SECONDS) throw new Problem("Aperçu expiré ou inconnu.");
  const stored: StoredPreview = JSON.parse(String(row.data));
  if (stored.preview.errors.length) throw new Problem("Corrigez les erreurs avant import.");
  const count = await store.transact(async (tx: Conn) => {
    const s = await store.read(tx);
    if (s.version !== stored.version) throw new Problem("Refaites l’aperçu après les modifications récentes.", 409);
    const before = s.version;
    let count = 0;
    for (const item of stored.preview.rows) {
      const { category_id, ...person } = item;
      person.id = uid();
      await applyCommand(store, tx, s, actor, "person.save", { person });
      if (category_id) await applyCommand(store, tx, s, actor, "entry.save", { entry: { id: uid(), person_id: person.id, category_id, confirmed: false } });
      count += 1;
    }
    s.version += 1;
    await store.write(tx, s, before);
    await store.record(tx, s, actor.id, "import.commit", { count });
    await tx.execute({ sql: "DELETE FROM import_previews WHERE id = ?", args: [previewId as string] });
    return count;
  });
  return count;
}
