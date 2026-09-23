# Déploiement sur Railway (plan B, ADR 0002)

Procédure pour mettre le serveur Python actuel en ligne sur Railway, où le TLS est
terminé par le proxy de la plateforme et où l'application reçoit du HTTP sur
`0.0.0.0:$PORT`. Statut : **rédigée le 23/09, jamais exécutée sur un vrai projet
Railway** (voir §7). Les fichiers du dépôt concernés : `Dockerfile`,
`.dockerignore`, `railway.json`, option `--behind-proxy` de `launch.py`.

## 1. Ce que fait le mode `--behind-proxy`

- Écoute HTTP sans certificat local, autorisée uniquement avec ce drapeau et une
  `--public-url https://…` ; `--cert/--key` y sont interdits. Le port interne ne
  doit **jamais** être exposé directement (le message de démarrage le rappelle).
- Le contrôle SQLite ≥ 3.51.3 reste bloquant (comme en réseau) ; le `Dockerfile`
  installe un Python 3.13 via `uv` (SQLite 3.53.1 mesuré le 23/09) car
  `python:3.13-slim` n'embarque que SQLite 3.46.1 (mesuré le 23/09 avec
  `docker run`). Le build échoue si la version est insuffisante.
- Une requête **passée par le proxy** porte `X-Forwarded-For` ; une requête
  **interne au conteneur** (`curl http://127.0.0.1:$PORT` via `railway ssh`)
  n'en porte pas. `setup`, `restore` et `demo` n'acceptent que les secondes.
- Le cookie de session est toujours `Secure` ; une connexion passée par le proxy
  avec `X-Forwarded-Proto` différent de `https` est refusée (400).
- Le limiteur de tentatives de connexion (15 essais / 5 min) est clé par la
  **dernière** adresse de `X-Forwarded-For`, celle ajoutée par le proxy Railway
  (Railway n'efface pas les valeurs fournies par le client : seule la dernière
  est fiable, réponse du support Railway d'août 2024 sur station.railway.com).
- Hors de ce mode, les en-têtes `X-Forwarded-*` sont ignorés : comportement
  inchangé sur les lancements locaux et VM.

## 2. Compte et outil

```bash
npm i -g @railway/cli
railway login            # compte GitHub, sans carte (essai gratuit)
```

## 3. Projet, volume, variables

Depuis la racine du dépôt :

```bash
railway init                      # nouveau projet, nom libre (ex. fibda)
railway add --service fibda       # service vide, déployé ensuite par railway up
railway volume add --mount-path /data
```

Dans l'interface Railway, onglet *Settings → Networking → Generate Domain* du
service : Railway attribue `NOM.up.railway.app` et demande le port cible ;
indiquer `8080` (le `Dockerfile` écoute sur `$PORT`, que Railway fixe lui-même ;
`8080` est la valeur de repli du `CMD`). Puis la variable, avec ce domaine :

```bash
railway variables --set PUBLIC_URL=https://NOM.up.railway.app
```

`PUBLIC_URL` est obligatoire : sans elle, `launch.py` refuse de démarrer.

## 4. Déployer

```bash
railway up                        # build du Dockerfile sur Railway, puis démarrage
railway logs                      # attendu : « MODE PROXY : TLS terminé par le proxy … »
curl -s https://NOM.up.railway.app/api/v1/health
```

`railway.json` déclare la sonde `/api/v1/health` et le redémarrage automatique.

## 5. Premier chef et restauration (boucle locale du conteneur)

`/api/v1/auth/setup`, `/api/v1/restore` et `/api/v1/demo` refusent toute requête
venue du proxy. Elles se font depuis l'intérieur du conteneur :

```bash
railway ssh
# dans le conteneur : $PORT est défini par Railway
 curl -X POST http://127.0.0.1:$PORT/api/v1/auth/setup \
  -H 'content-type: application/json' -d '{"name":"Nom du chef","code":"CODE-A-CHOISIR"}'
```

Préfixer la commande d'une espace pour qu'elle n'entre pas dans l'historique.
Réponse attendue : `200` (chef créé) ou `409` si un chef existe déjà.

Restauration d'une sauvegarde : copier le zip dans le conteneur (`railway ssh`
n'offre pas de copie de fichier ; passer par `railway run` ou un upload dans un
service de stockage n'a pas été vérifié — voir §7), puis, avec le cookie du chef
obtenu par un login interne :

```bash
 curl -c cookies.txt -X POST http://127.0.0.1:$PORT/api/v1/auth/login \
  -H 'content-type: application/json' -d '{"code":"CODE-DU-CHEF"}'
 curl -b cookies.txt -X POST http://127.0.0.1:$PORT/api/v1/restore -F file=@fibda-sauvegarde.zip
```

## 6. Recette minimale avant de déclarer Railway prêt

1. Téléphone sur réseau mobile : `https://NOM.up.railway.app` s'ouvre, cadenas ok.
2. Ajout à l'écran d'accueil (PWA), ouverture plein écran.
3. Connexion d'un juge, envoi d'un bulletin de test, accusé serveur reçu.
4. Sauvegarde téléchargée depuis le poste chef, copiée hors de Railway.
5. `railway redeploy` : le service revient, l'état sur `/data` est conservé.

Consigner chaque résultat dans `docs/PV-RECETTE.md`.

## 7. Ce qui n'a pas été vérifié

- **Aucun déploiement réel** : ni `railway init`, ni `railway up`, ni le volume,
  ni `railway ssh` n'ont été exécutés (pas de compte Railway dans cette session).
  Les commandes CLI ci-dessus viennent de la documentation Railway et peuvent
  différer selon la version de la CLI.
- Que le proxy Railway ajoute bien `X-Forwarded-For` et `X-Forwarded-Proto` :
  la documentation officielle (`docs.railway.com/networking/edge-networking`)
  ne le dit pas explicitement ; c'est attesté par des réponses du support sur
  station.railway.com (août 2024). Si `X-Forwarded-For` manquait, `setup` serait
  accessible depuis Internet : **vérifier au premier déploiement** que
  `curl -X POST https://NOM.up.railway.app/api/v1/auth/setup` répond `403`.
- Que l'en-tête `Host` (ou `X-Forwarded-Host`) reçu par le conteneur est le nom
  public : sinon les commandes POST du navigateur seront refusées (403 « Origine
  de commande refusée »). Test : une connexion de juge depuis le navigateur.
- Le WebSocket à travers le proxy Railway (le frontend retombe sur
  l'interrogation périodique s'il échoue).
- L'écriture sur le volume par l'utilisateur du conteneur (root dans l'image).
- La copie d'une sauvegarde vers le conteneur pour une restauration.

Ce qui a été vérifié le 23/09 sur ce poste : tests pytest du mode proxy, lancement
réel de `launch.py --behind-proxy` sur 127.0.0.1:8797 avec curl (cookie `Secure`
avec `X-Forwarded-Proto: https`, `setup` refusé 403 avec `X-Forwarded-For`,
accepté 200 puis 409 sans), refus du lanceur sans `--public-url`, avec
`--cert`, et avec SQLite 3.45 ; construction locale de l'image Docker (SQLite
3.53.1 au build) et lancement du conteneur avec `PORT=9123` et `PUBLIC_URL`
(santé 200, `setup` 403 avec `X-Forwarded-For`, 200 depuis `docker exec` sur
127.0.0.1:$PORT, page d'accueil servie). `curl` est présent dans l'image pour
les opérations du §5.

## 8. Après la compétition

Sauvegarde finale rapatriée, puis suppression du service et du volume
(`railway down` ou interface). Données de mineurs : ne pas laisser en ligne.
