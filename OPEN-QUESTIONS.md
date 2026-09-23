# OPEN-QUESTIONS.md — Questions bloquantes au PO

À tenir à jour. Tant qu'une question de la section "Bloquant conception" n'est pas répondue,
la zone du projet concernée ne doit pas être commencée.

## Bloquant conception

0bis. **[LA PLUS URGENTE MAINTENANT]** Tu as demandé "un nouveau repo, une app à part, pas
   celle du StrongMan". La base de code que tu viens de partager (`FIBDA-sources-developpeur.zip`)
   est déjà, après inspection réelle du code, une app bodybuilding distincte du StrongMan
   (zéro référence StrongMan dedans, catalogue et logique 100% bodybuilding). **Est-ce que
   "nouveau repo" voulait juste dire "distinct du StrongMan" (→ on part de cette base, c'est
   déjà rempli) ou vraiment "ignorer ce code aussi et repartir de zéro" ?** Vu le délai (3
   jours), repartir de zéro alors qu'une base fonctionnelle existe serait un risque énorme —
   `PLAN-J3.md` suppose qu'on réutilise cette base sauf contre-ordre de ta part.

0. **[RÉPONDU LE 23/09, partiellement]** Périmètre de samedi 26/09/2026, réponses du PO :
   - **Un seul panel de juges.**
   - **Toutes les disciplines** du catalogue sont possibles ; **d'autres disciplines existent**
     et doivent pouvoir être ajoutées (→ le catalogue doit rester extensible ; toute discipline
     ajoutée hors catalogue actuel reste à faire valider, voir Q1ter/Q5).
   - **Overall le même jour** : les premiers de toutes les catégories s'affrontent pour le
     titre de champion overall. → Voir Q0ter (règle exacte de l'overall).
   - Tout doit rester **modulable pendant l'événement** : ajouter des athlètes au fur et à
     mesure, ajouter des juges, créer catégories et sous-catégories.
   - **Pas encore répondu** : nombre concret de catégories et d'athlètes ; Wi-Fi/routeur du
     lieu (dépend de Q0quater).

0ter. **[RÉPONDU LE 23/09]** Overall : « tous les premiers de chaque discipline s'affrontent
   pour un champion définitif ». Implémenté côté TypeScript : commande `overall.final`
   {section} disponible quand toutes les disciplines sont terminées ; participants = champions
   des overalls de discipline (dédupliqués par personne), tour jugé par le panel comme un
   overall ordinaire, récompense « Champion overall toutes disciplines ».
   **Hypothèse H1 à confirmer** : un seul overall final, hommes et femmes confondus, par
   section. Si la fédération veut un champion par sexe, dire-le : c'est une ligne à changer.

0quater. **[REMPLACÉ LE 23/09 par ADR 0002]** Réécriture du backend en TypeScript serverless
   (Vercel + Turso), frontend et contrat d'API conservés, Python sur Railway en plan B. Voir
   `docs/decisions/0002-*.md`. Historique : hébergement : le PO choisit un serveur hébergé sur Internet,
   sur une VM gratuite. Décision et compromis dans `docs/decisions/0001-serveur-heberge-sur-internet-vm-gratuite.md`,
   procédure dans `docs/DEPLOIEMENT-INTERNET.md`, actions manuelles dans `A-FAIRE.md`.
   Réponse du 23/09 : partage 4G prévu.

0quinquies. **[RÉPONDU LE 23/09 : 8 caractères pour chef, responsable, directeur ; 4 pour les autres — implémenté côté TypeScript]** Longueur minimale des codes personnels.
   Décision du 23/09 (REPRISE.md) : 4 caractères minimum. La passe sécurité du 23/09 relève
   qu'un code à 4 chiffres = 10 000 combinaisons et que le login sans identifiant teste tous
   les comptes à chaque essai. Proposition : garder 4 pour les juges, exiger 8 pour chef,
   responsable et directeur. À trancher.

1. ~~Nature du dossier reçu~~ **[RÉSOLU]** — L'application déjà codée et testée décrite dans ce
   dossier a en réalité été construite pour le **StrongMan**, un sport différent. Le PO a
   envoyé le mauvais dossier / une confusion s'est produite. **FIBDA Bodybuilding est donc un
   nouveau projet à concevoir de zéro**, pas une reprise de code existant.
   → Conséquence importante : le "Contrat partagé FIBDA v1", le référentiel "neuf disciplines,
   106 règles", les rapports de tests ("77 tests OK", agents domaine/frontend/exploitation) du
   dossier initial décrivent très probablement l'app StrongMan avec du vocabulaire bodybuilding
   plaqué dessus (Men's Physique, Bikini apparaissent bien, donc une adaptation partielle a eu
   lieu — mais rien ne garantit qu'elle soit complète ou correcte). **Ne pas faire confiance à
   ce document comme source de vérité du référentiel sportif bodybuilding.**
1bis. **[CADUC LE 23/09]** — Le PO a tranché : le repo StrongMan n'a aucun rapport avec ce
   projet, ne pas le cloner ni l'auditer. La base de code de ce dépôt est la base de départ
   (voir `PLAN-J3.md`). `CLAUDE.md` §0.2, `00-PROJECT-BRIEF.md` §1bis et `ARCHITECTURE.md`
   §6bis restent à corriger en conséquence.
1ter. Le dossier "FIBDA Bodybuilding" reçu a-t-il été écrit par une personne qui a réellement
   vérifié les 106 règles/9 disciplines de bodybuilding, ou est-ce un remaniement automatique
   du dossier StrongMan (agents IA qui ont substitué du vocabulaire) ? **Toujours ouvert.** À
   faire confirmer explicitement avant de considérer le référentiel comme fiable à 1%.
2. **[RÉSOLU]** Repo StrongMan accessible via l'utilisateur, pas de dossier `cadrage/`/maquette
   v4 encore localisé — à vérifier pendant l'audit du repo.
3. Date de la compétition cible — **toujours ouvert**, mais le délai est confirmé comme serré.
4. **[RÉSOLU]** Pays/fédération : Côte d'Ivoire.
5. **Toujours ouvert et critique** : qui, côté fédération FIBDA, valide le référentiel sportif
   (106 règles, calcul de jury, barèmes) avant mise en production ?
6. **[RÉSOLU]** Développeur seul + Claude Code, pas d'équipe. → contraintes de rigueur ajoutées
   dans `CLAUDE.md` §0bis (pas de tâche à moitié faite, ne rien casser, scope tenu).
3. **Date de la compétition cible** et délai réel disponible.
4. **Pays / fédération exacte** de FIBDA — nécessaire pour le cadre légal (mineurs dès 15 ans,
   photos, données personnelles).
5. **Qui valide le référentiel sportif** (106 règles, calcul de jury, barèmes) côté fédération
   avant mise en production — sans ce point, le moteur de calcul ne peut pas être considéré fiable.
6. **Qui construit et teste réellement** ce dossier de conception : le PO code lui-même en
   s'appuyant sur ces fichiers de règles, ou un agent LLM codeur (type Claude Code) va exécuter
   le travail ?

## Important mais pas totalement bloquant

7bis. **[NOUVEAU]** Le PO envoie le frontend lui-même — quand exactement, dans quel format
   (repo à part, fichiers zip, stack précise), et respecte-t-il déjà les contraintes PWA
   (manifest, service worker) ? Tant que ce n'est pas su, le backend doit être conçu API-first
   et testable indépendamment du frontend (voir `AGENTS.md` §Agent Dev), pour ne pas être
   bloqué par l'arrivée tardive de la pièce qu'on ne maîtrise pas.
7ter. Qui, du PO ou de l'utilisateur, fige le contrat d'API en premier ? Si le PO code son
   frontend sans connaître le contrat exact, risque fort de mismatch à intégrer en urgence
   vendredi/samedi. Recommandation : lui envoyer le contrat d'API dès qu'il est stabilisé.

7. Nombre d'événements/an et de lieux différents (une config réseau par salle ou une seule
   récurrente ?)
8. Qui configure le réseau le jour J (domaine, DNS, certificat) — un rôle "responsable
   technique" existe dans le dossier mais n'est pas nommé.
9. Budget pour nom de domaine / certificat / matériel réseau de secours.
10. Le build Windows : sur quelle machine, par qui, à quelle échéance ?
11. Confirmation explicite du seuil "300 athlètes / 40 appareils" comme cible réelle ou comme
    hypothèse de dimensionnement.

## À faire remonter dès réponse obtenue

- Mettre à jour `00-PROJECT-BRIEF.md` §2 avec le vrai statut du code
- Mettre à jour `ARCHITECTURE.md` §7 en fonction de la structure de repo réelle
- Si la fédération n'a pas encore validé le référentiel sportif : créer un jalon explicite
  "gel du référentiel" avant tout développement du moteur `domain.py`

## Relevés du portage TypeScript (23/09) — portés tels quels, à trancher après samedi

P1. `rank_ballots` : le chef est de fait obligatoire (`chief_id=None` échoue toujours sur
   « Bulletin du chef manquant »). Conforme à RULES, mais la signature laisse croire l'inverse.
P2. `elimination_result` ignore `chief_id` et `collective_results` ignore `tiebreak` :
   paramètres morts, conformes à RULES (le chef n'annule pas une égalité ; départage par
   places avant tout critère). À simplifier plus tard.
P3. `exam_report` plante (KeyError) sur un tour hors overall sans `category_id` ou avec
   `participant_ids: null` — jamais produit par le workflow, mais aucune garde.
P4. Affichage des moyennes d'examen : `display` arrondi à 2 décimales peut montrer « 85.00 »
   pour une moyenne exacte < 85 refusée. Le calcul est juste, l'affichage peut surprendre.
P5. `measure` accepte tout ce que `Decimal(str)` accepte (blancs, `1E2`). Tolérance héritée.
P6. Deux copies de `catalogue.json` (backend Python et `frontend/domain/`) tant que le plan B
   Python existe : toute modification du catalogue se fait dans les deux (voir A-FAIRE.md).
P7. `validate_confirmed_entries` : une dérogation dont `reason` vaut `null` est comptée comme
   motivée (`str(None)` = « None » côté Python). Porté à l'identique ; trou probable.
P8. `entry.late` avec `reason: null` : passe le premier contrôle puis plante en 500 au `strip()`.
   Porté à l'identique.
P9. **[RÉSOLU LE 24/09]** Photos portées en serverless : stockées dans Turso (table `photos`,
   BLOB ≤ 1 Mo après réduction dans le navigateur, type vérifié par octets magiques, pas de
   re-encodage serveur), mêmes règles d'approbation et de consentement que le Python, incluses
   dans la sauvegarde JSON tant qu'elle reste sous 4 Mo. Seul l'import ZIP de photos reste
   indisponible (501). Réserve : l'orientation EXIF n'est pas corrigée (le Python le faisait) ;
   une photo prise en portrait peut apparaître pivotée, à contrôler à l'œil.

P10. **Import XLSX indisponible** (23/09 soir). Audit mesuré : `exceljs` 4.4.0 → 2 vulnérabilités
   modérées ; `xlsx` 0.18.5 → 1 vulnérabilité haute sans correctif. Conformément à RULES.md,
   aucune dépendance ajoutée : `POST /imports/preview` répond 415 « Format XLSX indisponible :
   convertir en CSV ». L'import CSV complet est porté (4 Mo maxi, limite Vercel).
