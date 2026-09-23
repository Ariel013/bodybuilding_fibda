# Rapport du lot exploitation

## Livraison

Modules backend/fibda/printing.py, transfers.py et backup.py ; tests backend/tests/test_operations.py. Fonctions pures raccordées par l'API du lot parent. Documents sources HANDOFF.md, MATRICE-DROITS.md, EXPLOITATION.md, RECETTE.md et DESIGN.md ; générateur scripts/build_docs.py ; dossier livrables/Dossier-developpeur-FIBDA.pdf et .docx.

## Vérification exécutée

Commande depuis la racine du projet historique : PYTHONPATH=application/backend application/.venv/bin/python -m pytest application/backend/tests/test_operations.py -q. Résultat : 7 passed. Contrôles : échappement HTML, bulletin individuel sans examen, sélection élimination, CSV/XLSX/PDF, refus des formules CSV/XLSX, recadrage et normalisation JPEG, mapping ZIP, instantané SQLite, staging sans écrasement, altération SHA256 et traversée de chemin, diplôme réservé aux résultats validés et absence de note inventée.

Au premier jalon, le dossier documentaire a été régénéré avec le runtime documentaire fourni. PDF direct : 8 pages. DOCX rendu en PDF : 8 pages. Toutes les pages ont été rendues et inspectées en planches ; aucune coupure de texte ni chevauchement relevé. Les bordures automatiques des titres Word ont été supprimées. Les preuves de rendu sont dans livrables/qa-pdf et livrables/qa-docx-final. La pagination Word et PDF diffère car ce sont deux compositions depuis les mêmes sources.

## Points d'intégration

L'API doit contrôler les rôles et filtrer l'état avant chaque impression/export, bloquer la confirmation d'un import comportant errors, vérifier les category_id et attribuer les identifiants. Les helpers ne fournissent pas d'autorisation implicite. Le logo HTML pointe vers /assets/fibda-logo.jpg.

create_backup doit s'exécuter sous verrou global de mutation pour la cohérence de l'ensemble base et photos. validate_backup vérifie l'inventaire, les hashes, les chemins, les tailles, les tables, l'unicité et la structure de l'événement, et PRAGMA integrity_check. stage_restore ne touche jamais la base active. Le parent conserve l'ancien dossier, remplace l'état atomiquement et invalide sessions, commandes et identité de restauration.

## Réserves

Les helpers ne prouvent pas à eux seuls le raccordement HTTP. Les impressions et exports restent à vérifier sur l'imprimante réelle. L'examen utilise le calcul métier du module domain et sa référence versionnée ; l'absence de bulletin comparable reste N/D. Les diplômes sont des documents nominatifs A4 paysage ; leur habillage final peut être adapté par la fédération. Les photographies et la sauvegarde contiennent des données privées, sous contrôle des droits serveur.

La réception de quarante appareils, Windows natif, Wi-Fi réel, HDMI, LED, vidéo et imprimante n'a pas été exécutée dans ce lot. RECETTE.md fournit le protocole sans les déclarer validés.

## Complément lancement et démonstration

Ajout de launch.py, scripts/lancer-macos.command, scripts/lancer-windows.bat, scripts/build-package.py, backend/fibda/demo.py, alembic.ini et migrations. Documentation spécifique : docs/LANCEMENT.md (source Markdown séparée du dossier PDF initial).

Vérification du 23/09/2026 : tests/test_launcher_demo.py et tests/test_operations.py, 10 tests réussis. Le lancement --help fonctionne. L'appel --host 0.0.0.0 sans certificat retourne le refus HTTPS attendu avec code 2. Les tests couvrent les dossiers distincts, les codes aléatoires démo, 24 personnes/3 catégories/5 juges, l'idempotence du peuplement, le refus en mode officiel et les migrations sur base neuve et schéma existant. À ce premier jalon, le serveur complet et le paquet natif restaient à vérifier ; les essais ultérieurs sont documentés ci-dessous et dans REPORT-PACKAGE.md. Aucun build Windows n'est revendiqué.

## Vérification HTTP et durcissement du lanceur — 23 septembre 2026

Commande : `.venv/bin/python -m pytest backend/tests/test_http_operations.py backend/tests/test_operations.py backend/tests/test_launcher_demo.py -q`.
Résultat frais : **19 passed, 2 warnings in 2.22s**. Les avertissements concernent les dépréciations TestClient/httpx et anyio, sans échec. Le runtime d’essai utilise SQLite **3.53.1**.

Couverture ajoutée : import CSV et XLSX prévisualisé puis confirmé ; formules refusées ; prévisualisation périmée ; photo recadrée/JPEG, accès public conditionné au consentement ; export CSV/XLSX/PDF ; profil officiel sans compte ; restrictions juge sur backup/import et autres bulletins ; récapitulatif et examens HTML/CSV limités au juge connecté ; restauration avec préservation du dossier précédent, nouvelle identité, cookie invalidé, commandes supprimées et version périmée rejetée ; archive invalide laissant l’état et la session intacts.

Correctifs : filtre judge_id dans les récapitulatifs et rapports d’examen ; contrôle d’identité complète dans les imports avant confirmation ; URL publique HTTPS explicite, port et SAN exact du certificat, période de validité, aucun DNS/IP déduit ; SQLite < 3.51.3 refusé en LAN, avertissement en boucle locale. README-OPERATIONS.md et docs/LANCEMENT.md précisent les étapes. Aucun fichier app.py/store.py modifié par ce lot.

Limites : la validation du certificat ne prouve pas sa confiance sur les appareils. Pas de certificat à joker dans le lanceur. Pas de contournement pour backports non documentés. Les tests de certificat utilisent un SAN contrôlé ; ils ne sont pas une connexion TLS matérielle. Réception téléphones/routeur/HDMI/imprimante/OS cible à effectuer. Les addenda de lancement, la notice, le README et les rapports sont désormais incorporés à la génération PDF/DOCX.

## Complément impressions et paquet

Les bulletins vierges sont produits par juge et tour avec noms, statut officiel ou stagiaire et version. Une finale dont les participants ne sont pas fixés propose six lignes à confirmer. Les récapitulatifs distinguent reçus, manquants, expirés et rectifiés. Les récompenses comportent le lauréat, le dossard et des pages séparées par catégorie/overall ; les collectifs utilisent leur nom explicite. Les officiels incluent le parcours. Les diplômes HTML et PDF sont nominatifs en A4 paysage. Les tableaux PDF répètent catégorie/tour et colonnes, et portent date, signature et version sur chaque page.

Le contrôle ciblé après ce complément a donné 15 tests réussis pour helpers et routes HTTP. Ce nombre décrit ce lot ; le bilan de livraison reste à établir après les dernières intégrations. Les rendus PDF opérationnels sont dans livrables/qa-print. Le paquet macOS et sa preuve sont décrits dans REPORT-PACKAGE.md.
