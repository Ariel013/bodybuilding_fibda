# Rapport du lot domaine et catalogue

Réalisé : moteur pur de validation panel/permutation, rangs officiels avec trace des extrêmes, renumérotation nationale, majorité/SCC, élimination avec blocage au seuil, déduplication overall, collectifs meilleur résultat par personne et examen à fractions exactes. Catalogue JSON de neuf disciplines, toutes classes documentées, sources et versions, mesures décimales exactes, plafonds classiques et incertitude à 15 ans. Contrat des fonctions et limites dans REFERENTIEL.md.

Vérification exécutée le 22 septembre 2026 depuis application :

```
PYTHONPATH=backend .venv/bin/python -m unittest discover -s backend/tests -p 'test_domain.py' -v
Ran 8 tests in 0.001s — OK
PYTHONPATH=backend .venv/bin/python -m unittest discover -s backend/tests -p 'test_catalogue.py' -v
Ran 3 tests in 0.002s — OK
```

Cas probants : jurys 5/7/9/11 avec extrêmes identiques ; directeur refusé ; doublon de classement refusé ; filtrage puis renumérotation nationale ; cycle majoritaire et composante dominante ; égalité de qualification non décidée ; champion doublonné et meilleur résultat collectif ; comparaison du bulletin original malgré correction ; absence sans zéro ; moyenne brute 84,994949… refusée malgré proximité de 85 ; 60 paires / quatre catégories ; quatorze classes Masters Bodybuilding ; date de naissance du 31 décembre ; 15 ans à confirmer ; 175,0 contre 175,1 cm et plafonds des classiques.

Réserves : tests unitaires de fonctions pures uniquement, pas réception serveur/navigateur/matériel. Aucun contrôle IFBB distant renouvelé dans ce lot ; la vérification documentaire du 22 septembre reste sourcée dans le document de cadrage. La nationalité CI, les filtres de finale/section/discipline et la capture immuable de la référence chef sont des responsabilités serveur explicites. Une proposition morphologique n'autorise pas à elle seule une inscription. Le départage collectif par nombres de places est obligatoire après les points ; seule une égalité persistante demande l'application du critère personnalisé et la décision humaine. La commission conserve sa décision d'examen. Confirmation IFBB à 15 ans et actualisation 2027 non obtenues.

## Extension préparation — 23 septembre 2026

Ajout de `backend/fibda/preparation.py` et `backend/tests/test_preparation.py` : 11 commandes demandées, droits, brouillons et confirmations, dérogation chef signée, cumuls réservés chef, mesures exactes, fusion réelle avec provenance et refus de doublon, dossards par inscription dans ordre programme, inscription tardive chef/responsable max+1 avant première épreuve de catégorie, profils officiels sans approbation photo injectée. La mutation est atomique en mémoire : aucune modification partielle si Problem.

Derniers contrôles : `test_preparation.py` 6 tests OK (0.008 s), `test_domain.py` 9 tests OK (0.001 s), `test_catalogue.py` 3 tests OK (0.002 s), mêmes commandes unittest que ci-dessus. Extension domaine : responsable admis dans panel, élimination et moins de deux participants exclus du programme d'examen évaluable sans faux manquant.

Limite admission : la dérogation conserve les écarts sportifs et le signataire ; elle ne constitue pas une certification internationale de l'âge à 15 ans. Les vérifications de pièces sont des attestations saisies par les opérateurs ; aucune lecture automatisée de pièce ou registre national. Les codes pays sont vérifiés syntaxiquement, pas contre un registre externe. Réception intégrée à faire côté serveur/frontend.


## Revue workflow et correction tardifs — 23 septembre 2026

Ajout de 16 scénarios dans `backend/tests/test_workflow.py`. Revue initiale : défauts reproduits sur inscription tardive non injectée dans le tour généré, ancienne révélation après correction et incident répété. Le parent a corrigé la syntaxe, les incidents et les révélations. Correction dans préparation : mise à jour participants et insertion des phases aux seuils 6→7/15→16, conservation des IDs des tours et des dossards, dépendances cohérentes et autres catégories intactes. Le signalement initial sur le départage collectif était une lecture erronée : les places 1 à 6 départagent toujours les points ; le test et la documentation ont été corrigés. Le helper de domaine applique désormais aussi ce départage par défaut.

Contrôles frais : test_workflow.py 16 tests OK (0.004 s), test_domain.py 9 tests OK (0.001 s), test_preparation.py 6 tests OK (0.011 s). Exécution réelle normale, sans correctif en mémoire, après les modifications. Tests couvrent délai 60 s, transition unique, validation et attente qualification, nationalité CI/renumérotation, finale zéro, correction à deux signatures, confidentialité, cycle overall et gestion des retards.

## Verrouillages de préparation — 23 septembre 2026

Le critère collectif est figé dès que l'événement quitte préparation. La réorganisation conserve exactement les positions des catégories engagées, y compris contre un déplacement indirect. L'attribution des dossards refuse zéro inscription confirmée. Un changement de date ou de mode relance l'admissibilité de chaque inscription confirmée et annule atomiquement la commande si un nouvel écart subsiste.

Helper public livré au serveur : `validate_confirmed_entries(state)` dans preparation.py, sans mutation, True ou auth.Problem. À appeler avant event.start. Une dérogation signée ne couvre que les écarts explicitement consignés ; un nouvel écart bloque la confirmation. Aucun changement de workflow.py effectué par ce lot.

Contrôles frais : test_preparation.py 12 tests OK (0.017 s), test_workflow.py 16 tests OK (0.005 s). Cas ajoutés : critère figé, déplacement indirect, zéro confirmation, changement national→international, anniversaire annuel 23→24 en Junior, nouvel écart après dérogation.

## Audit ciblé des dépendances et signatures

Lecture indépendante de app.py, auth.py, projections.py, commands.py et workflow.py ; aucun de ces fichiers modifié. Nouveau `backend/tests/test_audit.py` : quatre régressions actuellement rouges, transmises au parent pour correction :

- Examen : un tour futur dont les finalistes ne sont pas encore connus (`pending`, dépendance, participants vides) est exclu comme un vrai tour à moins de deux athlètes ; un examen peut être déclaré réussi avant ce tour prévu.
- La signature directeur ne revérifie pas qu’une finale dépendante a été ouverte après la proposition de correction d’une demi-finale.
- Une finale peut changer de champion après confirmation de son overall, qui garde alors le mauvais champion.
- La signature directeur après suspension pour un nouvel incident rétablit implicitement `validated` sans résolution de l’incident.

Preuve : `PYTHONPATH=backend .venv/bin/python -m unittest discover -s backend/tests -p test_audit.py -v` → `Ran 4 tests`, `FAILED (failures=4)` à la remise de la revue. Ce sont des tests de défauts confirmés, pas une annonce de suite verte. Les autres corrections d’intégration sont prises en charge par le parent.

## Correctif examen et simulation de capacité

`domain.exam_report` distingue maintenant les finalistes inconnus d'une qualification effectivement validée à zéro ou un athlète. Une dépendance non résolue reste manquante, interdit `complete` et `passed` ; une qualification connue à moins de deux athlètes reste exclue. Tests du domaine : 10/10 réussis. Le test d'audit ciblé `test_exam_future_dependency_is_missing_not_excluded_as_zero_participants` réussit également. Les trois autres défauts sont corrigés par le parent, hors périmètre de cette intervention.

`backend/tests/test_capacity.py` prépare une base temporaire avec 100 inscriptions, 11 officiels et 29 stagiaires (40 identités et sessions distinctes). Une barrière libère 40 clients TestClient dans 40 threads ; chaque client poste simultanément une permutation complète différente de 100 athlètes avec la même version initiale. Vérifications : 40 réponses HTTP 200, 40 bulletins originaux intacts, 40 commandes et 40 traces d'audit, version 40, clôture unique en attente de validation, aucune révélation automatique. Après fermeture de l'application et réouverture d'un nouveau moteur SQLite, l'état est identique et une répétition idempotente du premier envoi ne le modifie pas.

Commande : `PYTHONPATH=backend .venv/bin/python -m unittest discover -s backend/tests -p test_capacity.py -v` → `Ran 1 test in 14.445s`, `OK`. Mesures du lot HTTP simulé : 0,195 s au total, P95 0,181 s, maximum 0,189 s ; la durée complète inclut la préparation des comptes. Ces mesures constituent une observation locale unique, pas un seuil contractuel ni un benchmark matériel reproductible.

Limites : transport ASGI en mémoire, SQLite réel temporaire, fixture initiale injectée directement pour isoler la réception ; aucun réseau Wi-Fi, navigateur, téléphone, serveur multi-processus, coupure électrique ou crash brutal testé. Réouverture logicielle du stockage, pas redémarrage de la machine. Le tour classé à 100 athlètes constitue une charge synthétique du bulletin, pas une recommandation de programme sportif. Avertissement de dépendance Starlette : support httpx TestClient déprécié ; le test a néanmoins réussi.

## Parcours métier API et catalogue figé (.2)

Nouveau `test_event_journey.py` : appel HTTP démo, connexion de chaque votant, génération, démarrage, deux demi-finales Men’s Physique avant les deux finales, classement commun avec HC en tête qualifié et national filtré/renuméroté, remise des récompenses, overall à deux champions voté, passage Bikini, demi/finale puis overall à un champion explicitement confirmé, clôture. Bilan : 24 athlètes, trois catégories, huit tours validés, neuf récompenses de catégories et deux overall marquées remises. Aucun état sportif injecté directement dans ce test ; toutes les étapes passent par l’API de commande. Test ASGI, pas navigateur/réseau réel. `test_event_journey.py` : 1 test réussi ; `test_audit.py` : les quatre régressions sont désormais vertes après corrections du parent et du domaine.

Catalogue comparé au tableau documentaire local : neuf disciplines et 106 règles, classes et groupes concordants ; 42 contrôles de plafonds couvrant les sept bandes, Junior/Senior/Masters des deux disciplines classiques. Neuf URL/éditions concordent avec le manifeste, et les neuf PDF archivés recalculés SHA-256 concordent également. Aucune recherche distante nouvelle, aucune homologation IFBB nouvelle.

Version `FIBDA-2026-09-22.2` : coefficients numériques et bornes inclus dans `classic_limits`, lus par le calcul Python ; titre/édition/URL/pages/octet/empreinte/chemin archive pour chaque source ; normalisations détaillées référencées par chaque règle. `weight_limit` et `eligibility` acceptent un catalogue explicite. Les admissions après démarrage utilisent `rules_snapshot` pour les groupes d’âge et coefficients, afin de préserver le référentiel figé. La préparation utilise le catalogue courant avant le snapshot du démarrage. Tests catalogue : 5/5 ; préparation : 12/12.

Réserves conservées : confirmation sportive à 15 ans pour les trois disciplines concernées ; corpus d’éditions 2024/2026, pas certification d’un règlement 2027 ; archives référencées dans le dépôt de recherche, pas embarquées en PDF dans l’application. Le snapshot porte les empreintes et toutes les tables numériques nécessaires, sans recopier les PDF.
