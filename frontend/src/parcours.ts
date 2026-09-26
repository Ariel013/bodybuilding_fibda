// Parcours guidé de la compétition (demande du PO, 24/09/2026) : à partir de l'état serveur,
// calcule la liste ordonnée des étapes, laquelle est à faire maintenant, lesquelles sont
// bloquées et pourquoi. Logique pure, sans React ni effet de bord : testée dans parcours.test.ts.
//
// Les conditions de blocage reprennent celles du serveur (server/workflow.ts et
// server/preparation.ts) pour éviter un refus après clic. Elles ne remplacent pas le serveur :
// en cas de refus malgré tout, l'écran affiche son message tel quel.
import { type State, type Round, type Entity, labels } from "./types";

export type EtatEtape = "fait" | "en_cours" | "bloque" | "a_venir";

/** Action exécutable sur place (commande serveur), lien vers un onglet ou un document, ou sauvegarde. */
export type Action =
  | {
      genre: "commande";
      type: string;
      payload?: Record<string, any>;
      libelle: string;
      raison?: string;
    }
  | { genre: "lien"; href: string; libelle: string; externe?: boolean }
  | { genre: "sauvegarde"; libelle: string };

/** Sous-étape du cycle de fin de discipline : chaque geste avec son état propre. */
export type SousEtape = {
  libelle: string;
  fait: boolean;
  action?: Action;
  raison?: string;
};

export type Etape = {
  id: string;
  numero: number;
  titre: string;
  /** Ce que fait l'étape, en une phrase (reprise du manuel). */
  description: string;
  etat: EtatEtape;
  /** Motif de blocage, en une phrase, quand `etat === "bloque"`. */
  raison?: string;
  /** Bouton principal de l'étape (absent quand l'étape est faite). */
  principale?: Action;
  /** Actions annexes : impressions, sauvegardes, ouverture d'une rubrique. */
  contextuelles: Action[];
  /** Compteurs et informations utiles (« 12 fiches · 10 inscriptions confirmées »). */
  details: string[];
  sousEtapes?: SousEtape[];
};

const ADMIN = ["chief", "responsable", "director"];
const CLOSED = new Set(["validated", "published"]);
const CLOS_OU_SANS_TITRE = new Set(["validated", "published", "no_title"]);
const PHASES_PROGRAMME = new Set(["elimination", "semi", "final"]);

const lien = (href: string, libelle: string, externe = false): Action => ({
  genre: "lien",
  href,
  libelle,
  externe,
});
const impression = (kind: string, libelle: string, query = ""): Action =>
  lien("/api/v1/print/" + kind + (query ? "?" + query : ""), libelle, true);
const sauvegarde = (
  libelle = "Télécharger une sauvegarde complète",
): Action => ({ genre: "sauvegarde", libelle });
const commande = (
  type: string,
  libelle: string,
  payload?: Record<string, any>,
  raison?: string,
): Action => ({
  genre: "commande",
  type,
  payload,
  libelle,
  ...(raison ? { raison } : {}),
});

const pluriel = (n: number, un: string, plusieurs: string) =>
  `${n} ${n > 1 ? plusieurs : un}`;

/** Ordre des disciplines selon l'ordre de passage des catégories (même règle que le serveur). */
export function disciplines(s: State): string[] {
  const triees = [...s.categories].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  return [
    ...new Set<string>(
      triees.filter((c) => !c.archived).map((c) => c.discipline),
    ),
  ];
}

export function disciplineCourante(s: State): string | null {
  return (
    disciplines(s).find((d) => !s.discipline_progress?.[d]?.completed) ?? null
  );
}

/** Le jury général compte 5, 7, 9 ou 11 juges distincts (validatePanel, sans le contrôle des profils). */
export function juryValide(panel: string[] | undefined): boolean {
  const p = panel ?? [];
  return [5, 7, 9, 11].includes(p.length) && new Set(p).size === p.length;
}

/** Comptes approuvés et actifs pouvant siéger comme juge officiel (chef, responsable ou juge, ni directeur ni stagiaire). */
export function jugesEligibles(users: Entity[]): Entity[] {
  return users.filter(
    (u) =>
      u.approved &&
      u.active !== false &&
      !u.roles?.includes("director") &&
      !u.roles?.includes("trainee") &&
      u.roles?.some((r: string) =>
        ["chief", "responsable", "judge"].includes(r),
      ),
  );
}

export function nomManche(s: State, r: Round): string {
  if (r.grand_final)
    return `Overall final · ${labels[r.section || ""] || r.section || ""}`;
  const cat = s.categories.find((c) => c.id === r.category_id);
  return (
    cat?.name ||
    (r.phase === "overall"
      ? `Toutes catégories · ${labels[r.section || ""] || r.section || ""}`
      : r.category_id)
  );
}

/** Manche à conduire maintenant : ouverte ou suspendue, sinon en attente de validation. */
export function mancheEnCours(s: State): Round | undefined {
  return (
    s.rounds.find((r) => r.id === s.active_round_id) ||
    s.rounds.find((r) => r.status === "open" || r.status === "suspended") ||
    s.rounds.find((r) => r.status === "awaiting_validation")
  );
}

/** Conditions de « Démarrer la compétition », dans l'ordre du serveur ; vide si rien ne manque. */
export function raisonsDemarrage(s: State, admin: boolean): string[] {
  const out: string[] = [];
  const cases = ["regulations_checked", "network_checked", "backup_checked"];
  const casesManquantes = cases.filter((k) => !s.settings?.[k]).length;
  const critereManquant =
    admin && !String(s.settings?.collective_tiebreak ?? "").trim();
  if (casesManquantes || critereManquant) {
    out.push(
      [
        casesManquantes
          ? pluriel(
              casesManquantes,
              "case de contrôle non cochée",
              "cases de contrôle non cochées",
            )
          : "",
        critereManquant ? "critère collectif non renseigné" : "",
      ]
        .filter(Boolean)
        .join(", ") + " (rubrique Événement)",
    );
  }
  if (!s.rounds.length) out.push("manches non générées");
  if (!juryValide(s.jury?.panel))
    out.push("jury de 5, 7, 9 ou 11 juges requis");
  return out;
}

type Contexte = {
  s: State;
  roles: string[];
  admin: boolean;
  confirmees: Entity[];
  brouillons: Entity[];
};

function etapeComptes({ s, admin }: Contexte): Omit<Etape, "etat" | "numero"> {
  const juges = jugesEligibles(s.users ?? []);
  const attente = (s.users ?? []).filter(
    (u) => !u.approved && u.active !== false,
  );
  const details = admin
    ? [
        `${juges.length} juge${juges.length > 1 ? "s" : ""} approuvé${juges.length > 1 ? "s" : ""} pouvant siéger (5 requis au minimum)`,
        ...(attente.length
          ? [
              pluriel(
                attente.length,
                "compte en attente d’approbation",
                "comptes en attente d’approbation",
              ),
            ]
          : []),
      ]
    : [
        "Comptes créés et approuvés par la direction ; non visibles pour votre rôle.",
      ];
  return {
    id: "comptes",
    titre: "Créer les accès de l’équipe",
    description:
      "Chaque personne reçoit un code personnel et des rôles ; un compte non approuvé ne peut rien faire et un juge doit être approuvé pour entrer dans le jury.",
    raison: undefined,
    principale: lien("#preparation/jury", "Ouvrir Préparation › Jury (Inviter un membre, Approuver)"),
    contextuelles: [],
    details,
  };
}

function etapeEvenement({
  s,
  admin,
}: Contexte): Omit<Etape, "etat" | "numero"> {
  const manquantes = raisonsDemarrage(s, admin).filter((r) =>
    r.includes("Événement"),
  );
  return {
    id: "evenement",
    titre: "Renseigner l’événement et sa liste de contrôle",
    description:
      "Nom, date, lieu, mode, critère collectif de départage et les trois cases de contrôle ; le serveur les exige avant le démarrage.",
    principale: lien("#preparation/evenement", "Ouvrir Préparation › Événement"),
    contextuelles: [],
    details: manquantes.length ? manquantes : ["Liste de contrôle complète."],
  };
}

function etapeAthletes({
  s,
  confirmees,
  brouillons,
}: Contexte): Omit<Etape, "etat" | "numero"> {
  const mesures = s.people.filter(
    (p) =>
      !p.measurements_confirmed && s.entries.some((e) => e.person_id === p.id),
  ).length;
  return {
    id: "athletes",
    titre: "Enregistrer les athlètes",
    description:
      "Une seule fiche par athlète (identité, contrôles, taille, poids, mesures confirmées) : la catégorie est proposée par le référentiel et l’inscription créée, confirmée si les contrôles sont cochés.",
    principale: lien("#preparation/athletes", "Ouvrir Préparation › Athlètes"),
    contextuelles: [
      impression("fiche", "Imprimer les fiches d’inscription"),
      impression("fiche", "Fiches d’inscription vierges", "blank=10"),
      impression("registrations", "Liste des inscriptions"),
    ],
    details: [
      `${pluriel(s.people.length, "fiche", "fiches")} · ${pluriel(confirmees.length, "inscription confirmée", "inscriptions confirmées")}` +
        (brouillons.length
          ? ` · ${pluriel(brouillons.length, "brouillon à confirmer", "brouillons à confirmer")}`
          : "") +
        (mesures
          ? ` · ${pluriel(mesures, "athlète sans mesures confirmées", "athlètes sans mesures confirmées")}`
          : ""),
    ],
  };
}

function etapeCategories({
  s,
  confirmees,
}: Contexte): Omit<Etape, "etat" | "numero"> {
  const actives = s.categories.filter((c) => !c.archived);
  const effectifs = actives.map(
    (c) =>
      `${c.name} : ${confirmees.filter((e) => e.category_id === c.id).length}`,
  );
  return {
    id: "categories",
    titre: "Vérifier et fusionner les catégories",
    description:
      "Les catégories sont créées automatiquement à l’inscription ; le chef peut fusionner celles trop peu fournies, tant que les dossards ne sont pas attribués. L’étape se clôt à l’attribution des dossards.",
    raison: confirmees.length ? undefined : "aucune inscription confirmée",
    principale: lien("#preparation/categories", "Ouvrir Préparation › Catégories"),
    contextuelles: [],
    details: effectifs.length
      ? [
          pluriel(actives.length, "catégorie", "catégories") +
            " · " +
            effectifs.join(" · "),
        ]
      : ["Aucune catégorie pour le moment."],
  };
}

function etapeDossards({
  s,
  confirmees,
}: Contexte): Omit<Etape, "etat" | "numero"> {
  return {
    id: "dossards",
    titre: "Ordonner le programme et attribuer les dossards",
    description:
      "Numérote de 1 à N toutes les inscriptions confirmées, catégorie par catégorie dans l’ordre de passage ; ensuite catégories, fusions et inscriptions ordinaires sont figées.",
    raison: confirmees.length ? undefined : "aucune inscription confirmée",
    principale: commande("bibs.assign", "Attribuer les dossards"),
    contextuelles: [
      lien("#preparation/programme", "Ordonner les catégories (Préparation › Programme)"),
    ],
    details: s.bibs_distributed
      ? [
          `Dossards attribués à ${pluriel(confirmees.length, "inscription", "inscriptions")}.`,
        ]
      : [],
  };
}

function etapeJury({ s, admin }: Contexte): Omit<Etape, "etat" | "numero"> {
  const juges = jugesEligibles(s.users ?? []);
  const panel = s.jury?.panel ?? [];
  const stagiaires = s.jury?.trainees ?? [];
  let raison: string | undefined;
  if (admin && juges.length < 5)
    raison = `${juges.length} juge${juges.length > 1 ? "s" : ""} approuvé${juges.length > 1 ? "s" : ""} sur 5 requis`;
  return {
    id: "jury",
    titre: "Composer le jury",
    description:
      "5, 7, 9 ou 11 juges officiels distincts, chef inclus, plus les stagiaires hors calcul et l’ordre de retrait ; chaque manche générée reçoit une copie de ce jury.",
    raison,
    principale: lien("#preparation/jury", "Ouvrir Préparation › Jury (Composition du jury)"),
    contextuelles: [],
    details: [
      panel.length
        ? `Jury enregistré : ${pluriel(panel.length, "juge officiel", "juges officiels")}, ${pluriel(stagiaires.length, "stagiaire", "stagiaires")}` +
          (juryValide(panel)
            ? ""
            : " (effectif invalide : 5, 7, 9 ou 11 requis)")
        : "Aucun jury enregistré.",
    ],
  };
}

function etapeManches({ s }: Contexte): Omit<Etape, "etat" | "numero"> {
  let raison: string | undefined;
  if (!s.bibs_distributed) raison = "dossards non attribués";
  else if (!juryValide(s.jury?.panel))
    raison = "jury de 5, 7, 9 ou 11 juges requis";
  const parCategorie = s.rounds.filter(
    (r) => !r.grand_final && r.phase !== "overall",
  ).length;
  return {
    id: "manches",
    titre: "Générer les manches",
    description:
      "Pour chaque catégorie inscrite, crée la suite de manches selon l’effectif (finale directe jusqu’à 6, demi-finale de 7 à 15, éliminatoire à partir de 16), chacune avec le jury enregistré.",
    raison,
    principale: commande(
      "programme.generate",
      s.rounds.length ? "Régénérer les manches" : "Générer les manches",
    ),
    contextuelles: s.rounds.length
      ? [
          impression("programme", "Imprimer l’ordre de passage"),
          sauvegarde("Sauvegarder après les dossards et les manches"),
        ]
      : [],
    details: s.rounds.length
      ? [pluriel(parCategorie, "manche prévue", "manches prévues")]
      : [],
  };
}

function etapeDemarrer(ctx: Contexte): Omit<Etape, "etat" | "numero"> {
  const { s } = ctx;
  const raisons = raisonsDemarrage(s, ctx.admin);
  const demarree = s.status !== "preparation";
  return {
    id: "demarrer",
    titre: "Démarrer la compétition",
    description:
      "Fige le référentiel, la date et le mode, passe l’événement « En cours » et ouvre d’elle-même la première manche du programme : les juges voient aussitôt leur bulletin.",
    raison: demarree ? undefined : raisons[0],
    principale: commande("event.start", "Démarrer la compétition"),
    contextuelles: demarree
      ? [
          sauvegarde("Sauvegarder juste après le démarrage"),
          impression("blank", "Imprimer les fiches de notation"),
        ]
      : [],
    details: demarree
      ? [
          `Compétition ${labels[s.status] ? labels[s.status].toLowerCase() : s.status}.`,
        ]
      : raisons.slice(1),
  };
}

type Brute = Omit<Etape, "etat" | "numero">;

function etapeMancheEnCours(ctx: Contexte): { etape: Brute; active: boolean } {
  const { s } = ctx;
  const running = s.status === "running";
  const manche = running ? mancheEnCours(s) : undefined;
  const courante = disciplineCourante(s);
  const details: string[] = [];
  const contextuelles: Action[] = [];
  let principale: Action | undefined;
  let active = false;
  if (manche) {
    active = true;
    const officiels = manche.panel.filter((j) => manche.ballots?.[j]).length;
    const stagiaires = manche.trainees.filter(
      (j) => manche.ballots?.[j],
    ).length;
    const absents = (manche.absent_ids ?? []).length;
    details.push(
      `${nomManche(s, manche)} · ${manche.grand_final ? "Toutes disciplines" : labels[manche.phase] || manche.phase} · ${labels[manche.status] || manche.status}`,
      `Bulletins officiels reçus : ${officiels}/${manche.panel.length} · stagiaires : ${stagiaires}/${manche.trainees.length}` +
        (absents
          ? ` · ${pluriel(absents, "absent déclaré", "absents déclarés")}`
          : ""),
    );
    if (manche.status === "awaiting_validation") {
      principale = commande(
        "round.validate",
        "Valider les résultats sportifs",
        { round_id: manche.id },
      );
    } else if (manche.status === "suspended") {
      principale = lien(
        "#competition",
        "Ouvrir le dossier : résoudre l’incident",
      );
    } else {
      const complet =
        manche.panel.length > 0 && officiels === manche.panel.length;
      principale = commande(
        "round.next",
        "Passer à la manche suivante",
        {},
        complet
          ? undefined
          : `Des bulletins officiels sont encore attendus (${officiels}/${manche.panel.length}).`,
      );
    }
    contextuelles.push(
      lien("#competition", "Ouvrir le dossier (Compétition)"),
      impression(
        "blank",
        "Fiches de notation de cette manche",
        "round_id=" + manche.id,
      ),
      impression(
        "programme",
        "Ordre de passage de cette manche",
        "round_id=" + manche.id,
      ),
    );
  } else if (running) {
    // Aucune manche ouverte : la suivante prête s'ouvre d'elle-même ; sinon une manche en attente
    // reste à lancer (round.next), ou un toutes catégories d'un seul champion attend le chef.
    const enAttente = s.rounds.filter((r) => r.status === "pending");
    const overallSeul = enAttente.find(
      (r) =>
        r.phase === "overall" &&
        r.participant_ids.length === 1 &&
        (r.grand_final || r.discipline === courante),
    );
    const restantes = enAttente.filter(
      (r) =>
        (PHASES_PROGRAMME.has(r.phase) && r.discipline === courante) ||
        (r.phase === "overall" &&
          r.participant_ids.length >= 2 &&
          ((!r.grand_final && r.discipline === courante) ||
            (r.grand_final && courante === null))),
    );
    if (overallSeul) {
      active = true;
      details.push(
        `${nomManche(s, overallSeul)} : un seul champion, à confirmer par le chef sans bulletin.`,
      );
      principale = commande(
        "overall.confirm",
        "Confirmer le toutes catégories",
        { round_id: overallSeul.id },
      );
      contextuelles.push(
        lien("#competition", "Ouvrir le dossier (Compétition)"),
      );
    } else if (restantes.length) {
      active = true;
      details.push(
        `Aucune manche ouverte · ${pluriel(restantes.length, "manche en attente", "manches en attente")} dans la discipline ${courante ?? "overall final"}.`,
      );
      principale = commande("round.next", "Passer à la manche suivante");
      contextuelles.push(
        lien("#competition", "Ouvrir le dossier (Compétition)"),
      );
    } else {
      details.push(
        courante
          ? `Toutes les manches de la discipline ${courante} sont validées.`
          : "Toutes les manches sont validées.",
      );
    }
  }
  return {
    etape: {
      id: "manche",
      titre: "Conduire la manche en cours",
      description:
        "La manche active reçoit les bulletins ; après le dernier bulletin officiel, le chef valide le résultat, puis la manche suivante prête s’ouvre d’elle-même.",
      principale,
      contextuelles,
      details,
    },
    active,
  };
}

function etapeFinDiscipline(ctx: Contexte): { etape: Brute; faite: boolean } {
  const { s } = ctx;
  const courante = disciplineCourante(s);
  const running = s.status === "running";
  if (!running || !courante) {
    return {
      etape: {
        id: "discipline",
        titre: "Terminer la discipline : récompenses et toutes catégories",
        description:
          "Quand toutes les finales d’une discipline sont validées : remises des catégories, toutes catégories par section, remise du champion, puis fin de la discipline ; la première manche de la discipline suivante s’ouvre d’elle-même.",
        contextuelles:
          running || s.status === "finished"
            ? [sauvegarde("Sauvegarder après chaque discipline terminée")]
            : [],
        details: running ? ["Toutes les disciplines sont terminées."] : [],
      },
      faite: running || s.status === "finished",
    };
  }
  const progres = s.discipline_progress?.[courante] ?? {};
  const finales = s.rounds.filter(
    (r) => r.discipline === courante && r.phase === "final",
  );
  const finalesOuvertes = finales.filter(
    (r) => !CLOS_OU_SANS_TITRE.has(r.status),
  ).length;
  const sections = [
    ...new Set<string>(
      s.categories
        .filter((c) => c.discipline === courante && !c.archived)
        .map((c) => c.section),
    ),
  ];
  const creees: string[] = progres.overall_sections ?? [];
  const overalls = s.rounds.filter(
    (r) => r.discipline === courante && r.phase === "overall" && !r.grand_final,
  );
  const overallsOuverts = overalls.filter(
    (r) => !CLOS_OU_SANS_TITRE.has(r.status),
  );
  const sous: SousEtape[] = [];
  sous.push({
    libelle: "Confirmer les remises des catégories",
    fait: !!progres.category_rewards_done,
    action: commande(
      "rewards.complete",
      "Confirmer les remises des catégories",
      { discipline: courante, kind: "category" },
    ),
    raison: finalesOuvertes
      ? `${pluriel(finalesOuvertes, "finale", "finales")} de ${courante} reste${finalesOuvertes > 1 ? "nt" : ""} à valider`
      : undefined,
  });
  for (const section of sections) {
    sous.push({
      libelle: `Toutes catégories ${labels[section] || section} (créé automatiquement après les finales)`,
      fait: creees.includes(section),
      action: commande(
        "overall.create",
        `Créer le toutes catégories ${labels[section] || section}`,
        { discipline: courante, section, exam_user_ids: [] },
      ),
      raison: finalesOuvertes
        ? "se crée seul dès que les finales sont validées"
        : undefined,
    });
  }
  const overallAJuger = overallsOuverts.length
    ? `${nomManche(s, overallsOuverts[0])} à juger (étape « Conduire la manche en cours »)`
    : undefined;
  const sectionsManquantes = sections.filter((x) => !creees.includes(x));
  sous.push({
    libelle: "Confirmer les remises toutes catégories",
    fait: !!progres.overall_rewards_done,
    action: commande(
      "rewards.complete",
      "Confirmer les remises toutes catégories",
      { discipline: courante, kind: "overall" },
    ),
    raison: sectionsManquantes.length
      ? `toutes catégories à créer : ${sectionsManquantes.map((x) => labels[x] || x).join(", ")}`
      : overallAJuger,
  });
  sous.push({
    libelle: "Terminer cette discipline",
    fait: false,
    action: commande("discipline.advance", "Terminer cette discipline", {
      discipline: courante,
    }),
    raison:
      !progres.category_rewards_done || !progres.overall_rewards_done
        ? "les deux confirmations de remises sont requises"
        : s.active_round_id
          ? "une manche est encore ouverte"
          : undefined,
  });
  const prochaine = sous.find((x) => !x.fait);
  const raison = finalesOuvertes ? sous[0].raison : overallAJuger;
  return {
    etape: {
      id: "discipline",
      titre: `Terminer la discipline ${courante} : récompenses et toutes catégories`,
      description:
        "Quand toutes les finales d’une discipline sont validées : remises des catégories, toutes catégories par section, remise du champion, puis fin de la discipline ; la première manche de la discipline suivante s’ouvre d’elle-même.",
      raison,
      principale: prochaine && !prochaine.raison ? prochaine.action : undefined,
      contextuelles: [
        lien("#rewards", "Préparer et remettre les récompenses (Récompenses)"),
        impression("rewards", "Imprimer la liste des récompenses"),
        impression("results", "Imprimer les résultats"),
        sauvegarde("Sauvegarder après chaque discipline terminée"),
      ],
      details: [
        `Discipline en cours : ${courante} · ${pluriel(finales.length - finalesOuvertes, "finale validée", "finales validées")} sur ${finales.length}`,
      ],
      sousEtapes: sous,
    },
    faite: false,
  };
}

function etapeCloture(ctx: Contexte): Omit<Etape, "etat" | "numero"> {
  const { s } = ctx;
  const restantes = disciplines(s).filter(
    (d) => !s.discipline_progress?.[d]?.completed,
  );
  const finalePendante = s.rounds.some(
    (r) => r.grand_final && !CLOSED.has(r.status) && r.status !== "no_title",
  );
  let raison: string | undefined;
  if (s.status === "running") {
    if (restantes.length)
      raison = `${pluriel(restantes.length, "discipline reste à terminer", "disciplines restent à terminer")} : ${restantes.join(", ")}`;
    else if (finalePendante)
      raison = "l’overall final doit être validé avant la clôture";
  }
  const documents: Action[] = [
    sauvegarde(
      s.status === "finished"
        ? "Sauvegarde finale (après clôture)"
        : "Sauvegarde finale (avant clôture)",
    ),
    impression("results", "Résultats"),
    impression("rewards", "Récompenses"),
    impression("diploma", "Diplômes"),
    impression("recap", "Récapitulatif jury"),
    lien("/api/v1/export/results?format=csv", "Résultats CSV", true),
    lien("/api/v1/export/results?format=xlsx", "Résultats XLSX", true),
    lien("/api/v1/export/results?format=pdf", "Résultats PDF", true),
  ];
  return {
    id: "cloture",
    titre: "Clôturer la compétition",
    description:
      "Passe l’événement « Terminé » ; toute modification est ensuite refusée. Téléchargez d’abord la sauvegarde finale et les documents.",
    raison,
    principale: commande("event.finish", "Terminer la compétition"),
    contextuelles: s.status === "preparation" ? [] : documents,
    details: s.status === "finished" ? ["Compétition terminée."] : [],
  };
}

/**
 * Calcule les étapes du parcours. Une seule étape « en cours » : la première non faite dont les
 * prérequis sont remplis ; les suivantes sans prérequis manquant sont « à venir », celles dont
 * un prérequis manque sont « bloquées » avec la raison. Les étapes de compétition (9 à 11)
 * restent « à venir » tant que la compétition n'est pas démarrée.
 */
export function etapes(s: State, roles: string[]): Etape[] {
  const admin = roles.some((r) => ADMIN.includes(r));
  const ctx: Contexte = {
    s,
    roles,
    admin,
    confirmees: s.entries.filter((e) => e.confirmed),
    brouillons: s.entries.filter((e) => !e.confirmed),
  };
  const preparation = s.status === "preparation";
  const running = s.status === "running";
  const finished = s.status === "finished";
  const juges = jugesEligibles(s.users ?? []);
  const manche = etapeMancheEnCours(ctx);
  const discipline = etapeFinDiscipline(ctx);
  const brut: { etape: Brute; fait: boolean; atteignable: boolean }[] = [
    {
      etape: etapeComptes(ctx),
      fait: !admin || juges.length >= 5 || !preparation,
      atteignable: true,
    },
    {
      etape: etapeEvenement(ctx),
      fait:
        !preparation ||
        raisonsDemarrage(s, admin).every((r) => !r.includes("Événement")),
      atteignable: true,
    },
    {
      etape: etapeAthletes(ctx),
      fait:
        !preparation ||
        (ctx.confirmees.length > 0 && ctx.brouillons.length === 0),
      atteignable: true,
    },
    {
      etape: etapeCategories(ctx),
      fait: !!s.bibs_distributed,
      atteignable: true,
    },
    {
      etape: etapeDossards(ctx),
      fait: !!s.bibs_distributed,
      atteignable: true,
    },
    {
      etape: etapeJury(ctx),
      fait: juryValide(s.jury?.panel),
      atteignable: true,
    },
    { etape: etapeManches(ctx), fait: s.rounds.length > 0, atteignable: true },
    { etape: etapeDemarrer(ctx), fait: !preparation, atteignable: true },
    {
      etape: manche.etape,
      fait: finished || (running && !manche.active),
      atteignable: running || finished,
    },
    {
      etape: discipline.etape,
      fait: finished || discipline.faite,
      atteignable: running || finished,
    },
    {
      etape: etapeCloture(ctx),
      fait: finished,
      atteignable: running || finished,
    },
  ];
  let enCoursAttribuee = false;
  return brut.map(({ etape, fait, atteignable }, i) => {
    let etat: EtatEtape;
    if (fait) etat = "fait";
    else if (!atteignable) etat = "a_venir";
    else if (etape.raison) etat = "bloque";
    else if (!enCoursAttribuee) {
      etat = "en_cours";
      enCoursAttribuee = true;
    } else etat = "a_venir";
    return {
      ...etape,
      numero: i + 1,
      etat,
      raison: etat === "bloque" ? etape.raison : undefined,
      principale: etat === "fait" ? undefined : etape.principale,
    };
  });
}

/** Étape mise en évidence, s'il y en a une. */
export function etapeEnCours(liste: Etape[]): Etape | undefined {
  return liste.find((e) => e.etat === "en_cours");
}
