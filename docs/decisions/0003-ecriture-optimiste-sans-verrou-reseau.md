# 0003 — Chaque commande s'écrit en un seul lot atomique, sans verrou tenu à travers le réseau

**Statut** : adopté (PO, 26/09/2026, « commit et déploie » après rapport de l'agent latence).
Complète 0002 : même schéma, mêmes garanties, autre façon de les obtenir.

## Contexte

Le PO constate que « le délai est un peu long lorsque tout le monde valide ses bulletins ».
Recette du 24/09 : ~3,5 s par bulletin, 5 bulletins simultanés reçus en 7,2 s. Mesure locale
(agent latence, `frontend/server/concurrence.test.ts` et script de comptage) : un bulletin
coûtait **12 allers-retours** vers Turso (Irlande), dont une transaction d'écriture tenue
pendant plusieurs allers-retours réseau, ce qui sérialisait les bulletins simultanés.

## Décision

- Lecture : un seul lot (`Store.snapshot`) rend session, état, comptes et commande antérieure.
- Écriture : un seul lot atomique (`Store.commit`) : audit et journal des commandes insérés
  sous condition `WHERE (SELECT version FROM events) = version lue`, puis `UPDATE events …
  WHERE version = version lue`. Si quelqu'un a écrit entre-temps, rien n'est écrit.
- Un bulletin (`ballot.submit`) dont l'écriture tombe sur une version dépassée est **rejoué
  côté serveur** sur l'état relu (6 essais au plus) ; toute autre commande reçoit le 409
  « Les données ont changé » comme avant.
- Les commandes qui écrivent dans d'autres tables (`user.*`, `person.delete`, `event.purge`)
  gardent une transaction explicite ; les autres reçoivent une connexion qui refuse le SQL.
- La transition temporisée (délai des stagiaires) n'est plus écrite par une transaction à part :
  elle rejoint le lot de la commande ou du `GET /state` qui la constate.

Résultat local : 2 allers-retours par bulletin au lieu de 12, 1 par `GET /state` au lieu de 6.
**Le gain en secondes n'est pas mesuré** : à relever en production (premier bulletin après
déploiement).

## Conséquences

- Idempotence, version optimiste, audit et révocation de session inchangés (relecture sécurité
  du 26/09 : rien de suspect ; 131 tests serveur).
- Point ouvert P14 (`OPEN-QUESTIONS.md`) : pistes non faites (état découpé en tables, cadence
  d'interrogation des juges).
