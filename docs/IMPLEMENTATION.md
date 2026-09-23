# Plan d'exécution autorisé — 23 septembre 2026

Le plan utilisateur fait autorité. Développement de l'application, pas simple remise documentaire. Maquette v4 préservée. Application nouvelle dans ce dossier, dépôt isolé car le dépôt parent n'a aucun commit et mélange plusieurs livrables antérieurs.

| Travail | Produit / consommateur | Contrôle de cohérence |
|---|---|---|
| Référentiel / serveur | Fonctions pures catalogue/calcul vers commandes transactionnelles | Les adaptations FIBDA ne se présentent pas comme IFBB Pro League ; 2027 reste à vérifier |
| Serveur / interface | Contrat API commun dans CONTRACT.md | Accusé serveur seul fait foi ; brouillon local ne vaut pas bulletin |
| Serveur / exploitation | Etat filtré vers impressions, import, backup | Profils et bulletins privés exclus du public |
| Chaque lot | Tests puis revue indépendante | Tests locaux distincts de réception 40appareils/matériel |

## Suivi
- [x] 0 Référentiel et décisions consolidées
- [x] 1 Persistance, comptes, API, lanceur, sauvegarde
- [x] 2 Préparation, contrôle/mesures, catégories, programme, officiels
- [x] 3 Jugement, délai stagiaire, transition unique
- [x] 4 Calculs, national, qualifications, overall, examens
- [x] 5 Régie, photos, récompenses, impressions
- [x] 6a Vérifications automatisées et navigateur local ; dossier source et paquet Mac
- [ ] 6b Réception matérielle Windows/Mac propre, téléphones, réseau, écrans et imprimante — voir STATUT-LIVRAISON.md

Décision technique : sérialiser les commandes dans une transaction SQLite BEGIN IMMEDIATE et conserver un agrégat événement versionné avec tables comptes/sessions/commandes/audit. Simple, cohérent pour un événement local et 40appareils ; les sous-objets disposent d'identifiants indépendants. La version du schéma est gérée par Alembic. La matrice de droits et les signatures s'appliquent au serveur.

Hors possibilités de cette machine seule : certificat du domaine FIBDA non fourni, build Windows natif et essais sur le matériel de la fédération. Fournir configuration, scripts et protocoles sans les déclarer reçus.

Les cases ci-dessus décrivent le logiciel livré et ses tests locaux, avec les limites explicites de STATUT-LIVRAISON.md. Elles ne signifient pas homologation ou réception terrain.
