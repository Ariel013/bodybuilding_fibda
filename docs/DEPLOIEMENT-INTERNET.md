# Déploiement sur une VM Internet (ADR 0001)

Procédure pour mettre le serveur FIBDA en ligne sur une VM Linux gratuite, avec
HTTPS Let's Encrypt, avant la compétition du 26/09/2026. Statut : **rédigée le
23/09, pas encore exécutée sur une vraie VM** ; chaque étape se coche dans
`A-FAIRE.md` quand elle a été faite et vérifiée.

Hypothèses : Ubuntu 24.04 (ARM ou x86), accès SSH avec un utilisateur `ubuntu`
qui a `sudo`, nom DuckDNS `NOM.duckdns.org` déjà pointé sur l'IP publique.

## 1. Ouvrir uniquement 22, 80 et 443

Sur Oracle Cloud, deux pare-feux : la « security list » du VCN (console web,
règles entrantes TCP 80 et 443 depuis 0.0.0.0/0) **et** iptables dans la VM :

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Le port 80 ne sert qu'au renouvellement Let's Encrypt (HTTP-01).

## 2. Python autonome avec SQLite récent

Le lanceur refuse le réseau si SQLite < 3.51.3. Les Python d'`uv` embarquent
leur propre SQLite (3.53.1 mesuré le 23/09 avec CPython 3.13.15).

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.local/bin/env
uv python install 3.13
sudo apt-get install -y git nodejs npm certbot
```

## 3. Code et build

```bash
git clone <URL DU DÉPÔT> ~/fibda && cd ~/fibda
uv venv --python 3.13 .venv
uv pip install --python .venv/bin/python -r requirements.txt
(cd frontend && npm ci && npm run build)
.venv/bin/python -c "import sqlite3; print(sqlite3.sqlite_version)"   # attendu ≥ 3.51.3
```

## 4. Certificat

```bash
sudo certbot certonly --standalone -d NOM.duckdns.org --agree-tos -m ADRESSE@EXEMPLE
sudo install -d -o ubuntu -g ubuntu -m 700 /home/ubuntu/tls
sudo install -o ubuntu -g ubuntu -m 600 /etc/letsencrypt/live/NOM.duckdns.org/fullchain.pem /home/ubuntu/tls/cert.pem
sudo install -o ubuntu -g ubuntu -m 600 /etc/letsencrypt/live/NOM.duckdns.org/privkey.pem   /home/ubuntu/tls/key.pem
```

Le certificat vaut 90 jours : aucun renouvellement nécessaire avant samedi.
Ne jamais copier ces fichiers dans le dépôt.

## 5. Service systemd

`/etc/systemd/system/fibda.service` :

```ini
[Unit]
Description=Serveur FIBDA Bodybuilding
After=network-online.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/fibda
ExecStart=/home/ubuntu/fibda/.venv/bin/python launch.py --host 0.0.0.0 --port 443 \
  --public-url https://NOM.duckdns.org --cert /home/ubuntu/tls/cert.pem --key /home/ubuntu/tls/key.pem \
  --data-dir /home/ubuntu/fibda-data/official
AmbientCapabilities=CAP_NET_BIND_SERVICE
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now fibda
sudo journalctl -u fibda -f      # attendu : « Uvicorn running on https://0.0.0.0:443 »
curl -s https://NOM.duckdns.org/api/v1/health
```

Pour une répétition avec données fictives, un second service identique avec
`--demo --data-dir /home/ubuntu/fibda-data/demo` sur un autre port et un autre
nom ; jamais le même dossier de données.

## 6. Opérations réservées à la boucle locale

`/api/v1/auth/setup` (premier chef), `/api/v1/restore` et `/api/v1/demo`
n'acceptent que 127.0.0.1. Depuis un SSH sur la VM, `--resolve` fait passer la
requête par la boucle locale tout en gardant le nom du certificat :

```bash
curl --resolve NOM.duckdns.org:443:127.0.0.1 -X POST https://NOM.duckdns.org/api/v1/auth/setup \
  -H 'content-type: application/json' -d '{"name":"Nom du chef","code":"CODE-A-CHOISIR"}'
```

Restauration : même principe avec `-F file=@fibda-sauvegarde.zip` après connexion
chef. Le code du chef ne se tape jamais dans l'historique du shell : préfixer la
commande d'une espace ou utiliser `read -s`.

## 7. Recette minimale avant de déclarer la VM prête

1. Depuis un téléphone sur réseau mobile puis sur le Wi-Fi de la salle :
   `https://NOM.duckdns.org` s'ouvre sans avertissement de certificat.
2. Ajouter à l'écran d'accueil (PWA) : icône FIBDA, ouverture plein écran.
3. Connexion d'un juge, envoi d'un bulletin de test, accusé serveur reçu.
4. Sauvegarde téléchargée depuis le poste chef, copiée hors de la VM.
5. Redémarrage de la VM : le service revient seul, l'état est conservé.

Consigner chaque résultat dans `docs/PV-RECETTE.md`.

## 8. Après la compétition

Sauvegarde finale rapatriée, puis `sudo systemctl stop fibda` et suppression de
`/home/ubuntu/fibda-data`, ou destruction de la VM. Données de mineurs : ne pas
laisser en ligne.
