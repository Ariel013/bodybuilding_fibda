# FIBDA — livraison technique du HTML autonome

Ce dossier produit une **copie locale de test** à partir de l’application existante. Son objectif est de transmettre les écrans et les parcours métier dans un HTML unique, avec données fictives et sans installation serveur. Il ne remplace pas l’architecture de compétition FastAPI/SQLite/WebSocket décrite dans `docs/HANDOFF.md` et `docs/CONNEXION-JUGES.md`.

## Architecture et frontière d’adaptation

| Élément | Réalisation |
|---|---|
| Interface | Sources React/TypeScript existantes, copiées dans `standalone/.build` puis regroupées par esbuild ; adaptations du constructeur limitées à cette copie |
| Règles sportives | Sources originales `backend/fibda/*.py` et catalogue JSON embarqués, exécutés par Python dans le navigateur |
| Runtime | Pyodide 0.28.3, Python 3.13.2 et ressources WASM/stdlib embarquées ; aucune résolution CDN à l’exécution |
| Frontière API | `standalone/src/browser.tsx` intercepte les chemins `/api/v1/` et appelle `standalone/python/bridge.py` |
| Stockage | Agrégat JSON en mémoire Python, puis snapshot IndexedDB dans la base `fibda-autonome-v1` |
| Session de test | Identifiant de compte dans `sessionStorage`, clé `fibda-test-actor` ; codes publics fournis dans le guide |
| Photos | Décodage et redimensionnement par le navigateur/canvas, JPEG embarqué dans le snapshot |
| XLSX | openpyxl 3.1.5 et et_xmlfile 2.0.0, roues Python pures intégrées |
| PDF | HTML imprimable original, puis impression native du navigateur ; pas de ReportLab embarqué |
| Synchronisation | Relecture locale périodique, événements locaux et temporisation locale ; aucun WebSocket ni liaison entre appareils |

Le moteur sportif n’a pas été réécrit en JavaScript. Le pont appelle notamment les commandes, le workflow, les projections, le catalogue, les impressions et les transferts Python existants. Il remplace les dépendances de stockage et d’authentification par une adaptation locale ciblée : définitions extraites par AST, tables de comptes minimales et opérations JSON. FastAPI, SQLAlchemy, la base SQLite, Pillow et le serveur réseau ne s’exécutent pas dans ce HTML.

Les contrôles de rôle du moteur restent utiles aux parcours de test. **Ils ne forment pas une barrière de sécurité dans un document possédé par son utilisateur.** Le pont fournit des comptes publics, leur hash de test et une identité locale modifiable. Employer uniquement des identités et des photos fictives, y compris dans les sauvegardes transmises.

## Exécution, transactions et conservation

`FIBDAPythonRuntime.boot()` initialise Python ; `window.fibdaPython` expose le runtime. Le pont présente les fonctions `init(snapshot_json)`, `handle(method, path, body_json, actor_id)` et `snapshot()`.

La couche navigateur séquence ses commandes, y compris l’initialisation et la réinitialisation. Elle recharge le snapshot courant, exécute le pont, puis attend la fin de la transaction IndexedDB avant de retourner la réponse à l’interface. L’écriture utilise une comparaison atomique du snapshot attendu avec celui présent dans la même transaction IndexedDB (« compare-and-swap »). Un autre onglet ne peut donc pas être écrasé silencieusement par une écriture fondée sur un état plus ancien. Si le stockage échoue, la couche rétablit le dernier snapshot connu et affiche une erreur ; elle ne confirme pas silencieusement l’action. Le pont conserve également une copie avant chaque commande et restaure celle-ci en cas d’erreur. Il réemploie les versions et identifiants de commande pour les conflits et doublons.

Lorsque `navigator.locks` est disponible, un verrou nommé protège en plus les opérations entre onglets de la même origine. Sans cette API, la comparaison atomique IndexedDB reste active. Un conflit de stockage provoque une relecture et une nouvelle tentative, jusqu’à quatre tentatives au total ; les contrôles métier de version restent applicables. Les onglets d’une même copie partagent ainsi leurs données locales. Cela ne crée aucune liaison entre appareils ni autorité serveur. Pour le premier essai, changer de rôle dans un seul onglet reste le parcours le plus simple.

Le composant `LocalLink` adapte les liens de la copie : les écrans possèdent une véritable URL vers le même HTML avec le paramètre `?screen=…`, et les commandes de document deviennent des boutons gérés localement. Ils ne pointent plus vers des routes serveur inexistantes en `file://`. Le speaker reste dans le même onglet pour conserver la session privée ; les écrans publics s’ouvrent dans un autre onglet. Les images issues des routes photo sont résolues par `LocalImage` depuis les données locales.

L’heure de référence est celle de l’appareil. Les délais sont réévalués pendant l’activité ; le navigateur peut suspendre ou ralentir les pages en arrière-plan. La réception serveur durable et l’horloge centrale de la version de compétition restent des fonctionnalités distinctes.

Les brouillons sont isolés sous `fibda-autonome-ballot-drafts`. Une adresse HTTPS stable et dédiée est préférable pour les essais mobiles. Plusieurs copies hébergées sur la même origine peuvent partager la même base IndexedDB : ne pas les annoncer comme des environnements isolés. Le comportement du stockage `file://` dépend du navigateur ; sauvegarder avant déplacement ou remplacement du HTML.

## Construire le livrable

Prérequis de construction : Python 3, Node.js, dépendances frontend du verrou npm et distributions runtime présentes sur disque. Node/Python installés sur le poste ne sont ensuite pas nécessaires pour ouvrir le HTML.

Depuis `application` :

```sh
cd frontend
npm ci
cd ..
python3 scripts/build-standalone.py
```

Les deux constructeurs se répartissent ainsi :

- `scripts/build-runtime.py` fournit `build_runtime_scripts(files)` : licences, ressources binaires, bibliothèques et modules Python. `python3 scripts/build-runtime.py --proof` produit séparément la preuve minimale `standalone/runtime/proof-offline.html`.
- `scripts/build-standalone.py` copie le frontend, applique les adaptations autonomes, intègre logo/police/styles, bundle l’interface et appelle le constructeur runtime. Il écrit `livrables/FIBDA-autonome/FIBDA-application-autonome.html` et `manifest.json`.

Le manifeste final donne taille, SHA256, commit source et empreintes des modules Python (`source_files`). Dans une archive extraite sans dépôt Git propre au projet, `source_commit` vaut `null` ; les empreintes des fichiers restent disponibles. Son champ `adapted_sources` contient aussi les empreintes des sources frontend, des adaptateurs TypeScript/Python et des scripts de construction concernés. Le commit ne décrit pas à lui seul les modifications locales non commitées : conserver également les sources réellement livrées et le manifeste associé. Les remplacements textuels du constructeur doivent être revus après toute évolution du frontend ; une compilation réussie ne suffit pas à garantir leur pertinence.

Le poids du runtime de preuve est d’environ 16,5 Mo. Lire la taille de **l’application finale** dans son propre manifeste : l’interface, les ressources et les licences s’y ajoutent.

## Sources et licences à conserver

Inclure dans la remise développeur : `frontend/src`, `frontend/public/assets`, les manifests/verrous npm, `backend/fibda`, les tests et documents du projet, `standalone/src`, `standalone/python`, `standalone/tests`, `standalone/runtime`, ainsi que les deux scripts de construction. Exclure les données de compétition réelle, sessions, clés privées, bases d’exploitation et sauvegardes réelles. `node_modules` et `.venv` sont des dépendances reconstructibles.

L’exception `!standalone/runtime/` a été ajoutée à `.gitignore` pour permettre le suivi du runtime malgré la règle générique `runtime/`. Le dossier de compilation `standalone/.build/` reste ignoré. Vérifier que l’archive source contient bien les distributions embarquées : les seuls scripts ne suffisent pas à reconstruire un fichier autonome.

`standalone/runtime/manifest.json` fige les versions, URL d’origine, tailles et SHA256. Les fichiers officiels Pyodide restent intacts sur disque. Le constructeur applique deux substitutions exactes et vérifiées au chargeur généré pour fournir les octets WASM intégrés, en conservant les imports requis par Pyodide. Il vérifie les sommes de contrôle avant la construction. Toute mise à jour du runtime exige une nouvelle preuve d’ouverture hors réseau.

Conserver les licences Pyodide, CPython, Emscripten, openpyxl et et_xmlfile du dossier runtime ; elles sont aussi incluses dans le HTML. Préserver les notices et droits des ressources frontend, de React et des assets de la fédération. Le logo et les polices sont embarqués depuis les assets du projet, sans appel de CDN.

## Sauvegarde et restauration de test

Le ZIP autonome contient un seul `snapshot.json` avec `format: "fibda-standalone"`, `schema: 1`, état de démonstration, comptes, journal, commandes, photos et aperçus d’import. Ce n’est **pas** le format de sauvegarde du serveur SQLite. Les deux circuits ne sont pas interchangeables.

La restauration vérifie le format et les relations structurantes, remplace l’état local, change l’identité de restauration, vide commandes/aperçus et déconnecte la session. Le navigateur garde aussi une copie locale précédente sous `before-restore`. Cette dernière n’est pas une archive externe ni une promesse d’interface de récupération. Exporter un ZIP avant une restauration ou une réinitialisation.

## Vérification et réception

Les tests du pont sont dans `standalone/tests/test_bridge.py`. Ils doivent être exécutés dans un processus dédié, car le pont remplace certains modules Python pour sa simulation :

```sh
.venv/bin/python -m unittest discover -s standalone/tests -p 'test_*.py'
```

Les preuves locales disponibles au 23 septembre 2026 sont distinctes :

| Preuve | Résultat attesté |
|---|---|
| `standalone/runtime/proof-results.json` | Preuve minimale du runtime : ouverture Chromium réelle `file://`, 15 tests métier originaux réussis, aller-retour XLSX et absence de ressources réseau externes observées |
| `fibda-wasm-tests.json` | **24 tests du pont exécutés dans Python/WASM, tous réussis**, zéro échec, erreur ou test ignoré ; notamment cycle complet, résultats/overall, délai stagiaire, permissions, correction à deux signatures, import/export et restauration |
| `fibda-browser-proof.json` | **11 contrôles navigateur réussis** sur un HTML ouvert en `file://` : connexion à quatre chiffres, photos recadrées/approuvées, import CSV, export XLSX binaire, bulletins vierges séparés par catégorie, sauvegarde ZIP, restauration avec conservation de la photo, échec de stockage sans fausse confirmation ni mutation, aucune requête externe |
| `fibda-ui-proof.json` et `fibda-reload-proof.json` | **9 contrôles du classement réussis**, puis verrouillage conservé après rechargement : remplacement, annuler/rétablir, complétude, confirmation et blocage des modifications |
| `fibda-responsive-*.json` | **40 contrôles de largeur réussis** : dix rubriques, aux largeurs 320, 390, 768 et 1280 pixels ; aucun débordement horizontal global dans les états visités |
| `typescript.txt` | Contrôle TypeScript de la copie adaptée réussi |
| `fibda-source-rebuild-proof.json` | Reconstruction depuis une extraction sans Git ni `.build` antérieur : HTML identique octet par octet au fichier contrôlé |

Ces preuves, les scripts de recette navigateur et des captures sont conservés dans `livrables/FIBDA-autonome/preuves/` et dans le kit des testeurs. Le `RAPPORT-VERIFICATION.md` joint les relie à l’empreinte du HTML contrôlé. Ces essais ne sont pas des tests sur appareils physiques. Ils n’attestent pas non plus, à eux seuls, tous les scénarios de concurrence entre onglets.

Après toute reconstruction ou évolution fonctionnelle, rejouer les contrôles concernés et conserver la nouvelle empreinte. Le parcours de réception complète couvre préparation, placement tactile, annuler/rétablir, validation/verrouillage, délai stagiaire, résultats, overall, récompenses, photos, documents et sauvegarde/restauration. Vérifier aussi la reprise après fermeture, les opérations simultanées entre onglets avec et sans Web Locks, puis les ouvertures de documents et téléchargements sous chaque navigateur cible.

Restent à réceptionner sur matériel : Safari iPhone/iPad, Chrome Android, gestes tactiles réels, mémoire et temps de chargement, imprimante, affichages, et compatibilité des téléchargements. La charge de 40 appareils, la synchronisation réseau, les certificats HTTPS, les coupures serveur et la restauration de compétition relèvent de l’application serveur et de son protocole de recette. **Le HTML de test ne vaut ni réception matérielle, ni homologation sportive, ni autorisation d’exploitation officielle.**
