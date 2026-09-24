import { examReport } from "../domain/domain";
import { PHASES, passageOrderValid } from "./workflow";
import { Problem } from "./problem";
import { xlsxWrite, type XlsxRow } from "./xlsx";
import { renderTablePdf, renderDiplomaPdf, type DiplomaPage } from "./pdf";

// Documents imprimables et téléchargeables : portage de backend/fibda/printing.py.
// L'habilitation appartient à l'appelant (route dans app.ts), comme côté Python.
// XLSX et PDF sont produits par les écrivains maison xlsx.ts et pdf.ts (ni openpyxl ni reportlab
// en serverless) ; l'impression passe aussi par la boîte de dialogue du navigateur sur le HTML.

export const KINDS = new Set(["blank", "ballot", "recap", "registrations", "programme", "measures", "results", "rewards", "diploma", "exams", "officials", "fiche"]);
export const TITLES: Record<string, string> = {
  blank: "Bulletin vierge",
  ballot: "Bulletin individuel",
  recap: "Récapitulatif des bulletins",
  registrations: "Inscriptions",
  programme: "Ordre de passage",
  measures: "Mesures",
  results: "Résultats",
  rewards: "Récompenses",
  diploma: "Diplôme",
  exams: "Examens des stagiaires",
  officials: "Officiels",
  fiche: "Fiche d'inscription",
};

export type Filters = { category_id?: string | null; round_id?: string | null; judge_id?: string | null; person_id?: string | null };
type Cell = string | number | null | undefined;
// Une section = (titre, en-têtes, lignes), comme le tuple Python.
export type Section = [string, string[], Cell[][]];

// `str(value if value is not None else '')` côté Python.
const text = (value: unknown): string => (value === null || value === undefined ? "" : String(value));

// --- Ordre de passage ----------------------------------------------------------------------
export const PASSAGE_HEADERS = ["N° de passage", "Dossard", "Athlète", "Club"];
export const NOT_DRAWN = "ordre non encore tiré";
export const NOT_DRAWN_ROUND = "Ordre de passage non encore tiré pour ce tour";
const PHASE_LABELS: Record<string, string> = { elimination: "Éliminatoire", semi: "Demi-finale", final: "Finale", overall: "Toutes catégories" };
export const phaseLabel = (r: any): string => (r.grand_final ? "Toutes disciplines" : PHASE_LABELS[r.phase] ?? text(r.phase));
// Horodatage du tirage (secondes Unix) à l'heure de Côte d'Ivoire (UTC toute l'année).
export function formatDrawTime(at: unknown): string {
  const n = Number(at);
  if (!Number.isFinite(n)) return "";
  return new Date(n * 1000).toLocaleString("fr-FR", { timeZone: "Africa/Abidjan", dateStyle: "short", timeStyle: "short" });
}

// Équivalent de `html.escape(s, quote=True)` : & < > " ' échappés.
export function escapeHtml(value: unknown): string {
  return text(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

// --- Fiche d'inscription --------------------------------------------------------------------
// Une fiche par athlète : identité, catégories et dossards, mesures, contrôles administratifs,
// dérogation, signatures. Aucune valeur n'est déduite : un champ absent reste vide.

export type FicheCheck = { label: string; value: boolean | null }; // null = sans objet
export type Fiche = {
  person_id: string;
  title: string;
  photo_id: string | null;
  identity: [string, string][];
  entries: [string, string][]; // une ligne par inscription : catégorie → dossard
  measures: [string, string][];
  checks: FicheCheck[];
  derogation: string; // vide si aucune
  rows: () => Cell[][]; // aplati en « Rubrique / Valeur » pour le PDF et les sections
};

const yesNo = (v: unknown): string => (v ? "Oui" : "Non");
const SEX: Record<string, string> = { M: "Masculin", F: "Féminin" };
const SECTION: Record<string, string> = { amateur: "Amateur", pro: "Pro" };
const year = (iso: unknown): number | null => {
  const m = /^(\d{4})-\d{2}-\d{2}/.exec(text(iso));
  return m ? Number(m[1]) : null;
};

// Âge à l'année de l'événement, même calcul que l'admission (preparation.ts : différence des années).
export function ageAtEvent(state: any, person: any): number | null {
  const y = year(state.date);
  const b = year(person.birth_date);
  return y !== null && b !== null ? y - b : null;
}

// Les colonnes de l'export tabulaire (csv, xlsx) : une ligne par athlète.
export const FICHE_COLUMNS = ["Nom", "Prénom", "Date de naissance", "Âge", "Sexe", "Nationalités", "Pays", "Club", "Section", "Catégories", "Dossards", "Taille cm", "Poids kg", "Mesures confirmées", "Statut approuvé", "Licence", "Paiement", "Autorisation représentant légal", "Délégation", "Organisateur", "Dérogation"];

// Athlètes concernés, dans l'ordre des catégories puis des dossards ; `person_id` isole un athlète
// (même sans inscription), `category_id` toutes les fiches d'une catégorie.
export function fiches(state: any, filters: Filters = {}): Fiche[] {
  const personId = filters.person_id || null;
  const categoryId = filters.category_id || null;
  const people: any[] = state.people ?? [];
  const entries: any[] = state.entries ?? [];
  const categories: any[] = [...(state.categories ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const catIndex = new Map(categories.map((c, i) => [c.id, i]));
  const catName = (id: string): string => categories.find((c) => c.id === id)?.name ?? text(id);
  const users: Record<string, string> = Object.fromEntries((state.users ?? []).map((u: any) => [u.id, u.name ?? u.id]));
  const international = state.mode === "international";

  const ordered: string[] = [];
  const seen = new Set<string>();
  const sortedEntries = entries
    .filter((e) => (!categoryId || e.category_id === categoryId) && (!personId || e.person_id === personId))
    .sort((a, b) => (catIndex.get(a.category_id) ?? 1e9) - (catIndex.get(b.category_id) ?? 1e9) || Number(a.bib ?? 0) - Number(b.bib ?? 0));
  for (const e of sortedEntries) if (!seen.has(e.person_id)) { seen.add(e.person_id); ordered.push(e.person_id); }
  if (personId && !seen.has(personId) && !categoryId && people.some((p) => p.id === personId)) ordered.push(personId);

  return ordered.map((pid) => {
    const person = people.find((p) => p.id === pid) ?? {};
    const own = entries.filter((e) => e.person_id === pid).sort((a, b) => (catIndex.get(a.category_id) ?? 1e9) - (catIndex.get(b.category_id) ?? 1e9));
    const age = ageAtEvent(state, person);
    const minor = age !== null && age < 18;
    const name = ((person.last_name ?? "") + " " + (person.first_name ?? "")).trim();
    const bibs = own.map((e) => text(e.bib)).filter(Boolean);
    const derogations = own
      .filter((e) => e.derogation && typeof e.derogation === "object" && text(e.derogation.reason).trim())
      .map((e) => `${catName(e.category_id)} : ${text(e.derogation.reason).trim()}` + (e.derogation.signed_by ? ` (signée par ${users[e.derogation.signed_by] ?? e.derogation.signed_by})` : ""));
    const fiche: Fiche = {
      person_id: pid,
      title: `${TITLES.fiche} - ${name}` + (bibs.length ? ` - dossard ${bibs.join(", ")}` : ""),
      photo_id: person.photo_portrait || null,
      identity: [
        ["Nom", text(person.last_name)],
        ["Prénom", text(person.first_name)],
        ["Date de naissance", text(person.birth_date)],
        ["Âge (année de l'événement)", age === null ? "" : String(age)],
        ["Sexe", SEX[person.sex] ?? text(person.sex)],
        ["Nationalités", Array.isArray(person.nationalities) ? person.nationalities.map(text).join(", ") : text(person.nationalities)],
        ["Pays", text(person.country)],
        ["Club", text(person.club)],
        ["Section", SECTION[person.section] ?? text(person.section)],
      ],
      entries: own.length ? own.map((e) => [catName(e.category_id), text(e.bib)]) : [["Catégorie", "Aucune inscription"]],
      measures: [
        ["Taille cm", text(person.height_cm)],
        ["Poids kg", text(person.weight_kg)],
        ["Mesures confirmées", person.measurements_confirmed ? "Oui" : "À contrôler"],
      ],
      checks: [
        { label: "Statut approuvé", value: Boolean(person.status_approved) },
        { label: "Licence", value: Boolean(person.licence_ok) },
        { label: "Paiement", value: Boolean(person.payment_ok) },
        { label: "Autorisation du représentant légal (mineur)", value: minor ? Boolean(person.minor_authorization) : null },
        { label: "Délégation", value: international ? Boolean(person.delegation_approved) : null },
        { label: "Organisateur", value: international ? Boolean(person.organizer_approved) : null },
      ],
      derogation: derogations.join(" ; "),
      rows: () => [
        ...fiche.identity,
        ...fiche.entries.map(([c, b]): Cell[] => ["Catégorie - dossard", c + (b ? " - dossard " + b : "")]),
        ...fiche.measures,
        ...fiche.checks.map((c): Cell[] => [c.label, c.value === null ? "Sans objet" : c.value ? "[X]" : "[ ]"]),
        ["Dérogation", fiche.derogation || "Aucune"],
      ],
    };
    return fiche;
  });
}

// Une ligne par athlète pour csv et xlsx, colonnes FICHE_COLUMNS.
function ficheTableRow(fiche: Fiche, state: any): Cell[] {
  const own: any[] = (state.entries ?? []).filter((e: any) => e.person_id === fiche.person_id);
  const check = (i: number): string => (fiche.checks[i].value === null ? "Sans objet" : yesNo(fiche.checks[i].value));
  return [
    ...fiche.identity.map(([, v]) => v),
    own.length ? fiche.entries.map(([c]) => c).join(" ; ") : "",
    own.map((e) => text(e.bib)).filter(Boolean).join(" ; "),
    ...fiche.measures.map(([, v]) => v),
    ...fiche.checks.map((_, i) => check(i)),
    fiche.derogation,
  ];
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
  } else if (kind === "programme") {
    // Ordre de passage sur scène (PO 24/09/2026) : tiré au sort à chaque tour parmi les athlètes
    // encore en lice. Trois lectures : générale (une section par catégorie, tour courant ou à
    // venir), détaillée d'un tour (`round_id`), tous les tours tirés d'une catégorie (`category_id`).
    const byBib = (ids: string[]): string[] => [...ids].sort((a, b) => Number(entries[a]?.bib ?? 0) - Number(entries[b]?.bib ?? 0));
    const club = (entryId: string): string => people[entries[entryId]?.person_id]?.club ?? "";
    const drawn = (r: any): boolean => passageOrderValid(r);
    // Lignes dans l'ordre tiré (numérotées 1..n), sinon par dossard sans numéro.
    const categoryIds = (catId: string): string[] => Object.values(entries).filter((e) => e.category_id === catId).map((e) => e.id);
    // Lignes dans l'ordre tiré (numérotées 1..n) ; sinon par dossard sans numéro, sur les participants
    // connus du tour ou, tant qu'ils ne le sont pas (tour dépendant en attente), sur la catégorie.
    const passageRows = (r: any): Cell[][] =>
      drawn(r)
        ? (r.passage_order as string[]).map((e, i) => [i + 1, ...identity(e), club(e)])
        : byBib((r.participant_ids ?? []).length ? r.participant_ids : categoryIds(r.category_id)).map((e) => ["", ...identity(e), club(e)]);
    const lastDraw = (r: any): any => (r.draws ?? [])[(r.draws ?? []).length - 1] ?? null;
    const drawNote = (r: any): string => {
      const d = lastDraw(r);
      const when = d ? formatDrawTime(d.at) : "";
      const who = d?.by ? judgeName(d.by) : "automatiquement à l’ouverture";
      return `tiré ${d?.by ? "par " + who : who}${when ? " le " + when : ""} - ${(r.passage_order ?? []).length} athlète(s)`;
    };
    const detailed = (r: any): Section => {
      const cat = (state.categories ?? []).find((c: any) => c.id === r.category_id) ?? {};
      const base = `Ordre de passage - ${cat.name ?? (r.grand_final ? "Overall final" : r.category_id)} - ${phaseLabel(r)}`;
      return [base + " - " + (drawn(r) ? drawNote(r) : NOT_DRAWN_ROUND), PASSAGE_HEADERS, passageRows(r)];
    };
    if (roundId) {
      for (const r of rounds) sections.push(detailed(r));
    } else {
      for (const category of categories) {
        const own = rounds.filter((r) => r.category_id === category.id).sort((a, b) => (PHASES[a.phase] ?? 99) - (PHASES[b.phase] ?? 99));
        if (categoryId) {
          // Tous les tours tirés de la catégorie, du premier au dernier ; sinon la lecture générale.
          const withDraw = own.filter(drawn);
          if (withDraw.length) {
            for (const r of withDraw) sections.push(detailed(r));
            continue;
          }
        }
        // Tour courant ou à venir : le premier non clos ; à défaut le dernier.
        const current = own.find((r) => !["validated", "published"].includes(r.status)) ?? own[own.length - 1] ?? null;
        const prefix = `${categories.indexOf(category) + 1}. ${category.name}`;
        if (!current) {
          const ids = byBib(categoryIds(category.id));
          sections.push([prefix + " - aucun tour prévu", PASSAGE_HEADERS, ids.map((e) => ["", ...identity(e), club(e)])]);
          continue;
        }
        const title = `${prefix} - ${phaseLabel(current)} (effectif ${(current.participant_ids ?? []).length})` + (drawn(current) ? " - " + drawNote(current) : " - " + NOT_DRAWN);
        sections.push([title, PASSAGE_HEADERS, passageRows(current)]);
      }
    }
  } else if (["registrations", "measures"].includes(kind)) {
    for (const category of categories) {
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
  } else if (kind === "fiche") {
    for (const fiche of fiches(state, filters)) sections.push([fiche.title, ["Rubrique", "Valeur"], fiche.rows()]);
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
  if (kind === "fiche") {
    // Une page par athlète : en-tête d'événement rappelé, photo portrait servie par URL (session de
    // préparation exigée par la route photo), rubriques, cases à cocher, dérogation, signatures.
    parts.push("<style>.fiche{position:relative}.fiche h2{margin:0 0 6px}.fiche .portrait{position:absolute;top:0;right:0;width:35mm;height:45mm;object-fit:cover;border:1px solid #879e96}.fiche h3{margin:14px 0 4px;font-size:12pt;border-bottom:1px solid #879e96}.fiche table{width:auto;min-width:60%}.fiche th{width:45%}.fiche .checks p{margin:4px 0}.fiche .signatures{display:flex;gap:16px;margin-top:28px}.fiche .signatures div{flex:1;border:1px solid #879e96;height:32mm;padding:6px}</style>");
    const meta = esc(state.name ?? "") + " - " + esc(state.date ?? "") + (state.location ? " - " + esc(state.location) : "");
    const kv = (rows: [string, string][]): string => "<table>" + rows.map(([k, v]) => "<tr><th>" + esc(k) + "</th><td>" + esc(v) + "</td></tr>").join("") + "</table>";
    for (const fiche of fiches(state, filters)) {
      parts.push('<section class="fiche"><h2>' + esc(fiche.title) + "</h2><p>" + meta + "</p>");
      if (fiche.photo_id) parts.push('<img class="portrait" src="/api/v1/photos/' + esc(fiche.photo_id) + '" alt="Portrait">');
      parts.push("<h3>Identité</h3>" + kv(fiche.identity));
      parts.push("<h3>Catégories et dossards</h3>" + kv(fiche.entries.map(([c, b]) => [c, b ? "Dossard " + b : ""])));
      parts.push("<h3>Mesures</h3>" + kv(fiche.measures));
      parts.push('<h3>Contrôles administratifs</h3><div class="checks">' + fiche.checks.map((c) => "<p>" + (c.value === null ? "&#9744; " + esc(c.label) + " - sans objet" : (c.value ? "&#9745; " : "&#9744; ") + esc(c.label)) + "</p>").join("") + "</div>");
      parts.push("<h3>Dérogation</h3><p>" + (fiche.derogation ? esc(fiche.derogation) : "Aucune") + "</p>");
      parts.push('<div class="signatures"><div>Athlète</div><div>Responsable</div><div>Chef des juges</div><div>Date</div></div>');
      parts.push("<footer>Version événement " + version + "</footer></section>");
    }
    if (!sections.length) parts.push("<p>Aucune donnée correspondant à cette sélection.</p>");
    parts.push("</html>");
    return parts.join("");
  }
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

// `export_document` (printing.py:140-208) : csv (UTF-8 avec BOM), xlsx (une feuille, titre de
// section en gras puis en-têtes puis lignes puis ligne vide, deux premières lignes figées) et pdf
// (une section par page, diplôme en paysage). Les formules sont neutralisées dans les trois formats.
export function exportDocument(state: any, kind: string, format: string, filters: Filters = {}): Exported {
  let sections = documentSections(state, kind, filters);
  // Fiches en tableur : une seule table, une ligne par athlète avec toutes les colonnes.
  if (kind === "fiche" && (format === "csv" || format === "xlsx")) {
    sections = [["Fiches d'inscription", FICHE_COLUMNS, fiches(state, filters).map((f) => ficheTableRow(f, state))]];
  }
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
  if (format === "xlsx") {
    const rows: XlsxRow[] = [];
    for (const [title, headers, sectionRows] of sections) {
      rows.push({ cells: [safeCell(title)], bold: true }, { cells: headers, bold: true });
      // Les nombres restent des nombres (comme openpyxl) ; toute chaîne passe par safeCell.
      for (const row of sectionRows) rows.push({ cells: row.map((c) => (typeof c === "number" ? c : safeCell(c))) });
      rows.push({ cells: [] });
    }
    return { data: xlsxWrite(TITLES[kind], rows), mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: kind + ".xlsx" };
  }
  if (format === "pdf") {
    const footerLeft = "Date : __________ Nom et signature : ____________________";
    const footerRight = "Version événement " + text(state.version ?? "") + " - page";
    let data: Uint8Array<ArrayBuffer>;
    if (kind === "diploma") {
      const diplomas: DiplomaPage[] = sections.map(([title, , rows]) => {
        const row = rows[0];
        return { name: title.replace(/^Diplôme - /, ""), competition: text(row[0]), category: text(row[1]), rank: text(row[2]), bib: text(row[3]) };
      });
      data = renderDiplomaPdf(diplomas, TITLES[kind], footerLeft, footerRight);
    } else {
      data = renderTablePdf({
        title: TITLES[kind],
        sections: sections.map(([title, headers, rows]) => ({ heading: TITLES[kind] + " - " + text(state.name ?? "") + " - " + title, headers, rows })),
        footerLeft,
        footerRight,
        empty: "Aucune donnée correspondant à cette sélection.",
      });
    }
    return { data, mime: "application/pdf", name: kind + ".pdf" };
  }
  throw new Problem("Format attendu csv, xlsx ou pdf");
}
