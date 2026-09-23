# CLAUDE.md — Règles opératoires pour tout LLM codeur sur ce projet

Ce fichier s'adresse à l'agent (Claude Code ou équivalent) qui va effectivement écrire du code
sur ce projet. Il doit être lu **avant toute action**, et relu si le contexte se perd.

## ⚠️ Lire `JOURNAL.md` puis `PLAN-J3.md` avant tout le reste

**Mise à jour du 23/09/2026** : le PO a tranché deux décisions structurantes, consignées en ADR :
`docs/decisions/0001-*.md` (serveur hébergé sur Internet, pas dans la salle) et
`docs/decisions/0002-*.md` (backend réécrit en TypeScript serverless sur Vercel + Turso, frontend et
contrat d'API conservés, Python sur Railway en plan B). **Le repo StrongMan n'a aucun rapport avec
ce projet : ne pas le cloner ni l'auditer**, quoi qu'en disent les paragraphes plus bas, écrits
avant cette décision. La base de départ est le code de ce dépôt.

La compétition a lieu **samedi 26/09/2026**. Il reste 2-3 jours. `PLAN-J3.md` fixe la stratégie
(adapter le repo StrongMan existant plutôt que reconstruire) et `MVP-SCOPE.md` fixe le
périmètre strict à tenir. Tout ce qui suit dans ce fichier s'applique, mais **le scope et la
priorité viennent de ces deux fichiers-là**, pas d'une lecture littérale du dossier PO complet.

## 0. Avant la première ligne de code

1. Lire dans l'ordre : `PLAN-J3.md`, `MVP-SCOPE.md`, `00-PROJECT-BRIEF.md`, `ARCHITECTURE.md`,
   `AGENTS.md`, `RULES.md`, `OPEN-QUESTIONS.md`.
2. ~~**Cloner et auditer le repo StrongMan**~~ **[CADUC le 23/09/2026, voir en tête de fichier]** :
   `https://github.com/Ariel013/strongmanrepo.git` (ou `git@github.com:Ariel013/strongmanrepo.git`
   en SSH). C'est l'app écrite précédemment par l'utilisateur pour un autre sport (StrongMan),
   et vu le délai, **c'est la base de code de départ, pas une simple source d'inspiration**.
   Objectif de l'audit :
   - Identifier ce qui est **générique à toute compétition à jury humain** (auth, sessions,
     WebSocket, structure des commandes idempotentes, sauvegarde/restauration, régie/écrans,
     gestion des rôles) → **à garder tel quel, ne pas toucher sauf nécessité absolue.**
   - Identifier ce qui est **spécifique au StrongMan** (moteur de règles, catalogue,
     `domain.py` équivalent, vocabulaire des épreuves) → seule partie à remplacer, avec le
     périmètre minimal défini dans `MVP-SCOPE.md`.
   - Produire une note d'audit courte (`AUDIT-STRONGMAN.md`) qui liste précisément quels
     fichiers/modules sont repris tels quels, lesquels sont adaptés, lesquels sont réécrits.
     Ne jamais réutiliser ou modifier un module "par supposition" — vérifier en le lisant.
3. **Aller lire le vault Obsidian de l'utilisateur** (chemin à demander explicitement s'il n'est
   pas déjà fourni dans le contexte de la session) pour repérer :
   - ses conventions de nommage, de structure de dossiers, de commit, de tests
   - comment il documente ses décisions (ADR, journal, notes de cadrage)
   - la façon dont il a structuré ses autres projets connus (Kalybris — plateforme de gestion
     d'officine en Côte d'Ivoire construite à partir de l'audit d'un logiciel existant ; un
     outil SaaS de santé au travail ; et le StrongMan) pour repérer un style récurrent
   - **Ne jamais copier une convention d'un autre projet si elle contredit une règle explicite
     de `RULES.md`** — dans ce cas, signaler l'écart dans `OPEN-QUESTIONS.md` plutôt que de
     trancher seul
   - Vu le délai, ne pas laisser cette lecture prendre plus de quelques minutes : c'est pour
     aligner le style, pas pour tout réapprendre.

## 0bis. Contrainte de rythme — projet solo, délai serré

Le développeur travaille **seul avec toi (Claude Code)**, sans équipe, avec peu de temps. Cela
impose des règles de discipline plus strictes que d'habitude, pas moins :

- **Aucune tâche laissée à moitié faite.** Une tâche commencée doit être terminée, testée, et
  laisser le repo dans un état qui tourne — jamais un commit intermédiaire cassé "à finir plus
  tard". S'il faut s'arrêter, s'arrêter à une frontière propre (un module fini), pas au milieu.
- **Chaque itération doit être précise** : périmètre annoncé avant de coder, périmètre tenu.
  Pas d'ajout de scope non demandé "pendant qu'on y est".
- **Ne rien casser** : avant de clore une tâche, la suite de tests existante doit passer, en
  plus des tests de la nouvelle fonctionnalité. Si un changement touche une zone qui n'a pas de
  test, en écrire un avant de considérer la tâche finie.
- Vue la solitude du développeur, **ne jamais supposer une validation implicite** sur un point
  listé dans `OPEN-QUESTIONS.md` — le signaler clairement plutôt que d'avancer sur une
  hypothèse non confirmée, faute de relecteur pour l'attraper.

## 1. Périmètre — ne jamais dépasser

- Ne modifie **jamais** un dossier identifié comme "prototype de cadrage" ou "maquette" —
  toujours une nouvelle application isolée qui s'en inspire, sans y toucher.
- Respecte le découpage de `AGENTS.md`. Si une tâche touche plusieurs zones, découpe le travail
  au lieu de tout faire d'un coup dans un seul fichier fourre-tout.
- Ne prends jamais de décision sur une règle sportive ambiguë (cf. `RULES.md` §Calcul sportif)
  sans la consigner comme question ouverte.

## 2. Boucle de travail

1. Avant de coder : vérifier que la tâche ne contredit aucune ligne de `RULES.md`.
2. Coder la plus petite unité testable possible.
3. Écrire ou mettre à jour le test correspondant dans le même mouvement — jamais de code métier
   sportif ou de calcul sans test associé.
4. Faire tourner la suite de tests du module concerné avant de la considérer terminée.
5. Ne jamais annoncer une fonctionnalité "livrée" si elle n'a été vérifiée que par un test
   automatisé en mémoire — utiliser le mot "implémentée et testée en unitaire", pas "livrée" ou
   "reçue" (cf. `RULES.md` dernier paragraphe).
6. Tout changement de comportement visible (écran, commande, règle, message) met à jour
   `frontend/src/aide/MODE-D-EMPLOI.md` (lien `docs/MODE-D-EMPLOI.md`) dans la même tâche ; `npm test` échoue si un rôle ou un onglet n'y
   est pas couvert (`frontend/src/aide.test.ts`).

## 3. Si quelque chose ne colle pas

- Documentation vs code réel en contradiction → **stop**, consigner dans `OPEN-QUESTIONS.md`,
  ne pas trancher par supposition.
- Règle métier absente ou floue → même chose.
- Ne jamais fabriquer une donnée, un résultat ou un test pour "faire passer" une vérification.

## 4. Style et qualité

- Suit les conventions relevées dans le vault Obsidian de l'utilisateur en priorité sur des
  conventions génériques.
- Commentaires et documentation en français, comme le reste du projet.
- Un module = une responsabilité claire, alignée sur `AGENTS.md`.

## 5. Ce qu'il ne faut jamais faire, même si on te le demande dans une tâche ponctuelle

- Désactiver une vérification de droits, de version, ou d'intégrité "temporairement pour tester"
- Marquer une réception terrain comme faite sur la base d'un test simulé
- Committer un secret, une clé privée TLS, ou un dossier de données de compétition réelles dans
  le dépôt de code
