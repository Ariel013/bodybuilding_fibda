import { test } from "node:test";
import assert from "node:assert/strict";
import {
  place,
  complete,
  selectionValid,
  draftKey,
  secondsRemaining,
} from "./ranking";
test("remplacement sans décalage, libère ancien occupant", () =>
  assert.deepEqual(place(["a", "b", "c"], "a", 1), [null, "a", "c"]));
test("nouveau dossard remplace rang sans déplacement", () =>
  assert.deepEqual(place(["a", null, "b"], "c", 0), ["c", null, "b"]));
test("classement incomplet ou doublon refusé", () => {
  assert.equal(complete(["a", null], ["a", "b"]), false);
  assert.equal(complete(["a", "a"], ["a", "b"]), false);
  assert.equal(complete(["b", "a"], ["a", "b"]), true);
});
test("quota et participants exacts éliminatoires", () => {
  assert.equal(selectionValid(["a"], ["a", "b"], 1), true);
  assert.equal(selectionValid(["a", "a"], ["a", "b"], 2), false);
  assert.equal(selectionValid(["x"], ["a", "b"], 1), false);
});
test("brouillons isolés après restauration et par juge", () => {
  assert.notEqual(
    draftKey("e", "restore1", "j", "r", 1),
    draftKey("e", "restore2", "j", "r", 1),
  );
  assert.notEqual(
    draftKey("e", "r", "j1", "r", 1),
    draftKey("e", "r", "j2", "r", 1),
  );
});
test("horloge serveur borne expiration à zéro", () => {
  assert.equal(secondsRemaining(120, 61), 59);
  assert.equal(secondsRemaining(120, 122), 0);
  assert.equal(secondsRemaining(null, 122), null);
});

import {
  projectionGroup,
  photoMode,
  photoFor,
  shouldAnimateScene,
} from "./projection";
import { canCommand } from "./permissions";
test("projection restreinte au tour, y compris un tour sans participants", () => {
  const entries = [
    { id: "a", category_id: "c" },
    { id: "b", category_id: "c" },
  ];
  assert.deepEqual(
    projectionGroup(entries, { category_id: "c" }, { participant_ids: ["b"] }),
    ["b"],
  );
  assert.deepEqual(
    projectionGroup(entries, { category_id: "c" }, { participant_ids: [] }),
    [],
  );
  assert.deepEqual(projectionGroup(entries, { category_id: "c" }), ["a", "b"]);
});
test("photo choisie pour le groupe original et consentement obligatoire", () => {
  assert.equal(photoMode(15), "full");
  assert.equal(photoMode(16), "portrait");
  assert.equal(photoMode(100), "portrait");
  const p = {
    photo_portrait: "p",
    photo_full: "f",
    photo_approved: true,
    photo_consent: true,
  };
  assert.equal(photoFor(p, photoMode(20)), "p");
  assert.equal(photoFor({ ...p, photo_consent: false }, "portrait"), undefined);
});
test("annonce seulement lors nouvelle scène publique, sans rejeu connexion", () => {
  assert.equal(shouldAnimateScene(undefined, "12", "qualifiers"), false);
  assert.equal(shouldAnimateScene("12", "12", "qualifiers"), false);
  assert.equal(shouldAnimateScene("12", "13", "category"), false);
  assert.equal(shouldAnimateScene("12", "13", "qualifiers"), true);
});
test("actions administratives masquées selon le rôle et exceptions chef", () => {
  assert.equal(canCommand(["director"], "round.open"), false);
  assert.equal(canCommand(["responsable"], "round.validate"), false);
  assert.equal(canCommand(["chief"], "round.validate"), true);
  assert.equal(canCommand(["regie"], "reward.update"), false);
  assert.equal(canCommand(["secretariat"], "reward.update"), true);
  assert.equal(canCommand(["director", "chief"], "paper.submit"), false);
  assert.equal(canCommand(["commission"], "exam.decide"), true);
  assert.equal(canCommand(["chief"], "exam.decide"), false);
});

test("aperçu privé ne diffuse que les photos individuellement approuvées", () => {
  const p = {
    photo_portrait: "portrait-ok",
    photo_full: "full-new",
    photo_approved: true,
    photo_consent: true,
    approved_photo_ids: ["portrait-ok"],
  };
  assert.equal(photoFor(p, "full", true), "portrait-ok");
  assert.equal(
    photoFor({ ...p, approved_photo_ids: [] }, "full", true),
    undefined,
  );
  assert.equal(
    photoFor({ ...p, approved_photo_ids: undefined }, "full", true),
    undefined,
  );
  assert.equal(
    photoFor(
      { ...p, photo_full: undefined, approved_photo_ids: undefined },
      "full",
    ),
    "portrait-ok",
  );
});

import { overallExamCandidates, selectedOverallExams } from "./exam";
test("examen overall limité aux stagiaires approuvés attendus sans doublon", () => {
  const users = [
    { id: "yes", approved: true, roles: ["trainee"] },
    { id: "absent", approved: true, roles: ["trainee"] },
    { id: "pending", approved: false, roles: ["trainee"] },
    { id: "judge", approved: true, roles: ["judge"] },
    { id: "director", approved: true, roles: ["trainee", "director"] },
  ];
  const candidates = overallExamCandidates(users, [
    "yes",
    "pending",
    "judge",
    "director",
  ]);
  assert.deepEqual(
    candidates.map((u) => u.id),
    ["yes"],
  );
  assert.deepEqual(
    selectedOverallExams(["yes", "yes", "absent", "pending"], candidates),
    ["yes"],
  );
  assert.deepEqual(selectedOverallExams(["yes"], []), []);
});

import { chosenRoundId } from "./judgeSelection";
test("le choix manuel reste stable puis cède au nouveau tour actif", () => {
  const choice = { id: "ancien", active: "courant" };
  assert.equal(chosenRoundId(choice, "courant"), "ancien");
  assert.equal(chosenRoundId(choice, "suivant"), undefined);
  assert.equal(chosenRoundId(choice, null), undefined);
  assert.equal(chosenRoundId(undefined, "courant"), undefined);
});

import { landingTab } from "./judgeSelection";
test("connexion juge ou stagiaire ouvre directement son bulletin, administration conserve accueil", () => {
  for (const roles of [["judge"], ["trainee"], ["judge", "trainee"]])
    assert.equal(landingTab(roles), "judge");
  for (const roles of [
    ["chief"],
    ["chief", "judge"],
    ["director", "judge"],
    [],
  ])
    assert.equal(landingTab(roles), "home");
});

import {
  toggleSelection,
  addSelection,
  isDragMove,
  dropTarget,
  autoScrollStep,
} from "./ranking";
test("sélection éliminatoire : bascule et ajout bornés par le quota", () => {
  assert.deepEqual(toggleSelection([], "a", 2), ["a"]);
  assert.deepEqual(toggleSelection(["a"], "a", 2), []);
  assert.deepEqual(toggleSelection(["a", "b"], "c", 2), ["a", "b"]);
  assert.deepEqual(addSelection(["a"], "b", 2), ["a", "b"]);
  assert.deepEqual(addSelection(["a"], "a", 2), ["a"]);
  assert.deepEqual(addSelection(["a", "b"], "c", 2), ["a", "b"]);
});
test("un glissement n'est reconnu qu'au-delà de 6 px", () => {
  assert.equal(isDragMove(3, 4), false);
  assert.equal(isDragMove(0, 7), true);
  assert.equal(isDragMove(-5, -5), true);
});
test("cible de dépôt : rang valide, zone sélectionnés, sinon rien", () => {
  assert.deepEqual(dropTarget({ rank: "2" }, 5), { kind: "rank", rank: 2 });
  assert.deepEqual(dropTarget({ drop: "selected" }, 5), { kind: "selected" });
  assert.equal(dropTarget({ rank: "5" }, 5), null);
  assert.equal(dropTarget({ rank: "x" }, 5), null);
  assert.equal(dropTarget({}, 5), null);
  assert.equal(dropTarget(undefined, 5), null);
});
test("défilement automatique seulement près des bords, nul au centre", () => {
  assert.equal(autoScrollStep(300, 0, 600), 0);
  assert.ok(autoScrollStep(10, 0, 600) < 0);
  assert.ok(autoScrollStep(590, 0, 600) > 0);
  assert.equal(autoScrollStep(0, 0, 600), -14);
  assert.equal(autoScrollStep(50, 0, 80), 0);
});
