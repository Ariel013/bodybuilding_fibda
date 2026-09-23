# Runtime Python autonome FIBDA

Le constructeur `../../scripts/build-runtime.py` produit les éléments `<script>`
pour intégrer Python et ses bibliothèques dans un unique fichier HTML. Aucune
installation Python, aucun CDN et aucun serveur ne sont nécessaires à son
exécution. La version est figée : Pyodide 0.28.3, Python 3.13.2.

## Contrat d'intégration

Depuis Python, importer `build-runtime.py` avec `importlib.util`, puis appeler :

```python
scripts = runtime_builder.build_runtime_scripts({
    '/home/pyodide/fibda/__init__.py': '',
    '/home/pyodide/fibda/domain.py': original_domain_source,
    '/home/pyodide/bridge.py': bridge_source,
})
```

Insérer `scripts` avant le démarrage de l'application React. Toutes les sources
transmises sont des chaînes UTF-8 ; les chemins doivent commencer par
`/home/pyodide/`. Les sources métier ne sont pas modifiées par ce constructeur.

```javascript
const runtime = await FIBDAPythonRuntime.boot({onProgress: message => show(message)});
// Le moteur brut est accessible des deux façons.
runtime.python === window.fibdaPython;
const reply = await runtime.call('bridge', 'handle', {action: 'state'});
// Équivalent direct si le pont existant attend une chaîne JSON :
window.fibdaPython.globals.set('request_json', JSON.stringify(request));
const replyJson = await window.fibdaPython.runPythonAsync('handle(request_json)');
```

`runtime.call(module, method, payload)` transmet un unique argument Python (objet
JSON) et attend un résultat sérialisable en JSON. Les appels par cette méthode
sont séquencés. `evaluateJson(expression)` est un utilitaire de tests destiné au
code de l'application, pas une entrée utilisateur.

Le moteur retourne aussi sa version. `boot()` est idempotent dans la page. Il
peut recevoir des fichiers supplémentaires via `files`, avec priorité sur les
fichiers embarqués par le constructeur. Les erreurs remontent par la promesse.

## Bibliothèques et licences

- Pyodide 0.28.3 et bibliothèque standard : distribution officielle, sources et
  sommes SHA-256 dans `manifest.json` ; MPL-2.0 incluse.
- CPython 3.13.2 : licence incluse.
- Emscripten 4.0.9 : licence incluse.
- openpyxl 3.1.5 et et_xmlfile 2.0.0 : roues Python pures officielles PyPI,
  licences incluses et décompression locale, sans `loadPackage` ni `micropip`.

Les licences sont également insérées dans le HTML sous la forme d'un bloc JSON
`fibda-runtime-licenses`.

Le chargeur officiel `pyodide.js` reste intact sur disque. Le constructeur
effectue **deux remplacements exacts contrôlés** pour transmettre les octets WASM
embarqués au code officiel d'instanciation. L'initialisation des imports
`sentinel`, nécessaire à cette version, est préservée. Si les marqueurs ne
correspondent plus, le constructeur échoue au lieu de produire un document
incorrect. Aucun global `fetch` n'est détourné.

## Preuve reproductible

Depuis le dossier `application` :

```text
python3 scripts/build-runtime.py --proof
```

Ouvrir `proof-offline.html` dans un navigateur, directement avec `file://`.
Ce fichier utilise une CSP interdisant les connexions externes ; seules les URL
`blob:` locales sont permises pour le chargement de la bibliothèque standard.

Contrôle Chromium gstack du 23 septembre 2026, archivé dans
`proof-results.json` :

- `file:` réel, calcul `2+2=4` ;
- imports Decimal, Fraction, datetime, UUID et hashlib ;
- appel du module `fibda.domain` original ;
- **15 tests originaux `test_domain.py` et `test_catalogue.py` réussis** ;
- export puis réimport XLSX : texte accentué et nombre identiques ;
- aucune ressource réseau dans les mesures navigateur.

Taille du HTML de preuve : environ **16,5 Mo**, comprenant les licences, les
modules et tests de preuve. Le frontend et les médias ajoutent leur propre poids.

## Limites

Il faut un navigateur prenant en charge WebAssembly et autorisant JavaScript.
Le résultat Chromium ne constitue pas une recette Safari/iPhone/Android. Les
visualiseurs de pièces jointes qui n'exécutent pas JavaScript ne peuvent pas
faire fonctionner une application HTML ; il faut un vrai navigateur.

Le runtime assure l'exécution Python. La persistance, les sessions de test,
les sauvegardes, la synchronisation et les adaptations serveur relèvent du pont
de l'application. Il n'embarque pas FastAPI, SQLAlchemy, Pillow ni ReportLab.
Les opérations de fichier et sockets natives d'un serveur ne deviennent pas
disponibles dans le navigateur.
