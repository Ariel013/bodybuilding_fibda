# FIBDA — sources destinées au développeur

Cette archive accompagne le HTML autonome de test FIBDA. Elle contient les
sources réellement présentes lors de son emballage, les distributions Python/WASM
figées et leurs licences. Elle ne contient aucune base de compétition ni session
de production. Les codes présents dans les fixtures et le guide sont des codes
publics de démonstration ; employer des personnes et photos fictives pour les essais.

## Lire en premier

- `standalone/LIVRAISON-DEVELOPPEUR.md` : architecture, frontière d'adaptation,
  persistance locale, preuves disponibles et limites du HTML.
- `standalone/NOTICE-TESTEURS.md` : ouverture, comptes de test et parcours.
- `docs/HANDOFF.md`, `docs/CONTRACT.md`, `docs/DESIGN.md` : application serveur,
  contrats métier et charte adoptée.
- `REPRISE.md` : historique et réserves. Les références à une consultation design
  séparée ne signifient pas que ses propositions sont adoptées ; ces fichiers sont exclus.

## Reconstruire le HTML

Dans le dossier extrait, installer les prérequis Node.js et Python, puis :

```sh
cd frontend
npm ci
cd ..
python3 scripts/build-standalone.py
```

Le résultat est `livrables/FIBDA-autonome/FIBDA-application-autonome.html`.
La construction ne lance pas de serveur et ne modifie pas les sources backend
ou frontend. Les ressources runtime sont déjà incluses ; npm ci nécessite l'accès
aux dépendances npm. Le HTML construit n'a pas besoin de CDN pendant son utilisation.
Les prérequis, tests et instructions propres au serveur sont dans `README.md`.

Chaque appareil conserve sa copie indépendante. Le HTML n'assure aucune
synchronisation de juges entre appareils ; il ne remplace pas le serveur central.
La réception Safari/iPhone/Android et imprimante demeure à effectuer. Les
visualiseurs de pièces jointes peuvent ne pas exécuter l'application : ouvrir le
HTML dans un navigateur récent. La compatibilité universelle n'est pas garantie.

## Inventaire et vérification

`MANIFEST-SOURCES.json` donne taille et SHA-256 de chaque entrée, hormis lui-même.
Les entrées sont triées, leurs dates et permissions ZIP sont fixes. Le constructeur
`standalone/package-sources.py` contrôle les noms, les signatures usuelles de secrets,
les empreintes des distributions runtime, la CRC et chaque SHA-256 après création.
Ce contrôle automatique ne remplace pas une revue humaine des fichiers à partager.

Le HTML généré, node_modules, .venv, caches, .build, Git, fichiers d'environnement,
clés/certificats, données et sauvegardes d'exploitation sont exclus. La consultation
design non adoptée et la preuve HTML runtime volumineuse sont également exclues.
Les preuves de développement incluses concernent des essais fictifs locaux ; les
adresses de boucle locale et chemins temporaires qu'elles citent ne sont pas des
liens de diffusion. Les anciennes preuves ne valent pas recette du nouvel HTML.

Les distributions Pyodide/CPython/Emscripten/openpyxl/et_xmlfile et licences restent
dans `standalone/runtime/`. La police et sa licence sont dans `frontend/public/assets/`.
Les notices React, React DOM et Scheduler sont dans `licenses/frontend/`.

Pour reproduire cette archive, depuis le dossier extrait :

```sh
python3 standalone/package-sources.py
```

Le fichier final HTML est remis à côté de cette archive. Son manifeste et le rapport
de vérification sont inclus dans livrables/FIBDA-autonome. Une reconstruction future doit être testée
et accompagnée d'une nouvelle empreinte et de nouvelles preuves appropriées.
