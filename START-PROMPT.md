# START-PROMPT.md — Prompt de démarrage pour Claude Code

> Colle ce texte tel quel comme premier message dans Claude Code, une fois :
> 1. le nouveau repo créé,
> 2. le contenu de `FIBDA-sources-developpeur.zip` décompressé à la racine de ce repo,
> 3. les fichiers de ce dossier de conception (`PLAN-J3.md`, `MVP-SCOPE.md`, `00-PROJECT-BRIEF.md`,
>    `ARCHITECTURE.md`, `AGENTS.md`, `RULES.md`, `OPEN-QUESTIONS.md`, `.claude/agents/*.md`)
>    copiés à la racine également (sans écraser les fichiers de même nom du code source — les
>    mettre dans un sous-dossier `conception/` si collision, sauf `CLAUDE.md` qui doit rester à
>    la racine),
> 4. `FIBDA-application-autonome.html` et le contenu de `FIBDA-kit-testeurs.zip` placés dans un
>    dossier `demo-testeurs/` à la racine (à ne surtout pas confondre avec le code de production).

---

Tu travailles sur **FIBDA Bodybuilding**, une application locale (sans dépendance Internet
pendant l'événement) de gestion de compétition de bodybuilding : inscriptions, jugement sur
téléphone par les juges, calcul des classements, affichage public, récompenses, sauvegarde.

**Contexte critique à ne jamais perdre de vue :**
- La compétition réelle a lieu **samedi 26 septembre 2026**. Nous sommes le 23. Il reste 2 à 3
  jours pleins.
- Je travaille **seul avec toi**, pas d'équipe, pas de relecteur humain systématique.
- **Une base de code substantielle existe déjà** dans ce repo (backend FastAPI/SQLAlchemy/
  SQLite, frontend React/TypeScript) — ce n'est pas un projet à construire de zéro. Elle est
  distincte d'une app précédente que j'ai faite pour un autre sport (le StrongMan,
  `https://github.com/Ariel013/strongmanrepo.git`) — n'y touche pas, ne la clone pas, elle n'a
  aucun rapport avec ce projet-ci.
- L'app doit fonctionner sur téléphone, **au minimum en PWA** (installable, manifest, service
  worker pour les statiques) — à vérifier/compléter si absent de la base actuelle.
- Il existe aussi une **version HTML autonome de démo** (`demo-testeurs/FIBDA-application-autonome.html`)
  qui tourne entièrement dans le navigateur via Pyodide/WASM, sans serveur. **Ce n'est PAS la
  version de production** : chaque appareil garde sa propre copie isolée, aucune synchronisation
  entre téléphones. Elle sert uniquement à la revue UX et à l'entraînement des juges avant
  samedi — ne construis jamais sur cette base pour la vraie compétition.

## Étape 0 — Lis avant de coder, dans cet ordre exact

1. `PLAN-J3.md` — la stratégie et le calendrier à 3 jours (explique pourquoi on audite plutôt
   qu'on reconstruit)
2. `MVP-SCOPE.md` — ce qui doit marcher samedi vs ce qui attend, et le bon usage de la version
   autonome
3. `00-PROJECT-BRIEF.md`, `ARCHITECTURE.md` — contexte et architecture
4. Les documents internes déjà présents dans le code source : `REPRISE.md`,
   `docs/STATUT-LIVRAISON.md`, `docs/CONTRACT.md`, `docs/REFERENTIEL.md`, `docs/PV-RECETTE.md`
   — ce sont des rapports d'un travail antérieur, à vérifier, pas à prendre pour argent comptant
5. `AGENTS.md` et utilise les sous-agents `.claude/agents/design.md`,
   `.claude/agents/security.md`, `.claude/agents/dev.md` pour les tâches de leur périmètre
6. `RULES.md` — invariants métier, techniques et sécurité à ne jamais violer
7. `OPEN-QUESTIONS.md` — questions encore ouvertes, notamment la Q0bis (confirmation qu'on
   réutilise bien cette base de code plutôt que de repartir de zéro) et la Q0 (périmètre exact
   de samedi). N'improvise jamais une réponse à l'une d'elles, pose-moi la question directement.

## Étape 1 — Audite avant de modifier quoi que ce soit

1. Fais réellement tourner la suite de tests backend (`pytest`) et frontend (`npm test`,
   `npm run build`, `npm run typecheck`). `REPRISE.md` annonce 79 tests serveur et 14 tests
   frontend réussis — **vérifie ce chiffre toi-même**, ne le recopie jamais sans l'avoir vu
   passer sous tes yeux.
2. Résume-moi en quelques lignes : est-ce que ça tourne en local tel quel ? Quels écarts
   trouves-tu entre ce que `REPRISE.md`/`docs/STATUT-LIVRAISON.md` annoncent et ce que le code
   fait réellement ?
3. Fais faire une première passe à l'agent `security` sur l'auth, les sessions, les données
   personnelles (athlètes potentiellement mineurs), et les dépendances déjà présentes
   (Pyodide, openpyxl, reportlab, etc. — vérifie qu'aucune n'a de CVE connue).

## Étape 2 — Clarifie le périmètre exact avant d'aller plus loin

Pose-moi explicitement, dans l'ordre :
1. La question Q0bis d'`OPEN-QUESTIONS.md` (confirmer qu'on garde cette base de code)
2. Les questions de `MVP-SCOPE.md` §"Question à trancher immédiatement avec le PO" (catégories/
   athlètes/juges réels de samedi, une ou plusieurs disciplines, besoin d'un overall, Wi-Fi du
   lieu)

Si je ne peux pas répondre tout de suite à un point secondaire, propose une hypothèse
raisonnable **explicitement marquée comme hypothèse** dans `OPEN-QUESTIONS.md`, et avance sans
bloquer sur ce point précis — mais n'avance jamais sans réponse sur la Q0bis, c'est structurant.

## Étape 3 — Complète dans cet ordre de priorité

1. Ajuster le référentiel/catalogue aux catégories réelles de samedi (pas besoin de tout
   réécrire, seulement de vérifier/adapter ce qui concerne les catégories effectivement en jeu)
2. Combler les manques identifiés à l'étape 1 qui touchent au parcours critique : créer un
   événement → inscrire des athlètes → jury sur téléphone → calcul → affichage du résultat
3. Vérifier/compléter le support PWA (manifest, service worker limité aux statiques)
4. Sauvegarde/restauration : confirmer que ça marche réellement, pas seulement dans les tests
5. **Déploiement réseau local HTTPS testé sur un vrai téléphone dès que possible** — c'est le
   point le moins couvert par le travail existant (rien dans `REPRISE.md` ne mentionne un test
   physique réussi) et le plus risqué pour samedi

Tout ce qui n'est pas dans cette liste attend après samedi (examens de stagiaires, collectifs,
5 contextes de régie distincts, exports soignés, packaging natif Windows, etc. — voir
`MVP-SCOPE.md` pour la liste complète de ce qu'on repousse).

## Étape 4 — Discipline de travail (non négociable vu le délai)

- Utilise l'agent `design` pour l'intégration/vérification du frontend existant (le PO peut
  aussi envoyer ses propres retours/ajustements de design — à intégrer par cet agent), l'agent
  `security` pour relire toute tâche touchant auth/session/données personnelles/réseau/
  dépendances avant de la clore, l'agent `dev` pour la logique métier et l'intégration.
- **Aucune tâche à moitié faite.** Une tâche commencée doit être terminée, testée, et laisser
  le repo dans un état qui tourne.
- **Chaque itération a un périmètre annoncé avant de coder, et ce périmètre est tenu** — pas
  d'ajout de scope non demandé "pendant qu'on y est", même si la base existante en offre la
  tentation (elle a beaucoup de fonctionnalités déjà là — ne pas les "améliorer" hors scope).
- **Ne rien casser** : fais tourner la suite de tests existante avant de clore une tâche, en
  plus des tests de la nouveauté.
- Si tu détectes une contradiction entre `REPRISE.md`/la doc et l'état réel du code, ou une
  décision de règle sportive à prendre, **arrête-toi et demande-moi**, plutôt que de deviner.

Commence par l'étape 0 et 1 maintenant, puis résume-moi ce que tu as trouvé (état réel du
code, écarts avec la doc) et les questions de l'étape 2, avant de commencer à modifier quoi
que ce soit.
