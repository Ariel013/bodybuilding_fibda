# Rapport interface FIBDA — 23 septembre 2026

## Livraison

Application React + TypeScript dans `application/frontend`, construite avec Vite. Sources, dépendances verrouillées et dossier de production `dist` présents. Police Manrope embarquée avec sa licence et logos originaux copiés des assets v4. Aucune dépendance CDN au fonctionnement. Direction menthe, panneaux translucides, logo sur fond blanc, sans filigrane. Mise en page adaptative téléphone/tablette/ordinateur.

Les données proviennent exclusivement de l’API. Aucune simulation locale ne remplace une API indisponible. L’initialisation de démonstration est une action explicite qui dépend du mode démo du serveur. Aucun appel à `/demo` n’a été effectué par cet agent.

## Parcours implémentés

- Initialisation chef et connexion par code, accès selon rôle, session serveur, déconnexion, affichage des codes de démonstration retournés par le serveur.
- Préparation : identité/paramètres et contrôles préalables de l’événement, personnes et inscriptions provisoires/confirmées, propositions d’éligibilité, mesures, catégories issues du catalogue, fusion, programme/dossards/tours, officiels, invitations et composition du jury, impressions et exports.
- Import CSV/XLSX en deux étapes (aperçu puis confirmation), import ZIP de photos avec association explicite, sauvegarde et restauration explicite.
- Photos : aperçu, recadrage manuel avec cadre et quatre limites en pourcentage converties en pixels, import et consentement séparé avant approbation. Une sélection d’une autre personne réinitialise les données de photo et le consentement.
- Jugement A : glisser-déposer avec Pointer Events, alternative appui dossard puis rang, remplacement sans décalage, annuler/rétablir, éliminatoires à quota, récapitulatif avant validation. Verrouillage après accusé serveur. Brouillons IndexedDB séparés par événement/restauration/juge/tour/version, restauration explicite et jamais d’envoi automatique.
- Conduite : ouverture/configuration/validation/transitions des tours, reçus des juges, résultats, réduction du panel, incidents, saisie papier, corrections et signature, overall et progression de discipline.
- Régie : diffusion explicite par cible, mosaïque, officiels, qualification, révélation, podium et classement. Quatre routes d’affichage principal/secondaire/coulisses/speaker ; le cinquième contexte est la régie. Speaker authentifié. Aperçu conservant les restrictions de diffusion.
- Récompenses : préparation/remise, impressions, clôture des remises catégorie ou overall avant progression. Classements collectifs et décision signée. Examens : programmation, indicateurs, détail de référence et décision de commission.
- Actualisation WebSocket avec repli par interrogation, état de connexion visible. Horloge des bulletins calculée depuis l’heure serveur. Les erreurs de commande restent visibles ; un conflit 409 rafraîchit l’état sans rejouer silencieusement l’action ni effacer le brouillon.

## Vérifications réalisées

`npm run build` : réussi (TypeScript puis Vite, 41 modules). `npm run typecheck` : réussi. `npm run test` : 12 tests réussis, couvrant remplacement sans décalage, absence de doublons, classement incomplet, quota éliminatoire, isolement des brouillons et expiration sur horloge serveur. Dernière compilation après recadrage photo réussie.

Les contrats ont été confrontés au code backend disponible : photos `{id}`, éligibilité `{proposals}`, jury dans `state.jury`, résultat `total`, codes de quatre caractères minimum, timestamps reçus en secondes, examens et classements collectifs. Le rôle responsable peut composer le panel ; un directeur même multirôle ne peut pas accéder au vote. Les autorisations restent vérifiées par le serveur.

## Réserves et réception restante

Ce rapport atteste de l’implémentation et des contrôles statiques/unitaires, pas d’une réception navigateur ou terrain. Le parent réalise la réception navigateur avec le serveur isolé prévu sur `127.0.0.1:8770`. La réception complète doit couvrir soumission/conflits simultanés, retour réseau, restauration, imports/exports réels, recadrage et approbation des photos, projections et cycle complet compétition/récompenses.

Les actions de commande et formulaires administratifs sont maintenant masqués selon les permissions du rôle ; les contrôles du serveur restent souverains. Les structures métier reçues emploient un type d’entité extensible ; la validation normative repose sur l’API.

Le glisser-déposer tactile, les écrans LED/HDMI, quarante appareils simultanés, le réseau local réel et les impressions physiques restent à recevoir sur matériel. Le recadrage est manuel par coordonnées avec aperçu, sans poignées de déplacement tactile. Les tests purs n’attestent pas ces comportements matériels. Le proxy Vite de développement pointe sur `8877` ; la production sert le bundle et l’API sur la même origine.

## Reprise QA ciblée — projection et permissions

Correction de `ScreenContent` : les participants du tour prévalent sur les inscriptions de la catégorie, même si le tour contient une liste vide. Le speaker emploie le même filtre. Le choix portrait (>15) ou plein pied (≤15) dépend du groupe original du tour ; les révélations successives ne changent pas le format. Une grille compacte jusqu’à 100 athlètes est implémentée, à recevoir sur l’écran réel.

La sortie animée des non-qualifiés ne démarre que sur une nouvelle version de scène publique de type `qualifiers`. Les mises à jour de votes et les actualisations réseau de la même scène ne relancent aucune annonce. Le premier chargement, donc aussi le rechargement complet d’une page, présente directement l’état actuel sans rejouer l’animation. Préférence de réduction du mouvement respectée.

Permissions centralisées pour les boutons de commande, y compris distinctions chef/responsable/directeur/commission, formulaires de catégorie et d’invitation et paramètres sportifs. Correction du champ multipart de restauration (`file`). Quatre tests supplémentaires couvrent la projection restreinte, la règle photo et le consentement, le déclenchement d’animation et les permissions. Build, typecheck et dix tests réussis après les corrections. Aucune réception navigateur supplémentaire réalisée par cet agent ; l’onglet de réception du parent est resté intact.

## Raccords finaux avant gel

Les récompenses collectives affichent `collective_name`. Le classement collectif signale son caractère provisoire jusqu’à validation de toutes les finales, puis affiche le vainqueur ou le besoin de départage. Le champ de dossier externe `settings.backup_directory` est présent dans les contrôles sportifs, avec indication qu’il concerne l’ordinateur serveur.

Le sélecteur National/International est visible dans l’en-tête de toutes les rubriques authentifiées. Sa modification respecte les droits d’administration et il est verrouillé après démarrage. Le formulaire de préparation verrouille aussi mode et date après démarrage. Le héros d’accueil emploie désormais le logo complet sur blanc.

L’aperçu privé filtre chaque photo grâce à `approved_photo_ids` : une photo plein pied nouvelle ne devient pas diffusable par l’approbation globale d’un ancien portrait. Le repli privilégie une autre photo autorisée, sinon l’emblème. Un onzième test couvre ce cas. Compilation production, typecheck et onze tests réussis. Réception visuelle de ces raccords laissée au parent.

## Dernier raccord examen overall

La création du toutes catégories permet de sélectionner les stagiaires à inscrire à l’examen avant l’ouverture immédiate éventuelle. `overall.create` transmet `exam_user_ids` avec `discipline` et `section`. Choix restreints aux stagiaires approuvés du modèle de jury de l’événement, sans directeur ; la liste envoyée est filtrée et dédoublonnée. La sélection est conservée en cas d’échec et effacée seulement après succès serveur. Le backend doit ajouter le tour au programme avant son ouverture. Douzième test réussi sur cette sélection ; build et typecheck réussis. Interface gelée après ce raccord, sous réserve du contrôle navigateur du parent.

## Reprise mobile à partir de la capture 390 × 844

Capture fournie `/private/tmp/fibda-mobile.png` examinée : contexte répétitif, réserve avant les rangs et barre collante masquant des cases. Le jugement mobile utilise maintenant deux colonnes réserve/rangs, chacune défilable dans une hauteur liée au viewport. Contexte raccourci, consigne détaillée repliable, barre de validation sous les panneaux sans recouvrement. Les cibles d’action restent au moins 48 px et les textes secondaires de ce parcours au moins 14 px. Le défilement vertical tactile des dossards est permis ; déplacement horizontal vers les rangs et alternative appui dossard/rang conservés. Le parent doit recontrôler le glissement sur téléphone réel.

La navigation donne désormais aux juges/stagiaires accès à Documents (bulletins vierges/personnels et rapport d’examen personnel, identité du juge imposée) et Examens (rapport personnel, aucune commande de commission visible). Le responsable accède aussi aux Examens selon ses droits de programmation. Build, typecheck et douze tests réussis après les modifications. Aucun backend modifié. La nouvelle capture de réception reste à effectuer par le parent.
