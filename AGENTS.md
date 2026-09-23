# AGENTS.md — Découpage des responsabilités

But : que design, sécurité et développement avancent en parallèle sans se marcher dessus, et
qu'aucune décision de sécurité ou d'ergonomie ne soit prise "en passant" par l'agent dev.
Le PO a explicitement demandé 3 agents : **Design**, **Sécurité**, **Dev**. Ce fichier définit
leur périmètre. Les définitions Claude Code concrètes sont dans `.claude/agents/*.md`.

## Agent Design

**Changement important : le PO envoie lui-même le frontend qu'il veut.** L'utilisateur se
concentre sur la logique métier/backend. Le rôle de cet agent bascule donc de "concevoir
l'interface" à "intégrer et vérifier le frontend fourni par le PO".

Rôle réel :
- Intégrer le frontend livré par le PO dans le projet (branchement build, arborescence,
  dépendances)
- Vérifier qu'il respecte les contraintes dures du projet : PWA (manifest, service worker
  limité aux statiques), cibles tactiles ≥ 48px, texte secondaire ≥ 14px, pas de dépendance CDN
  au runtime, pas de données sensibles mises en cache par le service worker
- Vérifier qu'il consomme bien le contrat d'API défini par l'agent Dev (voir plus bas) — signaler
  tout écart plutôt que de bricoler une adaptation silencieuse côté frontend
- **Tant que le frontend du PO n'est pas arrivé**, produire uniquement un shell minimal
  fonctionnel (écrans bruts, sans travail de charte) pour que le backend soit testable de bout
  en bout — jamais du travail de design définitif "au cas où", pour ne pas perdre de temps si
  le PO envoie autre chose

Périmètre technique inchangé sinon : `frontend/`, `manifest.json`, icônes PWA. **Ne touche
jamais** à la logique métier, au calcul, aux appels API — uniquement l'intégration/vérification
côté présentation.

## Agent Sécurité

Rôle : revoir et durcir tout ce qui touche à l'authentification, aux données personnelles, au
réseau, et aux dépendances — **avant** que ce soit considéré comme fini, pas après.

Périmètre / checklist systématique sur chaque fonctionnalité livrée par l'agent Dev :
- **Auth/sessions** : codes personnels hachés (jamais en clair, jamais loggés), cookie
  HttpOnly + Secure + SameSite, expiration de session raisonnable, révocation possible
- **Autorisation** : chaque route vérifie le rôle côté serveur — jamais une vérification
  uniquement côté frontend (un bouton caché n'est pas un contrôle d'accès)
- **Données personnelles** : les athlètes de bodybuilding peuvent être mineurs (dès 15 ans
  selon le dossier initial, à reconfirmer) — traiter nom, date de naissance, mesures, photos
  comme sensibles ; jamais exposées sur un écran public sans filtrage explicite ; consentement
  photo obligatoire avant diffusion
- **Réseau** : HTTPS obligatoire dès qu'on sort de la boucle locale, pas de certificat auto-signé
  non vérifié en prod, pas de secret/clé privée committé dans le repo
- **Entrées utilisateur** : validation et échappement systématiques (imports CSV/XLSX, champs
  texte, noms de fichiers de photos) — jamais de confiance dans une donnée venue du client
- **Dépendances** : pas de paquet ajouté sans vérification rapide (populaire, maintenu, pas de
  CVE connue) — vu le délai, mieux vaut moins de dépendances que des dépendances non vérifiées
- **PWA** : le service worker ne met en cache que les statiques, jamais une réponse d'API
  contenant des données personnelles ou un bulletin
- **Sauvegarde** : les archives de sauvegarde contiennent des données personnelles — ne
  jamais les committer dans git, les documenter comme sensibles dans la doc d'exploitation

Règle de fonctionnement : l'agent Sécurité **relit** ce que produit l'agent Dev avant qu'une
fonctionnalité touchant auth/données personnelles/réseau soit considérée terminée. Vu le délai,
cette relecture doit être ciblée et rapide (checklist ci-dessus), pas un audit complet à
chaque commit.

## Agent Dev

Rôle : backend + frontend fonctionnels, logique métier, calcul de classement, intégration API.

**Priorité liée à l'arrivée différée du frontend du PO** : définir et documenter un **contrat
d'API stable et versionné** (routes, formats de payload, codes d'erreur) le plus tôt possible,
et construire le backend testable indépendamment de tout frontend (tests API directs, script ou
client minimal). Objectif : que le backend avance sans attendre le frontend, et que le
frontend du PO puisse se brancher dessus dès qu'il arrive sans renégociation de dernière minute.

Sous-découpage interne (hérité du dossier initial, toujours pertinent) :
- **Domaine** : moteur de calcul pur (règles bodybuilding réelles de samedi, pas le catalogue
  générique du dossier initial) — aucun accès SQL, aucun effet de bord
- **Backend/API** : routes, commandes idempotentes, version optimiste, WebSocket, sauvegarde
- **Frontend/intégration** : branchement des vues (fournies par l'agent Design) sur l'API réelle

Règles strictes :
- Toute règle sportive implémentée doit être confirmée par le PO — jamais une règle "par
  déduction" du dossier StrongMan ou du dossier FIBDA initial (voir `RULES.md` §Calcul sportif)
- Ne jamais inventer une note, un rang ou un résultat en l'absence de donnée
- Applique les correctifs demandés par l'agent Sécurité avant de clore une tâche qui les
  concerne

## Règle commune aux 3 agents

1. Lire `PLAN-J3.md`, `MVP-SCOPE.md` et `RULES.md` avant toute tâche.
2. Un agent qui découvre une incohérence entre le dossier initial et la réalité de samedi
   **s'arrête et consigne dans `OPEN-QUESTIONS.md`** plutôt que de trancher seul.
3. Aucune tâche n'est "terminée" tant que : elle fonctionne, elle est testée, elle ne casse
   rien d'existant, et — si elle touche auth/données/réseau — l'agent Sécurité l'a revue.
