# FIBDA Bodybuilding

Application locale de préparation, jugement, régie et récompenses. Version de développement 0.1.0, réalisée dans un dépôt indépendant du prototype. Les données de compétition restent hors du programme.

## Essayer

La démonstration de contrôle est accessible sur cet ordinateur à http://127.0.0.1:8770. Elle contient des personnes fictives et utilise `/private/tmp/fibda-reception`, sans toucher aux compétitions officielles. Ce dossier temporaire n'est pas un emplacement d'archivage.

Pour lancer une démonstration persistante :

```sh
.venv/bin/python launch.py --demo
```

Ouvrir l'adresse affichée. Créer le premier compte chef, puis utiliser « Créer la démonstration » dans la vue d'ensemble. Les codes des comptes fictifs sont affichés une seule fois lors de leur création. Ne pas les employer pour une compétition réelle.

Le paquet natif local pour Mac Apple Silicon est dans `dist/FIBDA-Bodybuilding`. Conserver ce dossier entier ; l'exécutable seul ne suffit pas. Il n'est pas signé pour distribution publique. La version Windows nécessite une construction sur Windows. Voir `docs/LANCEMENT.md`.

## Développer

Python 3.12 ou supérieur ; SQLite 3.51.3 minimum pour le réseau. Installation reproductible des versions contrôlées : `python -m pip install -r requirements-lock.txt`. Frontend : `cd frontend`, `npm ci`, `npm run build`. Le serveur sert le frontend compilé ; Node n'est pas requis pendant les épreuves dans le paquet autonome.

```sh
.venv/bin/python -m pytest -q
cd frontend
npm test
npm run build
```

`backend/fibda` : API, règles, commandes, workflow, projections, persistance et exports. `frontend/src` : écrans React/TypeScript. `migrations` : schéma Alembic. `scripts` : lancement, construction et dossier Word/PDF. `docs/openapi.json` : routes HTTP ; `docs/CONTRACT.md` : commandes et invariants métier.

## Livraison et exploitation

Lire d'abord `docs/STATUT-LIVRAISON.md`, puis `docs/NOTICE.md`. Le dossier développeur modifiable et sa version PDF sont dans `livrables`. La charte est dans `docs/DESIGN.md`, le référentiel dans `docs/REFERENTIEL.md`, les droits dans `docs/MATRICE-DROITS.md` et le modèle de données dans `docs/MODELE-DONNEES.md`.

Pour les téléphones : lire le guide illustré [Connexion des juges et synchronisation](docs/CONNEXION-JUGES.md). Réseau local, domaine FIBDA, DNS du routeur et certificat HTTPS reconnus par les appareils sont à préparer. Le lanceur refuse l'exposition réseau sans HTTPS. Le serveur reste l'autorité ; une validation sans accusé de réception ne vaut pas bulletin reçu.

Les tests locaux et le paquet Mac contrôlé ne valent pas réception sur iPhone/iPad/Android, Windows, 40 appareils Wi-Fi, écrans de salle et imprimante. Ces essais et la vérification du règlement applicable à l'événement sont décrits dans `docs/RECETTE.md`. État de reprise et prochaine action : `REPRISE.md`.
