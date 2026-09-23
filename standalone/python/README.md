# Pont Python du kit HTML autonome

Ce pont sert aux essais avec des données fictives, dans un navigateur. Il ne se
connecte pas à la base de la compétition et ne modifie pas les modules sources.
Chaque navigateur conserve sa propre copie ; aucun serveur central ne synchronise
des appareils différents.

## Réutilisation du métier

`bridge.py` importe directement les modules originaux `commands`, `preparation`,
`workflow`, `domain`, `projections`, `catalogue`, `printing`, `transfers` et `demo`.
Les calculs, les contrôles des rôles, les versions, les corrections, les examens,
les qualifications et les transitions sont exécutés par ces modules inchangés.

Seule la frontière serveur est remplacée :

- une transaction JSON remplace la base SQL ; toute erreur restaure la copie
  complète prise avant la requête ;
- `new_state`, `dump`, `safe_user`, les constantes de droits, `Problem`, `require`
  et `add_user` sont extraits par AST des fichiers originaux, sans recopier leur
  implémentation ;
- le petit adaptateur de requêtes couvre uniquement les opérations sur les
  utilisateurs nécessaires à `add_user` et à la validation des accès ;
- les routes HTTP sont adaptées à des appels JSON directs, sans FastAPI ;
- le contrôle des photos côté serveur devient un contrôle de format/volume :
  le navigateur décode, recadre et réencode d'abord l'image en JPEG par canvas.

Les comptes de test et leurs codes sont publics dans le kit. Le hash local
`local-test:` n'est pas une authentification sécurisée ; l'application serveur
conserve son mécanisme d'authentification original. Les droits sont néanmoins
contrôlés dans le pont pour tester les parcours fonctionnels.

## Contrat avec le navigateur

Les trois fonctions retournent des chaînes JSON, et non des objets Python :

```python
init(snapshot_json="")
# {"status":200,"data":{"initialized":true,"version":0,"accounts":[...]}}

handle(method, path, body_json="{}", actor_id="")
# {"status":200,"data":...,"headers":{...}}
# Erreur : {"status":4xx,"data":{"detail":"..."}}

snapshot()
# {"format":"fibda-standalone","schema":1,"state":...,"users":...,
#  "audit":...,"commands":...,"photos":...,"previews":...}
```

`init("")` crée 24 personnes fictives dans trois catégories, cinq juges officiels
dont le chef, et un stagiaire. L'événement reste en préparation. Les dossards
sont affectés ; la commande `programme.generate` prépare les tours.

Le navigateur doit sérialiser les commandes et enregistrer le snapshot dans
IndexedDB **avant** d'afficher un accusé de réception. Une réussite Python seule
ne garantit pas encore la persistance dans le navigateur. La session choisie
utilise l'identifiant retourné par `/auth/login`, dans `data.user.id`.

Les routes acceptent le préfixe `/api/v1` ou un chemin relatif, et les paramètres
de requête habituels. Le délai des stagiaires s'appuie sur `time.time()` ;
`POST /tick`, `GET /state` et les lectures des écrans publics évaluent les
transitions. Il faut continuer à appeler `/tick` pendant les essais. Un onglet
suspendu ne peut pas garantir une transition à la seconde exacte : elle sera
réévaluée à sa reprise.

### Routes

| Routes | Format particulier |
| --- | --- |
| `/health`, `/auth/login`, `/auth/logout`, `/auth/me` | JSON ; `/auth/setup` indique que les comptes sont déjà configurés |
| `POST /demo`, `POST /demo/seed` | Sans connexion ; retourne `{codes,state}` du chef existant ; ne réinitialise pas les essais |
| `/state`, `/catalogue`, `/eligibility/{person_id}`, `/speaker`, `/exams`, `/collective`, `/audit` | Projections et droits originaux |
| `POST /command` | `{id,version,type,payload}` ; dédoublonnage par utilisateur et contenu |
| `POST /tick` | `{changed,version}` |
| `/public/{main,secondary,backstage}` | Projection publique filtrée |
| `POST /photos` | `{owner_type,owner_id,kind,data_url}` ; JPEG déjà réencodé |
| `POST /photos/batch` | `{items:[...même format...]}` ; transaction atomique |
| `POST /photos/batch/preview` | `{data_b64,mappings:[{filename,owner_type,owner_id,kind,crop?}]}` ; ZIP vérifié ; retourne `{items:[{...,data_url}]}` à réencoder avant envoi |
| `GET /photos/{id}` | `{data_url}` ; photo privée réservée aux rôles autorisés ; diffusion seulement après approbation et consentement actuels |
| `POST /photos/{id}/approve` | `{consent:true}` |
| `POST /imports/preview` | `{filename,data_b64}` ; import CSV/Excel original |
| `POST /imports/commit` | `{preview_id}` ; aperçu lié à son utilisateur et à la version de l'état |
| `GET /print/{kind}` | HTML original, en-tête `content-type: text/html` |
| `GET /export/{kind}?format=csv\|xlsx` | `{data_b64,mime,name}` ; exports originaux |
| `GET /export/{kind}?format=pdf` | HTML original pour l'impression / l'enregistrement PDF natifs ; pas un fichier PDF binaire |
| `GET /snapshot` | Snapshot complet, réservé à l'administration |
| `POST /backup` | ZIP `{data_b64,mime,name}`, contenant uniquement `snapshot.json` |
| `POST /restore` | `{data_b64}` ZIP ou `{snapshot:objet}` ; chef/directeur ; validation puis `{restore_id,relogin_required:true}` |

Les impressions et exports acceptent `category_id`, `round_id`, `judge_id`.
Les aperçus d'import font partie du snapshot et survivent donc à une reprise.
Les images ne doivent jamais être extraites directement du snapshot pour être
affichées : passer par la route `/photos/{id}` pour préserver les contrôles de
diffusion. Le navigateur conserve une sauvegarde de l'état précédent avant de
confirmer une restauration.

### Comptes fictifs

| Rôle | Code |
| --- | --- |
| Chef | `1111` |
| Juges 1 à 4 | `2001`, `2002`, `2003`, `2004` |
| Stagiaire | `3001` |
| Responsable | `4444` |
| Directeur | `5555` |
| Secrétariat | `6666` |
| Régie | `7777` |
| Speaker | `8888` |
| Commission | `9999` |

## Vérifications

Exécuter séparément des tests serveur : le pont remplace volontairement les
modules de stockage et d'authentification dans son processus Python.

```sh
.venv/bin/python standalone/tests/test_bridge.py
```

Résultat vérifié : **24 tests réussis**, dont import/export Excel avec openpyxl
3.1.5. Les tests couvrent notamment les rôles, les transactions, l'idempotence,
les bulletins, les délais, les invités, les photos/consentements, les imports,
les sauvegardes, les impressions, les corrections à deux signatures et une
compétition complète jusqu'aux overall et à la clôture.

Ces tests Python ne remplacent pas la vérification du chargement Pyodide, de la
persistance IndexedDB, du rendu tactile ou des navigateurs physiques. Ils ne
valident pas non plus une exploitation multi-appareil : cette dernière nécessite
le serveur de compétition. Les archives de ce kit sont un format de test propre,
incompatible avec les sauvegardes SQLite de l'application serveur.
