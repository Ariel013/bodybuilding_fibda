import { deflateRawSync, inflateRawSync } from "node:zlib";
import { Problem } from "./problem";

// Lecture et écriture XLSX sans dépendance : un .xlsx est une archive ZIP de fichiers XML.
// Décision (OPEN-QUESTIONS.md P10) : les bibliothèques npm candidates ne sont pas maintenues,
// on écrit le strict nécessaire ici. Pas de parseur XML (donc ni entité externe ni DTD) :
// extraction par expressions régulières sur un sous-ensemble connu du format.
//
// Lecture : première feuille du classeur, cellules rendues en texte (chaînes partagées, chaînes
// en ligne, nombres, dates reconnues par leur format), formules rendues comme openpyxl
// (« =… ») pour que l'import les refuse avec son message habituel. Bombe ZIP : taille déclarée
// bornée par entrée et au total, taille réelle contrôlée à l'inflation.
// Écriture : chaînes en `inlineStr` échappées XML, nombres en `<v>`, titres et en-têtes en gras.

export const MAX_ENTRY = 20 * 1024 * 1024;
export const MAX_TOTAL = 40 * 1024 * 1024;
const MAX_ENTRIES = 2000;
const MAX_COLUMNS = 256;
const MAX_ROW_NUMBER = 10001; // MAX_ROWS + 1 côté transfers.ts : au-delà, l'import refuse de toute façon.

const unreadable = (why: string) => new Problem("Fichier XLSX non lisible : " + why);

// --- ZIP ---------------------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;

// Archive ZIP « stored » ou « deflate » : en-têtes locaux, répertoire central, fin de répertoire.
export function zipWrite(files: Record<string, Uint8Array>): Uint8Array<ArrayBuffer> {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name, "utf8");
    const packed = deflateRawSync(content);
    const crc = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(SIG_LOCAL, 0);
    local.writeUInt16LE(20, 4); // version nécessaire
    local.writeUInt16LE(0x0800, 6); // noms en UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10); // heure
    local.writeUInt16LE(0x21, 12); // date : 1980-01-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(SIG_CENTRAL, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(0, 12);
    entry.writeUInt16LE(0x21, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(content.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt16LE(0, 30); // extra
    entry.writeUInt16LE(0, 32); // commentaire
    entry.writeUInt16LE(0, 34); // disque
    entry.writeUInt16LE(0, 36); // attributs internes
    entry.writeUInt32LE(0, 38); // attributs externes
    entry.writeUInt32LE(offset, 42);
    parts.push(local, nameBytes, packed);
    central.push(entry, nameBytes);
    offset += local.length + nameBytes.length + packed.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(SIG_END, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(central.length / 2, 8);
  end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  const all = Buffer.concat([...parts, centralBytes, end]);
  return new Uint8Array(all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength) as ArrayBuffer);
}

type ZipEntry = { name: string; method: number; compressed: number; size: number; offset: number };

// Répertoire central seulement (les en-têtes locaux ne sont lus qu'à l'extraction) ; tailles
// déclarées bornées avant toute inflation ; ZIP64 et chiffrement refusés.
export function zipEntries(data: Uint8Array): ZipEntry[] {
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (buf.length < 22 || buf.readUInt32LE(0) !== SIG_LOCAL) throw unreadable("archive ZIP attendue");
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === SIG_END) {
      end = i;
      break;
    }
  }
  if (end < 0) throw unreadable("fin d'archive introuvable");
  const count = buf.readUInt16LE(end + 10);
  const size = buf.readUInt32LE(end + 12);
  let pos = buf.readUInt32LE(end + 16);
  if (count > MAX_ENTRIES) throw new Problem("Archive trop volumineuse", 413);
  if (pos + size > end) throw unreadable("répertoire central incohérent");
  const entries: ZipEntry[] = [];
  const seen = new Set<string>();
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== SIG_CENTRAL) throw unreadable("répertoire central incohérent");
    const flags = buf.readUInt16LE(pos + 8);
    const method = buf.readUInt16LE(pos + 10);
    const compressed = buf.readUInt32LE(pos + 20);
    const uncompressed = buf.readUInt32LE(pos + 24);
    const nameLength = buf.readUInt16LE(pos + 28);
    const extraLength = buf.readUInt16LE(pos + 30);
    const commentLength = buf.readUInt16LE(pos + 32);
    const offset = buf.readUInt32LE(pos + 42);
    const name = buf.toString("utf8", pos + 46, pos + 46 + nameLength);
    pos += 46 + nameLength + extraLength + commentLength;
    if (flags & 0x1) throw unreadable("archive chiffrée");
    if (method !== 0 && method !== 8) throw unreadable("méthode de compression inconnue");
    if (compressed === 0xffffffff || uncompressed === 0xffffffff || offset === 0xffffffff) throw unreadable("ZIP64 non pris en charge");
    if (uncompressed > MAX_ENTRY) throw new Problem("Fichier trop volumineux", 413);
    total += uncompressed;
    if (total > MAX_TOTAL) throw new Problem("Archive trop volumineuse", 413);
    if (seen.has(name)) throw unreadable("doublon dans l'archive");
    seen.add(name);
    entries.push({ name, method, compressed, size: uncompressed, offset });
  }
  return entries;
}

// Extrait une entrée : l'inflation est plafonnée à la taille déclarée (Node lève une erreur si le
// flux la dépasse) et la taille réelle doit être exactement celle annoncée.
export function zipExtract(data: Uint8Array, entry: ZipEntry): Uint8Array {
  const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const at = entry.offset;
  if (at + 30 > buf.length || buf.readUInt32LE(at) !== SIG_LOCAL) throw unreadable("en-tête local incohérent");
  const start = at + 30 + buf.readUInt16LE(at + 26) + buf.readUInt16LE(at + 28);
  if (start + entry.compressed > buf.length) throw unreadable("entrée tronquée");
  const packed = buf.subarray(start, start + entry.compressed);
  let out: Buffer;
  if (entry.method === 0) out = packed;
  else {
    try {
      out = inflateRawSync(packed, { maxOutputLength: Math.max(1, entry.size) });
    } catch {
      throw new Problem("Fichier trop volumineux ou archive corrompue", 413);
    }
  }
  if (out.length !== entry.size) throw unreadable("taille réelle différente de la taille déclarée");
  return new Uint8Array(out);
}

// --- XML minimal ------------------------------------------------------------------------------

export function escapeXml(value: string): string {
  // Les caractères de contrôle interdits en XML 1.0 sont retirés (sauf tabulation et sauts de ligne).
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unescapeXml(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos|#x[0-9a-fA-F]+|#\d+);/g, (m, code: string) => {
    if (code === "amp") return "&";
    if (code === "lt") return "<";
    if (code === "gt") return ">";
    if (code === "quot") return '"';
    if (code === "apos") return "'";
    const point = code[1] === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(point) && point <= 0x10ffff ? String.fromCodePoint(point) : m;
  });
}

const attr = (tag: string, name: string): string | undefined => {
  const m = new RegExp("(?:^|\\s)" + name + '="([^"]*)"').exec(tag);
  return m ? unescapeXml(m[1]) : undefined;
};

// Concatène tous les `<t>` d'un fragment (chaîne simple ou texte enrichi).
const textRuns = (xml: string): string => {
  let out = "";
  for (const t of elements(xml, "t")) out += unescapeXml(t.inner);
  return out;
};

// Éléments <tag ...>…</tag> ou <tag …/> d'un fragment, par indexOf (linéaire, sans retour arrière).
// Un élément ouvert sans fermeture : fichier refusé.
function* elements(xml: string, tag: string): Generator<{ tag: string; inner: string }> {
  const open = "<" + tag;
  const close = "</" + tag + ">";
  let pos = 0;
  for (;;) {
    const at = xml.indexOf(open, pos);
    if (at < 0) return;
    const next = xml[at + open.length];
    if (next !== undefined && next !== ">" && next !== "/" && !/\s/.test(next)) { pos = at + open.length; continue; }
    const gt = xml.indexOf(">", at);
    if (gt < 0) throw unreadable("balise non fermée");
    if (xml[gt - 1] === "/") { yield { tag: xml.slice(at + open.length, gt - 1), inner: "" }; pos = gt + 1; continue; }
    const end = xml.indexOf(close, gt);
    if (end < 0) throw unreadable("élément non fermé");
    yield { tag: xml.slice(at + open.length, gt), inner: xml.slice(gt + 1, end) };
    pos = end + close.length;
  }
}
const firstElement = (xml: string, tag: string) => elements(xml, tag).next().value as { tag: string; inner: string } | undefined;

// --- Lecture ----------------------------------------------------------------------------------

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

// Indices de style (attribut s des cellules) dont le format de nombre est une date.
function dateStyles(styles: string | undefined): Set<number> {
  const result = new Set<number>();
  if (!styles) return result;
  const custom = new Map<number, string>();
  const numFmt = /<numFmt\s[^>]*\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = numFmt.exec(styles))) {
    const id = Number(attr(m[0], "numFmtId"));
    const code = attr(m[0], "formatCode") ?? "";
    custom.set(id, code);
  }
  const isDate = (id: number): boolean => {
    if (BUILTIN_DATE_FORMATS.has(id)) return true;
    const code = custom.get(id);
    if (!code) return false;
    // Hors sections entre guillemets, crochets et échappements : une année ou un jour = une date.
    return /[yd]/i.test(code.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").replace(/\\./g, ""));
  };
  const xfs = /<cellXfs[\s\S]*?<\/cellXfs>/.exec(styles)?.[0] ?? "";
  const xf = /<xf\s[^>]*\/?>/g;
  let index = 0;
  while ((m = xf.exec(xfs))) {
    if (isDate(Number(attr(m[0], "numFmtId") ?? 0))) result.add(index);
    index += 1;
  }
  return result;
}

// Numéro de série Excel → AAAA-MM-JJ (système 1900 ou 1904).
function serialToIso(serial: number, date1904: boolean): string {
  const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  return new Date(base + Math.floor(serial) * 86400000).toISOString().slice(0, 10);
}

const columnIndex = (ref: string): number => {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

function entryText(data: Uint8Array, entries: ZipEntry[], name: string): string | undefined {
  const entry = entries.find((e) => e.name === name);
  return entry ? Buffer.from(zipExtract(data, entry)).toString("utf8") : undefined;
}

// Feuille active = première feuille du classeur, via workbook.xml et ses relations.
function firstSheetPath(data: Uint8Array, entries: ZipEntry[]): string {
  const workbook = entryText(data, entries, "xl/workbook.xml");
  const rels = entryText(data, entries, "xl/_rels/workbook.xml.rels");
  const sheet = workbook ? /<sheet\s[^>]*\/?>/.exec(workbook)?.[0] : undefined;
  const rid = sheet ? (attr(sheet, "r:id") ?? attr(sheet, "id")) : undefined;
  if (rid && rels) {
    const rel = /<Relationship\s[^>]*\/?>/g;
    let m: RegExpExecArray | null;
    while ((m = rel.exec(rels))) {
      if (attr(m[0], "Id") === rid) {
        const target = attr(m[0], "Target") ?? "";
        return target.startsWith("/") ? target.slice(1) : "xl/" + target;
      }
    }
  }
  return "xl/worksheets/sheet1.xml";
}

// Cellules de la première feuille, en texte, ligne par ligne (numéro de ligne Excel = index + 1),
// toutes les lignes ayant la largeur de la colonne la plus à droite, comme openpyxl.
export function xlsxRead(data: Uint8Array): (string | null)[][] {
  const entries = zipEntries(data);
  const sheetPath = firstSheetPath(data, entries);
  const sheet = entryText(data, entries, sheetPath);
  if (sheet === undefined) throw unreadable("feuille introuvable");
  const shared: string[] = [];
  const sharedXml = entryText(data, entries, "xl/sharedStrings.xml");
  if (sharedXml) {
    for (const si of elements(sharedXml, "si")) shared.push(textRuns(si.inner));
  }
  const dates = dateStyles(entryText(data, entries, "xl/styles.xml"));
  const workbook = entryText(data, entries, "xl/workbook.xml") ?? "";
  const date1904 = /<workbookPr\s[^>]*date1904="(1|true)"/.test(workbook);

  const rows: (string | null)[][] = [];
  let width = 0;
  let m: RegExpExecArray | null;
  let rowIndex = 0;
  for (const { tag, inner } of elements(sheet, "c")) {
    const ref = attr(tag, "r") ?? "";
    const rowNumber = Number(/\d+$/.exec(ref)?.[0] ?? 0);
    if (rowNumber > 0) rowIndex = rowNumber - 1;
    if (rowIndex + 1 > MAX_ROW_NUMBER) throw new Problem("Maximum 10000 lignes");
    const col = ref ? columnIndex(ref) : (rows[rowIndex]?.length ?? 0);
    if (col < 0 || col >= MAX_COLUMNS) throw unreadable("plus de " + MAX_COLUMNS + " colonnes");
    const type = attr(tag, "t") ?? "n";
    let value: string | null;
    const formula = firstElement(inner, "f");
    if (formula) value = "=" + unescapeXml(formula.inner).trim(); // même rendu qu'openpyxl : l'import la refuse
    else {
      const v = firstElement(inner, "v");
      const raw = v ? unescapeXml(v.inner) : "";
      if (type === "s") value = shared[Number(raw)] ?? "";
      else if (type === "inlineStr") value = textRuns(inner);
      else if (type === "n" && raw !== "" && dates.has(Number(attr(tag, "s") ?? -1)) && Number.isFinite(Number(raw))) value = serialToIso(Number(raw), date1904);
      else value = raw;
      if (value === "") value = null;
    }
    while (rows.length <= rowIndex) rows.push([]);
    const row = rows[rowIndex];
    while (row.length <= col) row.push(null);
    row[col] = value;
    width = Math.max(width, col + 1);
  }
  // Une ligne déclarée sans cellule compte aussi (openpyxl la rend vide).
  const rowTag = /<row\b[^>]*\br="(\d+)"/g;
  let last = rows.length;
  while ((m = rowTag.exec(sheet))) last = Math.max(last, Number(m[1]));
  if (last > MAX_ROW_NUMBER) throw new Problem("Maximum 10000 lignes");
  while (rows.length < last) rows.push([]);
  for (const row of rows) while (row.length < width) row.push(null);
  return rows;
}

// --- Écriture ---------------------------------------------------------------------------------

export type XlsxCell = string | number | null | undefined;
export type XlsxRow = { cells: XlsxCell[]; bold?: boolean };

const columnRef = (index: number): string => {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

// Classeur à une feuille : chaînes en `inlineStr`, nombres finis en `<v>`, lignes en gras via le
// style 1, deux premières lignes figées (A3) comme l'export Python.
export function xlsxWrite(sheetName: string, rows: XlsxRow[]): Uint8Array<ArrayBuffer> {
  const name = escapeXml(sheetName.replace(/[\\/*?:\[\]]/g, " ").slice(0, 31) || "Feuille");
  const lines: string[] = [];
  rows.forEach((row, r) => {
    const cells: string[] = [];
    row.cells.forEach((value, c) => {
      if (value === null || value === undefined || value === "") return;
      const ref = columnRef(c) + (r + 1);
      const style = row.bold ? ' s="1"' : "";
      if (typeof value === "number" && Number.isFinite(value)) cells.push(`<c r="${ref}"${style}><v>${value}</v></c>`);
      else cells.push(`<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`);
    });
    lines.push(`<row r="${r + 1}">${cells.join("")}</row>`);
  });
  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    "<sheetData>" + lines.join("") + "</sheetData></worksheet>";
  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    "</Relationships>";
  const styles =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
    "</styleSheet>";
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    "</Types>";
  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    "</Relationships>";
  const enc = (s: string) => new TextEncoder().encode(s);
  return zipWrite({
    "[Content_Types].xml": enc(contentTypes),
    "_rels/.rels": enc(rootRels),
    "xl/workbook.xml": enc(workbook),
    "xl/_rels/workbook.xml.rels": enc(workbookRels),
    "xl/styles.xml": enc(styles),
    "xl/worksheets/sheet1.xml": enc(sheet),
  });
}
