# A-FAIRE.md — Actions hors code, à faire par une personne

Règle : une action manuelle apparaît ici dans la tâche qui la fait naître, datée.
Cocher quand c'est fait, avec la date.

## Avant samedi 26/09/2026

- [ ] (24/09) **PO : envoyer le modèle papier de la fiche d'inscription** (photo ou fichier) pour
      aligner le document « Fiches d'inscription » dessus.

- [ ] (24/09) **Données de test en production** : 7 catégories (bikini, wellness, bodyfitness,
      bodybuilding, classic bodybuilding, classic physique, men's physique), 35 athlètes fictifs
      nommés `TEST-…`, dossards attribués, jury = chef + 4 juges. **Nettoyage = restaurer
      `~/fibda-prod-avant-semis-2026-09-24.json`** (Préparation → Sauvegarde et restauration,
      ou curl avec le jeton). ⚠️ Cette restauration efface TOUT ce qui a été saisi après le
      semis : la faire **avant** d'entrer les vrais athlètes, jamais après.

- [ ] (23/09, **EN SUSPENS** sur décision PO : on finit l'app d'abord) ~~Créer le compte Railway~~ (compte créé) avec ton GitHub (sans carte), installer la
      CLI (`npm i -g @railway/cli`), puis `railway login`. Plan B Python (ADR 0002).
- [x] (23/09) Compte Turso créé, base `fibda` créée en Irlande, jeton posé dans Vercel.
- [ ] (23/09) ~~**Créer le compte Turso**~~ (https://turso.tech, GitHub, sans carte),
      créer une base `fibda`, me transmettre l'URL `libsql://…` et un jeton en
      variable d'environnement, jamais dans un fichier du dépôt.
- [x] (23/09) Projet Vercel `fibda-bodybuilding` créé par la CLI, variables posées, production déployée et vérifiée : https://fibda-bodybuilding.vercel.app
- [ ] (24/09) **PO : créer les comptes des juges réels** (au moins 4 juges en plus du chef : le jury doit compter 5, 7, 9 ou 11 officiels, chef inclus), puis composer le jury dans Préparation.
- [ ] (23/09) **PO : ouvrir l'URL sur un téléphone**, ajouter à l'écran d'accueil, se connecter avec le code du chef (fichier `~/fibda-secrets-2026-09-23.txt` sur le poste de dev), créer un juge, envoyer un bulletin de test. C'est la recette minimale de `docs/DEPLOIEMENT-VERCEL.md` §5.
- [ ] (24/09) **Lire l'onglet « Aide » de l'app** avec le profil chef, signaler toute étape fausse ou manquante : le manuel est la référence des juges samedi.
- [ ] (23/09) **Entraînement des juges** : leur envoyer https://fibda-bodybuilding-demo.vercel.app et un code de juge fictif (fichier de secrets), pour qu'ils pratiquent le geste de jugement avant samedi.
- [ ] (23/09) **PO : changer le code du chef** généré par la machine dès la première connexion (créer un second compte de direction avec un code choisi, puis désactiver le premier), ou le garder s'il convient.
- [ ] (23/09) ~~**Compte Vercel** relié au dépôt GitHub~~ ; `npm i -g vercel` puis
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
- [x] (23/09) Codes admin : 8 caractères, décidé et implémenté.
- [x] (24/09) Q0ter définitive : un overall par discipline et par sexe, pas de finale entre disciplines. Bouton retiré.
- [ ] (23/09) Plan papier de secours : imprimer feuilles de jugement vierges par
      catégorie ; désigner qui les distribue si le réseau tombe.

- [ ] (23/09) Tant que le plan B Python existe : toute modification de
      `backend/fibda/catalogue.json` est recopiée dans `frontend/domain/catalogue.json`
      (vérifier avec `cmp`).

## Après la compétition

- [ ] Télécharger la sauvegarde finale sur un support local contrôlé, puis
      **détruire la VM ou effacer le dossier de données** (données de mineurs sur
      un serveur exposé).
