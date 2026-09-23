# MVP-SCOPE.md — Doit marcher samedi vs peut attendre

Règle de tri : si une fonctionnalité n'empêche pas la compétition de samedi de se dérouler et
de produire un classement juste, elle attend après l'événement. Point.

**Contexte mis à jour** : une base de code substantielle existe déjà (voir `PLAN-J3.md`). Ce
document sert désormais à trier ce qui, dans cette base, doit être vérifié/durci en priorité
avant samedi — pas à définir ce qu'il faut construire à partir de rien.

## Version autonome (HTML/Pyodide) — usage correct, pas pour la production

`FIBDA-application-autonome.html` (et le kit testeurs qui l'accompagne) est un **outil de
démonstration et de test**, explicitement documenté comme tel dans sa propre notice : chaque
appareil garde sa propre copie isolée, **aucune synchronisation entre téléphones ni avec un
poste central**. Elle ne doit jamais servir pour la compétition réelle de samedi.

Usages légitimes avant samedi :
- Revue UX par le PO/les parties prenantes sans rien installer
- Entraînement des juges au geste de jugement (glisser/toucher, dossards, validation) sur leur
  propre téléphone, en autonomie, sans dépendre du serveur réel
- Test rapide du moteur de règles sportives (le même moteur Python tourne dedans via WASM)

Ce n'est PAS : la version de production, un moyen de tester la synchronisation réseau, une
preuve que l'app fonctionnera en salle samedi.

## Doit marcher samedi (non négociable)

- Créer l'événement, les comptes (chef, juges, éventuellement responsable/secrétariat) avec les
  bons rôles
- Enregistrer les athlètes et leurs catégories réelles de samedi (import manuel si besoin, pas
  besoin d'import CSV/XLSX en masse si le nombre d'athlètes est gérable à la main)
- Distribuer les dossards
- Jugement sur téléphone : lire le bulletin, classer, valider, recevoir l'accusé serveur
- **Calcul de classement correct** selon les règles réelles de samedi (retrait extrêmes si
  applicable, majorité, etc. — à confirmer avec le PO, cf. `OPEN-QUESTIONS.md`)
- Le chef voit les bulletins reçus, valide le résultat
- Un affichage des résultats (même simple : un seul écran, pas 5 contextes de régie)
- Sauvegarde manuelle qui fonctionne (au moins un export/backup fiable, testé)
- Accès réseau local stable pour tous les téléphones des juges présents samedi

## Peut attendre (après l'événement, ou si le temps le permet vraiment)

- Photos des athlètes (portrait/pied), consentement, approbation
- Examens de stagiaires / commission
- Classements collectifs (club, etc.)
- Overall multi-discipline si samedi ne comporte qu'une discipline/peu de catégories
- 5 contextes de régie distincts (main/secondary/backstage/speaker/régie) — un seul écran public
  suffit pour une première édition
- Exports PDF/DOCX soignés avec mise en page complète — un export simple (CSV/HTML) suffit pour
  samedi si besoin d'un document
- Import CSV/XLSX en masse avec prévisualisation — saisie manuelle acceptable si peu d'athlètes
- Packaging natif Windows, notarisation macOS
- Recette 40 appareils, tests d'accessibilité, charte graphique complète FIBDA

## Question à trancher immédiatement avec le PO (bloque le scope exact)

- Combien de catégories et d'athlètes concrètement samedi ?
- Combien de juges, un seul panel ou plusieurs catégories en parallèle ?
- Une seule discipline bodybuilding ou plusieurs (ex. Men's Physique + Bikini) ?
- Faut-il un overall samedi, ou juste des classements par catégorie ?
- Le lieu a-t-il déjà un Wi-Fi/routeur identifié, ou faut-il l'apporter ?
