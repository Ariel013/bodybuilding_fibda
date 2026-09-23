# A-FAIRE.md — Actions hors code, à faire par une personne

Règle : une action manuelle apparaît ici dans la tâche qui la fait naître, datée.
Cocher quand c'est fait, avec la date.

## Avant samedi 26/09/2026

- [ ] (23/09) **Créer le compte Railway** avec ton GitHub (sans carte), installer la
      CLI (`npm i -g @railway/cli`), puis `railway login`. Plan B Python (ADR 0002).
- [ ] (23/09) **Créer le compte Turso** (https://turso.tech, GitHub, sans carte),
      créer une base `fibda`, me transmettre l'URL `libsql://…` et un jeton en
      variable d'environnement, jamais dans un fichier du dépôt.
- [ ] (23/09) **Compte Vercel** relié au dépôt GitHub ; `npm i -g vercel` puis
      `vercel login` (taper `! vercel login` dans cette session).
- [ ] (23/09) Dire ce que « tout et même plus » contient au-delà de l'app Python.

- [x] (23/09, abandonné : paiement exigé) ~~Créer le compte Oracle Cloud Free Tier~~ : carte bancaire et
      numéro de téléphone exigés, aucune facturation sans passage volontaire en
      payant. Choisir une région proche (Marseille ou Paris). Si l'inscription est
      refusée ou la capacité ARM indisponible : repli Google Cloud e2-micro, puis
      VPS payant d'entrée de gamme. Voir ADR `docs/decisions/0001-*.md`.
- [ ] (23/09) **Créer un sous-domaine DuckDNS** (https://www.duckdns.org, compte
      gratuit) du type `fibda-xxxx.duckdns.org` et le pointer sur l'IP publique de
      la VM. Ce nom sera dans le QR des juges.
- [ ] (23/09) Suivre `docs/DEPLOIEMENT-INTERNET.md` jusqu'au test sur un vrai
      téléphone, **au plus tard jeudi 24/09 soir**.
- [ ] (23/09) Décider longueur minimale des codes admin (`OPEN-QUESTIONS.md`
      Q0quinquies).
- [ ] (23/09) Répondre Q0ter : overall par discipline ou toutes disciplines.
- [ ] (23/09) Plan papier de secours : imprimer feuilles de jugement vierges par
      catégorie ; désigner qui les distribue si le réseau tombe.

- [ ] (23/09) Tant que le plan B Python existe : toute modification de
      `backend/fibda/catalogue.json` est recopiée dans `frontend/domain/catalogue.json`
      (vérifier avec `cmp`).

## Après la compétition

- [ ] Télécharger la sauvegarde finale sur un support local contrôlé, puis
      **détruire la VM ou effacer le dossier de données** (données de mineurs sur
      un serveur exposé).
