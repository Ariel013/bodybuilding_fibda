# 🧭 Journal de bord — FIBDA Bodybuilding

> **Nouvelle session : LIS CE FICHIER EN PREMIER**, puis `CLAUDE.md`. Tu sauras
> où on en est, quoi faire ensuite et quoi éviter — sans relire tout le code.
>
> **Discipline** :
> 1. Au **démarrage** : lire les trois sections ci-dessous, puis agir / proposer.
> 2. En **fin de session** : mettre à jour « État & prochaine action », ajouter
>    une entrée au journal des sessions, consigner toute erreur en « Leçons ».
> 3. Convertir les dates relatives en absolues. Rester concis.

Carte des documents :
- `PLAN-J3.md`, `MVP-SCOPE.md` : stratégie et périmètre pour samedi 26/09/2026.
- `docs/decisions/0001-*.md`, `0002-*.md` : hébergement Internet ; réécriture TypeScript serverless.
- `docs/DEPLOIEMENT-VERCEL.md` (cible), `docs/DEPLOIEMENT-RAILWAY.md` (plan B Python).
- `A-FAIRE.md` : actions manuelles du PO. `OPEN-QUESTIONS.md` : questions ouvertes et relevés de portage.
- `RULES.md` : invariants. `docs/CONTRACT.md` : contrat d'API partagé par les deux backends.
- `REPRISE.md`, `docs/STATUT-LIVRAISON.md` : rapports du travail antérieur (Python), vérifiés le 23/09.

---

## 📍 État actuel & prochaine action

*(Mis à jour le 2026-09-23, soir.)*

- **Version en prod** : aucune. Rien n'est déployé, aucun test sur téléphone réel.
- **Code** : branche `main`, 4 commits depuis l'import. Version TypeScript committée
  (`a4258e9`) : `npm run check` = 77 tests verts. Plan B Python mode proxy Railway : écrit,
  91 tests verts, **non committé**, relecture sécurité en cours.
- **Bloqué par le PO** : comptes Turso et Vercel (déploiement cible), compte Railway (plan B),
  réponses Q0ter (overall par discipline ou confondu), Q0quinquies (codes admin 8 caractères),
  Internet de la salle et 4G de secours.
- **Prochaine action** : dès les comptes Turso + Vercel créés, déployer la version TypeScript
  (`docs/DEPLOIEMENT-VERCEL.md`), créer le chef avec le jeton, ouvrir l'URL sur un téléphone.
  Critère de fin : connexion juge + bulletin avec accusé depuis un téléphone sur réseau mobile.

## 📓 Journal des sessions

### 2026-09-23 — Reprise, audit, PWA, sauvegarde, réécriture TypeScript
- Réorganisation du dépôt (sources dézippées → arborescence cible), commit `21ae035`.
- Audit : 79 tests Python + 14 frontend passent, serveur démarre. Écarts doc/code : PWA absente,
  SQLite 3.45 sur le poste (lanceur exige 3.51.3 en réseau ; résolu par le Python `uv` 3.13,
  SQLite 3.53.1), docs de cadrage contradictoires sur le StrongMan (tranché : sans rapport).
- Sécurité Python : 3 bloquants (pas de révocation, login hachant sous verrou, code d'invitation
  dans l'empreinte de commande). 0 CVE dépendances.
- PWA manifest + service worker, commit `6798822`. Sauvegarde/restauration vérifiées en réel.
- Hébergement : Oracle exige un paiement, Render gratuit sans disque, Koyeb/Fly plus de gratuit.
  Le PO choisit la **réécriture en JS** : Vite SPA conservé + fonctions Vercel + Turso (ADR 0002),
  Python sur Railway en plan B. Commit `e42beff` (ADR 0001, devenu plan B) puis `a4258e9`.
- Réécriture : moteur porté avec différentiel 200/200, préparation 12/12, workflow 16/16,
  parcours complet de compétition vert, 3 bloquants sécurité réglés côté TS.
- Ouvert : photos, imports, impressions, exports non portés ; Q0ter, Q0quinquies ; comptes.

## 🎓 Leçons apprises

### Un hébergement « gratuit » se vérifie avant d'écrire la procédure (2026-09-23)
Procédure Oracle rédigée, ADR écrit, puis inscription refusée sans paiement.
Les offres gratuites changent de mois en mois et se lisent sur la page du fournisseur, pas de
mémoire.
Règle : avant un ADR d'hébergement, l'inscription est faite et la ressource créée.
