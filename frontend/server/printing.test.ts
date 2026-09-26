import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "./app";
import { Store } from "./store";
import { documentSections, renderPrint, exportDocument, escapeHtml, fiches, parseBlank, notationSections, juryRows, FICHE_COLUMNS, BLANK_LINE, JUDGES_PART, TITLES, JUDGE_LINE, CHECKBOX, CHECKBOX_PDF, TO_CONFIRM } from "./printing";
import { publicState, collective, syncCollectiveRewards } from "./projections";
import { newState } from "./state";
import { xlsxRead } from "./xlsx";
import { extractText, buildPdf, Page, wrap, encodeText, textWidth } from "./pdf";

// Portage des parties impression/export de backend/tests/test_operations.py et
// backend/tests/test_http_operations.py, plus un parcours HTTP sur la démonstration.
// Différences acceptées : xlsx et pdf produits par les écrivains maison (pas openpyxl/reportlab),
// pas de WebSocket, jeton de configuration pour la démo.

// Contrôle structurel d'un PDF : en-tête, chaque entrée de la xref pointe sur « n 0 obj », startxref
// pointe sur la table, longueur des flux exacte. Aucun lecteur PDF n'est disponible sur la machine.
function checkPdf(data: Uint8Array): { pages: number; mediaBoxes: string[] } {
  const src = Buffer.from(data).toString("latin1");
  assert.ok(src.startsWith("%PDF-1."));
  assert.ok(src.endsWith("%%EOF\n"));
  const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(src)![1]);
  assert.ok(src.slice(startxref).startsWith("xref\n"), "startxref");
  const count = Number(/xref\n0 (\d+)\n/.exec(src.slice(startxref))![1]);
  const table = src.slice(startxref).split("\n").slice(2, 2 + count);
  assert.equal(table[0], "0000000000 65535 f ");
  for (let i = 1; i < count; i++) {
    assert.equal(table[i].length, 19, "entrée xref de 20 octets");
    const offset = Number(table[i].slice(0, 10));
    assert.ok(src.slice(offset).startsWith(i + " 0 obj\n"), "objet " + i + " à " + offset);
  }
  const lengths = /<< \/Length (\d+) >>\nstream\n/g;
  let m: RegExpExecArray | null;
  while ((m = lengths.exec(src))) assert.ok(src.slice(m.index + m[0].length).slice(Number(m[1])).startsWith("\nendstream"), "longueur de flux");
  return { pages: Number(/\/Count (\d+)/.exec(src)![1]), mediaBoxes: [...src.matchAll(/\/MediaBox \[([^\]]+)\]/g)].map((x) => x[1]) };
}

const json = (body: any, headers: Record<string, string> = {}) => ({ method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
const cookieOf = (r: Response) => (r.headers.get("set-cookie") ?? "").split(";")[0];
const body = async (r: Response | Promise<Response>): Promise<any> => { const t = await (await r).text(); try { return JSON.parse(t); } catch { return t; } };
const decode = (data: Uint8Array) => new TextDecoder().decode(data);

// Même état minimal que `state()` du test Python : nom d'événement porteur d'un script.
function state(): any {
  return {
    name: "<script>alert(1)</script>",
    version: 2,
    people: [{ id: "p", first_name: "A", last_name: "B" }],
    entries: [{ id: "e", person_id: "p", category_id: "c", bib: 7 }],
    categories: [{ id: "c", name: "Senior", discipline: "bikini" }],
    rounds: [{ id: "r", category_id: "c", phase: "final", status: "validated", participant_ids: ["e"], ballots: { j: { ranking: ["e"], version: 2, source: "paper" } }, result: { official: [{ entry_id: "e", rank: 1, total: 3 }] } }],
  };
}

test("échappement HTML et isolation du bulletin", () => {
  const html = renderPrint(state(), "ballot", { judge_id: "j" });
  assert.ok(!html.includes("<script>") && html.includes("&lt;script&gt;"));
  assert.ok(html.includes("juge j") && html.includes("version 2"));
  assert.ok(!html.toLowerCase().includes("exam"));
  assert.ok(html.includes("table-header-group"));
  assert.ok(!renderPrint(state(), "ballot", { judge_id: "other" }).includes("juge j"));
  // Sans juge nommé, aucun bulletin individuel n'est rendu.
  assert.ok(renderPrint(state(), "ballot").includes("Aucune donnée correspondant à cette sélection."));
  // Logo par URL, jamais en base64 ; bouton d'impression ; saut de page par section.
  assert.ok(html.includes('<img src="/assets/fibda-logo.jpg"') && !html.includes("data:image"));
  assert.ok(html.includes('onclick="window.print()"') && html.includes("section{break-before:page}"));
});

test("fiche de notation d'une éliminatoire et export csv", () => {
  const event = state();
  Object.assign(event.rounds[0], { phase: "elimination", quota: 1, status: "open" });
  const html = renderPrint(event, "blank");
  assert.ok(html.includes("quota 1") && html.includes("Sélectionné " + CHECKBOX));
  const { data, mime, name } = exportDocument(event, "registrations", "csv");
  assert.deepEqual([...data.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.equal(mime, "text/csv; charset=utf-8");
  assert.equal(name, "registrations.csv");
  // Format de `csv.writer` par défaut : virgule, CRLF, titre puis en-têtes puis lignes.
  assert.equal(decode(data.slice(3)), "Senior\r\nDossard,Athlète,Club,Pays,Confirmé\r\n7,A B,,,Non\r\n");
  assert.throws(() => exportDocument(event, "registrations", "txt"), /Format attendu/);
  assert.throws(() => documentSections(event, "inconnu"), /Document inconnu/);
});

test("neutralisation des formules et guillemets dans le csv", () => {
  const event = state();
  event.people[0].first_name = "=formula";
  event.people[0].last_name = 'Dit "Le Grand", B';
  const text = decode(exportDocument(event, "registrations", "csv").data);
  assert.ok(text.includes("'=formula"));
  assert.ok(text.includes('"\'=formula Dit ""Le Grand"", B"'));
});

test("export xlsx : une feuille, titre en gras, en-têtes, une ligne par inscription, formule neutralisée", () => {
  const event = state();
  event.people.push({ id: "p2", first_name: "=HYPERLINK(1)", last_name: "Aïcha <&> Kouamé" });
  event.entries.push({ id: "e2", person_id: "p2", category_id: "c", bib: 8 });
  const { data, mime, name } = exportDocument(event, "registrations", "xlsx");
  assert.equal(mime, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(name, "registrations.xlsx");
  assert.deepEqual([...data.slice(0, 2)], [0x50, 0x4b], "archive ZIP");
  const rows = xlsxRead(data);
  assert.deepEqual(rows[0], ["Senior", null, null, null, null]);
  assert.deepEqual(rows[1], ["Dossard", "Athlète", "Club", "Pays", "Confirmé"]);
  assert.deepEqual(rows[2], ["7", "A B", null, null, "Non"]);
  assert.deepEqual(rows[3], ["8", "'=HYPERLINK(1) Aïcha <&> Kouamé", null, null, "Non"]);
  assert.deepEqual(rows[4], [null, null, null, null, null], "ligne vide après la section, comme openpyxl");
  const sheet = Buffer.from(data).toString("latin1");
  assert.ok(!sheet.includes("<&>"), "XML échappé à l'écriture");
  // Le nom d'événement à script devient un titre de feuille inoffensif ; le titre de section neutralisé.
  event.categories[0].name = "=cmd";
  assert.equal(xlsxRead(exportDocument(event, "registrations", "xlsx").data)[0][0], "'=cmd");
});

test("export pdf : structure valide, texte relisible avec accents, une section par page, diplôme en paysage", () => {
  const event = state();
  event.name = "Coupe d'Abidjan – œuvre « été »";
  event.people[0].first_name = "Aïcha";
  event.people[0].last_name = "Kouamé (Côte d'Ivoire) \\";
  const { data, mime, name } = exportDocument(event, "registrations", "pdf");
  assert.equal(mime, "application/pdf");
  assert.equal(name, "registrations.pdf");
  let info = checkPdf(data);
  assert.equal(info.pages, 1);
  assert.equal(info.mediaBoxes[0], "0 0 595.28 841.89", "A4 portrait");
  // Le texte replié dans une cellule est recollé pour la comparaison (repli aux espaces).
  let text = extractText(data).replace(/\n/g, " ");
  assert.ok(text.includes("Catégories et athlètes - Coupe d'Abidjan – œuvre « été » - Senior"), text);
  assert.ok(text.includes("Aïcha Kouamé (Côte d'Ivoire) \\"), text);
  assert.ok(text.includes("Dossard") && text.includes("Athlète") && text.includes("Confirmé"));
  assert.ok(text.includes("Version événement 2 - page 1") && text.includes("Nom et signature"));
  // Deux catégories : deux pages ; le saut de page automatique rappelle le titre et les en-têtes.
  event.categories.push({ id: "c2", name: "Master" });
  for (let i = 0; i < 80; i++) {
    event.people.push({ id: "m" + i, first_name: "Prénom" + i, last_name: "Nom" });
    event.entries.push({ id: "me" + i, person_id: "m" + i, category_id: "c2", bib: 100 + i });
  }
  info = checkPdf(exportDocument(event, "registrations", "pdf").data);
  assert.equal(info.pages, 3);
  text = extractText(exportDocument(event, "registrations", "pdf").data).replace(/\n/g, " ");
  assert.equal(text.split("Catégories et athlètes - ").length - 1, 3, "titre rappelé sur la page de suite");
  assert.ok(text.includes("Prénom79"));
  // Diplôme : paysage, une page par lauréat, texte du diplôme.
  const diploma = exportDocument(event, "diploma", "pdf");
  info = checkPdf(diploma.data);
  assert.equal(info.pages, 1);
  assert.equal(info.mediaBoxes[0], "0 0 841.89 595.28", "A4 paysage");
  text = extractText(diploma.data);
  assert.ok(text.includes("DIPLÔME") && text.includes("Aïcha Kouamé") && text.includes("Senior - Classement 1") && text.includes("Dossard 7"));
  // Aucune section : une page avec le message.
  event.rounds[0].status = "open";
  assert.ok(extractText(exportDocument(event, "diploma", "pdf").data).includes("Aucune donnée"));
  assert.ok(extractText(exportDocument(event, "results", "pdf", { category_id: "zzz" }).data).includes("Aucune donnée"));
  // Encodage WinAnsi : accents en un octet, caractère hors table remplacé par « ? » ; repli des mots longs.
  assert.equal(encodeText("é€"), "<e980>");
  assert.equal(encodeText("中"), "<3f>", "hors table : point d'interrogation");
  assert.equal(encodeText("≤ 170"), "<3c3d20313730>", "≤ rendu <=");
  const wrapped = wrap("un mot trop long à replier", 30, 8);
  assert.ok(wrapped.length > 1 && wrapped.every((l) => textWidth(l, 8) <= 30));
  assert.equal(wrapped.join(" "), "un mot trop long à replier");
  assert.ok(wrap("abcdefghijklmnopqrstuvwxyz", 30, 8).length > 1);
  checkPdf(buildPdf([new Page(100, 100)], "vide"));
});

test("diplôme sur résultat validé seulement, examens séparés du bulletin", () => {
  const event = state();
  assert.ok(renderPrint(event, "diploma").includes("Diplôme - A B"));
  assert.ok(renderPrint(event, "diploma").includes("A4 landscape"));
  event.rounds[0].status = "open";
  assert.ok(!renderPrint(event, "diploma").includes("Diplôme - A B"));
  event.rounds[0].participant_ids = ["e", "e2"];
  event.exam_programs = [{ user_id: "trainee", round_ids: ["r"] }];
  const exams = renderPrint(event, "exams");
  assert.ok(exams.includes("N/D"));
  assert.ok(exams.includes("Manquant ou non comparable"));
  assert.ok(!renderPrint(event, "ballot", { judge_id: "j" }).includes("Concordance"));
});

test("affectation, bulletins manquants ou expirés, récompenses", () => {
  const event = state();
  const rnd = event.rounds[0];
  event.users = [{ id: "j", name: "Jean" }, { id: "t", name: "Tina" }, { id: "m", name: "Marc" }];
  Object.assign(rnd, { panel: ["j", "m"], trainees: ["t"], expired_trainees: ["t"] });
  rnd.ballots.j.corrections = [{ reason: "Rectification" }];
  // Fiche de notation : une seule fiche par manche, quel que soit le jury, sans nom de juge ni d'athlète.
  let blank = documentSections(event, "blank", { round_id: "r" });
  assert.equal(blank.length, 1);
  assert.ok(!blank[0][0].includes("Jean") && !blank[0][0].includes("Tina"));
  const recap = documentSections(event, "recap");
  assert.ok(recap[0][0].includes("Rectifié") && recap[1][0].includes("Manquant") && recap[2][0].includes("Expiré"));
  rnd.participant_ids = [];
  event.entries[0].confirmed = true;
  blank = documentSections(event, "blank", { judge_id: "j", round_id: "r" });
  // Participants inconnus : dossards confirmés de la catégorie, mention à confirmer.
  assert.ok(blank[0][0].includes(TO_CONFIRM) && blank[0][2].length === 1 && blank[0][2][0][0] === 7);
  event.entries[0].confirmed = false;
  blank = documentSections(event, "blank", { round_id: "r" });
  assert.ok(blank[0][0].includes(TO_CONFIRM) && blank[0][2].length === 6, "aucun dossard confirmé : six lignes vierges");
  event.rewards = [{ title: "Champion", category_id: "c", entry_id: "e", kind: "overall" }, { title: "Club", collective_name: "Club Abidjan" }];
  const rewards = documentSections(event, "rewards");
  assert.equal(rewards.length, 2);
  assert.equal(rewards[0][0], "Overall - Senior");
  assert.deepEqual(rewards[0][2][0].slice(1, 3), [7, "A B"]);
  assert.equal(rewards[1][2][0][2], "Club Abidjan");
  // Résultats, mesures, programme et officiels : une section par catégorie ou un tableau unique.
  assert.deepEqual(documentSections(event, "results")[0][2], [[1, 7, "A B", 3]]);
  assert.deepEqual(documentSections(event, "measures")[0][1], ["Dossard", "Athlète", "Taille cm", "Poids kg", "Contrôle"]);
  // Ordre de passage : phase en français et effectif dans le titre ; sans tirage, athlètes par dossard
  // sans numéro de passage et mention « ordre non encore tiré ».
  const programme = documentSections(event, "programme");
  assert.equal(programme[0][0], "1. Senior - Finale (effectif 0) - ordre non encore tiré");
  assert.deepEqual(programme[0][1], ["N° de passage", "Dossard", "Athlète", "Club"]);
  assert.deepEqual(programme[0][2], [["", 7, "A B", ""]]);
  event.officials = [{ first_name: "Invité", last_name: "FICTIF", post: "Président" }];
  assert.deepEqual(documentSections(event, "officials")[0][2], [["Invité FICTIF", "Président", "", "", ""]]);
  // Seconde section « Jury » : comptes approuvés et actifs à rôle de jury, chef en tête, jamais le
  // directeur, la régie, ni un compte non approuvé ou inactif.
  event.users = [
    { id: "j", name: "Jean", roles: ["judge"], approved: true, active: true },
    { id: "c", name: "Chef", roles: ["chief", "judge"], approved: true, active: true },
    { id: "t", name: "Tina", roles: ["trainee"], approved: true, active: true },
    { id: "d", name: "Dir", roles: ["director"], approved: true, active: true },
    { id: "x", name: "Attente", roles: ["judge"], approved: false, active: true },
    { id: "y", name: "Parti", roles: ["judge"], approved: true, active: false },
    { id: "r", name: "Régie", roles: ["regie"], approved: true, active: true },
  ];
  const officials = documentSections(event, "officials");
  assert.equal(officials.length, 2);
  assert.deepEqual(officials[1].slice(0, 2), ["Jury", ["Nom", "Rôle"]]);
  assert.deepEqual(officials[1][2], [["Chef", "Chef de jury, Juge"], ["Jean", "Juge"], ["Tina", "Stagiaire"]]);
  assert.deepEqual(juryRows([{ id: "u", roles: ["judge"] }]), [["u", "Juge"]], "sans nom ni indicateurs : identifiant, compte réputé actif");
  assert.deepEqual(documentSections({ ...event, users: undefined }, "officials")[1][2], []);
});

test("fiche de notation : en-tête catégorie / sous-catégorie / phase, dossards croissants sans nom, ligne juge, une page par manche, filtres", () => {
  const event = state();
  event.people.push({ id: "q", first_name: "Zoé", last_name: "Nom" }, { id: "s", first_name: "Yann", last_name: "Autre" });
  event.entries.push({ id: "f", person_id: "q", category_id: "c", bib: 3, confirmed: true }, { id: "g", person_id: "s", category_id: "c", bib: 12, confirmed: true });
  const final = event.rounds[0];
  final.participant_ids = ["e", "f", "g"];
  final.status = "open";
  // Sans filtre : uniquement les manches non validées, dans l'ordre des catégories puis des phases.
  event.categories.push({ id: "c2", name: "Junior", discipline: "mens_physique", order: 1 });
  event.rounds.push(
    { id: "r2", category_id: "c2", phase: "final", status: "validated", participant_ids: ["h"], ballots: {}, result: { official: [] } },
    { id: "r3", category_id: "c2", phase: "elimination", status: "pending", quota: 2, participant_ids: ["h", "i"], ballots: {} },
  );
  event.entries.push({ id: "h", person_id: "q", category_id: "c2", bib: 21, confirmed: true }, { id: "i", person_id: "s", category_id: "c2", bib: 20, confirmed: true });
  let sections = notationSections(event);
  assert.deepEqual(sections.map((x) => x[0]), ["Catégorie Bikini — Sous-catégorie Senior — Finale", "Catégorie Men’s Physique — Sous-catégorie Junior — Éliminatoire — quota 2"]);
  assert.deepEqual(sections[0][1], ["Dossard", "Position (1 à 3)"]);
  assert.deepEqual(sections[0][2], [[3, ""], [7, ""], [12, ""]], "dossards croissants, position à écrire, aucun nom");
  assert.deepEqual(sections[1][1], ["Dossard", "Sélectionné " + CHECKBOX]);
  assert.deepEqual(sections[1][2], [[20, CHECKBOX], [21, CHECKBOX]]);
  // `category_id` : toutes les manches de la catégorie, validées comprises ; `round_id` : une seule.
  assert.deepEqual(notationSections(event, { category_id: "c2" }).map((x) => x[0].split(" — ")[2]), ["Éliminatoire", "Finale"]);
  assert.equal(notationSections(event, { round_id: "r2" }).length, 1);
  assert.equal(documentSections(event, "blank", { round_id: "r2" })[0][0], "Catégorie Men’s Physique — Sous-catégorie Junior — Finale");
  // Overall sans catégorie dans l'état : discipline et section de la manche.
  event.rounds.push({ id: "o", category_id: "overall-bikini-amateur", discipline: "bikini", section: "amateur", phase: "overall", status: "pending", participant_ids: ["e"], ballots: {} });
  assert.equal(notationSections(event, { round_id: "o" })[0][0], "Catégorie Bikini — Sous-catégorie Toutes catégories amateur — Toutes catégories");

  // HTML : titre du document, une section par manche, en-tête lisible, ligne juge, aucun nom d'athlète.
  const html = renderPrint(event, "blank");
  assert.ok(html.includes("<title>Fiche de notation</title>"));
  assert.equal((html.match(/<section class="notation">/g) ?? []).length, 3);
  assert.ok(html.includes("<h2>Catégorie Bikini — Sous-catégorie Senior — Finale</h2>"));
  assert.ok(html.includes("<th>Position (1 à 3)</th>") && html.includes("<td>3</td><td></td>"));
  assert.ok(html.includes(escapeHtml(JUDGE_LINE)));
  for (const name of ["Zoé", "Yann", "A B", "Nom", "Autre"]) assert.ok(!html.includes(">" + name), "nom absent : " + name);
  assert.ok(!html.includes("Nom et signature"), "la ligne juge remplace la signature générique");
  // CSV et XLSX : mêmes sections ; PDF : une page par fiche, ligne juge, case « [ ] » en WinAnsi.
  const csv = decode(exportDocument(event, "blank", "csv").data.slice(3));
  assert.ok(csv.includes("Catégorie Bikini — Sous-catégorie Senior — Finale\r\nDossard,Position (1 à 3)\r\n3,\r\n7,\r\n12,\r\n"));
  assert.ok(!csv.includes("Zoé"));
  const pdf = exportDocument(event, "blank", "pdf").data;
  assert.equal(checkPdf(pdf).pages, 3);
  const text = extractText(pdf);
  assert.ok(text.includes("Juge :") && text.includes("Signature :") && text.includes(CHECKBOX_PDF) && !text.includes("?"));
  assert.ok(!text.includes("Zoé") && !text.includes("Yann"));
  const sheet = xlsxRead(exportDocument(event, "blank", "xlsx").data);
  assert.ok(JSON.stringify(sheet).includes("Sélectionné"));
  // Aucune manche non validée : document vide, sans invention.
  for (const r of event.rounds) r.status = "validated";
  assert.equal(notationSections(event).length, 0);
  assert.ok(renderPrint(event, "blank").includes("Aucune donnée correspondant à cette sélection."));
});

test("écran public : logos de club limités aux clubs affichés ; mode national sans « Meilleur pays »", () => {
  const s = newState();
  s.people = [
    { id: "a", first_name: "A", last_name: "Test", club: "Club A", country: "CI", nationalities: ["CI"] },
    { id: "b", first_name: "B", last_name: "Test", club: "Club B", country: "CI", nationalities: ["CI"] },
  ];
  s.entries = [{ id: "ea", person_id: "a", category_id: "cat", bib: 1, confirmed: true }, { id: "eb", person_id: "b", category_id: "other", bib: 2, confirmed: true }];
  s.categories = [{ id: "cat", name: "Catégorie", discipline: "bodybuilding", section: "amateur" }];
  s.public.main = { kind: "category", category_id: "cat" };
  // Sans `club_logos` dans l'état : objet vide.
  assert.deepEqual(publicState(s, "main").club_logos, {});
  s.club_logos = { "Club A": "logo-a", "Club B": "logo-b", "Club C": "logo-c", "Club D": "" };
  // Sans autorisation, aucun logo n'est publié.
  assert.deepEqual(publicState(s, "main").club_logos, {}, "logo non autorisé : privé");
  s.club_logos_approved = { "Club A": "logo-a", "Club B": "logo-b" };
  assert.deepEqual(publicState(s, "main").club_logos, { "Club A": "logo-a" }, "seuls les clubs des athlètes affichés, et autorisés");
  // Un logo remplacé après autorisation redevient privé jusqu'à nouvelle autorisation.
  s.club_logos["Club A"] = "logo-a2";
  assert.deepEqual(publicState(s, "main").club_logos, {}, "logo remplacé : en attente d'autorisation");
  s.club_logos["Club A"] = "logo-a";

  // Finale validée : en national, aucun classement pays ni récompense « Meilleur pays » ; un ancien
  // « Meilleur pays » est retiré. En international (délégations approuvées), il apparaît.
  s.entries[1].category_id = "cat";
  s.rounds = [{ id: "r", category_id: "cat", discipline: "bodybuilding", section: "amateur", phase: "final", status: "validated", participant_ids: ["ea", "eb"], panel: [], trainees: [], ballots: {}, result: { official: [{ entry_id: "ea", rank: 1 }, { entry_id: "eb", rank: 2 }], version: 1 } }];
  s.rewards = [{ id: "old", kind: "country", collective_name: "CI", title: "Meilleur pays" }];
  let out = collective(s);
  assert.equal(s.mode, "national");
  assert.deepEqual(out.country, []);
  assert.deepEqual(Object.keys(out.winners), ["club"]);
  syncCollectiveRewards(s);
  assert.deepEqual(s.rewards.map((r: any) => r.kind), ["club"]);
  s.mode = "international";
  for (const p of s.people) Object.assign(p, { delegation_approved: true, organizer_approved: true });
  out = collective(s);
  assert.equal(out.winners.country, "CI");
  syncCollectiveRewards(s);
  assert.deepEqual(s.rewards.map((r: any) => r.title).sort(), ["Meilleur club", "Meilleur pays"]);
});

// Démonstration peuplée, juges connectés ; renvoie l'app, le cookie chef, les cookies par utilisateur et les codes.
async function demo() {
  const store = new Store({ url: ":memory:", demo: true, clock: () => 1000 });
  const app = createApp({ store, setupToken: "jeton-test", testing: true });
  const r = await app.request("/api/v1/demo", { method: "POST", headers: { "x-setup-token": "jeton-test" } });
  const seeded = await body(r);
  assert.equal(r.status, 200, JSON.stringify(seeded));
  const chief = cookieOf(r);
  const clients: Record<string, string> = {};
  for (const [id, access] of Object.entries<any>(seeded.codes)) {
    if (access.roles.some((x: string) => ["judge", "trainee"].includes(x))) {
      const login = await app.request("/api/v1/auth/login", json({ code: access.code }));
      assert.equal(login.status, 200, await login.text());
      clients[id] = cookieOf(login);
    }
  }
  const command = async (kind: string, payload: any = {}): Promise<any> => {
    const version = (await body(app.request("/api/v1/state", { headers: { cookie: chief } }))).version;
    const r = await app.request("/api/v1/command", json({ id: randomUUID(), version, type: kind, payload }, { cookie: chief }));
    const b = await body(r);
    assert.equal(r.status, 200, JSON.stringify(b));
    return b.state;
  };
  return { app, store, chief, clients, codes: seeded.codes as Record<string, any>, state: seeded.state, command };
}

test("parcours : fiche de notation par catégorie, bulletin du juge, export csv, refus au juge", async () => {
  const { app, chief, clients, codes, command } = await demo();
  await command("event.update", { settings: { collective_tiebreak: "Décision motivée chef et directeur après égalité des places" } });
  // Un athlète de la première catégorie porte un nom à script et une formule tableur, avant le démarrage
  // (person.save est refusé une fois la catégorie commencée).
  const seeded = (await command("programme.generate"));
  const firstCategory = seeded.categories[0];
  const victim = seeded.people.find((p: any) => p.id === seeded.entries.find((e: any) => e.category_id === firstCategory.id).person_id);
  await command("person.save", { person: { ...victim, first_name: "<script>alert(1)</script>", last_name: "=CMD()" } });
  const state = await command("event.start");
  const category = state.categories[0];
  const entries = state.entries.filter((e: any) => e.category_id === category.id);
  const others = state.entries.filter((e: any) => e.category_id !== category.id);
  assert.ok(entries.length >= 2 && others.length >= 1);
  const people: Record<string, any> = Object.fromEntries(state.people.map((p: any) => [p.id, p]));

  // Fiche de notation d'une catégorie : ses dossards, son nom, la colonne de position et la ligne juge ;
  // aucun nom d'athlète, aucun dossard d'une autre catégorie, aucune donnée privée (club, mesures, contact).
  let r = await app.request("/api/v1/print/blank?category_id=" + category.id, { headers: { cookie: chief } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type") ?? "", /text\/html/);
  const blank = await r.text();
  assert.ok(blank.includes("<title>Fiche de notation</title>"));
  assert.ok(blank.includes("Sous-catégorie " + escapeHtml(category.name)));
  for (const e of entries) {
    assert.ok(blank.includes("<td>" + e.bib + "</td>"), "dossard " + e.bib);
    assert.ok(!blank.includes(escapeHtml(people[e.person_id].last_name)), "aucun nom d'athlète");
  }
  for (const e of others) assert.ok(!blank.includes("<td>" + e.bib + "</td>"), "dossard étranger " + e.bib);
  assert.ok(blank.includes("<th>Position (1 à ") || blank.includes("<th>Sélectionné"));
  assert.ok(blank.includes(escapeHtml(JUDGE_LINE)));
  assert.ok(!blank.includes("Club fictif") && !blank.includes("height_cm") && !blank.includes("private_contact"));
  // Une section (saut de page) par manche de la catégorie, quel que soit le nombre de juges.
  const expected = state.rounds.filter((x: any) => x.category_id === category.id).length;
  assert.ok(expected > 0);
  assert.equal((blank.match(/<section class="notation">/g) ?? []).length, expected);
  // Un juge reçoit les fiches de ses propres tours (droits inchangés : direction sans restriction, juge = ses tours).

  // Un juge : ses bulletins uniquement ; le bulletin d'un autre juge est refusé ; jamais les résultats.
  const judges = Object.entries(codes).filter(([, a]) => a.roles.includes("judge") && !a.roles.includes("chief"));
  const [first, second] = judges;
  const mine = clients[first[0]];
  r = await app.request("/api/v1/print/ballot?judge_id=" + second[0], { headers: { cookie: mine } });
  assert.equal(r.status, 403);
  r = await app.request("/api/v1/print/ballot", { headers: { cookie: mine } });
  assert.equal(r.status, 200);
  let html = await r.text();
  assert.ok(html.includes("juge " + first[1].name) && !html.includes("juge " + second[1].name));
  assert.ok(html.includes("Manquant"), "aucun vote encore reçu");
  r = await app.request("/api/v1/print/results", { headers: { cookie: mine } });
  assert.equal(r.status, 403);
  r = await app.request("/api/v1/print/blank?judge_id=" + second[0], { headers: { cookie: mine } });
  assert.equal(r.status, 403);
  r = await app.request("/api/v1/print/blank", { headers: { cookie: mine } });
  assert.equal(r.status, 200);
  html = await r.text();
  assert.equal((html.match(/<section class="notation">/g) ?? []).length, state.rounds.filter((x: any) => [...x.panel, ...x.trainees].includes(first[0]) && !["validated", "published"].includes(x.status)).length);
  r = await app.request("/api/v1/print/exams?judge_id=" + second[0], { headers: { cookie: mine } });
  assert.equal(r.status, 403);
  // Un juge n'apprend pas les documents inexistants (droits avant reconnaissance) ; le chef reçoit 422.
  assert.equal((await app.request("/api/v1/print/inconnu", { headers: { cookie: mine } })).status, 403);
  assert.equal((await app.request("/api/v1/print/inconnu", { headers: { cookie: chief } })).status, 422);
  assert.equal((await app.request("/api/v1/print/blank")).status, 401);

  // Export csv des inscriptions : BOM, pièce jointe, une ligne par inscription.
  r = await app.request("/api/v1/export/registrations?format=csv", { headers: { cookie: chief } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type") ?? "", /text\/csv/);
  assert.equal(r.headers.get("content-disposition"), 'attachment; filename="registrations.csv"');
  const bytes = new Uint8Array(await r.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  const lines = decode(bytes.slice(3)).split("\r\n").filter((l) => l && !l.startsWith("Dossard,"));
  assert.equal(lines.length, state.categories.length + state.entries.length);
  // Le juge n'a pas accès aux documents de préparation, quel que soit le format.
  for (const format of ["csv", "xlsx", "pdf"]) {
    r = await app.request("/api/v1/export/registrations?format=" + format, { headers: { cookie: mine } });
    assert.equal(r.status, 403);
  }
  // xlsx : pièce jointe, relisible, une ligne par inscription, script et formule neutralisés.
  r = await app.request("/api/v1/export/registrations?format=xlsx", { headers: { cookie: chief } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(r.headers.get("content-disposition"), 'attachment; filename="registrations.xlsx"');
  const sheet = xlsxRead(new Uint8Array(await r.arrayBuffer()));
  assert.equal(sheet.filter((row) => row[0] !== null && row[0] !== "Dossard").length, state.categories.length + state.entries.length);
  assert.ok(sheet.some((row) => row[1] === "<script>alert(1)</script> =CMD()"), "xlsx : valeur brute, la formule n'est pas en tête de cellule");
  // pdf : pièce jointe, texte relisible avec le titre et un athlète.
  r = await app.request("/api/v1/export/registrations?format=pdf", { headers: { cookie: chief } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/pdf");
  assert.equal(r.headers.get("content-disposition"), 'attachment; filename="registrations.pdf"');
  const pdf = new Uint8Array(await r.arrayBuffer());
  checkPdf(pdf);
  const pdfText = extractText(pdf).replace(/\n/g, " ");
  // « ≤ » n'a pas de code WinAnsi : rendu « <= » dans le PDF.
  assert.ok(pdfText.includes("Catégories et athlètes - ") && pdfText.includes(category.name.replace(/≤/g, "<=")), pdfText);
  const someone = people[others[0].person_id];
  assert.ok(pdfText.includes(someone.first_name + " " + someone.last_name), someone.first_name);
  r = await app.request("/api/v1/export/registrations", { headers: { cookie: chief } });
  assert.equal(r.status, 200, "format par défaut pdf, comme le Python");
  assert.equal(r.headers.get("content-type"), "application/pdf");
  r = await app.request("/api/v1/export/registrations?format=txt", { headers: { cookie: chief } });
  assert.equal(r.status, 422);
  // Le nom porteur de script est échappé dans le HTML et neutralisé dans le csv ; la fiche de notation
  // ne porte aucun nom, ni brut ni échappé.
  assert.ok(!blank.includes("<script>") && !blank.includes("alert(1)"));
  html = await (await app.request("/api/v1/print/registrations", { headers: { cookie: chief } })).text();
  assert.ok(!html.includes("<script>") && html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  const csv = await (await app.request("/api/v1/export/registrations?format=csv", { headers: { cookie: chief } })).text();
  assert.ok(csv.includes("<script>alert(1)</script> =CMD()"), "csv brut : l'échappement HTML n'y a pas sa place");
});

test("officiels imprimables par la préparation, récapitulatif et examens filtrés pour un juge", async () => {
  const { app, store, chief, clients, codes, command } = await demo();
  await command("official.save", { official: { id: randomUUID(), first_name: "Invité", last_name: "FICTIF", post: "Président", organization: "Test", country: "CI" } });
  const officialsHtml = await (await app.request("/api/v1/print/officials", { headers: { cookie: chief } })).text();
  assert.ok(officialsHtml.includes("Invité"));
  // Section « Jury » : les comptes approuvés à rôle de jury, avec leur rôle, jamais leur code.
  const chiefName = Object.values(codes).find((a: any) => a.roles.includes("chief"))!.name;
  assert.ok(officialsHtml.includes(">Jury - version") && officialsHtml.includes("<td>" + escapeHtml(chiefName) + "</td><td>Chef de jury"));
  const r = await app.request("/api/v1/export/officials?format=csv", { headers: { cookie: chief } });
  assert.equal(r.status, 200);
  const officialsCsv = await r.text();
  assert.ok(officialsCsv.includes("Invité FICTIF,Président,Test,CI,"));
  assert.ok(officialsCsv.includes("Jury\r\nNom,Rôle\r\n") && officialsCsv.includes(chiefName + ",Chef de jury"));
  for (const access of Object.values(codes)) if (access.code) assert.ok(!officialsCsv.includes(access.code) && !officialsHtml.includes(access.code), "code personnel absent du document");

  // Même montage que test_judge_cannot_import_backup_or_read_other_ballots : un tour écrit directement
  // dans le magasin, deux juges avec un bulletin chacun, un programme d'examen pour chacun.
  const judges = Object.entries(codes).filter(([, a]) => a.roles.length === 1 && a.roles[0] === "judge");
  const [first, second] = judges;
  await store.transact(async (tx) => {
    const s = await store.read(tx);
    const cat = s.categories[0];
    const entries = cat.entry_ids.slice(0, 2);
    s.rounds = [{ id: "test-round", category_id: cat.id, phase: "final", status: "open", panel: [first[0], second[0]], trainees: [], participant_ids: entries, ballots: { [first[0]]: { ranking: entries, version: 1 }, [second[0]]: { ranking: [...entries].reverse(), version: 7 } } }];
    s.exam_programs = [{ user_id: first[0], round_ids: ["test-round"] }, { user_id: second[0], round_ids: ["test-round"] }];
    await store.write(tx, s, s.version);
  });
  const judge = clients[first[0]];
  assert.equal((await app.request("/api/v1/print/ballot?judge_id=" + second[0], { headers: { cookie: judge } })).status, 403);
  const recap = await app.request("/api/v1/print/recap", { headers: { cookie: judge } });
  assert.equal(recap.status, 200);
  let text = await recap.text();
  assert.ok(!text.includes(second[1].name) && text.includes(first[1].name));
  assert.ok(text.includes("bulletin version 1") && !text.includes("bulletin version 7"));
  text = await (await app.request("/api/v1/print/exams", { headers: { cookie: judge } })).text();
  assert.ok(!text.includes(second[1].name) && text.includes(first[1].name));
  for (const kind of ["recap", "exams"]) {
    const exported = await app.request("/api/v1/export/" + kind + "?format=csv", { headers: { cookie: judge } });
    assert.equal(exported.status, 200);
    text = await exported.text();
    assert.ok(!text.includes(second[1].name) && text.includes(first[1].name));
  }
});

// Deux athlètes pour la fiche d'inscription : l'une complète (avec téléphone et balisage à
// échapper), l'autre sans téléphone ni club.
function ficheState(): any {
  const event = state();
  event.date = "2026-09-26";
  event.location = "Palais des sports";
  Object.assign(event.people[0], { first_name: "Awa", last_name: "KONÉ", birth_date: "1995-06-15", sex: "F", nationalities: ["CI", "FR"], country: "CI", club: "Club <b>Abidjan</b>", private_contact: "+225 07 00 00 00 <script>", height_cm: "165", weight_kg: "58.0", measurements_confirmed: true, photo_portrait: "ph1", status_approved: true });
  event.people.push({ id: "q", first_name: "Bakary", last_name: "TRAORÉ", birth_date: "2010-01-02", sex: "M", nationalities: ["CI"], country: "CI", height_cm: "170", weight_kg: "", measurements_confirmed: false });
  event.categories.push({ id: "c2", name: "Junior", order: 1 });
  event.categories[0].order = 0;
  event.entries.push({ id: "e2", person_id: "q", category_id: "c2", bib: 12, confirmed: true, derogation: { reason: "Mesures à confirmer sur place", signed_by: "chief-1", issues: [] } });
  event.users = [{ id: "chief-1", name: "Chef Test" }];
  return event;
}

test("fiche d'inscription : partie athlète puis partie juges, 9 champs, lignes à compléter, une page par athlète, filtres", () => {
  const event = ficheState();
  const all = fiches(event);
  assert.deepEqual(all.map((f) => f.person_id), ["p", "q"], "ordre des catégories puis des dossards");
  assert.equal(all[0].title, "Fiche d'inscription - KONÉ Awa");
  // Partie athlète : six champs, dans l'ordre du modèle du PO ; le téléphone est le contact privé.
  assert.deepEqual(all[0].athlete.map(([k]) => k), ["Nom", "Prénoms", "Date de naissance", "Téléphone (WhatsApp)", "Club", "Nationalité"]);
  assert.deepEqual(all[0].athlete.map(([, v]) => v), ["KONÉ", "Awa", "1995-06-15", "+225 07 00 00 00 <script>", "Club <b>Abidjan</b>", "CI, FR"]);
  // Partie juges : trois champs ; la catégorie vient des inscriptions.
  assert.deepEqual(all[0].judges, [["Taille cm", "165"], ["Poids kg", "58.0"], ["Catégorie", "Senior"]]);
  assert.equal(FICHE_COLUMNS.length, 9);
  // Rien d'autre : ni photo, ni contrôles, ni dossard, ni dérogation dans le document.
  assert.deepEqual(Object.keys(all[0]).sort(), ["athlete", "judges", "person_id", "rows", "title"]);
  // Valeurs absentes : brutes vides dans la fiche, lignes à compléter dans les rangées imprimées.
  assert.deepEqual(all[1].athlete.slice(3).map(([, v]) => v), ["", "", "CI"]);
  assert.equal(all[1].judges[1][1], "");
  const rows = all[1].rows();
  assert.deepEqual(rows.map((r) => r[0]), ["Nom", "Prénoms", "Date de naissance", "Téléphone (WhatsApp)", "Club", "Nationalité", JUDGES_PART, "Taille cm", "Poids kg", "Catégorie"]);
  assert.equal(rows[3][1], BLANK_LINE);
  assert.equal(rows[4][1], BLANK_LINE);
  assert.equal(rows[8][1], BLANK_LINE);
  assert.equal(rows[0][1], "TRAORÉ");
  // Filtres.
  assert.deepEqual(fiches(event, { person_id: "q" }).map((f) => f.person_id), ["q"]);
  assert.deepEqual(fiches(event, { category_id: "c" }).map((f) => f.person_id), ["p"]);
  assert.deepEqual(fiches(event, { person_id: "inconnu" }), []);
  // Un athlète sans inscription n'a de fiche que sur demande nominative ; sa catégorie reste à compléter.
  event.people.push({ id: "z", first_name: "Sans", last_name: "INSCRIPTION" });
  assert.equal(fiches(event).length, 2);
  assert.equal(fiches(event, { person_id: "z" })[0].judges[2][1], "");
  assert.equal(fiches(event, { person_id: "z" })[0].rows()[9][1], BLANK_LINE);

  // HTML : une section par athlète avec saut de page, en-tête rappelé, partie athlète avant la partie
  // juges, lignes à compléter, signatures Athlète / Juge / Date, échappement du téléphone et du club.
  const html = renderPrint(event, "fiche");
  assert.ok(html.includes("<title>Fiche d'inscription</title>") || html.includes("<title>Fiche d&#x27;inscription</title>"));
  assert.equal((html.match(/<section class="fiche">/g) ?? []).length, 2);
  assert.ok(html.includes("section{break-before:page}"));
  assert.equal((html.match(/fibda-logo\.jpg/g) ?? []).length, 2, "logo sur chaque fiche, pas d'en-tête général");
  assert.equal((html.match(/Palais des sports/g) ?? []).length, 2);
  assert.ok(html.includes("2026-09-26"));
  assert.ok(html.indexOf("Partie athlète") < html.indexOf(JUDGES_PART), "athlète en haut, juges en bas");
  assert.ok(html.includes('<div class="juges">'));
  assert.ok(html.includes("<th>Nom</th><td>KONÉ</td>") && html.includes("<th>Prénoms</th><td>Awa</td>") && html.includes("<th>Nationalité</th><td>CI, FR</td>"));
  assert.ok(html.includes("<th>Taille cm</th><td>165</td>") && html.includes("<th>Catégorie</th><td>Senior</td>"));
  assert.ok(html.includes("<th>Téléphone (WhatsApp)</th><td>+225 07 00 00 00 &lt;script&gt;</td>"));
  assert.ok(html.includes("<th>Téléphone (WhatsApp)</th><td>" + BLANK_LINE + "</td>") && html.includes("<th>Poids kg</th><td>" + BLANK_LINE + "</td>"));
  for (const zone of ["Athlète", "Juge", "Date"]) assert.ok(html.includes("<div>" + zone + "</div>"), zone);
  for (const absent of ["Responsable", "Chef des juges", "portrait", "/api/v1/photos/", "Dossard", "Statut approuvé", "Dérogation", "Sexe", "Pays", "Section"]) assert.ok(!html.includes(absent), absent);
  assert.ok(!html.includes("<script>") && !html.includes("<b>Abidjan</b>") && html.includes("Club &lt;b&gt;Abidjan&lt;/b&gt;"));
  assert.ok(renderPrint(event, "fiche", { person_id: "inconnu" }).includes("Aucune donnée correspondant à cette sélection."));
  assert.ok(!renderPrint(event, "fiche", { person_id: "q" }).includes("KONÉ"));

  // csv et xlsx : une ligne par athlète, neuf colonnes, valeurs brutes (vide reste vide). Un numéro
  // commençant par « + » est neutralisé comme toute formule tableur (apostrophe de tête, safeCell).
  const csv = decode(exportDocument(event, "fiche", "csv").data.slice(3)).split("\r\n");
  assert.equal(csv[0], "Fiches d'inscription");
  assert.equal(csv[1], "Nom,Prénoms,Date de naissance,Téléphone (WhatsApp),Club,Nationalité,Taille cm,Poids kg,Catégorie");
  assert.equal(csv[2], "KONÉ,Awa,1995-06-15,'+225 07 00 00 00 <script>,Club <b>Abidjan</b>,\"CI, FR\",165,58.0,Senior");
  assert.equal(csv[3], "TRAORÉ,Bakary,2010-01-02,,,CI,170,,Junior");
  assert.equal(csv.filter(Boolean).length, 4);
  const sheet = xlsxRead(exportDocument(event, "fiche", "xlsx").data);
  assert.deepEqual(sheet[1], FICHE_COLUMNS);
  assert.equal(sheet[2][3], "'+225 07 00 00 00 <script>");
  assert.deepEqual(sheet[3], ["TRAORÉ", "Bakary", "2010-01-02", null, null, "CI", "170", null, "Junior"]);

  // pdf : une page par athlète, deux parties, lignes à compléter, texte relisible.
  const pdf = exportDocument(event, "fiche", "pdf").data;
  assert.equal(checkPdf(pdf).pages, 2);
  const text = extractText(pdf).replace(/\n/g, " ");
  assert.ok(text.includes("KONÉ Awa") && text.includes("Téléphone") && text.includes(JUDGES_PART) && text.includes(BLANK_LINE), text);
  assert.ok(text.indexOf("Nationalité") < text.indexOf(JUDGES_PART) && text.indexOf(JUDGES_PART) < text.indexOf("Taille cm"));
  assert.ok(!text.includes("Statut approuvé") && !text.includes("Dérogation"));
  assert.equal(TITLES.programme, "Ordre de passage");
});

test("fiche d'inscription vierge : blank=3 donne trois fiches sans aucune donnée, bornes du paramètre", () => {
  const event = ficheState();
  const blanks = fiches(event, { blank: 3, person_id: "p" });
  assert.equal(blanks.length, 3);
  assert.ok(blanks.every((f) => f.person_id === null && f.title === "Fiche d'inscription"));
  assert.ok(blanks.every((f) => [...f.athlete, ...f.judges].every(([, v]) => v === "")));
  assert.deepEqual(blanks[0].rows().map((r) => r[1]), [...Array(6).fill(BLANK_LINE), "", ...Array(3).fill(BLANK_LINE)]);
  // Sections et HTML : trois pages vierges, aucune donnée de l'événement (hors en-tête).
  assert.equal(documentSections(event, "fiche", { blank: 3 }).length, 3);
  const html = renderPrint(event, "fiche", { blank: 3 });
  assert.equal((html.match(/<section class="fiche">/g) ?? []).length, 3);
  assert.equal((html.match(new RegExp(BLANK_LINE, "g")) ?? []).length, 27, "9 lignes à compléter par fiche");
  for (const absent of ["KONÉ", "TRAORÉ", "Senior", "+225"]) assert.ok(!html.includes(absent), absent);
  assert.ok(html.includes("Palais des sports"));
  // csv : trois lignes vides sous les en-têtes ; pdf : trois pages.
  const csv = decode(exportDocument(event, "fiche", "csv", { blank: 3 }).data.slice(3)).split("\r\n");
  assert.deepEqual(csv.slice(2, 5), [",,,,,,,,", ",,,,,,,,", ",,,,,,,,"]);
  assert.equal(checkPdf(exportDocument(event, "fiche", "pdf", { blank: 3 }).data).pages, 3);
  // Paramètre : absent → null ; entier de 1 à 50 ; sinon refus.
  assert.equal(parseBlank(undefined), null);
  assert.equal(parseBlank(""), null);
  assert.equal(parseBlank("1"), 1);
  assert.equal(parseBlank("50"), 50);
  for (const bad of ["0", "51", "-1", "abc", "1.5", "3e1"]) assert.throws(() => parseBlank(bad), /entier de 1 à 50/, bad);
});

test("parcours : fiches réservées à la préparation, ordre de passage avec les dossards", async () => {
  const { app, chief, clients, codes, command } = await demo();
  const state = await command("programme.generate");
  const category = state.categories[0];
  const entries = state.entries.filter((e: any) => e.category_id === category.id);
  const people: Record<string, any> = Object.fromEntries(state.people.map((p: any) => [p.id, p]));

  // Toutes les fiches : une section par athlète inscrit.
  let r = await app.request("/api/v1/print/fiche", { headers: { cookie: chief } });
  assert.equal(r.status, 200);
  let html = await r.text();
  assert.equal((html.match(/<section class="fiche">/g) ?? []).length, state.entries.length);
  // Une seule fiche par person_id ; une catégorie complète par category_id.
  const one = entries[0];
  html = await (await app.request("/api/v1/print/fiche?person_id=" + one.person_id, { headers: { cookie: chief } })).text();
  assert.equal((html.match(/<section class="fiche">/g) ?? []).length, 1);
  assert.ok(html.includes(escapeHtml(people[one.person_id].first_name)) && !html.includes("Dossard"));
  html = await (await app.request("/api/v1/print/fiche?category_id=" + category.id, { headers: { cookie: chief } })).text();
  assert.equal((html.match(/<section class="fiche">/g) ?? []).length, entries.length);
  // Fiches vierges : dix pages sans nom ; paramètre hors bornes refusé (422), sans données.
  html = await (await app.request("/api/v1/print/fiche?blank=10", { headers: { cookie: chief } })).text();
  assert.equal((html.match(/<section class="fiche">/g) ?? []).length, 10);
  for (const p of state.people) assert.ok(!html.includes(escapeHtml(p.last_name)));
  assert.equal((await app.request("/api/v1/print/fiche?blank=51", { headers: { cookie: chief } })).status, 422);
  assert.equal((await app.request("/api/v1/print/fiche?blank=x", { headers: { cookie: chief } })).status, 422);
  // Le secrétariat y a accès ; un juge et la régie non, quel que soit le format, vierges comprises.
  const login = async (role: string) => cookieOf(await app.request("/api/v1/auth/login", json({ code: Object.values(codes).find((a: any) => a.roles.includes(role))!.code })));
  const secretariat = await login("secretariat");
  assert.equal((await app.request("/api/v1/print/fiche", { headers: { cookie: secretariat } })).status, 200);
  const regie = await login("regie");
  const judge = Object.values(clients)[0];
  for (const cookie of [judge, regie]) {
    assert.equal((await app.request("/api/v1/print/fiche", { headers: { cookie } })).status, 403);
    assert.equal((await app.request("/api/v1/print/fiche?blank=1", { headers: { cookie } })).status, 403);
    for (const format of ["csv", "xlsx", "pdf"]) assert.equal((await app.request("/api/v1/export/fiche?format=" + format, { headers: { cookie } })).status, 403);
  }
  // La régie garde l'ordre de passage.
  assert.equal((await app.request("/api/v1/print/programme", { headers: { cookie: regie } })).status, 200);
  // pdf : une page par athlète, texte relisible.
  r = await app.request("/api/v1/export/fiche?format=pdf&category_id=" + category.id, { headers: { cookie: chief } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-disposition"), 'attachment; filename="fiche.pdf"');
  const pdf = new Uint8Array(await r.arrayBuffer());
  assert.equal(checkPdf(pdf).pages, entries.length);
  const text = extractText(pdf).replace(/\n/g, " ");
  assert.ok(text.includes(people[one.person_id].first_name) && text.includes("Partie réservée aux juges"));

  // Ordre de passage : chaque catégorie avec ses tours, puis ses dossards et noms.
  r = await app.request("/api/v1/print/programme", { headers: { cookie: chief } });
  assert.equal(r.status, 200);
  html = await r.text();
  assert.ok(html.includes("<title>Ordre de passage</title>"));
  for (const c of state.categories) assert.ok(html.includes(escapeHtml(c.name) + " - "), c.name);
  // Avant le démarrage, aucun tirage : la mention l'indique pour chaque catégorie.
  assert.equal((html.match(/ordre non encore tiré/g) ?? []).length, state.categories.length);
  for (const e of entries) {
    assert.ok(html.includes("<td>" + e.bib + "</td>"), "dossard " + e.bib);
    assert.ok(html.includes(escapeHtml(people[e.person_id].first_name)));
  }
  assert.equal((html.match(/<section>/g) ?? []).length, state.categories.length);
});

// --- Ordre de passage tiré au sort (PO 24/09/2026) ------------------------------------------

function drawnState(): any {
  const event = state();
  event.users = [{ id: "chef", name: "Chef Test" }];
  event.people = ["p1", "p2", "p3", "p4"].map((id, i) => ({ id, first_name: "Prénom" + (i + 1), last_name: "NOM" + (i + 1), club: "Club " + (i + 1) }));
  event.entries = ["p1", "p2", "p3", "p4"].map((pid, i) => ({ id: "e" + (i + 1), person_id: pid, category_id: "c", bib: 10 + i }));
  event.categories = [{ id: "c", name: "Senior", order: 0 }, { id: "c2", name: "Junior", order: 1 }];
  event.entries.push({ id: "j1", person_id: "p4", category_id: "c2", bib: 20 });
  event.rounds = [
    // Demi validée, tirée automatiquement à l'ouverture (at = 2026-09-26 10:30 UTC).
    { id: "semi", category_id: "c", phase: "semi", status: "validated", participant_ids: ["e1", "e2", "e3", "e4"], passage_order: ["e3", "e1", "e4", "e2"], draws: [{ at: 1790418600, by: null, automatic: true }], ballots: {}, result: { official: [], qualified: ["e1", "e3"] } },
    // Finale ouverte, retirée à la main par le chef.
    { id: "final", category_id: "c", phase: "final", status: "open", participant_ids: ["e1", "e3"], passage_order: ["e3", "e1"], draws: [{ at: 1790418600, by: null, automatic: true }, { at: 1790422200, by: "chef", automatic: false }], ballots: {}, result: null },
    // Junior : éliminatoire en attente, pas encore tirée.
    { id: "elim", category_id: "c2", phase: "elimination", status: "pending", participant_ids: ["j1"], ballots: {}, result: null },
  ];
  return event;
}

test("ordre de passage général : tour courant par catégorie, athlètes numérotés dans l'ordre tiré, sinon par dossard", () => {
  const event = drawnState();
  const sections = documentSections(event, "programme");
  assert.equal(sections.length, 2);
  // Senior : la demi est close, la finale ouverte est le tour courant ; ordre tiré e3 puis e1.
  assert.ok(sections[0][0].startsWith("1. Senior - Finale (effectif 2) - tiré par Chef Test le "), sections[0][0]);
  assert.ok(sections[0][0].endsWith(" - 2 athlète(s)"), sections[0][0]);
  assert.deepEqual(sections[0][1], ["N° de passage", "Dossard", "Athlète", "Club"]);
  assert.deepEqual(sections[0][2], [[1, 12, "Prénom3 NOM3", "Club 3"], [2, 10, "Prénom1 NOM1", "Club 1"]]);
  // Junior : pas de tirage → mention, dossards sans numéro.
  assert.equal(sections[1][0], "2. Junior - Éliminatoire (effectif 1) - ordre non encore tiré");
  assert.deepEqual(sections[1][2], [["", 20, "Prénom4 NOM4", "Club 4"]]);
  // Tout clos : le dernier tour de la catégorie reste affiché avec son ordre.
  event.rounds[1].status = "validated";
  assert.ok(documentSections(event, "programme")[0][0].startsWith("1. Senior - Finale (effectif 2) - tiré par"));
  // Le tirage n'est plus valable si l'effectif a changé sans nouveau tirage : retour au dossard.
  event.rounds[1].participant_ids = ["e1"];
  assert.ok(documentSections(event, "programme")[0][0].endsWith("ordre non encore tiré"));
});

test("ordre de passage détaillé d'un tour et de tous les tours tirés d'une catégorie ; tour sans tirage → message", () => {
  const event = drawnState();
  const semi = documentSections(event, "programme", { round_id: "semi" });
  assert.equal(semi.length, 1);
  assert.ok(semi[0][0].startsWith("Ordre de passage - Senior - Demi-finale - tiré automatiquement à l’ouverture le 26/09/2026"), semi[0][0]);
  assert.ok(semi[0][0].endsWith(" - 4 athlète(s)"));
  assert.deepEqual(semi[0][2].map((r) => [r[0], r[1]]), [[1, 12], [2, 10], [3, 13], [4, 11]]);
  const elim = documentSections(event, "programme", { round_id: "elim" });
  assert.equal(elim[0][0], "Ordre de passage - Junior - Éliminatoire - Ordre de passage non encore tiré pour ce tour");
  assert.deepEqual(elim[0][2], [["", 20, "Prénom4 NOM4", "Club 4"]]);
  // Catégorie : demi puis finale, chacune dans son ordre tiré.
  const cat = documentSections(event, "programme", { category_id: "c" });
  assert.equal(cat.length, 2);
  assert.ok(cat[0][0].startsWith("Ordre de passage - Senior - Demi-finale"));
  assert.ok(cat[1][0].startsWith("Ordre de passage - Senior - Finale"));
  assert.deepEqual(cat[1][2].map((r) => r[0]), [1, 2]);
  // Catégorie sans aucun tirage : lecture générale de cette catégorie seule.
  const junior = documentSections(event, "programme", { category_id: "c2" });
  assert.equal(junior.length, 1);
  assert.equal(junior[0][0], "1. Junior - Éliminatoire (effectif 1) - ordre non encore tiré");
  // Les trois formats suivent les sections ; la mention et l'ordre sont dans le PDF.
  const html = renderPrint(event, "programme", { round_id: "final" });
  assert.ok(html.includes("<td>1</td><td>12</td><td>Prénom3 NOM3</td>") && html.includes("<td>2</td><td>10</td><td>Prénom1 NOM1</td>"));
  const csv = new TextDecoder().decode(exportDocument(event, "programme", "csv", { round_id: "final" }).data);
  assert.ok(csv.includes("N° de passage,Dossard,Athlète,Club\r\n1,12,Prénom3 NOM3,Club 3\r\n2,10,Prénom1 NOM1,Club 1\r\n"), csv);
  const xlsx = xlsxRead(exportDocument(event, "programme", "xlsx", { round_id: "final" }).data);
  assert.deepEqual(xlsx[2], ["1", "12", "Prénom3 NOM3", "Club 3"]);
  const pdf = extractText(exportDocument(event, "programme", "pdf", { round_id: "elim" }).data).replace(/\n/g, " ");
  assert.ok(pdf.includes("Ordre de passage non encore tiré pour ce tour"), pdf);
  assert.equal(checkPdf(exportDocument(event, "programme", "pdf", { category_id: "c" }).data).pages, 2);
});

test("parcours : tirage automatique à l'ouverture, round.draw, ordre imprimé, droits et formats", async () => {
  const { app, chief, clients, codes, command } = await demo();
  await command("event.update", { settings: { collective_tiebreak: "Décision motivée chef et directeur après égalité des places" } });
  await command("programme.generate");
  let state = await command("event.start");
  const r = state.rounds.find((x: any) => x.id === state.active_round_id);
  assert.ok(r, "un tour est ouvert");
  const sorted = (a: string[]) => [...a].sort();
  assert.deepEqual(sorted(r.passage_order), sorted(r.participant_ids));
  assert.equal(r.draws.length, 1);
  const people: Record<string, any> = Object.fromEntries(state.people.map((p: any) => [p.id, p]));
  const entries: Record<string, any> = Object.fromEntries(state.entries.map((e: any) => [e.id, e]));
  const category = state.categories.find((c: any) => c.id === r.category_id);

  // Impression détaillée : les athlètes numérotés dans l'ordre tiré, phase en français.
  let res = await app.request("/api/v1/print/programme?round_id=" + r.id, { headers: { cookie: chief } });
  assert.equal(res.status, 200);
  let html = await res.text();
  assert.ok(html.includes("Ordre de passage - " + escapeHtml(category.name) + " - "));
  assert.ok(!/ - (elimination|semi|final) - /.test(html));
  r.passage_order.forEach((id: string, i: number) => {
    const e = entries[id];
    assert.ok(html.includes("<td>" + (i + 1) + "</td><td>" + e.bib + "</td><td>" + escapeHtml(people[e.person_id].first_name)), "passage " + (i + 1));
  });
  // Impression générale : la catégorie ouverte affiche le même ordre.
  html = await (await app.request("/api/v1/print/programme", { headers: { cookie: chief } })).text();
  assert.ok(html.includes("<td>1</td><td>" + entries[r.passage_order[0]].bib + "</td>"));

  // Nouveau tirage à la main : permutation des mêmes participants, tracée au nom du chef, version du tour incrémentée.
  state = await command("round.draw", { round_id: r.id });
  const r2 = state.rounds.find((x: any) => x.id === r.id);
  assert.deepEqual(sorted(r2.passage_order), sorted(r.participant_ids));
  assert.equal(r2.draws.length, 2);
  assert.equal(r2.draws[1].by, state.me.id);
  assert.equal(r2.version, r.version + 1);
  // Un juge ne peut pas tirer.
  const judge = Object.values(clients)[0];
  const version = (await body(app.request("/api/v1/state", { headers: { cookie: chief } }))).version;
  res = await app.request("/api/v1/command", json({ id: randomUUID(), version, type: "round.draw", payload: { round_id: r.id } }, { cookie: judge }));
  assert.equal(res.status, 403);
  // L'écran public reçoit l'ordre d'appel du tour de la scène.
  await command("scene.set", { screen: "main", scene: { kind: "category", category_id: r.category_id, round_id: r.id } });
  const pub = await body(app.request("/api/v1/public/main"));
  assert.deepEqual(pub.rounds[0].passage_order, r2.passage_order);
  // Les trois formats sont téléchargeables par la régie.
  const regie = cookieOf(await app.request("/api/v1/auth/login", json({ code: Object.values(codes).find((a: any) => a.roles.includes("regie"))!.code })));
  for (const format of ["csv", "xlsx", "pdf"]) {
    res = await app.request("/api/v1/export/programme?format=" + format + "&round_id=" + r.id, { headers: { cookie: regie } });
    assert.equal(res.status, 200, format);
  }
  // Après un bulletin, l'ordre est figé.
  const judgeId = Object.keys(clients).find((id) => r2.panel.includes(id))!;
  res = await app.request("/api/v1/command", json({ id: randomUUID(), version: state.version, type: "ballot.submit", payload: { round_id: r.id, restore_id: state.restore_id, ...(r2.phase === "elimination" ? { selected: r2.participant_ids.slice(0, r2.quota) } : { ranking: r2.participant_ids }) } }, { cookie: clients[judgeId] }));
  assert.equal(res.status, 200, await res.text());
  const v2 = (await body(app.request("/api/v1/state", { headers: { cookie: chief } }))).version;
  res = await app.request("/api/v1/command", json({ id: randomUUID(), version: v2, type: "round.draw", payload: { round_id: r.id } }, { cookie: chief }));
  assert.equal(res.status, 409);
  assert.match((await body(res)).detail ?? JSON.stringify(await res.text()), /figé/);
});
