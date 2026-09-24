# Procès-verbal de réception à compléter

Version / commit : __________. Date et lieu : __________. Événement : __________.

Responsable technique : __________. Chef des juges : __________. Directeur : __________.

## État préalable

Consulter REPORT-RECETTE-LOCALE.md pour les essais exécutés sur la machine de développement. Les lignes suivantes restent à réaliser sur le matériel prévu ; elles ne sont pas prévalidées.

| Essai terrain | Résultat, réserve et preuve | Signature |
|---|---|---|
| Installation propre Windows | À réaliser | |
| Installation propre Mac cible | À réaliser | |
| Certificat, DNS local et Wi-Fi sans Internet | À réaliser | |
| Safari iPhone / iPad et Chrome Android | À réaliser | |
| Glisser, toucher, corriger, perdre et retrouver la connexion | À réaliser | |
| 300 personnes, inscriptions multiples, 100 participants dans un groupe | À réaliser | |
| 40 appareils simultanés ; P95 des accusés inférieur à 2 secondes | À réaliser | |
| Écrans principal, secondaire, backstage, speaker et régie | À réaliser | |
| Lisibilité des mosaïques et des podiums à distance | À réaliser | |
| Impressions A4, une catégorie par début de page, secours papier | À réaliser | |
| Arrêt brutal contrôlé et conservation des bulletins acquittés | À réaliser sur données d'essai | |
| Restauration sur ordinateur de secours | À réaliser | |
| Répétition complète avec officiels, stagiaires et régie | À réaliser | |
| Vérification fédérale du catalogue et paramètres d'événement | À réaliser | |

Décision : accepté / accepté avec réserves / refusé (rayer les mentions inutiles).

Réserves bloquantes, responsable et date de reprise : __________________________________.

Signatures technique / sportive / direction : __________________________________.

## Recette API sur l'infrastructure réelle — 24/09/2026, 2 h (version serverless, démonstration)

Exécutée par script contre https://fibda-bodybuilding-demo.vercel.app (Vercel + Turso Irlande),
données fictives, depuis le poste de développement. Ce n'est pas une recette terrain (aucun
téléphone, aucun réseau de salle) ; c'est la preuve que le serveur réel tient le parcours.

| Étape | Résultat mesuré |
|---|---|
| Sauvegarde JSON avant essai | 200, 129 ko |
| Jury (chef + 4 juges + 1 stagiaire), réglages, programme, démarrage | 200 à chaque commande, ~2,5 s chacune |
| Tour ouvert automatiquement | demi-finale, 8 participants |
| 5 bulletins officiels depuis 5 sessions distinctes | 200 avec accusé, ~3,5 s par juge connexion comprise |
| 5 bulletins officiels envoyés **au même instant** (rejoué à 2 h 30) | 5 × 200 avec accusé, sérialisés par la base : 2,2 / 2,7 / 3,6 / 6,2 / 7,2 s ; aucun conflit de version |
| Attente stagiaire après le dernier officiel | délai armé, tour toujours ouvert (règle 60 s) |
| Bulletin du stagiaire | 200, tour passé en attente de validation |
| Validation par le chef | 200, résultat calculé |
| Écran public avant scène / après scène « qualifiés » | projection sans bulletin, sans date de naissance, sans code |
| Restauration de la sauvegarde d'avant essai | 200, sessions invalidées, état revenu en préparation |

Reste à réaliser sur le terrain : tout le tableau ci-dessus, avec de vrais téléphones.
