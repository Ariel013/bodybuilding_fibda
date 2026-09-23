# Recette locale du 23 septembre 2026

Application 0.1.0, branche codex/fibda-application. Contrôles sur cette machine, données temporaires fictives. La maquette v4 et les bases des autres projets sont préservées. Ce rapport atteste les vérifications décrites ; il ne vaut pas procès-verbal de réception fédérale.

## Contrôles automatisés frais

| Contrôle | Résultat et preuve |
|---|---|
| Serveur et domaine | 77 tests et 2 sous-tests réussis en 19,86 secondes ; docs/preuves/pytest.txt |
| Avertissements serveur | Deux avertissements de dépréciation TestClient/AnyIO ; aucune erreur de test |
| Interface | 14 tests réussis au dernier passage, TypeScript et compilation Vite réussis ; docs/preuves/frontend-*.txt |
| Revue indépendante | Lecture des transitions, corrections, examens, projections et restauration ; aucun nouveau défaut bloquant confirmé après corrections |
| Paquet et documents | Rapports et manifestes distincts REPORT-PACKAGE.md, package-smoke.json et document-smoke.json |

La suite couvre les trois exemples d'écrêtage 12 / 11 / 8, le national renuméroté dans chaque bulletin, les tours et leur remise à zéro, les délais stagiaires, la transition unique, l'examen incomplet, les permissions API et les signatures de correction. Les défauts relevés en revue ont donné lieu à des régressions. Les anciens passages rouges décrits dans REPORT-DOMAIN.md sont l'historique du diagnostic ; la suite complète ci-dessus inclut leurs corrections.

Un parcours API complet exécute 24 athlètes, trois catégories, deux disciplines, huit tours, les récompenses et overall puis la clôture. La charge synthétique exécute 40 identités dans 40 threads, 100 rangs par bulletin, 40 reçus, réouverture SQLite et répétition idempotente. Ce transport ASGI reste en mémoire : il ne teste pas 40 appareils ni la radio Wi-Fi. Les durées de cet essai ne prouvent pas l'objectif de réception sur le réseau de salle.

## Contrôles navigateur réalisés

Chromium piloté par gstack /browse, application servie sur 127.0.0.1:8770. Démonstration avec 24 athlètes fictifs, catégories et jury fictifs ; aucune saisie de compétition officielle.

- Préparation et navigation sur ordinateur à 1280 pixels : formulaire événement, critères et programme ; capture preparation-ordinateur.png.
- Téléphone simulé à 390 × 844 : largeur du document égale à 390 pixels, absence de défilement horizontal global ; deux colonnes dossards/rangs.
- Connexion d'un juge confirmé : arrivée directe dans Mon jugement, outils de préparation absents ; aide repliable connexion et envoi.
- Placement dossard 1 au rang 1, remplacement par dossard 2, retour du précédent occupant dans la réserve, annulation puis rétablissement ; aucun décalage des autres rangs.
- Après affichage de l'enregistrement local, rechargement et reprise du brouillon : classement conservé. Une fermeture avant la confirmation d'écriture locale n'a pas été réceptionnée comme sauvegarde.
- Classement complet du chef, résumé final, transmission : accusé serveur affiché, commandes de classement désactivées. Rechargement : même classement reçu et verrouillé, même heure de réception.
- Documents sous un compte juge : choix limité aux bulletins et rapport personnel, aucun sélecteur permettant de lire les autres juges.
- Dernière interface à 390 × 844 : état de connexion visible, commandes Annuler / Rétablir / Vérifier et valider entre 709 et 758 pixels de hauteur, cibles de 48 pixels ; aucune largeur globale dépassant 390 pixels.
- Fiche athlète distincte : taille confirmée 169,0 cm et poids confirmé 75,0 kg sur une fiche fictive ; absence de photo autorisée explicitée, coordonnées privées absentes, retour au jugement sans changement du brouillon.

Les captures de docs/captures sont issues de l'application réelle sur ces données fictives. Elles ne sont pas des rendus d'interface imaginés. La console contient les réponses 401 attendues lors de l'absence de session ; aucun défaut JavaScript bloquant observé dans ce parcours.

## Réserves de réception

Le glissement tactile physique sur iPhone/iPad/Android n'est pas validé par des clics dans Chromium. Restent à recevoir : Safari et Chrome sur les vrais appareils, Windows et Mac propre, réseau sans Internet et certificat, quarante appareils, 300 athlètes et inscriptions multiples, mosaïque et animations sur écrans réels, imprimante, coupure électrique, restauration sur un autre ordinateur. Les essais de la bibliothèque SQLite et du serveur ne garantissent pas le matériel.

Le détail des limites fonctionnelles assumées figure dans STATUT-LIVRAISON.md. Le PV-RECETTE.md reste vierge pour la répétition fédérale. Aucun déploiement Internet ni utilisation officielle n'a été effectué.
