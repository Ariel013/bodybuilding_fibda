import { test } from "node:test";
import assert from "node:assert/strict";
import { etapes, etapeEnCours, raisonsDemarrage, juryValide } from "./parcours";
import type { State, Round } from "./types";

// Fixtures : état projeté tel que le serveur le rend au chef (server/state.ts + projections.ts).
const CHEF = ["chief"];

function juge(id: string, roles = ["judge"], approved = true) {
  return { id, name: id, roles, approved, active: true };
}

function evenementVide(): State {
  return {
    id: "ev",
    version: 0,
    name: "Test",
    date: "2026-09-26",
    location: "Abidjan",
    mode: "national",
    status: "preparation",
    demo: false,
    restore_id: "r",
    server_time: 0,
    me: { id: "chef", roles: CHEF },
    people: [],
    entries: [],
    categories: [],
    officials: [],
    users: [juge("chef", ["chief"])],
    rounds: [],
    rewards: [],
    alerts: [],
    exam_programs: [],
    settings: {
      collective_tiebreak: "",
      regulations_checked: false,
      network_checked: false,
      backup_checked: false,
    },
    active_round_id: null,
    public: {},
    bibs_distributed: false,
    discipline_progress: {},
    jury: { panel: [], trainees: [], withdrawal_order: [] },
  };
}

function avecAthletes(s: State, confirmes = 3, brouillons = 0): State {
  s.categories = [
    {
      id: "c1",
      name: "Bodybuilding -70",
      discipline: "bodybuilding",
      section: "amateur",
      order: 0,
    },
  ];
  for (let i = 0; i < confirmes + brouillons; i++) {
    s.people.push({
      id: "p" + i,
      first_name: "A",
      last_name: String(i),
      measurements_confirmed: true,
    });
    s.entries.push({
      id: "e" + i,
      person_id: "p" + i,
      category_id: "c1",
      confirmed: i < confirmes,
    });
  }
  return s;
}

function avecCinqJuges(s: State): State {
  s.users = [
    juge("chef", ["chief"]),
    juge("j1"),
    juge("j2"),
    juge("j3"),
    juge("j4"),
  ];
  return s;
}

function avecJury(s: State): State {
  avecCinqJuges(s);
  s.jury = {
    panel: ["chef", "j1", "j2", "j3", "j4"],
    trainees: [],
    withdrawal_order: ["j4", "j3"],
  };
  return s;
}

function evenementRenseigne(s: State): State {
  s.settings = {
    collective_tiebreak: "Décision motivée",
    regulations_checked: true,
    network_checked: true,
    backup_checked: true,
  };
  return s;
}

function manche(id: string, status: string, extra: Partial<Round> = {}): Round {
  return {
    id,
    category_id: "c1",
    discipline: "bodybuilding",
    section: "amateur",
    phase: "final",
    status,
    participant_ids: ["e0", "e1", "e2"],
    panel: ["chef", "j1", "j2", "j3", "j4"],
    trainees: [],
    ballots: {},
    ...extra,
  };
}

const etats = (s: State, roles = CHEF) =>
  Object.fromEntries(etapes(s, roles).map((e) => [e.id, e.etat]));
const raison = (s: State, id: string) =>
  etapes(s, CHEF).find((e) => e.id === id)?.raison;

test("événement vide : les comptes sont à faire, tout le reste attend ou est bloqué avec sa raison", () => {
  const s = evenementVide();
  const liste = etapes(s, CHEF);
  assert.equal(liste.length, 11);
  assert.equal(
    liste.map((e) => e.id).join(","),
    "comptes,evenement,athletes,categories,dossards,jury,manches,demarrer,manche,discipline,cloture",
  );
  assert.equal(etapeEnCours(liste)?.id, "comptes");
  assert.equal(etats(s).evenement, "a_venir");
  assert.equal(etats(s).athletes, "a_venir");
  assert.equal(etats(s).dossards, "bloque");
  assert.equal(raison(s, "dossards"), "aucune inscription confirmée");
  assert.equal(etats(s).jury, "bloque");
  assert.equal(raison(s, "jury"), "1 juge approuvé sur 5 requis");
  assert.equal(etats(s).manches, "bloque");
  assert.equal(raison(s, "manches"), "dossards non attribués");
  assert.equal(etats(s).demarrer, "bloque");
  assert.match(
    raison(s, "demarrer") ?? "",
    /3 cases de contrôle non cochées, critère collectif non renseigné/,
  );
  // Les étapes de compétition ne sont pas bloquées mais à venir tant que rien n'est démarré.
  assert.equal(etats(s).manche, "a_venir");
  assert.equal(etats(s).discipline, "a_venir");
  assert.equal(etats(s).cloture, "a_venir");
  // Aucune commande n'est proposée sur une étape bloquée ; les liens de saisie restent.
  assert.equal(liste[0].principale?.genre, "lien");
  assert.equal(
    liste[0].principale && "href" in liste[0].principale
      ? liste[0].principale.href
      : "",
    "#preparation/jury",
  );
});

test("athlètes inscrits sans dossards : catégories à vérifier, dossards attribuables, manches bloquées", () => {
  const s = avecCinqJuges(evenementRenseigne(avecAthletes(evenementVide(), 3)));
  const liste = etapes(s, CHEF);
  assert.equal(etats(s).comptes, "fait");
  assert.equal(etats(s).evenement, "fait");
  assert.equal(etats(s).athletes, "fait");
  assert.equal(etapeEnCours(liste)?.id, "categories");
  assert.equal(etats(s).dossards, "a_venir");
  const dossards = liste.find((e) => e.id === "dossards")!;
  assert.deepEqual(dossards.principale, {
    genre: "commande",
    type: "bibs.assign",
    payload: undefined,
    libelle: "Attribuer les dossards",
  });
  assert.equal(etats(s).jury, "a_venir");
  assert.equal(raison(s, "manches"), "dossards non attribués");
  assert.equal(raison(s, "demarrer"), "manches non générées");
  // Les fiches d'inscription sont imprimables dès cette étape.
  const athletes = liste.find((e) => e.id === "athletes")!;
  assert.ok(
    athletes.contextuelles.some(
      (a) => a.genre === "lien" && a.href === "/api/v1/print/fiche",
    ),
  );
  assert.ok(
    athletes.contextuelles.some(
      (a) => a.genre === "lien" && a.href === "/api/v1/print/fiche?blank=10",
    ),
  );
  assert.match(athletes.details[0], /3 fiches · 3 inscriptions confirmées/);
});

test("brouillons d'inscription : l'étape athlètes reste en cours et compte les brouillons", () => {
  const s = avecCinqJuges(
    evenementRenseigne(avecAthletes(evenementVide(), 2, 1)),
  );
  const liste = etapes(s, CHEF);
  assert.equal(etapeEnCours(liste)?.id, "athletes");
  assert.match(
    liste.find((e) => e.id === "athletes")!.details[0],
    /1 brouillon à confirmer/,
  );
});

test("dossards attribués sans jury : le jury est l'étape en cours, les manches restent bloquées", () => {
  const s = avecCinqJuges(evenementRenseigne(avecAthletes(evenementVide(), 3)));
  s.bibs_distributed = true;
  const liste = etapes(s, CHEF);
  assert.equal(etats(s).categories, "fait");
  assert.equal(etats(s).dossards, "fait");
  assert.equal(etapeEnCours(liste)?.id, "jury");
  assert.equal(raison(s, "manches"), "jury de 5, 7, 9 ou 11 juges requis");
  assert.equal(raison(s, "demarrer"), "manches non générées");
});

test("jury de 5 : les manches deviennent possibles, le démarrage attend les manches", () => {
  const s = avecJury(evenementRenseigne(avecAthletes(evenementVide(), 3)));
  s.bibs_distributed = true;
  const liste = etapes(s, CHEF);
  assert.equal(etats(s).jury, "fait");
  assert.equal(etapeEnCours(liste)?.id, "manches");
  assert.equal(
    liste.find((e) => e.id === "manches")!.principale?.genre,
    "commande",
  );
  assert.equal(
    (liste.find((e) => e.id === "manches")!.principale as any).type,
    "programme.generate",
  );
  assert.equal(raison(s, "demarrer"), "manches non générées");
  // Quatre juges : refus serveur anticipé.
  s.jury.panel = ["chef", "j1", "j2", "j3"];
  assert.equal(juryValide(s.jury.panel), false);
  assert.equal(raison(s, "manches"), "jury de 5, 7, 9 ou 11 juges requis");
});

test("manches générées : démarrer est en cours, l'ordre de passage est imprimable, la sauvegarde proposée", () => {
  const s = avecJury(evenementRenseigne(avecAthletes(evenementVide(), 3)));
  s.bibs_distributed = true;
  s.rounds = [manche("m1", "pending")];
  const liste = etapes(s, CHEF);
  assert.equal(etapeEnCours(liste)?.id, "demarrer");
  assert.deepEqual(raisonsDemarrage(s, true), []);
  const manches = liste.find((e) => e.id === "manches")!;
  assert.ok(
    manches.contextuelles.some(
      (a) => a.genre === "lien" && a.href === "/api/v1/print/programme",
    ),
  );
  assert.ok(manches.contextuelles.some((a) => a.genre === "sauvegarde"));
  // Liste de contrôle incomplète : le démarrage est bloqué même avec les manches.
  s.settings.backup_checked = false;
  assert.equal(etats(s).demarrer, "bloque");
  assert.equal(
    raison(s, "demarrer"),
    "1 case de contrôle non cochée (rubrique Événement)",
  );
});

test("compétition démarrée avec une manche ouverte : bulletins comptés, dossier et fiches de notation", () => {
  const s = avecJury(evenementRenseigne(avecAthletes(evenementVide(), 3)));
  s.bibs_distributed = true;
  s.status = "running";
  s.rounds = [
    manche("m1", "open", { ballots: { chef: {}, j1: {} }, absent_ids: ["e2"] }),
  ];
  s.active_round_id = "m1";
  const liste = etapes(s, CHEF);
  for (const id of [
    "comptes",
    "evenement",
    "athletes",
    "categories",
    "dossards",
    "jury",
    "manches",
    "demarrer",
  ])
    assert.equal(etats(s)[id], "fait", id);
  const enCours = etapeEnCours(liste)!;
  assert.equal(enCours.id, "manche");
  assert.match(enCours.details[0], /Bodybuilding -70 · Finale · Ouvert/);
  assert.match(enCours.details[1], /officiels reçus : 2\/5/);
  assert.match(enCours.details[1], /1 absent déclaré/);
  assert.equal(enCours.principale?.genre, "commande");
  assert.equal((enCours.principale as any).type, "round.next");
  assert.match((enCours.principale as any).raison, /encore attendus \(2\/5\)/);
  assert.ok(
    enCours.contextuelles.some(
      (a) => a.genre === "lien" && a.href === "#competition",
    ),
  );
  assert.ok(
    enCours.contextuelles.some(
      (a) => a.genre === "lien" && a.href === "/api/v1/print/blank?round_id=m1",
    ),
  );
  const demarrer = liste.find((e) => e.id === "demarrer")!;
  assert.ok(demarrer.contextuelles.some((a) => a.genre === "sauvegarde"));
  assert.equal(etats(s).discipline, "bloque");
  assert.equal(
    raison(s, "discipline"),
    "1 finale de bodybuilding reste à valider",
  );
  assert.equal(etats(s).cloture, "bloque");
  assert.equal(
    raison(s, "cloture"),
    "1 discipline reste à terminer : bodybuilding",
  );
});

test("manche en attente de validation : le bouton principal est la validation du chef", () => {
  const s = avecJury(evenementRenseigne(avecAthletes(evenementVide(), 3)));
  s.status = "running";
  s.bibs_distributed = true;
  s.rounds = [
    manche("m1", "awaiting_validation", {
      ballots: { chef: {}, j1: {}, j2: {}, j3: {}, j4: {} },
    }),
  ];
  const enCours = etapeEnCours(etapes(s, CHEF))!;
  assert.equal(enCours.id, "manche");
  assert.deepEqual(enCours.principale, {
    genre: "commande",
    type: "round.validate",
    payload: { round_id: "m1" },
    libelle: "Valider les résultats sportifs",
  });
});

test("finales validées : cycle de fin de discipline, sous-étapes dans l'ordre du serveur", () => {
  const s = avecJury(evenementRenseigne(avecAthletes(evenementVide(), 3)));
  s.status = "running";
  s.bibs_distributed = true;
  s.rounds = [manche("m1", "validated")];
  let liste = etapes(s, CHEF);
  assert.equal(etats(s).manche, "fait");
  const discipline = etapeEnCours(liste)!;
  assert.equal(discipline.id, "discipline");
  assert.deepEqual(
    discipline.sousEtapes!.map((x) => [x.libelle, x.fait, x.raison ?? null]),
    [
      ["Confirmer les remises des catégories", false, null],
      [
        "Toutes catégories Amateur (créé automatiquement après les finales)",
        false,
        null,
      ],
      [
        "Confirmer les remises toutes catégories",
        false,
        "toutes catégories à créer : Amateur",
      ],
      [
        "Terminer cette discipline",
        false,
        "les deux confirmations de remises sont requises",
      ],
    ],
  );
  assert.deepEqual((discipline.principale as any).payload, {
    discipline: "bodybuilding",
    kind: "category",
  });
  // Remises des catégories confirmées : création du toutes catégories par section.
  s.discipline_progress = { bodybuilding: { category_rewards_done: true } };
  liste = etapes(s, CHEF);
  assert.deepEqual((etapeEnCours(liste)!.principale as any).payload, {
    discipline: "bodybuilding",
    section: "amateur",
    exam_user_ids: [],
  });
  // Overall d'un seul champion en attente : la confirmation du chef est proposée dans la manche en cours.
  s.discipline_progress.bodybuilding.overall_sections = ["amateur"];
  s.rounds.push(
    manche("o1", "pending", {
      phase: "overall",
      category_id: "overall-bodybuilding-amateur",
      participant_ids: ["e0"],
    }),
  );
  liste = etapes(s, CHEF);
  assert.equal(etapeEnCours(liste)!.id, "manche");
  assert.equal(
    (etapeEnCours(liste)!.principale as any).type,
    "overall.confirm",
  );
  assert.equal(etats(s).discipline, "bloque");
  // Overall validé : remises toutes catégories, puis fin de discipline.
  s.rounds[1].status = "validated";
  liste = etapes(s, CHEF);
  assert.deepEqual((etapeEnCours(liste)!.principale as any).payload, {
    discipline: "bodybuilding",
    kind: "overall",
  });
  s.discipline_progress.bodybuilding.overall_rewards_done = true;
  liste = etapes(s, CHEF);
  assert.equal(
    (etapeEnCours(liste)!.principale as any).type,
    "discipline.advance",
  );
});

test("toutes disciplines terminées : la clôture est en cours avec sauvegarde et documents", () => {
  const s = avecJury(evenementRenseigne(avecAthletes(evenementVide(), 3)));
  s.status = "running";
  s.bibs_distributed = true;
  s.rounds = [manche("m1", "validated")];
  s.discipline_progress = {
    bodybuilding: {
      category_rewards_done: true,
      overall_sections: ["amateur"],
      overall_rewards_done: true,
      completed: true,
    },
  };
  const liste = etapes(s, CHEF);
  assert.equal(etats(s).manche, "fait");
  assert.equal(etats(s).discipline, "fait");
  const cloture = etapeEnCours(liste)!;
  assert.equal(cloture.id, "cloture");
  assert.equal((cloture.principale as any).type, "event.finish");
  assert.ok(cloture.contextuelles.some((a) => a.genre === "sauvegarde"));
  assert.ok(
    cloture.contextuelles.some(
      (a) => a.genre === "lien" && a.href === "/api/v1/print/results",
    ),
  );
  assert.ok(
    cloture.contextuelles.some(
      (a) =>
        a.genre === "lien" && a.href === "/api/v1/export/results?format=xlsx",
    ),
  );
  // Overall final constitué mais non jugé : la clôture attend.
  s.rounds.push(
    manche("gf", "pending", {
      phase: "overall",
      grand_final: true,
      category_id: "overall-final-amateur",
      participant_ids: ["e0", "e1"],
    }),
  );
  assert.equal(etats(s).cloture, "bloque");
  assert.equal(
    raison(s, "cloture"),
    "l’overall final doit être validé avant la clôture",
  );
  assert.equal(etapeEnCours(etapes(s, CHEF))!.id, "manche");
  // Compétition terminée : tout est fait, aucune étape en cours.
  s.rounds[1].status = "validated";
  s.status = "finished";
  assert.equal(etapeEnCours(etapes(s, CHEF)), undefined);
  assert.ok(etapes(s, CHEF).every((e) => e.etat === "fait"));
});

test("secrétariat : les comptes et le critère collectif (non projetés) ne bloquent rien", () => {
  const s = evenementVide();
  s.me = { id: "sec", roles: ["secretariat"] };
  s.users = [juge("sec", ["secretariat"])];
  delete s.settings.collective_tiebreak;
  const liste = etapes(s, ["secretariat"]);
  assert.equal(etats(s, ["secretariat"]).comptes, "fait");
  assert.equal(etapeEnCours(liste)?.id, "evenement");
  assert.equal(etats(s, ["secretariat"]).jury, "a_venir");
  assert.equal(
    liste.find((e) => e.id === "evenement")!.details[0],
    "3 cases de contrôle non cochées (rubrique Événement)",
  );
});
