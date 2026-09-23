# 0001 — Le serveur de compétition est hébergé sur Internet, sur une VM gratuite, pas sur une machine dans la salle

**Statut** : adopté (PO, 23/09/2026)

## Contexte

La compétition a lieu le samedi 26/09/2026. Au 23/09, la base de code suppose un
serveur sur un ordinateur dans la salle (`ARCHITECTURE.md` §1 et §4,
`docs/LANCEMENT.md`) : écoute sur le Wi-Fi local, HTTPS obligatoire hors boucle
locale avec un certificat reconnu par les téléphones, un nom configuré dans le DNS
du routeur de la salle, et SQLite ≥ 3.51.3 exigé par le lanceur. Aucun de ces
points n'a jamais été testé en réel : `docs/PV-RECETTE.md` est vierge, et le poste
de développement (WSL, SQLite 3.45.1) ne peut même pas démarrer en mode réseau.
Le point le plus risqué du projet (`PLAN-J3.md`) est précisément ce HTTPS local
sur téléphone, à monter en deux jours sans machine de salle identifiée.

Le PO a un seul panel de juges, donc peu de téléphones, et propose d'héberger.
Contrainte du PO : service gratuit.

Options examinées :

1. **Serveur dans la salle** (architecture initiale) : aucune dépendance Internet,
   mais certificat à faire accepter par chaque téléphone, DNS local, machine à
   installer, et aucune preuve terrain à J-3.
2. **PaaS gratuit** (Render, Koyeb, Fly.io) : en 2026 Fly.io n'a plus d'offre
   gratuite, Koyeb a fermé son palier gratuit aux nouveaux comptes, Render gratuit
   met le service en veille et n'offre pas de disque persistant. SQLite en WAL sur
   disque éphémère = perte de la compétition au premier redémarrage. Exclu.
3. **VM gratuite « Always Free »** : Oracle Cloud (2 OCPU ARM / 12 Go depuis le
   15/06/2026, carte bancaire et téléphone exigés, capacité ARM parfois
   indisponible selon la région) ou Google Cloud e2-micro. Disque persistant,
   port 443 direct, SSH, contrôle total du Python et de SQLite.

## Décision

Le serveur FIBDA tourne sur une VM Linux hébergée sur Internet, en priorité
Oracle Cloud Always Free (repli : Google Cloud e2-micro, puis un VPS payant
d'entrée de gamme si les deux inscriptions échouent). Le lanceur `launch.py`
termine lui-même le TLS avec un certificat Let's Encrypt, sur le port 443, avec un
nom de domaine gratuit (DuckDNS). Les juges se connectent en HTTPS depuis le Wi-Fi
de la salle ou leur réseau mobile. Le Python du serveur est un Python autonome
installé par `uv` (SQLite embarqué 3.53.1, mesuré le 23/09), ce qui satisfait le
garde-fou SQLite sans le désactiver. Procédure : `docs/DEPLOIEMENT-INTERNET.md`.

## Pourquoi

- Un vrai certificat public supprime le risque n°1 : aucun téléphone n'a de
  certificat à accepter, aucun DNS local à configurer, rien à installer sur place.
- Une VM plutôt qu'un PaaS parce que SQLite exige un disque persistant et que le
  lanceur doit garder le contrôle du TLS et de la boucle locale.
- Le code ne change pas : `launch.py` supporte déjà `--host 0.0.0.0 --public-url
  --cert --key`. Seul l'environnement change.
- Ce que ça coûte : une coupure Internet dans la salle arrête le jugement. Avec un
  seul panel, le réseau mobile des juges est un repli réaliste en Côte d'Ivoire ;
  le plan papier de secours reste obligatoire (`PLAN-J3.md`).

## Conséquences

- `ARCHITECTURE.md` §1 « sans dépendance Internet pendant l'événement » est
  remplacé par « sans dépendance à un réseau local » ; la dépendance Internet est
  assumée.
- Les données d'athlètes potentiellement mineurs vivent sur un serveur exposé :
  pare-feu limité à 22 et 443, sauvegarde rapatriée sur un support local en fin
  de journée, VM détruite ou base effacée après la compétition (à inscrire dans
  `A-FAIRE.md`).
- Les opérations réservées à la boucle locale (`/api/v1/auth/setup`,
  `/api/v1/restore`, `/api/v1/demo`) s'exécutent **sur la VM**, en SSH, avec
  `curl --resolve` vers 127.0.0.1. C'est voulu : personne ne peut initialiser ou
  restaurer depuis Internet.
- Le test sur un vrai téléphone devient possible dès la VM en ligne, avant
  vendredi.
- Reste ouvert : le mode « serveur dans la salle » reste supporté par le code pour
  une édition future sans Internet fiable ; il n'est pas testé pour cette édition.
