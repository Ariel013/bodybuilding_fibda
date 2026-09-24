// Écriture PDF sans dépendance : PDF 1.4 texte, polices standard Helvetica et Helvetica-Bold
// (non embarquées, encodage WinAnsi : les accents du français passent, œ/Œ/€ compris ; tout autre
// caractère hors table est rendu « ? »). Les chaînes sont écrites en hexadécimal, ce qui évite
// tout échappement ; le fichier est assemblé en latin1 (un caractère = un octet) et les décalages
// de la table xref sont mesurés en octets. Mise en page volontairement simple : tableau à
// colonnes de largeur égale, texte replié dans la cellule, saut de page automatique avec rappel
// du titre et des en-têtes, pied de page avec numéro, une section par page comme l'impression HTML.

export const A4: [number, number] = [595.28, 841.89];

// Largeurs Helvetica (AFM, pour 1000 unités) des caractères ASCII 32 à 126, pour replier le texte.
const WIDTHS = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];

// Caractères courants sans code WinAnsi, remplacés par un équivalent lisible plutôt que « ? ».
const SUBSTITUTES: Record<string, string> = { "≤": "<=", "≥": ">=", "≠": "!=", "→": "->", "←": "<-", "−": "-", "′": "'", "″": '"', "ʼ": "'", "\u00a0": " ", "\u202f": " " };
const substitute = (text: string): string => text.normalize("NFC").replace(/[≤≥≠→←−′″ʼ\u00a0\u202f]/g, (ch) => SUBSTITUTES[ch]);

// Largeur d'un texte en points ; une lettre accentuée est comptée comme sa lettre de base ; le gras
// est légèrement plus large (approximation, la mise en page n'exige pas la précision typographique).
export function textWidth(text: string, size: number, bold = false): number {
  let units = 0;
  for (const ch of substitute(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "")) {
    const code = ch.charCodeAt(0);
    units += code >= 32 && code <= 126 ? WIDTHS[code - 32] : 556;
  }
  return (units / 1000) * size * (bold ? 1.06 : 1);
}

// Caractères hors Latin-1 disposant d'un code WinAnsi.
const WINANSI: Record<string, number> = { "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f };

// Chaîne PDF hexadécimale en WinAnsi.
export function encodeText(text: string): string {
  let hex = "";
  for (const ch of substitute(text)) {
    const code = ch.codePointAt(0)!;
    const byte = code < 0x80 || (code >= 0xa0 && code <= 0xff) ? code : (WINANSI[ch] ?? 0x3f);
    hex += byte.toString(16).padStart(2, "0");
  }
  return "<" + hex + ">";
}

const num = (n: number): string => (Math.round(n * 100) / 100).toString();

// Une page = suite d'opérateurs de contenu.
export class Page {
  private ops: string[] = [];
  constructor(public readonly width: number, public readonly height: number) {}
  text(x: number, y: number, value: string, size: number, bold = false): void {
    this.ops.push(`BT /${bold ? "F2" : "F1"} ${num(size)} Tf ${num(x)} ${num(y)} Td ${encodeText(value)} Tj ET`);
  }
  textCentered(y: number, value: string, size: number, bold = false): void {
    this.text((this.width - textWidth(value, size, bold)) / 2, y, value, size, bold);
  }
  textRight(x: number, y: number, value: string, size: number, bold = false): void {
    this.text(x - textWidth(value, size, bold), y, value, size, bold);
  }
  line(x1: number, y1: number, x2: number, y2: number, width = 0.5): void {
    this.ops.push(`${num(width)} w 0.53 0.62 0.59 RG ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`);
  }
  fill(x: number, y: number, w: number, h: number, rgb: [number, number, number]): void {
    this.ops.push(`${rgb.map(num).join(" ")} rg ${num(x)} ${num(y)} ${num(w)} ${num(h)} re f 0 0 0 rg`);
  }
  content(): string {
    return this.ops.join("\n");
  }
}

// Assemble le document : objets Catalog, Pages, Page, Contents, polices, Info, table xref.
export function buildPdf(pages: Page[], title: string): Uint8Array<ArrayBuffer> {
  const objects: string[] = [];
  const add = (body: string): number => objects.push(body); // numéro d'objet = position (1-based)
  const catalog = add(""); // rempli plus bas, une fois les numéros connus
  const pagesId = add("");
  const font1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const font2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pageIds: number[] = [];
  for (const page of pages) {
    const content = page.content();
    const contents = add(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(page.width)} ${num(page.height)}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${contents} 0 R >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => id + " 0 R").join(" ")}] /Count ${pageIds.length} >>`;
  const info = add(`<< /Title ${encodeText(title)} /Producer (FIBDA) >>`);
  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += offset.toString().padStart(10, "0") + " 00000 n \n";
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const buf = Buffer.from(out, "latin1");
  return new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
}

// --- Mise en page des documents tabulaires ---------------------------------------------------

export type TableSection = { heading: string; headers: string[]; rows: (string | number | null | undefined)[][] };
export type Layout = {
  title: string;
  landscape?: boolean;
  sections: TableSection[];
  footerLeft: string;
  footerRight: string; // « … - page » : le numéro est ajouté
  empty: string;
};

const MARGIN = 36;
const FOOTER_Y = 32;
const FONT = 8;
const LEADING = 11;
const PAD = 3;
const HEADER_FILL: [number, number, number] = [0.85, 0.93, 0.9];

// Replie un texte dans une largeur donnée : par mots, puis par caractères si un mot est trop long.
export function wrap(text: string, width: number, size: number, bold = false): string[] {
  const lines: string[] = [];
  for (const paragraph of String(text).split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      let candidate = line ? line + " " + word : word;
      if (textWidth(candidate, size, bold) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      // Mot plus large que la colonne : coupé caractère par caractère.
      for (const ch of word) {
        candidate = line + ch;
        if (textWidth(candidate, size, bold) > width && line) {
          lines.push(line);
          line = ch;
        } else line = candidate;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

const cellText = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

// Document tabulaire : une section par page, tableau à colonnes égales, en-têtes rappelés à chaque
// page, pied de page daté et numéroté.
export function renderTablePdf(layout: Layout): Uint8Array<ArrayBuffer> {
  const [w, h] = layout.landscape ? [A4[1], A4[0]] : A4;
  const pages: Page[] = [];
  const footer = (page: Page) => {
    page.text(MARGIN, FOOTER_Y, layout.footerLeft, FONT);
    page.textRight(w - MARGIN, FOOTER_Y, layout.footerRight + " " + pages.length, FONT);
  };
  const newPage = (): Page => {
    const page = new Page(w, h);
    pages.push(page);
    footer(page);
    return page;
  };
  const bottom = FOOTER_Y + 24;
  for (const section of layout.sections) {
    const columns = Math.max(1, section.headers.length);
    const colWidth = (w - 2 * MARGIN) / columns;
    let page = newPage();
    let y = h - MARGIN;
    // Ligne de titre fusionnée puis en-têtes, sur fond coloré ; rappelées à chaque nouvelle page.
    const drawRow = (cells: string[], bold: boolean, fill?: [number, number, number], span = false): number => {
      const wrapped = span ? [wrap(cells[0], w - 2 * MARGIN - 2 * PAD, FONT, bold)] : cells.map((c) => wrap(c, colWidth - 2 * PAD, FONT, bold));
      const height = Math.max(...wrapped.map((l) => l.length)) * LEADING + 2 * PAD;
      if (fill) page.fill(MARGIN, y - height, w - 2 * MARGIN, height, fill);
      wrapped.forEach((lines, c) => {
        lines.forEach((line, i) => page.text(MARGIN + c * colWidth + PAD, y - PAD - LEADING * (i + 1) + 3, line, FONT, bold));
      });
      page.line(MARGIN, y - height, w - MARGIN, y - height);
      if (!span) for (let c = 0; c <= columns; c++) page.line(MARGIN + c * colWidth, y, MARGIN + c * colWidth, y - height);
      return height;
    };
    const drawHead = () => {
      page.line(MARGIN, y, w - MARGIN, y);
      y -= drawRow([section.heading], true, HEADER_FILL, true);
      y -= drawRow(section.headers, true, HEADER_FILL);
    };
    const rowHeight = (cells: string[]): number => Math.max(...cells.map((c) => wrap(c, colWidth - 2 * PAD, FONT).length)) * LEADING + 2 * PAD;
    drawHead();
    for (const raw of section.rows) {
      const cells = section.headers.map((_, i) => cellText(raw[i]));
      if (y - rowHeight(cells) < bottom) {
        page = newPage();
        y = h - MARGIN;
        drawHead();
      }
      y -= drawRow(cells, false);
    }
  }
  if (!layout.sections.length) {
    const page = newPage();
    page.text(MARGIN, h - MARGIN - LEADING, layout.empty, FONT);
  }
  return buildPdf(pages, layout.title);
}

// Diplôme : une page paysage par lauréat, texte centré, comme le reportlab côté Python.
export type DiplomaPage = { name: string; competition: string; category: string; rank: string; bib: string };

export function renderDiplomaPdf(diplomas: DiplomaPage[], title: string, footerLeft: string, footerRight: string): Uint8Array<ArrayBuffer> {
  const [w, h] = [A4[1], A4[0]];
  const pages: Page[] = [];
  for (const d of diplomas) {
    const page = new Page(w, h);
    pages.push(page);
    let y = h - MARGIN - 80;
    for (const [value, size, bold] of [["DIPLÔME", 25, true], [d.name, 25, true], [d.competition, 25, false], [d.category + " - Classement " + d.rank, 25, false], ["Dossard " + d.bib, 18, true]] as [string, number, boolean][]) {
      page.textCentered(y, value, size, bold);
      y -= size + 31;
    }
    page.text(MARGIN, FOOTER_Y, footerLeft, FONT);
    page.textRight(w - MARGIN, FOOTER_Y, footerRight + " " + pages.length, FONT);
  }
  if (!pages.length) {
    const page = new Page(w, h);
    pages.push(page);
    page.text(MARGIN, h - MARGIN - LEADING, "Aucune donnée correspondant à cette sélection.", FONT);
  }
  return buildPdf(pages, title);
}

// Relecture de contrôle (tests) : concatène les chaînes hexadécimales affichées par Tj.
export function extractText(pdf: Uint8Array): string {
  const src = Buffer.from(pdf).toString("latin1");
  const out: string[] = [];
  const re = /<([0-9a-f]+)> Tj/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let s = "";
    for (let i = 0; i < m[1].length; i += 2) {
      const byte = parseInt(m[1].slice(i, i + 2), 16);
      const back = Object.entries(WINANSI).find(([, b]) => b === byte)?.[0];
      s += back ?? String.fromCharCode(byte);
    }
    out.push(s);
  }
  return out.join("\n");
}
