# 0002 — Le backend est réécrit en TypeScript serverless (Vercel + Turso), le frontend et le contrat d'API sont conservés

**Statut** : adopté (PO, 23/09/2026). Remplace partiellement 0001 : l'hébergement
VM Python devient le plan B, pas la cible.

## Contexte

Le PO veut une application JavaScript, hébergée sur un service gratuit sans carte
bancaire, sans personne de technique dans la salle samedi 26/09/2026. Oracle
Cloud a exigé un paiement, Render gratuit perd son disque, aucune VM gratuite
fiable n'existe. Le code actuel est un backend Python (2 215 lignes, 79 tests)
et un frontend React/TypeScript (5 094 lignes, 14 tests), avec un contrat d'API
documenté (`docs/CONTRACT.md`, `docs/openapi.json`) et un modèle d'état JSON
versionné par événement.

Le développeur a signalé le risque : réécrire le moteur de classement à J-3 est
le scénario le plus risqué du projet. Le PO maintient la décision.

## Décision

- Le frontend Vite/React actuel est conservé **sans modification fonctionnelle**.
- Le backend est réécrit en TypeScript sous forme de fonctions Vercel, en
  respectant **le même contrat d'API et le même modèle d'état** que le backend
  Python, pour que le frontend se branche sans renégociation.
- La base est Turso (libSQL, SQLite hébergé, offre gratuite sans carte) : mêmes
  tables (`events`, `users`, `sessions`, `commands`, `audit`), même agrégat JSON
  versionné, idempotence et version optimiste garanties par transaction et
  condition `WHERE version = ?`.
- Le WebSocket est remplacé par l'interrogation périodique déjà présente dans le
  frontend (repli toutes les 10 s, ramené à 5 s).
- Le moteur sportif (`domain.py`) est porté fonction par fonction ; les tests
  Python correspondants sont portés en premier et servent d'oracle.
- Ordre de construction : chemin critique de samedi (`MVP-SCOPE.md`) d'abord,
  puis extension vers la parité complète.
- **Plan B** : la version Python actuelle est déployée sur Railway (essai gratuit,
  volume persistant, `railway ssh`) avant la réécriture, pour que samedi tourne
  quoi qu'il arrive.

## Pourquoi

- Le contrat d'API et l'état sont déjà spécifiés et testés : réécrire
  l'implémentation en gardant l'interface est le seul chemin où le frontend et
  les tests existants réduisent le risque au lieu de l'augmenter.
- Vercel et Turso sont gratuits sans carte, sans machine à tenir dans la salle.
- Ce que ça coûte : perte du WebSocket, du verrou de processus (remplacé par des
  transactions), des photos sur disque (à reporter vers un stockage externe),
  de la sauvegarde ZIP locale (remplacée par un export JSON signé), et du temps
  de test terrain.

## Conséquences

- Nouveau dossier `frontend/api/` (fonctions Vercel) et `frontend/domain/`
  (moteur pur, testé avec `node --test`, comme `ranking.test.ts`).
- Secrets Turso et Vercel uniquement en variables d'environnement, jamais dans
  le dépôt.
- `RULES.md` reste la référence ; toute règle non portée est listée dans
  `OPEN-QUESTIONS.md` avant samedi.
- `backend/` Python reste dans le dépôt tant que le plan B est nécessaire.
- Le mode serverless retire la garantie « un seul processus » : chaque fonction
  doit relire l'état et vérifier la version, sans état en mémoire.
