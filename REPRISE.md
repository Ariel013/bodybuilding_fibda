# Reprise — FIBDA Bodybuilding, 23 septembre 2026

## Objectif et autorisation

L’utilisateur a demandé l’implémentation du plan complet et une interface téléphone simple, ergonomique et intuitive, avec explication des connexions et de la synchronisation. Application isolée dans ce dossier ; maquette v4 et données des autres projets préservées. Dépôt autonome, branche `codex/fibda-application`. Aucun déploiement externe ni utilisation officielle.

## Décisions conservées

FastAPI, SQLAlchemy, SQLite local, React et TypeScript. Le serveur fait autorité ; une validation n’est reçue qu’après écriture et accusé serveur. Version 0.1.0, catalogue FIBDA-2026-09-22.2, figé au démarrage de l’événement. Variante A : glisser ou toucher dossard puis rang, remplacement sans décalage, annuler/rétablir, validation finale. Dernier bulletin officiel puis dernier stagiaire attendu ou délai de 60 secondes. Aucune action privée ne commande l’écran public.

Le juge et le stagiaire arrivent directement dans Mon jugement. QR commun ou adresse HTTPS sur le Wi-Fi de la salle, puis code personnel approuvé. Brouillons IndexedDB locaux, synchronisation WebSocket et interrogation de secours toutes les 10 secondes. Voir `docs/CONNEXION-JUGES.md`, relu indépendamment contre le code.

## Travail présent

Socle et comptes, préparation, mesures/catégories, inscriptions multiples, programme et dossards, officiels/pedigree, jugement, calculs et qualifications, overall et examens, régie, photos, récompenses, impressions, sauvegarde/restauration, démonstration et lanceur implémentés. Les limites précises restent dans `docs/STATUT-LIVRAISON.md` ; il ne s’agit pas d’une réception matérielle ou fédérale.

## Correctif demandé — codes de connexion, 23 septembre 2026

- Demande : minimum de 4 caractères au lieu de 10. Appliqué à la création du chef, aux invitations et au formulaire de connexion. Maximum 128 conservé ; anciens codes toujours valables, aucune réinitialisation ni migration.
- Codes numériques ou alphanumériques possibles ; zéros initiaux conservés. Unicité et droits inchangés. La démonstration peut continuer à générer des codes plus longs.
- Deux nouveaux tests API : création/connexion `0042` et `J042`, refus des codes de 3 ou 129 caractères, refus du doublon, persistance après réouverture et reconnexion avec un ancien code long. Suite : **79 tests et 2 sous-tests réussis**, deux avertissements de dépréciation existants. Preuve : `docs/preuves/pytest-codes-courts.txt`.
- TypeScript/build Vite réussis ; Chromium vérifie les deux champs à minimum 4, le refus de 3 à la connexion et l’accès avec le code chef existant. Preuves : `docs/preuves/frontend-build-codes-courts.txt` et `codes-courts-navigateur.json`.
- Serveur 8770 relancé avec les mêmes données ; empreinte intégrale de l’événement identique avant/après, dont les bulletins déjà reçus. Preuve : `docs/preuves/codes-courts-redemarrage.json`.
- PDF/Word régénérés, 41 pages ; revue ciblée des pages modifiées 15, 35 et 39. Paquet Mac reconstruit ; création et connexion à quatre caractères vérifiées sur base officielle temporaire isolée. Manifestes actualisés et empreintes contrôlées par le parent.
- Revue indépendante des chemins d’authentification : aucun autre minimum bloquant trouvé. Aucun changement des résultats sportifs ni déploiement externe. Prochaine action : recharger l’interface pour employer un code court lors de la création d’un nouvel accès ; la réception matérielle demeure à réaliser.

## Preuves fraîches

- Serveur : 77 tests et 2 sous-tests réussis en 19,86 secondes ; deux avertissements de dépréciation, aucune erreur. `docs/preuves/pytest.txt`.
- Interface : 14 tests, contrôle TypeScript et build Vite réussis. `docs/preuves/frontend-*.txt`.
- Revue indépendante : calculs, transitions, corrections, examens, projections et restauration ; aucun nouveau défaut bloquant confirmé après corrections.
- Parcours API : 24 personnes, trois catégories, deux disciplines, huit tours et clôture.
- Charge synthétique : 40 identités et 100 rangs, concurrence et idempotence, SQLite réel ; transport ASGI en mémoire, pas 40 appareils Wi-Fi.
- Chromium 390 × 844 et 1280 pixels : connexion directe du juge, placement et remplacement, annuler/rétablir, reprise du brouillon, accusé puis verrouillage conservé au rechargement, droits documentaires personnels. Dernière interface : validation visible à y=709–758, pas de débordement horizontal. Fiche athlète séparée avec mesures confirmées, sans coordonnées privées.
- Captures de l’application dans `docs/captures`. Détail dans `docs/REPORT-RECETTE-LOCALE.md`.
- Redémarrage du serveur source : version 0.1.0, SQLite 3.53.1, identité de restauration et bulletin reçu du chef conservés.
- Dossier PDF et Word final : 41 pages chacun, sept tableaux réels et trois captures téléphone ; toutes les pages contrôlées par le sous-agent, empreintes revérifiées par le parent et contrôle visuel complémentaire des pages téléphone. `docs/document-smoke.json`.
- Paquet Mac Apple Silicon reconstruit avec les ressources finales : santé, logo, catalogue, démo de 24 personnes, sauvegarde et redémarrage contrôlés ; empreinte du binaire revérifiée. `docs/package-smoke.json` et `docs/REPORT-PACKAGE.md`. Paquet dans `dist/FIBDA-Bodybuilding`, données hors programme.

## Démo locale

Serveur source sur http://127.0.0.1:8770, données fictives dans `/private/tmp/fibda-reception`. Premier jugement ouvert ; bulletin du chef reçu, autres juges disponibles. Ce serveur écoute seulement sur l’ordinateur. Le dossier temporaire n’est pas un archivage. Vérifier `/api/v1/health` avant reprise.

## Réserves

Windows et Mac propre, certificats/DNS réels, iPhone/iPad/Android et gestes tactiles physiques, 40 appareils Wi-Fi, charge de 300 athlètes, imprimante, écrans, restauration sur un autre ordinateur et panne électrique restent à réceptionner. Registre fédéral transversal et bibliothèque d’archives dans l’interface non livrés. Lanceur terminal avec QR ; pas d’assistant natif graphique. OpenAPI des routes et contrat JSON documenté, pas de modèle typé exhaustif pour chaque commande. Vérifier le règlement applicable à 2027 et les admissions encore à confirmer.

## Compteur commun

Projet rattaché à `329310bd8c99fb73`, encore nommé historiquement « Bodybuilding competition — transcription vidéo ». Le jalon « Application FIBDA 0.1 — recette locale » est consigné avec preuve. La commande `phase` échoue avec « Journal absent, lié ou supérieur à 64 Mio. » ; aucun bilan de phase actualisé n’est annoncé. Aucun temps, token ou coût inventé. Projet non clôturé.

Le jalon « Codes de connexion FIBDA : minimum 4 caractères » est également consigné. Nouvelle tentative `phase` : même erreur de journal ; la mise à jour du logiciel et ses preuves sont conservées, sans annoncer de bilan cumulatif régénéré.

## Consultation design — 23 septembre 2026

- Autorisation : skill `design-consultation` explicitement invoqué sur l’application 8770. Travail limité au diagnostic et à une proposition séparée ; aucune modification des sources applicatives, accès, données ou bulletins.
- Livrable : `docs/CONSULTATION-DESIGN-2026-09-23.md`, trois écrans interactifs (jugement téléphone, connexion, poste central), charte et diagnostic. Aperçu sur http://127.0.0.1:8771/ ; HTML autonome et captures dans `/Users/m.b.p.m.1/.gstack/projects/Bodybuildingcompetition/designs/consultation-20260923/`.
- Direction conservée : menthe/encre/verre dépoli, Manrope embarquée, logo original sur blanc, aucun filigrane. Navigation mobile compacte et défilement commun proposés ; mode sombre seulement exploratoire. `docs/DESIGN.md` demeure la référence adoptée.
- Preuves : revue indépendante, treize contrôles interactifs réussis (`docs/preuves/design-consultation-interactions.json`), contrastes des paires opaques calculés (`design-consultation-contrastes.json`), contrôles visuels des trois maquettes. À 390 × 844, sept dossards entiers visibles contre environ trois dans l’écran actuel ; à 320 × 740, pas de débordement horizontal et validation visible.
- Deux défauts propres à l’aperçu corrigés : réinitialisation pendant la réception simulée et retour en réserve absent. Les gestes tactiles physiques, grands groupes et tous les états translucides restent à réceptionner. Les tests de cet aperçu ne valident pas une intégration serveur.
- Prochaine action design : recueillir le retour utilisateur sur l’aperçu, puis intégrer la direction retenue. Aucune réponse aux premières questions de consultation n’a encore été reçue ; le silence n’est pas traité comme une approbation.
- Compteur : jalon de consultation consigné avec son dossier comme preuve. La tentative de bilan `phase` échoue encore avec « Journal absent, lié ou supérieur à 64 Mio. » ; aucun nouveau bilan cumulatif archivé n’est annoncé et le projet reste ouvert.

## Prochaine action de mise en service

Livraison locale 0.1.0 contrôlée ; conserver les sources, le dossier Word/PDF et les preuves dans le dépôt autonome de l’application. Le paquet construit et les données temporaires de démonstration ne sont pas archivés dans Git. La prochaine étape est la configuration du réseau HTTPS et la répétition fédérale à l’aide de `docs/PV-RECETTE.md`, avec appareils, écrans, imprimante et ordinateur de secours réels. Ne pas déclarer la réception officielle acquise sur la base des contrôles locaux.

## HTML autonome demandé — 23 septembre 2026 (livraison de test)

- Objectif et autorisation : partager l’application actuelle avec développeur et testeurs dans un HTML responsive indépendant du serveur. Aucune adoption implicite de la consultation design 8771 ; version serveur 8770, sources métier et données préservées.
- Réalisation isolée : `standalone/` et `scripts/build-standalone.py`. Interface React existante, moteur Python original dans Pyodide/WASM, ressources et polices embarquées. API locale, photos/canvas, imports CSV/Excel, documents, sauvegarde/restauration ZIP. Aucun CDN à l’exécution.
- Fichier : `livrables/FIBDA-autonome/FIBDA-application-autonome.html`, 20 119 122 octets ; SHA256 `9ff5389ab1476835233ae96679a5863980fd8ecde47ad419007c7f333a89aea6`. Codes publics à quatre chiffres, chef `1111`, 24 athlètes fictifs initiaux. Les saisies de recette ne sont pas embarquées dans ce fichier.
- Livrables : kit des testeurs ZIP avec application/notice/preuves/licences ; sources développeur ZIP avec code, runtime, documentation et inventaire SHA. Notices dans `standalone/` ; compte rendu final et preuves dans `livrables/FIBDA-autonome/`. Page d’entrée locale sur http://127.0.0.1:8772/ ; cette adresse ne fonctionne que sur cet ordinateur.
- Preuves sur le HTML final : 24 tests du pont exécutés dans Python/WASM ; 11 contrôles navigateur de connexion, photos, import/export, documents et sauvegarde ; 9 contrôles du classement ; verrouillage conservé au rechargement ; 40 vérifications de largeur (dix rubriques à 320, 390, 768 et 1280 px), sans débordement horizontal global dans les états visités. TypeScript de la copie adaptée réussi. Captures examinées visuellement. Les 15 tests du runtime minimal constituent une preuve distincte.
- Revue indépendante : écritures conditionnelles atomiques IndexedDB, sérialisation du démarrage/réinitialisation, accusé après commit local ; écran speaker conservant sa session dans le même onglet. Débordement à 320 px corrigé dans la copie. Constructeur corrigé pour archive sans Git et génération systématique du tsconfig ; reconstructions propres identiques octet par octet. Aucun commit Git parent hérité.
- Paquets contrôlés : CRC, SHA et listes d’entrées ; données d’exploitation, clés et caches exclus. Licences Pyodide/Python/Emscripten/openpyxl/et_xmlfile, Manrope, React/React DOM/Scheduler présentes. Sources à réemballer avec `python3 standalone/package-sources.py` après toute modification documentaire ; kit par `python3 standalone/package-testkit.py` (module Python markdown nécessaire).
- Réserves : chaque appareil conserve une copie indépendante ; aucune synchronisation de jury entre appareils. Sauvegarde autonome distincte de SQLite serveur. Codes de démonstration publics, données fictives uniquement. Les tests physiques Safari/iPhone/iPad/Android, gestes tactiles, téléchargement et imprimante restent à faire ; pas de garantie universelle. Publication Internet en attente du choix demandé à l’utilisateur ; aucune publication effectuée.
- Compteur : jalon de validation consigné avec le rapport de vérification comme preuve. `phase` échoue encore sur « Journal absent, lié ou supérieur à 64 Mio. » ; aucun nouveau bilan cumulatif archivé annoncé. Projet non clôturé.
- Prochaine action : transmettre les fichiers, recueillir scénarios et sauvegardes fictives des testeurs ; préparer un hébergement HTTPS dédié si le lien public est confirmé. La recette réseau central et les appareils physiques relèvent toujours de la version serveur.
