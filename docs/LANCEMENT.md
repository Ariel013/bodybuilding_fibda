# Lancement et paquet de distribution

Le lanceur conserve les données hors du programme. Sur macOS : ~/Library/Application Support/FIBDA/Bodybuilding/official ; sur Windows : %LOCALAPPDATA%\FIBDA\Bodybuilding\official ; sur Linux : $XDG_DATA_HOME/FIBDA/Bodybuilding/official ou ~/.local/share/FIBDA/Bodybuilding/official. Le mode --demo utilise le sous-dossier demo. --data-dir permet un emplacement explicite ; ne jamais partager un même dossier entre mode réel et démonstration.

## Préparer une installation source

Installer Python 3.12 ou ultérieur. Depuis application, créer l'environnement avec python -m venv .venv, puis installer requirements.txt avec le Python de cet environnement : .venv/bin/python -m pip install -r requirements.txt sur macOS/Linux ; .venv\Scripts\python.exe -m pip install -r requirements.txt sur Windows. Construire l'interface depuis frontend avec npm ci puis npm run build. Ces opérations exigent des dépendances disponibles avant le déplacement.

Démarrer par scripts/lancer-macos.command ou scripts/lancer-windows.bat. Ces scripts transmettent les arguments au lanceur. À défaut, exécuter .venv/bin/python launch.py --demo pour une formation locale. Sans --demo, l'application démarre l'espace réel. Le premier chef réel est créé par l'initialisation locale de l'application, jamais par un code de production prédéfini.

## Adresse et connexion

Par défaut, le serveur écoute 127.0.0.1:8443 sur l'ordinateur seulement. Le QR représente cette adresse locale et n'établit pas une connexion téléphone. Pour partager sur le réseau, utiliser --host 0.0.0.0 --port 8443 --public-url https://NOM-CONFIGURE:8443 --cert /chemin/certificat.pem --key /chemin/cle.pem. Le lanceur refuse une écoute hors boucle locale sans certificat et clé valides.

Le certificat doit correspondre au nom ou à l'adresse utilisée et être reconnu par les appareils. Fournir un fichier ne prouve pas qu'il est approuvé par les téléphones. Le QR utilise exclusivement --public-url, dont le nom doit correspondre au certificat. Configurer réellement ce nom dans le DNS du réseau ; le lanceur ne crée ni ne devine de DNS. Le lanceur contrôle l'écriture, SQLite et la disponibilité locale du port. Il ne prouve pas l'accès des téléphones ni la qualité du Wi-Fi.

## Mode démonstration

Un événement de démonstration vide reçoit vingt-quatre athlètes fictifs, trois catégories, un chef, quatre juges, un stagiaire, une direction, une régie et un secrétariat. Les comptes reçoivent des codes aléatoires. Un chef existant est conservé. Les contrôles réglementaires et matériels précochés sont exclusivement fictifs. Aucun tour n'est généré par le peuplement ; le programme passe par les commandes ordinaires.

La démonstration est peuplée une seule fois. Conserver les codes présentés au premier lancement selon le mécanisme de l'application. Le helper n'enregistre pas les codes en clair dans l'audit. Les sessions sont créées par l'authentification habituelle.

## Migrations

alembic.ini et migrations contiennent la révision 0001_initial. Le serveur doit fournir l'URL de la base ou sa connexion SQLAlchemy lors de upgrade head. La première révision préserve les tables déjà créées lorsqu'elles correspondent au schéma attendu. Un schéma incompatible doit être examiné avant toute reprise. Le downgrade destructif est interdit : une restauration vérifiée se fait dans un nouvel emplacement.

## Construire un paquet natif

Installer PyInstaller dans l'environnement de construction puis lancer .venv/bin/python scripts/build-package.py --check. La construction s'effectue avec la même commande sans --check. Le frontend compilé, le catalogue, les migrations et la documentation sont inclus. Le paquet apparaît dans dist/FIBDA-Bodybuilding.

PyInstaller construit pour le système où il s'exécute. Construire et tester le paquet Windows sur Windows ; un paquet macOS ne démontre pas la compatibilité Windows. La signature du binaire, le certificat TLS de la fédération et la recette réseau restent des étapes de distribution distinctes. Ne jamais inclure le dossier des données de compétition ni les clés TLS privées dans le paquet distribué.

## Version SQLite

Le lanceur refuse le réseau si la bibliothèque SQLite liée au Python est antérieure à 3.51.3. En boucle locale, il affiche un avertissement. Mettre à jour le runtime Python/SQLite ; la version Python seule ne garantit pas la version SQLite. Aucun contournement pour un backport non documenté n’est prévu. Vérifier avec python -c "import sqlite3; print(sqlite3.sqlite_version)".

Le contrôle du nom du certificat exige une correspondance SAN exacte (DNS ou IP), sans joker et sans repli sur le seul champ CN ; sa période de validité est aussi vérifiée.
