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

0ter. **[RÉPONDU LE 24/09, définitif]** Overall : **un par discipline et par sexe**, pas de finale
   entre disciplines. Dames : bikini, wellness, bodyfitness (3 overalls) ; hommes : 4 disciplines.
   C'est le fonctionnement natif du moteur (`overall.create` par discipline). La commande
   `overall.final` (toutes disciplines) écrite le 23/09 sur une première lecture reste côté
   serveur, testée, **non exposée dans l'interface ni dans le mode d'emploi**.

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
   **Résolu (24/09)** — demande PO « import et export par PDF et XLSX ». Second audit mesuré
   (`npm audit --json` dans un dossier jetable) : `pdf-lib` 1.17.1, 0 vulnérabilité, JS pur,
   5 dépendances transitives, dernière publication 12/05/2022 ; `@e965/xlsx` 0.20.3 (miroir npm
   de SheetJS CE), 0 vulnérabilité, JS pur, 0 dépendance, dernière publication 19/07/2024 par un
   tiers (l'amont ne publie plus sur npm). Aucune des deux ne satisfait « maintenue » (RULES.md
   §Sécurité) : solution retenue = écriture maison sans dépendance, `frontend/server/xlsx.ts`
   (ZIP + XML par expressions régulières, lecture première feuille, formules rendues « =… » donc
   refusées, bornes anti-bombe 20 Mo par entrée / 40 Mo total / taille réelle contrôlée) et
   `frontend/server/pdf.ts` (PDF 1.4, Helvetica non embarquée, WinAnsi, tableau simple, diplôme
   en paysage). `GET /export/{kind}?format=xlsx|pdf` et l'import XLSX sont implémentés et testés
   en unitaire ; limites : mise en page PDF sommaire, caractères hors WinAnsi rendus « ? »
   (≤ ≥ → substitués), pas de lecteur PDF sur la machine de développement pour un contrôle
   visuel — à ouvrir dans un lecteur réel avant la compétition.

P11. **Barème collectif : divergence TypeScript / Python** (24/09). Décision PO du 24/09/2026 pour
   « Meilleur club » et « Meilleur pays » : 15/10/5/4/3 puis 1 point par place, finales de catégorie
   et overalls par discipline comptés, chaque inscription compte (plus de déduplication par
   personne), 1 point de participation pour un inscrit confirmé éliminé avant la finale, départage
   inchangé. Implémentée et testée en unitaire dans `frontend/domain/domain.ts` et
   `frontend/server/projections.ts` ; `backend/fibda/domain.py` (plan B Python) garde l'ancienne
   règle 10/6/4/3/2/1 « meilleur rang par personne, sans overall » et n'est PAS modifié : en cas de
   bascule sur le plan B, les classements collectifs différeraient. Points non tranchés par le PO,
   choix provisoires à confirmer : (a) l'overall final toutes disciplines (`grand_final`, décision du
   23/09) n'est **pas** compté ; (b) une inscription confirmée dans une catégorie dont aucun tour n'est
   encore validé ne rapporte rien tant que la catégorie n'est pas engagée (le point de participation
   apparaît dès le premier tour validé, de manière provisoire jusqu'à la finale, et seulement pour
   les inscriptions effectivement alignées dans les `participant_ids` d'un tour validé). Point (c)
   **tranché par le PO le 24/09/2026** : « Un athlète absent est absent, il ne compte aucun point ! »
   — une inscription déclarée absente (`round.absent`, avant le premier bulletin du tour) est retirée
   du tour et des tours suivants de la catégorie et rapporte 0 point ; un éliminé en demi-finale ou
   en éliminatoire garde 1 point. Cas limite retenu sans décision PO : le dernier participant d'un
   tour ne peut pas être déclaré absent (un tour vide ne devient jamais prêt, cf. `ready`) ; on passe
   par un incident. Un tour réduit à 1 participant reste jugeable, comme en Python.


P12. **Catégories activables et multi-inscription** (26/09). Implémentées et testées en unitaire côté
   serveur (`frontend/server/preparation.ts`, `workflow.ts`, contrat `docs/CONTRACT.md`). Points non
   tranchés par le PO, choix provisoires à confirmer. **Tranché par le PO le 26/09** : une catégorie
   désactivée garde ses inscriptions et se réactive sans ressaisie (c'est l'implémentation).
   (a) **Réactivation après les dossards** : les inscriptions confirmées d'une catégorie réactivée
   après `bibs.assign` n'ont pas de dossard (elles ont été ignorées à l'attribution) et, si la
   compétition est démarrée, `programme.generate` ne peut plus recréer ses manches. Aucune attribution
   automatique n'a été inventée : il faut désactiver avant les dossards, ou passer par `entry.late`
   (dossard « plus grand + 1 ») et le programme régénéré en préparation. À trancher : faut-il un
   dossard automatique à la réactivation ?
   (b) `programme.reorder` attend toujours la liste exacte des catégories **non archivées**, y compris
   les désactivées (elles gardent leur rang d'affichage) ; le contrat frontend doit envoyer les deux.
   (c) `category.fuse` ne tient pas compte de `active` : la fusion copie l'indicateur de la première
   catégorie. Non contractuel, laissé tel quel.
   (d) La route `GET /eligibility/{person_id}` propose des **règles du catalogue**, pas des catégories
   de l'état : rien à filtrer côté serveur ; le filtrage « catégories actives seulement » de la
   proposition automatique relève du frontend (`src/categorieAuto*`).

P13. **Concordance des juges avec le bulletin du chef** (26/09, demande PO). Implémentée et testée en
   unitaire (`frontend/server/concordance.ts`, route `GET /api/v1/concordance` chef/responsable,
   panneau « Concordance avec le chef » dans Compétition). La formule est **exactement celle de
   l'examen des stagiaires** (`pairConcordance` / `examReport`, `frontend/domain/domain.ts`) : part des
   paires d'athlètes classées dans le même ordre que le chef, moyenne non pondérée par manche.
   Choix provisoires à confirmer par le PO :
   (a) **Avant validation** de la manche, la référence est le bulletin courant du chef (l'examen, lui,
   n'évalue qu'après validation, sur la référence gelée) ; dès la validation, on repasse sur la
   référence gelée et versionnée, comme l'examen. Faut-il au contraire n'afficher qu'après validation ?
   (b) **Éliminatoires exclues** : bulletin de sélection (pas de classement), la formule de l'examen
   ne s'y applique pas et l'examen les exclut aussi. Le PO veut-il un taux de sélections communes
   pour ces manches ? Non implémenté, aucune formule inventée.
   (c) Le bulletin comparé est le bulletin **original** du juge (avant correction papier), comme
   l'examen ; le chef lui-même n'apparaît pas dans la liste (100 % par construction).
   (d) Sans chef actif unique, le rapport est vide (aucune référence) ; un bulletin portant sur
   d'autres athlètes que la référence est signalé « non comparable », sans score.

P14. **Route `/command` en écriture optimiste sans transaction tenue à travers le réseau** (26/09,
   suite au constat PO « délai long quand tout le monde valide »). Mesuré en local (compteur d'appels
   au client libsql, `frontend/server/concurrence.test.ts` pour la sémantique) : un `ballot.submit`
   coûtait 12 allers-retours vers Turso (2 transactions, `tickOnce` séparé, comptes lus 3 fois), il en
   coûte 2 (une lecture groupée : session + état + comptes + commande antérieure ; une écriture
   groupée atomique : audit + journal des commandes + état, chaque ligne conditionnée à la version
   lue). `GET /state` : 6 → 1 (2 si une transition temporisée est due). Gain en secondes **non
   mesuré** : à relever par le PO sur Vercel. Choix faits sans décision PO, à confirmer :
   (a) **Bulletins simultanés** : au lieu d'être sérialisés par le verrou d'écriture de la base (le
   dernier des 5 reçu en 7,2 s le 24/09), un bulletin dont l'écriture trouve la version dépassée est
   **relu et rejoué côté serveur sur l'état à jour** (6 essais au plus, puis 409 comme avant). Les
   contrôles de tour, restauration, propriétaire et clôture s'appliquent à chaque rejeu ; toute autre
   commande revient au contrôle de version (409) comme avant. Le contrat `docs/CONTRACT.md` (« les
   bulletins simultanés admettent une ancienne version globale ») est inchangé.
   (b) **Transition temporisée (délai stagiaire)** : appliquée en mémoire sur l'état lu et écrite dans
   le même lot que la commande. Si la commande échoue (422/409), la transition n'est pas écrite et
   se rejouera à la requête suivante (elle ne dépend que de l'horloge et de l'état) ; auparavant elle
   était validée à part avant la commande. `GET /state` l'écrit toujours avant de la renvoyer.
   (c) Les commandes qui écrivent aussi dans les comptes, sessions ou photos (`user.invite`,
   `user.approve`, `user.deactivate`, `person.delete`, `event.purge`, liste `TRANSACTIONAL` dans
   `commands.ts`) gardent une transaction explicite ; toute autre commande reçoit une connexion qui
   refuse le SQL (500 explicite plutôt qu'une écriture hors lot).
   (d) Non fait, à décider si le délai reste gênant : découper l'état en tables (un tour = une ligne)
   pour ne plus réécrire ~30 ko d'état par bulletin ; interrogation périodique du téléphone toutes
   les 6 s (`App.tsx`) à espacer pour les juges, qui reçoivent déjà l'état avec l'accusé.
