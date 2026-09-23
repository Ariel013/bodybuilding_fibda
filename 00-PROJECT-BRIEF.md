# FIBDA Bodybuilding — Brief de projet

> Document de synthèse. Sert de point d'entrée pour tout humain ou LLM qui reprend ce projet.
> Statut : BROUILLON — à valider avec le PO avant de coder quoi que ce soit.

## 1. Ce que c'est

Application **locale, sans dépendance Internet pendant l'événement**, pour organiser une
compétition de bodybuilding fédérale (FIBDA) : préparation des inscriptions, jugement sur
téléphone par les juges, calcul des classements, régie/écrans publics, récompenses,
sauvegarde/restauration.

Architecture cible telle que décrite dans le dossier reçu du PO :
- **Backend** Python (API `/api/v1`, SQLite, migrations Alembic)
- **Frontend** React + TypeScript (Vite), servi par le backend en production
- **Réseau** : un ordinateur central héberge le serveur, les téléphones des juges et les écrans
  se connectent en Wi-Fi local, HTTPS obligatoire (certificat + DNS local)
- **Packaging** : exécutable natif via PyInstaller (macOS validé, Windows non fait)

## 1bis. ~~Révélation critique — StrongMan vs Bodybuilding~~ [CADUC le 23/09/2026]

> Section conservée pour l'historique. Après inspection réelle du code, la base de ce dépôt est
> une application bodybuilding sans lien avec le StrongMan ; le PO a confirmé qu'il ne faut ni
> cloner ni auditer ce repo. Statut réel du code : `JOURNAL.md`. Décisions : `docs/decisions/`.

L'application déjà codée et testée décrite dans le dossier reçu (v0.1.0, 77 tests, packaging
macOS) **a en réalité été construite pour le StrongMan**, un sport différent — pas pour le
bodybuilding. Confusion du PO en envoyant le dossier. C'est l'utilisateur lui-même qui a
travaillé sur cette app StrongMan.

Repo StrongMan : `https://github.com/Ariel013/strongmanrepo.git` (privé ou non indexé — non
accessible depuis les outils web de ce chat ; **Claude Code doit le cloner et l'auditer
directement**, voir `CLAUDE.md` §0).

**FIBDA Bodybuilding est donc un projet neuf, à concevoir depuis zéro.** Le dossier reçu ne
doit plus être traité comme une spec fiable pour le référentiel sportif bodybuilding (jury,
disciplines, barèmes) — il documente potentiellement un remaniement de vocabulaire sur une app
StrongMan, pas un vrai travail de cadrage bodybuilding. Voir `OPEN-QUESTIONS.md` Q1/1bis/1ter.

Ce qui reste probablement récupérable malgré tout : l'**architecture technique** (backend
Python/SQLite, frontend React, réseau local HTTPS, jury numérique sur téléphone, sauvegarde,
régie/écrans) — ce socle est générique à toute compétition à jury humain, indépendamment du
sport. C'est ce que `ARCHITECTURE.md` capture. Le **référentiel sportif** (`domain.py`,
`catalogue.json`, règles de calcul) doit en revanche être considéré comme à refaire
intégralement avec de vraies règles FIBDA Bodybuilding validées par la fédération.

## 1ter. Contexte de mise en œuvre

- Fédération basée en **Côte d'Ivoire**.
- Développeur **seul, avec Claude Code** comme agent codeur — pas d'équipe.
- Délai serré, explicitement posé comme contrainte : **chaque itération doit être précise,
  fonctionnelle et ne rien casser ; chaque tâche doit être menée à son terme** (pas de travail
  partiel laissé en suspens). Ce point est repris comme règle dure dans `CLAUDE.md` §2.

## 2. Statut réel (à ne jamais perdre de vue)

Le dossier reçu **prétend** qu'une version 0.1.0 existe avec tests unitaires/ASGI qui passent.
**Aucun code n'a été transmis avec ce dossier** — seulement de la documentation. Tant que le
repo réel n'a pas été vu, considérer ce statut comme **non vérifié**.

Ce qui est explicitement listé comme NON FAIT par le dossier lui-même (voir `docs/RECETTE.md`
et `PV-RECETTE.md` vierge) :
- Aucun test sur téléphone réel (iPhone/iPad/Android), aucun test Windows natif
- Aucun test sur 40 appareils Wi-Fi simultanés en conditions réelles
- Aucun certificat HTTPS / DNS local réellement déployé
- Aucun test imprimante, écran LED/vidéoprojecteur réels
- Aucune validation du référentiel sportif par la fédération elle-même
- Aucune certification d'accessibilité

**=> Le dossier documente un travail de développement (probablement assisté par IA), pas une
réception opérationnelle.** Traiter les "tests OK" comme des garanties de non-régression
logicielle, pas comme une preuve de fiabilité terrain.

## 3. Risque majeur à traiter en premier

Le moteur de calcul sportif (jury 5/7/9/11, retrait extrêmes, égalités par majorité/cycles,
filtre national, élimination à quota, overall, examens de stagiaires) encode des règles
fédérales complexes. **Ce référentiel n'a pas de validation humaine côté fédération confirmée
dans le dossier.** Une erreur ici = des classements de compétition faux, publiés en direct.
=> Ne pas avancer sur l'UI/l'infra tant que ce point n'est pas traité avec le PO (cf.
`OPEN-QUESTIONS.md`).

## 4. Ce qui est déjà bien cadré (réutilisable tel quel)

- Contrat d'API et enveloppe de commande (`CONTRACT.md` — voir extraits dans le dossier PDF)
- Modèle d'état JSON de l'événement (people/entries/categories/rounds/rewards/etc.)
- Matrice des droits par rôle (chef/responsable/directeur/juge/stagiaire/commission/régie)
- Règles de sécurité (BEGIN IMMEDIATE, idempotence par commande, version optimiste, 409)
- Parcours juge sur téléphone (déjà maquetté et détaillé pas à pas)
- Checklist de recette terrain (à transformer en plan de test, cf. `RULES.md`)

## 5. Ce qui manque pour concevoir sereinement

Voir `OPEN-QUESTIONS.md` — liste des questions bloquantes envoyées au PO.

## 6. Comment ce dossier de conception est organisé

| Fichier | Rôle |
|---|---|
| `00-PROJECT-BRIEF.md` | ce fichier — contexte et état des lieux |
| `ARCHITECTURE.md` | architecture cible, structure de dépôt, flux de données |
| `AGENTS.md` | découpage des responsabilités si un LLM codeur (ex. Claude Code) travaille dessus |
| `RULES.md` | invariants métier et techniques à ne jamais violer |
| `CLAUDE.md` | règles opératoires pour tout LLM codeur qui reprend ce projet |
| `OPEN-QUESTIONS.md` | questions bloquantes au PO, à tenir à jour |
