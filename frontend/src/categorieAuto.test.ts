// Tests du choix automatique de catégorie (module pur, sans réseau ni composant).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  choisirCategorie,
  categoriePourRegle,
  categorieActive,
  categoriesInscriptibles,
  categoriesAInscrire,
  ficheComplete,
  confirmationPossible,
  inscriptionTardiveRequise,
  fusionCompatible,
  nomFusionParDefaut,
  type Proposition,
  type CategorieEvenement,
} from "./categorieAuto";

const proposition = (rule_id: string, discipline: string, name: string, reasons: string[] = []): Proposition => ({
  rule_id,
  discipline,
  name,
  division: "senior",
  section: "amateur",
  reasons,
});

const bb = proposition("bodybuilding-senior-all-70", "bodybuilding", "Bodybuilding senior ≤ 70");
const classic = proposition("classic_bodybuilding-senior-all-171", "classic_bodybuilding", "Classic bodybuilding senior ≤ 171");
const physique = proposition("mens_physique-senior-all-170", "mens_physique", "Men's Physique senior ≤ 170", ["Mesures à confirmer."]);

const cat = (id: string, rule_id: string, extra: Partial<CategorieEvenement> = {}): CategorieEvenement => ({
  id,
  name: "Cat " + id,
  rule_id,
  section: "amateur",
  archived: false,
  ...extra,
});

test("aucune proposition : rien à présélectionner, message d'orientation", () => {
  const choix = choisirCategorie([], [cat("c1", bb.rule_id)], "amateur");
  assert.equal(choix.category_id, null);
  assert.equal(choix.rule_id, null);
  assert.deepEqual(choix.alternatives, []);
  assert.match(choix.message, /Aucune catégorie du référentiel/);
});

test("première proposition sans catégorie existante : règle à créer", () => {
  const choix = choisirCategorie([bb, classic], [], "amateur");
  assert.equal(choix.category_id, null);
  assert.equal(choix.rule_id, bb.rule_id);
  assert.equal(choix.nom, bb.name);
  assert.equal(choix.alternatives.length, 2);
  assert.equal(choix.alternatives[0].rule_id, bb.rule_id);
  assert.match(choix.message, /créée automatiquement/);
  assert.match(choix.message, /Autres catégories possibles : Classic bodybuilding senior ≤ 171\./);
});

test("catégorie existante pour la première proposition : présélection", () => {
  const choix = choisirCategorie([bb, classic], [cat("c1", bb.rule_id)], "amateur");
  assert.equal(choix.category_id, "c1");
  assert.equal(choix.rule_id, null);
  assert.match(choix.message, /déjà créée/);
});

test("une catégorie existante d'une autre proposition est préférée à une création", () => {
  const choix = choisirCategorie([bb, classic, physique], [cat("c2", classic.rule_id)], "amateur");
  assert.equal(choix.category_id, "c2");
  assert.equal(choix.rule_id, null);
  assert.equal(choix.alternatives[0].rule_id, classic.rule_id);
  assert.deepEqual(
    choix.alternatives.slice(1).map((a) => a.rule_id),
    [bb.rule_id, physique.rule_id],
  );
  assert.deepEqual(choix.alternatives[2].motifs, ["Mesures à confirmer."]);
});

test("section, archivage et fusion sont respectés", () => {
  const categories = [
    cat("pro", bb.rule_id, { section: "pro" }),
    cat("old", bb.rule_id, { archived: true }),
    cat("fusion", "autre-regle", { source_rule_ids: [bb.rule_id, "autre-regle"] }),
  ];
  assert.equal(categoriePourRegle(categories, bb.rule_id, "amateur")?.id, "fusion");
  assert.equal(categoriePourRegle(categories, bb.rule_id, "pro")?.id, "pro");
  const choix = choisirCategorie([bb, { ...classic, section: "pro" }], categories, "amateur");
  assert.equal(choix.category_id, "fusion");
  assert.equal(choix.alternatives.length, 1, "la proposition pro est écartée pour un amateur");
});

test("fiche complète et confirmation possible", () => {
  const p = { sex: "M", birth_date: "1990-01-01", height_cm: "170", weight_kg: "69.5" };
  assert.equal(ficheComplete(p), true);
  assert.equal(ficheComplete({ ...p, weight_kg: "" }), false);
  assert.equal(ficheComplete({ ...p, sex: "" }), false);
  const flags = { status_approved: true, licence_ok: true, payment_ok: true, measurements_confirmed: true };
  assert.equal(confirmationPossible(flags, "national"), true);
  assert.equal(confirmationPossible({ ...flags, payment_ok: false }, "national"), false);
  assert.equal(confirmationPossible(flags, "international"), false);
  assert.equal(confirmationPossible({ ...flags, delegation_approved: true, organizer_approved: true }, "international"), true);
});

test("inscription tardive dès les dossards attribués ou la compétition démarrée", () => {
  assert.equal(inscriptionTardiveRequise({ bibs_distributed: false, status: "preparation" }), false);
  assert.equal(inscriptionTardiveRequise({ bibs_distributed: true, status: "preparation" }), true);
  assert.equal(inscriptionTardiveRequise({ bibs_distributed: false, status: "running" }), true);
});

test("fusion : compatibilité et nom par défaut", () => {
  const a = { id: "a", name: "A", discipline: "bodybuilding", sex: "M", section: "amateur", division: "senior", age_min: null, age_max: null };
  const b = { ...a, id: "b", name: "B" };
  assert.equal(fusionCompatible([a, b]), true);
  assert.equal(fusionCompatible([a, { ...b, division: "junior" }]), false);
  assert.equal(fusionCompatible([a, { ...b, age_max: 23 }]), false);
  assert.equal(fusionCompatible([a]), true);
  assert.equal(nomFusionParDefaut([a, b]), "A / B");
});

test("catégorie active : archivée ou désactivée exclues, « active » absent vaut actif", () => {
  assert.equal(categorieActive({}), true);
  assert.equal(categorieActive({ active: true }), true);
  assert.equal(categorieActive({ active: false }), false);
  assert.equal(categorieActive({ archived: true }), false);
  const liste = [cat("a", bb.rule_id), cat("b", bb.rule_id, { active: false }), cat("c", bb.rule_id, { archived: true })];
  assert.deepEqual(categoriesInscriptibles(liste).map((c) => c.id), ["a"]);
});

test("catégories à inscrire : cochées moins celles déjà inscrites, sans doublon", () => {
  const inscriptions = [{ category_id: "a" }];
  assert.deepEqual(categoriesAInscrire(["a", "b", "b", "c"], inscriptions), ["b", "c"]);
  assert.deepEqual(categoriesAInscrire([], inscriptions), []);
  assert.deepEqual(categoriesAInscrire(["a"], inscriptions), []);
});

test("une catégorie désactivée n'est ni présélectionnée ni recréée", () => {
  const inactive = cat("off", bb.rule_id, { active: false });
  // Une catégorie active portant la même règle est préférée à la désactivée.
  assert.equal(categoriePourRegle([inactive, cat("on", bb.rule_id)], bb.rule_id, "amateur")?.id, "on");
  // Seule proposition et sa catégorie désactivée : rien à faire, message d'orientation.
  const seule = choisirCategorie([bb], [inactive], "amateur");
  assert.equal(seule.category_id, null);
  assert.equal(seule.rule_id, null);
  assert.equal(seule.alternatives[0].desactivee, true);
  assert.match(seule.message, /désactivée/);
  // Une autre proposition sans catégorie : elle est retenue (à créer), la désactivée listée.
  const autre = choisirCategorie([bb, classic], [inactive], "amateur");
  assert.equal(autre.category_id, null);
  assert.equal(autre.rule_id, classic.rule_id);
  assert.match(autre.message, /Bodybuilding senior ≤ 70 \(désactivée\)/);
  // Une autre proposition avec catégorie active : présélectionnée.
  const active = choisirCategorie([bb, classic], [inactive, cat("c2", classic.rule_id)], "amateur");
  assert.equal(active.category_id, "c2");
});
