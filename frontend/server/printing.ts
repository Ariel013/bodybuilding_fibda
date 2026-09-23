import { examReport } from "../domain/domain";
import { Problem } from "./problem";

// Documents imprimables et téléchargeables : portage de backend/fibda/printing.py.
// L'habilitation appartient à l'appelant (route dans app.ts), comme côté Python.
// Pas de génération PDF ni XLSX ici (pas de reportlab/openpyxl en serverless) :
// l'impression passe par la boîte de dialogue du navigateur sur le HTML.

export const KINDS = new Set(["blank", "ballot", "recap", "registrations", "programme", "measures", "results", "rewards", "diploma", "exams", "officials"]);
export const TITLES: Record<string, string> = {
  blank: "Bulletin vierge",
  ballot: "Bulletin individuel",
  recap: "Récapitulatif des bulletins",
  registrations: "Inscriptions",
  programme: "Programme",
  measures: "Mesures",
  results: "Résultats",
  rewards: "Récompenses",
  diploma: "Diplôme",
  exams: "Examens des stagiaires",
  officials: "Officiels",
};

export type Filters = { category_id?: string | null; round_id?: string | null; judge_id?: string | null };
type Cell = string | number | null | undefined;
// Une section = (titre, en-têtes, lignes), comme le tuple Python.
export type Section = [string, string[], Cell[][]];

// `str(value if value is not None else '')` côté Python.
const text = (value: unknown): string => (value === null || value === undefined ? "" : String(value));

// Équivalent de `html.escape(s, quote=True)` : & < > " ' échappés.
export function escapeHtml(value: unknown): string {
  return text(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

// `document_sections` (printing.py:11-116) : même découpage, mêmes libellés.
export function documentSections(state: any, kind: string, filters: Filters = {}): Section[] {
  if (!KINDS.has(kind)) throw new Problem("Document inconnu"); // ValueError → 422 côté Python (app.py:117)
  const categoryId = filters.category_id || null;
  const roundId = filters.round_id || null;
  const judgeId = filters.judge_id || null;
  const people: Record<string, any> = Object.fromEntries((state.people ?? []).map((p: any) => [p.id, p]));
  const entries: Record<string, any> = Object.fromEntries((state.entries ?? []).map((e: any) => [e.id, e]));
  const users: Record<string, string> = Object.fromEntries((state.users ?? []).map((u: any) => [u.id, u.name ?? u.id]));
  const judgeName = (uid: string): string => users[uid] ?? uid;
  const identity = (entryId: string | null | undefined): Cell[] => {
    const entry = entries[entryId ?? ""] ?? {};
    const person = people[entry.person_id] ?? {};
    return [entry.bib ?? "", ((person.first_name ?? "") + " " + (person.last_name ?? "")).trim()];
  };
  const categories: any[] = (state.categories ?? []).filter((c: any) => !categoryId || c.id === categoryId).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  const rounds: any[] = (state.rounds ?? []).filter((r: any) => (!roundId || r.id === roundId) && (!categoryId || r.category_id === categoryId));
  const sections: Section[] = [];

  if (["blank", "ballot", "recap", "results", "diploma"].includes(kind)) {
    for (const rnd of rounds) {
      const cat = (state.categories ?? []).find((c: any) => c.id === rnd.category_id) ?? {};
      const title = `${cat.name ?? rnd.category_id} - ${rnd.phase ?? ""} - ${rnd.status ?? ""}`;
      if (["blank", "ballot", "recap"].includes(kind)) {
        const panel: string[] = rnd.panel ?? Object.keys(rnd.ballots ?? {});
        const trainees: string[] = rnd.trainees ?? [];
        const judges = [...new Set([...panel, ...trainees])];
        // Un bulletin individuel exige un juge nommé (printing.py:33).
        if (kind === "ballot" && !judgeId) continue;
        for (const uid of judges) {
          if (judgeId && uid !== judgeId) continue;
          const role = trainees.includes(uid) ? "stagiaire" : "officiel";
          let label = title + ` - juge ${judgeName(uid)} (${role}) - tour version ${rnd.version ?? 1}`;
          if (kind === "blank") {
            // Plan papier de secours : une ligne par dossard, case de rang ou de sélection.
            const selection = rnd.phase === "elimination";
            const participants: string[] = rnd.participant_ids ?? [];
            let rows: Cell[][] = participants.map((e) => [...identity(e), selection ? "[ ]" : "______"]);
            if (!participants.length) {
              label += " - participants à confirmer";
              rows = Array.from({ length: 6 }, () => ["______", "________________________", selection ? "[ ]" : "______"]);
            }
            sections.push([label + (selection ? ` - sélectionner ${rnd.quota ?? ""} athlètes` : " - rangs uniques"), ["Dossard", "Athlète", selection ? "Sélection" : "Rang"], rows]);
            continue;
          }
          const ballot = (rnd.ballots ?? {})[uid];
          if (!ballot) {
            const status = (rnd.expired_trainees ?? []).includes(uid) ? "Expiré" : "Manquant";
            sections.push([label + " - " + status, ["Dossard", "Athlète", "Vote"], [["", "", status]]]);
            continue;
          }
          const hasRanking = "ranking" in ballot;
          const ordered: string[] = hasRanking ? ballot.ranking : (ballot.selected ?? []);
          const rows: Cell[][] = ordered.map((e, i) => [...identity(e), hasRanking ? i + 1 : "Sélectionné"]);
          const status = ballot.corrections && ballot.corrections.length ? "Rectifié" : "Reçu";
          label += ` - ${status} - bulletin version ${ballot.version ?? 1} - ${ballot.source ?? "digital"} - reçu ${ballot.received_at ?? ""}`;
          sections.push([label, ["Dossard", "Athlète", "Vote"], rows]);
        }
      } else {
        const result = rnd.result ?? {};
        const rows: Cell[][] = [];
        (result.official ?? []).forEach((item: any, i: number) => {
          const plain = typeof item === "string";
          const eid = plain ? item : (item.entry_id ?? item.id);
          const rank = plain ? i + 1 : (item.rank ?? i + 1);
          rows.push([rank, ...identity(eid), plain ? "" : (item.score ?? item.total ?? "")]);
        });
        if (kind === "diploma") {
          // Un diplôme n'existe que sur un résultat validé ou publié (printing.py:67).
          if (!["validated", "published"].includes(rnd.status)) continue;
          for (const row of rows) sections.push(["Diplôme - " + text(row[2]), ["Compétition", "Catégorie", "Classement", "Dossard"], [[state.name ?? "", cat.name ?? "", row[0], row[1]]]]);
        } else {
          sections.push([title + ` - résultat version ${result.version ?? "-"}`, ["Rang", "Dossard", "Athlète", "Points"], rows]);
        }
      }
    }
  } else if (["registrations", "measures", "programme"].includes(kind)) {
    for (const category of categories) {
      if (kind === "programme") {
        const rows: Cell[][] = rounds.filter((r) => r.category_id === category.id).map((r) => [r.phase, r.status, (r.participant_ids ?? []).length]);
        sections.push([category.name, ["Phase", "État", "Effectif"], rows]);
        continue;
      }
      const rows: Cell[][] = [];
      for (const entry of Object.values(entries)) {
        if (entry.category_id !== category.id) continue;
        const person = people[entry.person_id] ?? {};
        const base = identity(entry.id);
        rows.push([
          ...base,
          ...(kind === "measures"
            ? [person.height_cm ?? "", person.weight_kg ?? "", person.measurements_confirmed ? "Oui" : "À contrôler"]
            : [person.club ?? "", person.country ?? "", entry.confirmed ? "Oui" : "Non"]),
        ]);
      }
      sections.push([category.name, ["Dossard", "Athlète", ...(kind === "measures" ? ["Taille cm", "Poids kg", "Contrôle"] : ["Club", "Pays", "Confirmé"])], rows]);
    }
  } else if (kind === "officials") {
    sections.push([
      "Officiels",
      ["Nom", "Fonction", "Organisation", "Pays", "Parcours"],
      (state.officials ?? []).map((p: any) => [((p.first_name ?? "") + " " + (p.last_name ?? "")).trim(), p.post ?? "", p.organization ?? "", p.country ?? "", p.pedigree ?? ""]),
    ]);
  } else if (kind === "rewards") {
    // Regroupement par catégorie, dans l'ordre d'apparition (dict Python ordonné).
    const grouped = new Map<string, Cell[][]>();
    for (const reward of state.rewards ?? []) {
      if (categoryId && reward.category_id !== categoryId) continue;
      if (roundId && reward.round_id !== roundId) continue;
      const category = categories.find((c) => c.id === reward.category_id) ?? {};
      const group = (reward.kind === "overall" ? "Overall - " : "") + (category.name ?? "Récompenses collectives");
      const [bib, ident] = identity(reward.entry_id);
      const name = reward.collective_name || ident;
      const row: Cell[] = [reward.title ?? "", bib, name, reward.trophy ?? "", reward.medal ?? "", reward.lot ?? "", text(reward.prize ?? "") + " " + (reward.currency ?? ""), reward.prepared ? "Oui" : "Non", reward.delivered ? "Oui" : "Non"];
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group)!.push(row);
    }
    for (const [group, rows] of grouped) sections.push([group, ["Titre", "Dossard", "Lauréat", "Trophée", "Médaille", "Lot", "Prime", "Préparé", "Remis"], rows]);
  } else if (kind === "exams") {
    for (const program of state.exam_programs ?? []) {
      const uid: string = program.user_id ?? "";
      if (judgeId && uid !== judgeId) continue;
      const report = examReport(program, state.rounds ?? [], uid);
      const mean = report.mean?.display ?? "N/D";
      const title = `Stagiaire ${judgeName(uid)} - moyenne ${mean} % - ${report.categories} catégories - ${report.pairs} paires - décision ${program.decision ?? "En attente"}`;
      const rows: Cell[][] = report.details.map((d) => [d.round_id, d.score.display, d.pairs, text(d.reference_version ?? "")]);
      for (const rid of report.missing) rows.push([rid, "Manquant ou non comparable", "", ""]);
      sections.push([title, ["Manche", "Concordance %", "Paires", "Version référence"], rows]);
    }
  }
  return sections;
}

// `render_print` (printing.py:119-137) : HTML autonome, bouton d'impression masqué à l'impression,
// saut de page par section, logo servi par URL (jamais en base64), toute valeur échappée.
export function renderPrint(state: any, kind: string, filters: Filters = {}): string {
  const sections = documentSections(state, kind, filters);
  const esc = escapeHtml;
  const version = esc(state.version ?? "");
  const parts: string[] = [
    '<!doctype html><html lang="fr"><meta charset="utf-8"><title>' + esc(TITLES[kind]) + "</title>" +
      "<style>body{font:12pt Arial;color:#142e28;margin:24px}img{height:60px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #879e96;padding:7px;text-align:left}thead{display:table-header-group}tr{break-inside:avoid}section{break-before:page}section:first-of-type{break-before:auto}footer{margin-top:20px;font-size:10pt}@media print{button{display:none}@page{size:A4;margin:15mm}}</style>" +
      '<button onclick="window.print()">Imprimer</button><header><img src="/assets/fibda-logo.jpg" alt="FIBDA"><h1>' + esc(TITLES[kind]) + "</h1><p>" +
      esc(state.name ?? "") + " - " + esc(state.date ?? "") + " - version événement " + version + "</p></header>",
  ];
  if (kind === "diploma") parts.push("<style>@page{size:A4 landscape}.diploma{text-align:center;padding:18mm 12mm}.diploma h2{font-size:32pt}.diploma p{font-size:20pt}</style>");
  for (const [title, headers, rows] of sections) {
    if (kind === "diploma") {
      const row = rows[0];
      parts.push('<section class="diploma"><h2>' + esc(title) + "</h2><p>" + esc(row[0]) + "</p><p>" + esc(row[1]) + " - classement " + esc(row[2]) + "</p><p>Dossard " + esc(row[3]) + "</p><footer>Version événement " + version + " - Date : __________ Signature : __________________</footer></section>");
      continue;
    }
    parts.push('<section><table><thead><tr><th colspan="' + headers.length + '">' + esc(title) + " - version événement " + version + "</th></tr><tr>" + headers.map((h) => "<th>" + esc(h) + "</th>").join("") + "</tr></thead><tbody>");
    for (const row of rows) parts.push("<tr>" + row.map((c) => "<td>" + esc(c) + "</td>").join("") + "</tr>");
    parts.push("</tbody></table><footer>Date : __________ Nom et signature : ____________________</footer></section>");
  }
  if (!sections.length) parts.push("<p>Aucune donnée correspondant à cette sélection.</p>");
  parts.push("</html>");
  return parts.join("");
}

// Neutralisation des formules tableur (printing.py:142-144) : préfixe apostrophe si la valeur
// commence par = + - @ (après espaces de tête).
export function safeCell(value: unknown): string {
  const t = text(value);
  return /^\s*[=+\-@]/.test(t) ? "'" + t : t;
}

// Une ligne au format de `csv.writer` par défaut (Python) : séparateur virgule, guillemets
// doublés, champ entouré s'il contient virgule, guillemet ou saut de ligne, fin de ligne CRLF ;
// une ligne réduite à un seul champ vide s'écrit `""`.
function csvRow(cells: string[]): string {
  if (cells.length === 1 && cells[0] === "") return '""\r\n';
  return cells.map((c) => (/[",\r\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c)).join(",") + "\r\n";
}

export type Exported = { data: Uint8Array<ArrayBuffer>; mime: string; name: string };

// `export_document` (printing.py:140-152), format csv uniquement : UTF-8 avec BOM.
// xlsx et pdf ne sont pas disponibles sur cette version (pas d'openpyxl ni de reportlab) :
// la route répond 501 avant d'arriver ici.
export function exportDocument(state: any, kind: string, format: string, filters: Filters = {}): Exported {
  const sections = documentSections(state, kind, filters);
  if (format === "csv") {
    let out = "";
    for (const [title, headers, rows] of sections) {
      out += csvRow([safeCell(title)]);
      out += csvRow(headers);
      for (const row of rows) out += csvRow(row.map(safeCell));
    }
    const body = new TextEncoder().encode(out);
    const data = new Uint8Array(new ArrayBuffer(3 + body.length));
    data.set([0xef, 0xbb, 0xbf]);
    data.set(body, 3);
    return { data, mime: "text/csv; charset=utf-8", name: kind + ".csv" };
  }
  throw new Problem("Format attendu csv, xlsx ou pdf");
}
