# Dossier développeur FIBDA

Cette application locale prépare une compétition, recueille les bulletins et produit des documents de travail. Le contrat API se trouve dans CONTRACT.md. Les règles sportives sont décrites dans REFERENTIEL.md ; le code et les résultats des tests déterminent ce qui est effectivement implémenté. Une démonstration locale ne vaut pas une réception fédérale.

## Architecture et reprise

Le backend Python sert une API versionnée /api/v1. SQLite conserve un événement versionné, des comptes, sessions, commandes, traces et métadonnées photo. L'interface React utilise la même origine réseau. Les postes publics reçoivent une projection autorisée, jamais l'agrégat privé. Le lanceur et les dépendances sont livrés dans le dossier application.

Avant toute reprise, lire CONTRACT.md, IMPLEMENTATION.md, REFERENTIEL.md et le rapport de vérification final. Exécuter les tests avec le Python de .venv et PYTHONPATH=backend. Vérifier la construction du frontend avant de distribuer son dossier compilé. Ne pas modifier le prototype historique situé hors application.

## Transactions et commandes

Toute mutation doit vérifier le compte actif, ses rôles, l'identifiant de restauration et la version d'événement attendue. Une commande possède un identifiant stable ; sa répétition ne doit pas produire une seconde écriture. Une réponse 409 oblige à relire l'état puis à revoir l'action. BEGIN IMMEDIATE sérialise les écritures SQLite. L'accusé de réception serveur constitue la preuve d'un bulletin reçu.

Les événements WebSocket indiquent qu'un état a changé. Ils ne transportent pas de bulletin privé. Un rechargement doit toujours pouvoir reconstruire l'écran depuis le serveur. Les timers de clôture dépendent de l'horloge serveur ; un téléphone ne décide pas de l'expiration.

## Modules d'exploitation

printing.document_sections prépare des tableaux à partir d'un état déjà autorisé. render_print(state, kind, category_id, round_id, judge_id) produit du HTML échappé, avec sauts de page et entêtes répétées. export_document retourne contenu binaire, type MIME et nom, en CSV, XLSX ou PDF. Ces fonctions ne décident pas des droits : l'API filtre l'état et refuse les documents privés selon le rôle.

transfers.preview_import(data, filename) retourne rows, errors et warnings sans modifier la base. Les colonnes sont en anglais conformément au contrat. Les erreurs bloquent la confirmation ; les doublons d'identité exigent un contrôle. sanitize_photo normalise JPEG, PNG ou WEBP en JPEG sans métadonnées et accepte un rectangle de recadrage en pixels. batch_photos ne fait aucune association implicite : chaque nom de fichier doit être associé à un propriétaire et à un type de photo.

backup.create_backup utilise l'API SQLite backup pour obtenir un instantané valide, puis ajoute les photos et les empreintes SHA256. Le serveur doit maintenir son verrou de mutation pendant l'ensemble de cette opération afin d'aligner base et photos. validate_backup refuse les chemins dangereux, les fichiers surnuméraires, les doublons, les empreintes invalides, les bases non intègres et les schémas incomplets. stage_restore écrit dans un nouveau dossier uniquement.

## Installation et dépendances

Le projet exige Python et les versions décrites dans son fichier de dépendances ; l'interface exige Node lors de la compilation. Pillow, openpyxl et reportlab assurent les images et les exports. Une installation hors ligne nécessite de préparer les dépendances et le frontend avant le jour de l'événement. Aucun CDN ne doit être requis sur le lieu.

Le script scripts/build_docs.py régénère le dossier PDF et sa version Word à partir des présents fichiers Markdown. Les sources restent éditables. Le PDF documentaire ne remplace ni les impressions opérationnelles issues de la base, ni le procès-verbal de recette.

## Limites de livraison

La conformité des règles avec une édition réglementaire ultérieure, le certificat réseau, Windows, le routeur, l'écran LED, le vidéoprojecteur, l'imprimante et quarante appareils simultanés nécessitent une réception spécifique. Ne jamais déclarer ces points validés à partir des tests unitaires seuls.
