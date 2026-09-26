// Choix automatique d'une catégorie à partir des propositions du référentiel
// (GET /api/v1/eligibility/:person_id) et des catégories déjà créées dans l'événement.
// Module pur : aucun appel réseau, aucun état ; Preparation.tsx l'utilise après « Enregistrer ».
// Les règles d'admission restent celles du serveur (preparation.ts) : ce module ne fait que
// proposer une présélection, jamais une admission.

/** Proposition telle que renvoyée par le serveur (forme de `Proposal` dans domain/catalogue.ts). */
export type Proposition = {
  rule_id: string;
  discipline: string;
  name: string;
  division: string;
  section: string;
  reasons: string[];
  status?: string;
};

/** Catégorie de l'événement (sous-ensemble des champs utiles ; optionnels pour accepter `Entity`). */
export type CategorieEvenement = {
  id: string;
  name?: string;
  rule_id?: string;
  section?: string;
  archived?: boolean;
  /** Catégories modulables (PO, 26/09/2026) : absent = active. */
  active?: boolean;
  source_rule_ids?: string[];
};

/** Une catégorie possible pour l'athlète : existante (category_id) ou à créer (category_id null). */
export type Alternative = {
  rule_id: string;
  nom: string;
  discipline: string;
  division: string;
  category_id: string | null;
  /** Vrai quand la catégorie existe mais est désactivée : ni présélection, ni création. */
  desactivee: boolean;
  motifs: string[];
};

export type Choix = {
  /** Catégorie existante présélectionnée, sinon null. */
  category_id: string | null;
  /** Règle de la catégorie à créer (`category.save {rule_id, section}`), sinon null. */
  rule_id: string | null;
  /** Libellé de la proposition retenue. */
  nom: string;
  /** Toutes les propositions retenues pour la section, la principale en premier. */
  alternatives: Alternative[];
  /** Explication en français à afficher. */
  message: string;
};

/** Forme minimale d'une catégorie ou d'une inscription (accepte `Entity` grâce à la signature d'index). */
type Etiquetable = { archived?: boolean; active?: boolean; [key: string]: unknown };

/** Catégorie jouée : ni archivée ni désactivée (`active` absent vaut actif). */
export function categorieActive(c: Etiquetable): boolean {
  return !c.archived && c.active !== false;
}

/** Catégories qui peuvent recevoir un athlète (mêmes critères que le serveur pour entry.save). */
export function categoriesInscriptibles<T extends Etiquetable>(categories: T[]): T[] {
  return categories.filter(categorieActive);
}

/** Catégories cochées où la personne n'est pas encore inscrite : une commande entry.save par élément. */
export function categoriesAInscrire(
  choisies: string[],
  inscriptions: { category_id?: unknown; [key: string]: unknown }[],
): string[] {
  const deja = new Set(inscriptions.map((e) => String(e.category_id)));
  return [...new Set(choisies)].filter((id) => !deja.has(id));
}

/**
 * Catégorie non archivée de l'événement portant cette règle (directement ou par fusion) dans cette
 * section, active de préférence ; une catégorie désactivée n'est renvoyée qu'à défaut d'active.
 */
export function categoriePourRegle(
  categories: CategorieEvenement[],
  ruleId: string,
  section: string,
): CategorieEvenement | undefined {
  const porteuses = categories.filter(
    (c) =>
      !c.archived &&
      c.section === section &&
      (c.rule_id === ruleId || (c.source_rule_ids ?? []).includes(ruleId)),
  );
  return porteuses.find(categorieActive) ?? porteuses[0];
}

/**
 * Retient la proposition principale : la première proposition (ordre du référentiel) qui
 * correspond à une catégorie déjà créée ; à défaut, la première proposition, à créer.
 * Une catégorie existante est préférée pour ne pas créer une discipline que l'événement
 * ne dispute pas.
 */
export function choisirCategorie(
  propositions: Proposition[],
  categories: CategorieEvenement[],
  section: string,
): Choix {
  const retenues = propositions.filter((p) => p.section === section);
  const alternatives: Alternative[] = retenues.map((p) => {
    const existante = categoriePourRegle(categories, p.rule_id, section);
    return {
      rule_id: p.rule_id,
      nom: p.name,
      discipline: p.discipline,
      division: p.division,
      category_id: existante?.id ?? null,
      desactivee: existante !== undefined && !categorieActive(existante),
      motifs: p.reasons ?? [],
    };
  });
  if (alternatives.length === 0) {
    return {
      category_id: null,
      rule_id: null,
      nom: "",
      alternatives,
      message:
        "Aucune catégorie du référentiel ne correspond à cette fiche (sexe, âge, taille, poids, section). Choisissez une catégorie dans la liste ; le serveur demandera une dérogation du chef si elle est hors critères.",
    };
  }
  // Une catégorie désactivée n'est jamais présélectionnée ni recréée : elle attend sa réactivation.
  const existante = alternatives.find((a) => a.category_id !== null && !a.desactivee);
  const aCreer = alternatives.find((a) => a.category_id === null);
  const principale = existante ?? aCreer ?? alternatives[0];
  const ordonnees = [principale, ...alternatives.filter((a) => a !== principale)];
  const autres = ordonnees.slice(1);
  const detail =
    autres.length > 0
      ? " Autres catégories possibles : " + autres.map((a) => a.nom + (a.desactivee ? " (désactivée)" : "")).join(", ") + "."
      : "";
  if (principale.desactivee) {
    return {
      category_id: null,
      rule_id: null,
      nom: principale.nom,
      alternatives: ordonnees,
      message:
        "Catégorie proposée : " + principale.nom + ", mais elle est désactivée. Réactivez-la dans la rubrique Catégories ou cochez une autre catégorie." + detail,
    };
  }
  return {
    category_id: principale.category_id,
    rule_id: principale.category_id === null ? principale.rule_id : null,
    nom: principale.nom,
    alternatives: ordonnees,
    message:
      (principale.category_id !== null
        ? "Catégorie proposée : " + principale.nom + " (déjà créée)."
        : "Catégorie proposée : " + principale.nom + " (créée automatiquement).") + detail,
  };
}

/** Champs de la fiche nécessaires pour interroger le référentiel. */
export function ficheComplete(person: Record<string, unknown>): boolean {
  const present = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";
  return (
    ["M", "F"].includes(String(person.sex)) &&
    present(person.birth_date) &&
    present(person.height_cm) &&
    present(person.weight_kg)
  );
}

/**
 * Vrai quand les contrôles cochés sur la fiche permettent de tenter une inscription confirmée
 * (mêmes cases que `admission()` côté serveur ; le serveur reste seul juge).
 */
export function confirmationPossible(person: Record<string, unknown>, mode: string): boolean {
  const flags = ["status_approved", "licence_ok", "payment_ok", "measurements_confirmed"];
  if (mode === "international") flags.push("delegation_approved", "organizer_approved");
  return flags.every((f) => Boolean(person[f]));
}

/** Après les dossards ou une fois la compétition démarrée, toute nouvelle inscription passe par `entry.late`. */
export function inscriptionTardiveRequise(etat: { bibs_distributed?: boolean; status?: string }): boolean {
  return Boolean(etat.bibs_distributed) || (etat.status !== undefined && etat.status !== "preparation");
}

/** Clé de compatibilité de fusion (règle serveur `category.fuse`). */
export const CLES_FUSION = ["discipline", "sex", "section", "division", "age_min", "age_max"] as const;

/** Vrai si toutes les catégories partagent discipline, sexe, section et groupe d'âge (règle serveur). */
export function fusionCompatible(categories: Record<string, unknown>[]): boolean {
  if (categories.length < 2) return true;
  return categories.every((c) =>
    CLES_FUSION.every((k) => (c[k] ?? null) === (categories[0][k] ?? null)),
  );
}

/** Nom par défaut d'une fusion (même règle que le serveur quand aucun nom n'est donné). */
export const nomFusionParDefaut = (categories: { id: string; name?: string }[]): string =>
  categories.map((c) => c.name ?? "").join(" / ");
