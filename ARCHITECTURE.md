# Architecture — FIBDA Bodybuilding

Statut : reconstruite à partir du dossier PO. Les zones marquées **[À CONFIRMER]** ne sont pas
vérifiées sur du vrai code.

## 1. Vue d'ensemble

```
Ordinateur organisateur (serveur + base + photos, jamais dans le repo)
   │  HTTPS (édition 2026 : VM Internet, cf. ADR 0001 ; sinon Wi-Fi local)
   ├── Téléphones des juges (navigateur, PWA-like, pas d'app native)
   ├── Postes table / chef / secrétariat / commission
   ├── Régie (pilotage des écrans)
   └── Écrans publics (main / secondary / backstage / speaker)
```

Un seul processus serveur = une seule autorité sur **un seul événement actif** à la fois.

## 2. Backend

- Langage : Python 3.12+
- Stockage : SQLite local (WAL, `synchronous=FULL`), verrou applicatif + `BEGIN IMMEDIATE`
  pour sérialiser les écritures
- Migrations : Alembic (`0001_initial` comme socle)
- État métier : **un agrégat JSON versionné par événement** (`events.data`), pas une table SQL
  par entité — chaque commande relit l'état, vérifie la version, produit un nouvel état
- Auth : cookie HttpOnly, session 16h, codes personnels hachés (PBKDF2-SHA256 + sel)
- Temps réel : WebSocket pour signaler un changement de version (jamais de données privées
  dedans) + repli par interrogation toutes les 10s
- Découpage interne du backend (`backend/fibda/`) :
  - `domain.py` + `catalogue.py` — moteur pur (jury, classement, examens, référentiel). **Aucun
    accès SQL, aucun effet de bord.**
  - `preparation.py` — commandes de préparation (inscriptions, mesures, catégories, fusions)
  - `workflow.py` — cycle de vie des manches (ouverture, transitions, validation, overall)
  - `printing.py`, `transfers.py`, `backup.py` — fonctions pures d'exploitation (impressions,
    import/export, sauvegarde), appelées par les routes mais **ne décident jamais des droits**
  - `auth.py`, `app.py`, `commands.py`, `projections.py`, `store.py` — colonne vertébrale
    (routes, transactions, filtrage par rôle)

## 3. Frontend — PWA obligatoire

- React + TypeScript + Vite, servi par le backend en prod (même origine, pas de CORS)
- **PWA au minimum** (exigence explicite du PO) :
  - `manifest.json` (nom, icônes, `display: standalone`, couleur de thème) pour être
    installable sur l'écran d'accueil des téléphones des juges
  - Service worker : cache de l'app shell (JS/CSS/police/logo) pour un chargement rapide sur
    Wi-Fi de salle, **jamais** de cache des réponses d'API privées (bulletins, données
    personnelles) — uniquement les statiques
  - Fonctionne sur réseau local sans Internet (déjà une contrainte de l'app elle-même) ;
    le service worker ne doit jamais tenter de contacter un CDN externe
  - Pas d'obligation d'app 100% offline pour cette première version — la PWA sert avant tout à
    l'installation/écran d'accueil et à un chargement fiable, le fonctionnement réel dépend du
    serveur local comme le reste de l'app
- Vues principales : Préparation, Compétition (chef), Mon jugement (juge/stagiaire), Régie &
  écrans (simplifiée pour la V1, cf. `MVP-SCOPE.md`), Documents, Récompenses
- Brouillons de bulletins en IndexedDB, scoping strict `événement/restauration/juge/tour/version`
- Aucune dépendance CDN au runtime — polices et logos embarqués

## 4. Réseau et déploiement le jour J

**Décision du 23/09/2026 (ADR 0001)** : pour l'édition du 26/09, le serveur est hébergé sur
une VM Internet avec certificat Let's Encrypt, pas sur une machine dans la salle. Les juges
se connectent en HTTPS via le Wi-Fi de la salle ou leur réseau mobile. Le mode « serveur dans
la salle » décrit ci-dessous reste supporté par le code mais n'est pas testé pour cette
édition. Voir `docs/decisions/0001-serveur-heberge-sur-internet-vm-gratuite.md` et
`docs/DEPLOIEMENT-INTERNET.md`.

- Par défaut le serveur écoute en boucle locale (127.0.0.1) — inutilisable pour les téléphones
- Mode réseau : `--host 0.0.0.0 --public-url https://DOMAINE --cert ... --key ...`
- **[À CONFIRMER]** qui prépare : nom de domaine, DNS du routeur de salle, certificat HTTPS
  reconnu par les appareils — ce n'est **pas** livré par l'application elle-même
- Paquet natif : PyInstaller (macOS arm64 construit et testé localement ; **Windows non
  construit, non testé**)

## 5. Sécurité / confidentialité intégrées à l'architecture

- Écrans publics = projection filtrée uniquement (jamais l'agrégat privé)
- Photos : diffusion conditionnée à `approved + consent`, révocable
- Sauvegarde = archive ZIP (base + photos + empreintes SHA-256), restauration = nouveau dossier,
  jamais d'écrasement, invalidation systématique des sessions

## 6. Ce que l'architecture ne couvre PAS (limites assumées dans le dossier)

- Pas de registre fédéral multi-compétitions (une personne = une fiche par événement)
- Pas d'app mobile native (uniquement navigateur)
- Pas de connexion automatique par QR personnel ni par SMS
- Pas de synchronisation multi-serveurs / cloud

## 6bis. Origine réelle de ce plan technique

Ce plan technique s'inspire d'une app déjà construite pour le **StrongMan**, pas pour le
bodybuilding (confusion initiale du PO). **Le PO veut un nouveau dépôt, une app distincte** —
le StrongMan sert de référence de patterns (auth, réseau, jugement, sauvegarde), jamais de
code copié. Voir `PLAN-J3.md` §Décision stratégique n°1.

**`domain.py`, `catalogue.json` et tout `REFERENTIEL.md` du dossier initial FIBDA doivent être
considérés comme obsolètes/non fiables pour le bodybuilding** et refaits avec de vraies règles
validées par la fédération. Ne pas réutiliser un seul chiffre du référentiel actuel (106
règles, barèmes, quotas) sans revérification complète.

## 7. Zones à clarifier avant de coder (voir `OPEN-QUESTIONS.md`)

- Structure exacte du repo (le dossier référence un dossier `cadrage/` externe non fourni)
- Environnement de build Windows (qui, où, avec quelle machine)
- Stratégie de test terrain réelle (téléphones, imprimante, réseau de salle)
