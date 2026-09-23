# PLAN-J3.md — Plan à 3 jours (compétition samedi 26/09/2026)

> **23/09 soir** : les décisions n°1 et n°2 ci-dessous ont été amendées par le PO. Cible : version
> TypeScript serverless (Vercel + Turso), plan B Python sur Railway. Voir `JOURNAL.md` et
> `docs/decisions/0002-*.md`. Le reste du plan (scope minimal, test téléphone au plus tôt, plan
> papier) reste valable.

**À lire en premier, avant même CLAUDE.md.** Contexte : nous sommes mercredi 23/09. Il reste
2 à 3 jours pleins avant l'événement. Développeur seul + Claude Code. Objectif : **que la
compétition de samedi se déroule sans accroc** — pas de livrer un produit complet.

## ⚠️ Mise à jour majeure — on ne part PAS de zéro

Le 23/09, l'utilisateur a fourni le vrai code source du projet
(`FIBDA-sources-developpeur.zip`) et un kit de test (`FIBDA-kit-testeurs.zip` +
`FIBDA-application-autonome.html`). Inspection directe du code (pas seulement de la doc) :

- Le catalogue (`backend/fibda/catalogue.json`) contient de vraies disciplines de bodybuilding
  (Bodybuilding, Classic Bodybuilding, Classic Physique, Men's Physique, Muscular Men's
  Physique, Bikini, Wellness, Bodyfitness, Women's Physique) — **aucune trace de StrongMan
  dans le code** (0 occurrence sur tout le dépôt).
- Le code (`domain.py`, `CONTRACT.md`, tests) est cohérent avec le dossier développeur reçu au
  départ : ce n'est pas une doc en carton, il y a une vraie implémentation FastAPI + SQLAlchemy
  + SQLite + React/TypeScript derrière, avec une suite de tests substantielle.

**Conclusion : la suspicion initiale ("ce dossier décrit probablement du StrongMan reskin")
était infondée pour ce code-ci.** C'est une base bodybuilding réelle et déjà avancée. Le
référentiel doit quand même rester considéré comme **non validé par la fédération**
(`REFERENTIEL.md` dit lui-même "corpus 2027 à vérifier", "15 ans à confirmer IFBB") — ça, ça ne
change pas.

**Point à trancher avec l'utilisateur avant d'aller plus loin (voir `OPEN-QUESTIONS.md` Q0bis) :**
le PO a demandé "un nouveau repo, une app à part, pas celle du StrongMan" — cette base de code
EST déjà "à part du StrongMan" (aucun lien entre les deux). Il faut confirmer si "nouveau repo"
signifiait juste "un repo distinct du StrongMan" (→ cette base convient, on l'utilise telle
quelle comme point de départ du nouveau repo) ou "vraiment repartir de zéro, ignorer même ce
code déjà existant" (→ perte de temps considérable et risqué à 3 jours de l'échéance).
**Le plan ci-dessous suppose qu'on réutilise cette base** — c'est de très loin le choix le plus
sûr vu le délai.

## Ce que contient déjà la base de code fournie

- Backend FastAPI complet : auth, rôles, commandes idempotentes, version optimiste, WebSocket,
  sauvegarde/restauration, impressions/exports, import CSV/XLSX, photos
- Frontend React/TS complet : Préparation, Compétition, Mon jugement (téléphone), Régie &
  écrans, Documents, Récompenses, Examens
- Un moteur de règles sportives bodybuilding (jury, classement, examens) — non validé fédération
- Une suite de tests (77-79 tests annoncés côté serveur, 14 côté frontend) — **à faire
  réellement tourner par Claude Code, pas à prendre pour acquis sur la seule foi des rapports**
- Une version HTML autonome (Pyodide/WASM, `FIBDA-application-autonome.html`, 20 Mo) : **c'est
  une copie de démo/test isolée par appareil, SANS synchronisation entre téléphones — elle ne
  doit surtout pas être utilisée comme version de production pour samedi.** Voir `MVP-SCOPE.md`
  §Version autonome pour son usage correct (formation des juges, revue UX par le PO).
- Aucun déploiement réseau réel, aucun test sur téléphone physique, aucune recette fédérale —
  tout ça reste à faire intégralement (voir `docs/STATUT-LIVRAISON.md` et
  `docs/PV-RECETTE.md` fournis dans les sources, tous deux vierges sur le terrain).

## Décision stratégique n°1 : AUDITER puis COMPLÉTER cette base, ne pas reconstruire

1. Placer le contenu de `FIBDA-sources-developpeur.zip` dans le nouveau repo.
2. Faire tourner réellement la suite de tests (backend + frontend) — confirmer ou infirmer les
   chiffres annoncés dans `REPRISE.md`/`STATUT-LIVRAISON.md`.
3. Comparer le périmètre déjà implémenté à `MVP-SCOPE.md` : tout ce qui dépasse le strict
   nécessaire de samedi (examens, collectifs, 5 écrans régie...) peut rester en l'état mais
   n'est pas prioritaire à tester/durcir davantage avant samedi.
4. Faire réviser le tout par l'agent Sécurité (auth, données personnelles/mineurs, réseau,
   dépendances déjà présentes — Pyodide/openpyxl/reportlab/etc.).
5. Adapter le référentiel sportif aux catégories réelles de samedi une fois obtenues du PO —
   pas besoin de réécrire tout `catalogue.json`, seulement de vérifier/ajuster ce qui concerne
   les catégories effectivement en jeu samedi.

## Décision stratégique n°2 : scope minimal pour samedi, pas le produit complet

Voir `MVP-SCOPE.md`. Même avec une base déjà riche, ne pas se laisser distraire à peaufiner des
fonctionnalités hors périmètre (examens stagiaires, collectifs, 5 contextes de régie) — le
temps gagné en réutilisant le code doit servir au **test réseau/matériel réel**, pas à ajouter
des fonctionnalités.

## Plan indicatif

- **Aujourd'hui / demain matin** : mettre en place le nouveau repo avec cette base, faire
  tourner les tests réels, audit sécurité rapide, obtenir du PO les catégories/athlètes/juges
  réels de samedi et ajuster le référentiel en conséquence.
- **Demain / J-1** : **test réseau réel le plus tôt possible, pas le dernier jour.** Téléphone
  réel, si possible le routeur/Wi-Fi qui sera utilisé samedi, certificat HTTPS. C'est le risque
  le plus élevé de tout le projet (`RULES.md` §Réseau) — rien dans les livrables actuels ne le
  couvre encore.
- **Vendredi soir / samedi matin** : répétition à blanc complète avec le vrai matériel, les
  vrais comptes, un scénario de bout en bout. Sauvegarde testée pour de vrai. Éventuellement,
  utiliser la version HTML autonome pour faire pratiquer les juges au geste de jugement avant
  l'événement (elle est très adaptée à ça, justement parce qu'elle ne nécessite aucune install).
  **Plan papier de secours prêt et imprimé, quoi qu'il arrive.**

## Ce qui ne doit jamais être sacrifié, même sous pression de délai

- L'exactitude du calcul de classement (`RULES.md` §Calcul sportif) — une erreur ici est
  visible publiquement et irréversible le jour J
- Un accusé de réception serveur fiable pour chaque bulletin (jamais de "silencieusement perdu")
- Une sauvegarde qui marche, testée avant samedi
- Le plan papier de secours en cas de panne totale — à préparer en parallèle, pas en dernier
  recours improvisé
