# 🧭 Journal de bord — FIBDA Bodybuilding

> **Nouvelle session : LIS CE FICHIER EN PREMIER**, puis `CLAUDE.md`. Tu sauras
> où on en est, quoi faire ensuite et quoi éviter — sans relire tout le code.
>
> **Discipline** :
> 1. Au **démarrage** : lire les trois sections ci-dessous, puis agir / proposer.
> 2. En **fin de session** : mettre à jour « État & prochaine action », ajouter
>    une entrée au journal des sessions, consigner toute erreur en « Leçons ».
> 3. Convertir les dates relatives en absolues. Rester concis.

Carte des documents :
- `PLAN-J3.md`, `MVP-SCOPE.md` : stratégie et périmètre pour samedi 26/09/2026.
- `docs/decisions/0001-*.md`, `0002-*.md` : hébergement Internet ; réécriture TypeScript serverless.
- `docs/DEPLOIEMENT-VERCEL.md` (cible), `docs/DEPLOIEMENT-RAILWAY.md` (plan B Python).
- `A-FAIRE.md` : actions manuelles du PO. `OPEN-QUESTIONS.md` : questions ouvertes et relevés de portage.
- `RULES.md` : invariants. `docs/CONTRACT.md` : contrat d'API partagé par les deux backends.
- `REPRISE.md`, `docs/STATUT-LIVRAISON.md` : rapports du travail antérieur (Python), vérifiés le 23/09.

---

## 📍 État actuel & prochaine action

*(Mis à jour le 2026-09-26, jour de la compétition.)*

- **26/09 (matin)** : suppression d'athlètes (`person.delete`, direction), retrait d'une inscription
  (`entry.remove`, préparation), vidage de la compétition (`event.purge`, chef, saisie VIDER, comptes
  conservés) ; catégories activables (`category.activate`, inactives sans manche ni dossard, inscriptions
  conservées : tranché par le PO) ; multi-inscription à la création de l'athlète (cases à cocher, un
  `entry.save` par catégorie) ; concordance des juges avec le bulletin du chef (`GET /concordance`,
  chef et responsable, même formule que l'examen des stagiaires, P13) ; barre du bulletin réparée sur
  téléphone (plafond de hauteur CSS, reproduit en headless) ; écriture optimiste en un lot (ADR 0003,
  12 → 2 allers-retours par bulletin, gain en secondes **non mesuré**). Relecture sécurité : aucun
  bloquant, 3 corrections appliquées. Plusieurs juges sur un même ordinateur = navigation privée ou
  profils de navigateur (documenté). Les points 1 à 4 du PO sont traités ; le PO déploie et vide.

- **Version en prod** : https://fibda-bodybuilding.vercel.app (Vercel, base Turso Irlande),
  déployée le 23/09 au soir depuis la CLI, **vérifiée au curl** : santé, jeton de configuration
  exigé, chef créé, connexion, état, écran public, en-têtes de sécurité, contrôle d'origine.
  Démonstration séparée : https://fibda-bodybuilding-demo.vercel.app (base `fibda-demo`,
  24 athlètes fictifs, 9 comptes). **Aucun test sur téléphone réel encore.** Secrets hors dépôt : `~/fibda-secrets-2026-09-23.txt`.
- **Code** : `main` poussé sur `origin` (voir `git log`). `npm run check` = 173 tests verts
  (44 interface, 17 moteur, 112 serveur). Déploiement : toujours
  `vercel build` puis `vercel deploy --prebuilt` (`docs/DEPLOIEMENT-VERCEL.md` §2).
- **Livré le 23/09 au soir** : impressions HTML (bulletin vierge = plan papier), export CSV,
  import CSV, mode d'emploi par profil dans l'onglet « Aide » (source
  `frontend/src/aide/MODE-D-EMPLOI.md`, règle de mise à jour dans `CLAUDE.md`), restauration
  depuis l'écran réparée, aide de connexion réécrite pour la version en ligne.
- **Décisions du PO** : overall **par discipline et par sexe** (24/09, définitif : 3 dames,
  4 hommes ; la finale toutes disciplines du 23/09 est retirée de l'interface), codes admin
  8 caractères, 4G prévu, Railway en suspens.
- **Soir 24/09** : « Revenir en préparation » (event.reset), audit indépendant des 29 demandes
  (aucune non faite, écarts corrigés), bouton de démonstration avec jeton, démo remise à neuf,
  test lent identifié et corrigé.
- **Après-midi 24/09** : espace juge recentré (Mon jugement, Documents, Examens, Aide) avec écran
  d'attente ; régie guidée par catégorie, pays masqué en national ; fiche de notation papier par
  manche ; officiels + jury ; logos de club ; durcissements (motifs ≤ 500, motifs d'absence
  réservés direction/secrétariat) ; glisser-déposer tactile réparé (touch-action) ; onglet
  **Parcours** étape par étape, page d'arrivée de la direction, rubriques adressables par
  l'adresse. Tout déployé, 173 tests.
- **Fiche d'inscription modèle PO (24/09, 10 h)** : deux parties (athlète / juges), lignes à
  compléter, fiches vierges en série, téléphone WhatsApp sur la fiche athlète.
- **Fiche unique, fiches d'inscription, ordre tiré au sort (24/09, 9 h)** : catégorie proposée et
  créée automatiquement d'après le référentiel (préférence à une catégorie déjà créée), tardif
  automatique, fusion guidée ; documents « Fiches d'inscription » (préparation seulement) et
  « Ordre de passage » général/catégorie/tour ; tirage au sort à l'ouverture de chaque tour,
  `round.draw`, absents retirés, rétabli en fin d'ordre. Modèle papier du PO toujours attendu.
- **Absences (24/09, 7 h)** : `round.absent` / `round.present` (chef ou responsable, avant le premier
  bulletin, propagé aux tours dépendants, quota réduit), panneau « Présence à l'appel » ;
  un absent = 0 point club. Correctifs PO : erreur d'action en bandeau fixe bas d'écran ; photo
  sélectionnée signalée non enregistrée (aucune photo n'avait atteint le serveur).
- **Meilleur club (24/09, 6 h)** : barème FIBDA 15/10/5/4/3 puis 1, finales et overalls par
  discipline, chaque inscription compte, éliminé = 1 point ; divergence assumée avec le Python
  (P11). Drapeaux à côté des pays, rubrique « Athlètes », « Sélectionner une catégorie ».
  Provisoire : absent = 1 point ; catégorie sans tour validé = 0.
- **XLSX et PDF (24/09, 5 h)** : export XLSX/PDF et import XLSX écrits sans dépendance (audit :
  pdf-lib sans publication depuis 2022, SheetJS via miroir tiers) ; relecture sécurité : un
  bloquant (regex quadratiques, 73 à 190 s sur 2 Mo malformés) corrigé par un scanner
  linéaire, test chronométré. Fichiers relus par pypdf et openpyxl, vérifiés sur la démo.
- **Photos** portées le 24/09 (Turso, réduction navigateur, relues : conforme), envoi réel
  vérifié sur la démo. **Hors périmètre** : import ZIP de photos, WebSocket, plan B Railway.
- **Retour du PO en production (24/09)** : « Erreur serveur » sur la composition du jury →
  les erreurs du moteur (DomainError) et de la préparation (PyValueError) n'étaient pas rendues
  en 422 ; corrigé, testé, déployé. Le PO a un chef et un juge ; il en faut 5 officiels.
- **Recette API réelle (24/09, 2 h)** : parcours complet joué sur la démo Vercel + Turso
  (jury, programme, 5 bulletins + stagiaire, validation, écran public, restauration) : tout
  200, ~3,5 s par bulletin connexion comprise ; 5 bulletins simultanés tous reçus, le dernier en
  7,2 s. Détail : `docs/PV-RECETTE.md`.
- **Semis de test en production (24/09, 3 h)** : 7 catégories, 35 athlètes `TEST-…`, dossards,
  jury complet, événement daté du 26/09. Sauvegarde d'avant semis chez Kevin, seule voie de
  nettoyage (pas de suppression d'athlète dans l'app), à faire avant les vrais athlètes.
- **Prochaine action** : le PO ouvre l'URL sur son téléphone, installe la PWA, se connecte
  avec le code du chef, crée un juge, envoie un bulletin de test (`A-FAIRE.md`). Critère de
  fin : accusé de réception d'un bulletin depuis un téléphone sur réseau mobile.

## 📓 Journal des sessions

### 2026-09-23 — Reprise, audit, PWA, sauvegarde, réécriture TypeScript
- Réorganisation du dépôt (sources dézippées → arborescence cible), commit `21ae035`.
- Audit : 79 tests Python + 14 frontend passent, serveur démarre. Écarts doc/code : PWA absente,
  SQLite 3.45 sur le poste (lanceur exige 3.51.3 en réseau ; résolu par le Python `uv` 3.13,
  SQLite 3.53.1), docs de cadrage contradictoires sur le StrongMan (tranché : sans rapport).
- Sécurité Python : 3 bloquants (pas de révocation, login hachant sous verrou, code d'invitation
  dans l'empreinte de commande). 0 CVE dépendances.
- PWA manifest + service worker, commit `6798822`. Sauvegarde/restauration vérifiées en réel.
- Hébergement : Oracle exige un paiement, Render gratuit sans disque, Koyeb/Fly plus de gratuit.
  Le PO choisit la **réécriture en JS** : Vite SPA conservé + fonctions Vercel + Turso (ADR 0002),
  Python sur Railway en plan B. Commit `e42beff` (ADR 0001, devenu plan B) puis `a4258e9`.
- Réécriture : moteur porté avec différentiel 200/200, préparation 12/12, workflow 16/16,
  parcours complet de compétition vert, 3 bloquants sécurité réglés côté TS.
- Soir : overall final toutes disciplines, codes admin 8, bouton dans l'écran Compétition.
  Turso + Vercel créés par la CLI ; deux échecs de déploiement (ESM non regroupé, puis
  signature Node du gestionnaire) corrigés ; production vérifiée au curl. Repli sans
  WebSocket corrigé côté frontend. Portages impressions/exports et imports lancés.
- Nuit : impressions/exports/imports portés et relus (conforme), mode d'emploi par profil
  intégré, restauration écran réparée, démo et production redéployées en `--prebuilt`.
- Ouvert : photos (P9), XLSX/PDF (P10), test téléphone réel par le PO, H1 (overall par sexe ?).

## 🎓 Leçons apprises

### Une assertion fausse peut « échouer lentement » : la barrière se pose sur le code de retour (2026-09-25)
La suite serveur est passée de 30 s à 25 minutes sans échec visible ; un déploiement est parti.
Cause : un libellé renommé (« Téléphone (WhatsApp) ») a rendu fausse une assertion d'un test ;
Node met alors des minutes à composer le message d'erreur sur le fichier TypeScript transpilé
en une seule ligne, et ma barrière lisait la sortie filtrée au lieu du code de retour.
Règle : la barrière avant commit est `npm run check` **avec son code de retour**, sous
`timeout` ; une suite qui ralentit brutalement est un échec à traiter, pas une attente.

### On ne déploie pas pendant qu'un agent écrit dans les fichiers du serveur (2026-09-24)
Un déploiement lancé pour deux correctifs d'interface a embarqué des fichiers serveur en cours
de modification par un agent parallèle ; la démo a échoué au build, la production a tourné
quelques minutes avec du code non vérifié (routes toujours saines, vérifié au curl).
Règle : avant `vercel build`, `git status` doit ne montrer que les fichiers du lot à livrer ;
sinon, attendre le rapport de l'agent.

### Une fonction Vercel en ESM ne regroupe pas ses imports relatifs (2026-09-23)
`FUNCTION_INVOCATION_FAILED` muet sur chaque route API, statiques servis normalement.
Vercel a déployé `api/index.ts` en ESM sans regrouper `../server/app` : `ERR_MODULE_NOT_FOUND`
dans les logs, qu'il a fallu aller chercher avec `vercel logs`. Puis la fonction restait
muette : gestionnaire web `(Request)` appelé avec la signature Node `(req, res)`.
Règle : l'API serverless est regroupée par esbuild en un fichier au build, et le
gestionnaire accepte les deux signatures. Le premier curl de recette est `/api/v1/health`.
Déploiement en `--prebuilt` uniquement.
→ coffre : `brain/10-lecons/une-fonction-serverless-s-envoie-regroupee-et-se-verifie-au-curl.md`.

### Un test de route emprunte le chemin que l'écran emprunte réellement (2026-09-23)
64 tests serveur verts, restauration impossible depuis l'écran : l'écran envoyait un fichier en
multipart, le serveur lisait du JSON brut, et le test envoyait du JSON brut. Vu en écrivant
le mode d'emploi. Règle : lire le code du client avant d'écrire le test d'une route qu'il
consomme. → coffre : `brain/10-lecons/un-test-de-route-emprunte-le-chemin-de-l-ecran.md`.

### Un hébergement « gratuit » se vérifie avant d'écrire la procédure (2026-09-23)
Procédure Oracle rédigée, ADR écrit, puis inscription refusée sans paiement.
Les offres gratuites changent de mois en mois et se lisent sur la page du fournisseur, pas de
mémoire.
Règle : avant un ADR d'hébergement, l'inscription est faite et la ressource créée.
→ coffre : `brain/10-lecons/l-inscription-a-une-offre-gratuite-se-fait-avant-l-adr.md`.
