# Modèle de données et API — version 0.1.0

## Stockage physique

SQLite sur disque local, hors partage réseau et dossier synchronisé. SQLAlchemy fournit les connexions et Alembic la migration `0001_initial`. Un processus serveur détient l'autorité sur un seul événement actif.

| Table | Contenu et clé |
|---|---|
| events | id indépendant du nom, version entière, document JSON data de l'événement |
| users | id, nom, rôles, approbation, activité, code personnel haché et date de création |
| sessions | empreinte du jeton de session, user_id, expiration |
| commands | id de commande, auteur, empreinte du contenu, réponse et version obtenue |
| audit | id, événement, auteur, action, horodatage serveur et données utiles |
| photos | id, propriétaire/type, portrait ou plein pied, approbation, consentement, nom de fichier |
| alembic_version | révision du schéma physique |

Les photos JPEG normalisées sont dans le sous-dossier photos du répertoire de données. Les codes sont hachés par PBKDF2-SHA256 avec sel ; les jetons de session ne sont pas stockés en clair. Les sessions durent seize heures, sont révoquées lors d'une restauration et utilisent un cookie HttpOnly, SameSite Strict, Secure sous HTTPS.

## Agrégat de l'événement

Les collections métier sont des objets JSON dotés d'identifiants stables, conservés dans events.data. Il ne s'agit pas d'une table SQL par entité. Ce choix facilite une transaction unique pour le bulletin, la fermeture et le passage suivant. Il impose de passer par les commandes métier pour préserver les références ; aucune écriture SQL manuelle d'exploitation n'est prévue.

| Ensemble | Relations et règles |
|---|---|
| people | identité et participation à l'événement, une section, nationalités, contrôles, mesures, photos et coordonnées privées |
| entries | personne → catégorie ; dossard propre à l'inscription, confirmation, dérogation et origine d'une fusion |
| categories | discipline, section, sexe, âge, règle réglementaire, ordre, quotas et provenance des fusions |
| officials | fiche publique, poste, organisation, photo et pedigree ; indépendante du compte users |
| jury | panel, stagiaires et ordre de retrait ; copié dans les tours |
| rounds | phase, participants, panel, stagiaires, dépendances, délais, bulletins, résultats et versions |
| exam_programs / exam_decisions | tours prévus par juge, décision motivée de la commission |
| public | état confirmé de chaque écran ; aucune conséquence d'un déplacement privé d'un juge |
| rewards | bénéficiaire/version sportive, prix, intitulé, préparation et remise |
| collective_decisions | critère figé, proposition et signatures, liées à la version des résultats |
| rules_snapshot | catalogue numérique et sources figés au démarrage |

La personne et la participation sont réunies dans une fiche locale à l'événement pour cette première version. Il n'existe pas encore de registre fédéral de personnes réutilisable entre événements. Les multiples inscriptions du même événement utilisent bien une seule personne. Les archives sont des dossiers de données et sauvegardes distincts ; il n'y a pas de bibliothèque multi-compétitions dans l'interface.

## Identifiants, versions et concurrence

Un dossard n'est jamais une clé technique. Les bulletins classent des entry_id. Le classement national filtre chaque bulletin commun puis renumérote ses places. Un bulletin conserve son original et les corrections ; les comparaisons d'examen utilisent l'original et une référence chef versionnée.

Un verrou applicatif et une transaction `BEGIN IMMEDIATE` sérialisent les mutations. WAL, `synchronous=FULL` et un délai d'attente SQL sont configurés. Les écritures et leur trace sont validées avant l'accusé. L'identifiant de commande rend un nouvel envoi idempotent ; réutiliser un identifiant pour un contenu différent est refusé.

Les commandes ordinaires exigent la version courante de l'événement. L'envoi d'un bulletin possède un traitement de concurrence particulier : deux juges peuvent envoyer depuis la même version initiale, mais le serveur vérifie toujours la restauration, le tour, le propriétaire, les participants, les droits et la clôture. Un bulletin déjà reçu reste verrouillé.

Le délai des stagiaires et la transition sont évalués avec l'heure serveur. Le service périodique et les commandes utilisent le même verrou ; une transition n'est exécutée qu'une fois. Les émissions WebSocket annoncent seulement un changement de version, puis chaque appareil recharge son état autorisé.

## Contrat d'accès

Les routes sont sous `/api/v1`. `openapi.json` décrit les routes, paramètres et transferts multipart. `CONTRACT.md` décrit l'enveloppe de commande, les payloads et les invariants. Le corps de plusieurs routes JSON utilise une validation métier dans le serveur plutôt qu'un schéma Pydantic par commande : OpenAPI seul ne permet donc pas de générer un client métier exhaustif.

Trois projections distinctes : état privé filtré selon rôle, conducteur speaker authentifié, écran public autorisé. Les listes de bulletins et rapports sont restreintes au propriétaire sauf habilitation d'administration ou de commission. Une URL photo publique cesse de fonctionner si son approbation ou le consentement est retiré, ou si la fiche ne référence plus la photo.

## Sauvegarde et restauration

L'API SQLite backup fournit une copie cohérente sous verrou, réunie avec les photos et le manifeste SHA256 dans une archive ZIP. Des sauvegardes sont réalisées après validation de tours et périodiquement ; une copie externe est possible via le chemin configuré. Une archive contient également les règles et traces conservées dans la base.

La restauration exige un chef ou directeur connecté depuis le serveur. Vérifications de chemins, empreintes, intégrité et schéma précèdent le remplacement. L'ancien état est conservé, la restauration reçoit un nouvel identifiant, les sessions et anciennes commandes sont invalidées. Une erreur de copie testée restaure l'état antérieur. Les téléphones doivent se reconnecter et ne réutilisent pas un brouillon d'une autre restauration.

## Évolution

Une évolution du schéma nécessite une migration Alembic, une sauvegarde et un test de restauration. Une modification du document métier doit gérer explicitement les versions d'agrégat existantes. Ne pas réécrire silencieusement le catalogue figé d'une compétition en cours. Le snapshot de cette livraison porte la version FIBDA-2026-09-22.2 ; les anciennes fixtures de développement incomplètes ne constituent pas des données officielles migrées.
