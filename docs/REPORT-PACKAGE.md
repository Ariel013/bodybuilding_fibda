# Vérification du paquet macOS

Le paquet natif a été construit sur ce Mac avec PyInstaller 6.22.3 et Python 3.12. Le dossier dist/FIBDA-Bodybuilding contient l’exécutable et ses dépendances. Il conserve ses données hors du programme. Le chemin du catalogue embarqué est fibda/catalogue.json ; Alembic, ses migrations et le frontend compilé sont inclus.

## Contrôles exécutés

La commande FIBDA-Bodybuilding --help fonctionne. Un serveur issu du paquet a été lancé en mode démonstration sur 127.0.0.1:8867 avec un dossier temporaire distinct. Les routes de santé, page initiale, logo et catalogue ont répondu HTTP 200. Le peuplement de démonstration a produit 24 personnes. La santé annonce la version 0.1.0 et SQLite 3.53.1. La sauvegarde produit une archive ZIP. Le redémarrage sur le même port conserve les 24 personnes, la version d’événement et l’identité de restauration. La base créée comporte la révision Alembic 0001_initial. Le détail machine est dans docs/package-smoke.json. Ces contrôles concernent le paquet local testé ; le bilan final de livraison précise les derniers contrôles et leurs compteurs.

## Correctif des codes personnels courts

Le paquet est reconstruit avec le minimum de quatre caractères et le frontend actualisé. Le contrôle ciblé de création puis de connexion d’un chef avec un code de quatre caractères utilise un nouveau dossier temporaire en mode officiel ; ses résultats et l’empreinte du binaire sont consignés dans docs/package-smoke.json. Le serveur de démonstration sur le port 8770 et ses données sont préservés. Les essais plus larges décrits ci-dessus concernent le jalon précédent ; ils ne sont pas tous répétés pour ce correctif.

## Reproduire

Installer PyInstaller dans le Python de construction, construire frontend, puis lancer .venv/bin/python scripts/build-package.py. Le cache de construction est placé dans application/build. Copier le dossier complet dist/FIBDA-Bodybuilding, et non le seul exécutable. Relancer --help puis un serveur avec un dossier --data-dir d’essai, contrôler la santé, le catalogue, une sauvegarde et un redémarrage avant utilisation réelle.

## Limites

Aucune signature de distribution, notarisation Apple, installation Windows ni diffusion n’a été effectuée. PyInstaller applique sa signature technique ad hoc à ses binaires macOS ; elle n’est pas une identité de développeur vérifiée. Le paquet doit être testé sur chaque OS et architecture cible. Cette construction incorpore les sources et le frontend gelés pour la livraison 0.1.0. Toute modification future nécessite une nouvelle construction et ses contrôles.

Les essais HTTP locaux ne démontrent ni la confiance du certificat sur les téléphones, ni le DNS de la salle, ni quarante connexions simultanées, ni le fonctionnement de l’écran ou de l’imprimante. L’ordinateur utilisé a ses propres permissions ; un autre Mac peut déclencher des contrôles de sécurité supplémentaires.
