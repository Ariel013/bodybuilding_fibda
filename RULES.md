# RULES.md — Invariants à ne jamais violer

Extraits condensés du contrat reçu du PO. Si le code envisagé contredit une ligne ci-dessous,
c'est le code qui a tort, pas ce fichier — sauf décision explicite et documentée du PO.

## Droits et rôles

- Rôles : chef, responsable, directeur, juge, stagiaire, secrétariat, régie, speaker, commission
- Le **directeur ne vote jamais**, même s'il cumule un autre rôle
- Un compte inactif ou non approuvé ne peut agir sur rien
- Un stagiaire ne contribue **jamais** au résultat officiel
- Une correction déjà publiée exige chef + un directeur **distinct** — jamais la même personne

## Concurrence et intégrité des données

- Toute commande porte un `id` stable ; la rejouer ne doit jamais produire une seconde écriture
  (idempotence)
- Toute mutation vérifie la version de l'événement attendue ; conflit → 409 → l'appelant relit
  puis revoit son action (jamais de rejeu automatique silencieux)
- Exception : l'envoi de bulletin admet une ancienne version globale, mais le serveur vérifie
  quand même restauration, tour, propriétaire, droits, clôture
- `BEGIN IMMEDIATE` sérialise les écritures — pas d'écriture concurrente non contrôlée
- Le serveur est la seule autorité. "Connecté au serveur" ≠ "bulletin envoyé". Seul un accusé
  explicite = bulletin reçu

## Calcul sportif

- Jury 5/7/9/11 personnes, chef inclus et distinct ; exactement un minimum et un maximum
  retirés par participant
- Classement national : filtrer **chaque bulletin** par nationalité puis **renuméroter** avant
  agrégation — jamais l'inverse
- Égalités : majorité paire à paire, composantes fortement connexes, ordre du chef à
  l'intérieur d'un cycle
- Élimination : comptage sans retrait, quota exact ; égalité au seuil = blocage
  (`pending=true`) jusqu'à décision sportive explicite — jamais un tri arbitraire
- Une finale se calcule **exclusivement** avec ses propres bulletins, jamais de report d'un tour
  précédent
- Overall : dédupliqué par personne ; collectifs : meilleur rang individuel, barème
  10/6/4/3/2/1, départage obligatoire par nombre de 1ères/2èmes/…/6èmes places **avant** tout
  critère personnalisé
- **Jamais de note ou de résultat inventé** en l'absence de donnée (N/D ≠ zéro)
- Examen stagiaire : comparaison sur le bulletin **original**, référence chef gelée à la
  validation et versionnée ; moyenne brute ≥ 85 stricte (84,999… refusé)

## Photos et confidentialité

- Une photo n'est publique qu'après `approved + consent` — révocable à tout moment
- Aucun écran public n'expose bulletin privé, code personnel ou coordonnées privées
- Le nom d'un fichier ne prouve jamais l'identité d'une photo — association explicite obligatoire

## Sauvegarde / restauration

- Sauvegarde = instantané SQLite cohérent + photos + empreintes SHA-256, sous verrou global
- Restauration réservée chef/directeur, depuis le serveur, après validation intégrale de
  l'archive (chemins, empreintes, intégrité, schéma)
- L'ancien état est conservé, jamais écrasé ; nouvelle identité de restauration ; invalidation
  systématique des sessions et anciens brouillons

## Sécurité (checklist de l'agent Sécurité — voir AGENTS.md et .claude/agents/security.md)

- Codes personnels toujours hachés (jamais en clair, jamais dans les logs)
- Cookie de session HttpOnly + Secure + SameSite ; expiration raisonnable ; révocation possible
- Vérification du rôle **côté serveur** sur chaque route sensible — un bouton masqué côté
  frontend n'est jamais un contrôle d'accès
- Athlètes potentiellement mineurs (dès 15 ans) : identité, mesures, photos = données
  sensibles ; jamais sur un écran public sans filtrage ; consentement photo obligatoire avant
  diffusion
- HTTPS obligatoire dès qu'on sort de la boucle locale ; aucun secret ni clé privée committé
  dans le repo
- Validation et échappement systématiques de toute entrée utilisateur (imports, champs texte,
  noms de fichiers) — ne jamais faire confiance à une donnée venue du client
- Toute dépendance ajoutée doit être rapidement vérifiée (maintenue, pas de CVE connue) — mieux
  vaut moins de dépendances que des dépendances non vérifiées, vu le délai
- Service worker PWA : cache uniquement les fichiers statiques, jamais une réponse d'API avec
  des données personnelles ou un bulletin
- Archives de sauvegarde : jamais committées dans git, documentées comme sensibles

## Réseau

- Le lanceur **refuse** toute écoute réseau (hors boucle locale) sans certificat + clé valides
- Un lien `localhost`/`127.0.0.1` ne fonctionne que sur la machine hôte — jamais sur un
  téléphone
- SQLite < 3.51.3 : avertissement en local, **refus** en réseau

## Ce qui ne doit jamais être présenté comme acquis

- Des tests unitaires/ASGI en mémoire ≠ une réception terrain (réseau réel, téléphones réels,
  imprimante, écran)
- Une démonstration avec données fictives ≠ une vérification réglementaire réelle
- Un rapport d'agent qui dit "X tests OK" ne vaut jamais validation métier tant que le
  référentiel sportif n'est pas confirmé par la fédération
