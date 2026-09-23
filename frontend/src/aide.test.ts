// Tests du mode d'emploi : parseur, filtrage par rôle, et couverture du manuel réel
// (chaque rôle de permissions.ts et chaque onglet de App.tsx doivent y figurer).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseManuel,
  parseInline,
  sectionsPourRoles,
  libelleProfil,
  TOUS,
} from "./aide";

const here = dirname(fileURLToPath(import.meta.url));
const manuel = readFileSync(join(here, "aide/MODE-D-EMPLOI.md"), "utf8");
const sourceApp = readFileSync(join(here, "App.tsx"), "utf8");
const sourcePermissions = readFileSync(join(here, "permissions.ts"), "utf8");
const normalise = (s: string) => s.replace(/[’']/g, "'");

const extrait = `# Manuel de test

Intro **importante** sur une ligne.

## Profil : Juge
Rôles : judge, trainee

### Première tâche

1. Ouvrir
2. Classer

- Point **fort**
- Autre point

Un paragraphe
sur deux lignes.

## Tous les profils
Rôles : tous

### Secours

- Papier
`;

test("parse d'un extrait : intro, sections, rôles et blocs typés", () => {
  const sections = parseManuel(extrait);
  assert.equal(sections.length, 3);
  const [intro, juge, tous] = sections;
  assert.equal(intro.intro, true);
  assert.equal(intro.title, "Manuel de test");
  assert.deepEqual(intro.roles, [TOUS]);
  assert.equal(intro.blocks[0].type, "paragraph");
  assert.deepEqual((intro.blocks[0] as any).runs, [
    { text: "Intro ", strong: false },
    { text: "importante", strong: true },
    { text: " sur une ligne.", strong: false },
  ]);
  assert.equal(juge.title, "Profil : Juge");
  assert.equal(libelleProfil(juge), "Juge");
  assert.deepEqual(juge.roles, ["judge", "trainee"]);
  assert.deepEqual(
    juge.blocks.map((b) => b.type),
    ["heading3", "ordered", "list", "paragraph"],
  );
  assert.equal((juge.blocks[1] as any).items.length, 2);
  assert.equal((juge.blocks[2] as any).items[0][1].strong, true);
  assert.equal((juge.blocks[3] as any).text, "Un paragraphe sur deux lignes.");
  assert.deepEqual(tous.roles, [TOUS]);
  assert.equal(tous.id, "tous-les-profils");
});

test("le texte n'est jamais interprété comme du HTML", () => {
  const runs = parseInline("<script>alert(1)</script> et **<b>gras</b>**");
  assert.equal(runs[0].text, "<script>alert(1)</script> et ");
  assert.equal(runs[1].text, "<b>gras</b>");
  const [intro] = parseManuel("# T\n\n<img src=x onerror=alert(1)>\n");
  assert.equal((intro.blocks[0] as any).text, "<img src=x onerror=alert(1)>");
});

test("filtrage par rôle : intro + section du rôle + Tous les profils", () => {
  const sections = parseManuel(extrait);
  assert.deepEqual(
    sectionsPourRoles(sections, ["judge"]).map((s) => s.title),
    ["Manuel de test", "Profil : Juge", "Tous les profils"],
  );
  assert.deepEqual(
    sectionsPourRoles(sections, ["regie"]).map((s) => s.title),
    ["Manuel de test", "Tous les profils"],
  );
  assert.deepEqual(
    sectionsPourRoles(sections, []).map((s) => s.title),
    ["Manuel de test", "Tous les profils"],
  );
});

test("le manuel réel se lit et se termine par « Tous les profils »", () => {
  const sections = parseManuel(manuel);
  assert.ok(sections.length >= 3);
  assert.equal(sections[0].title, "Mode d'emploi — FIBDA Compétition");
  assert.equal(sections.at(-1)!.title, "Tous les profils");
  assert.deepEqual(sections.at(-1)!.roles, [TOUS]);
  for (const s of sections.slice(1)) {
    assert.ok(s.roles.length, `Section sans ligne « Rôles : » : ${s.title}`);
    assert.ok(s.blocks.length, `Section vide : ${s.title}`);
  }
});

test("chaque rôle de permissions.ts et de la navigation est couvert par une section du manuel", () => {
  // permissions.ts ne cite que les rôles porteurs de commandes (pas judge, trainee, speaker) :
  // on y ajoute les rôles déclarés sur les onglets de App.tsx.
  const navigation = sourceApp.slice(
    sourceApp.indexOf("const navigation = ["),
    sourceApp.indexOf("export default function App"),
  );
  const declares = [...navigation.matchAll(/roles: \[([^\]]*)\]/g)].flatMap(
    (m) => [...m[1].matchAll(/"([a-z]+)"/g)].map((r) => r[1]),
  );
  const roles = new Set([
    ...[...sourcePermissions.matchAll(/"([a-z]+)"/g)].map((m) => m[1]),
    ...declares,
  ]);
  assert.ok(roles.has("chief") && roles.has("judge") && roles.has("speaker"));
  const couverts = new Set(parseManuel(manuel).flatMap((s) => s.roles));
  for (const role of roles)
    assert.ok(
      couverts.has(role),
      `Rôle « ${role} » absent de toute ligne « Rôles : » de frontend/src/aide/MODE-D-EMPLOI.md`,
    );
});

test("chaque onglet de navigation de App.tsx est mentionné dans le manuel", () => {
  const navigation = sourceApp.slice(
    sourceApp.indexOf("const navigation = ["),
    sourceApp.indexOf("export default function App"),
  );
  const onglets = [...navigation.matchAll(/label: "([^"]+)"/g)].map(
    (m) => m[1],
  );
  assert.ok(onglets.length >= 10, "liste des onglets non lue dans App.tsx");
  const texte = normalise(manuel);
  for (const onglet of onglets)
    assert.ok(
      texte.includes(normalise(onglet)),
      `Onglet « ${onglet} » absent de frontend/src/aide/MODE-D-EMPLOI.md`,
    );
});
