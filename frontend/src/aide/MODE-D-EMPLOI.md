# Mode d'emploi — FIBDA Compétition

Ce mode d'emploi décrit ce que l'application fait réellement, profil par profil. Il est affiché dans l'application, onglet **Aide**, filtré selon vos rôles. Si vous lisez le fichier complet, cherchez la section « Profil » qui vous concerne, puis « Tous les profils » à la fin.

**Se connecter.** Ouvrez l'adresse remise par l'organisation dans Safari ou Chrome : https://fibda-bodybuilding.vercel.app (la version d'entraînement est https://fibda-bodybuilding-demo.vercel.app, avec des données fictives). Saisissez votre **code personnel** puis touchez « Accéder à la compétition ». Le code est unique et personnel : ne le partagez jamais, même pour dépanner un collègue. Sur téléphone, ajoutez la page à l'écran d'accueil (menu « Partager » puis « Sur l'écran d'accueil » sur iPhone ; menu du navigateur puis « Ajouter à l'écran d'accueil » sur Android) : l'application s'ouvre ensuite comme une application ordinaire. La session reste ouverte au maximum 16 heures ; « Déconnexion » en haut à droite la ferme.

**Accusé de réception.** Le serveur en ligne est la seule référence. Une action n'est enregistrée que lorsque l'application affiche « Modification enregistrée sur le serveur » ou, pour un bulletin, « Bulletin reçu et verrouillé par le serveur ». L'indicateur « Connecté au serveur » signifie seulement que la liaison est récente : il ne prouve pas qu'un bulletin a été envoyé.

**Connexion interrompue.** Si l'application affiche « Connexion interrompue » ou « Reconnexion… », gardez la page ouverte, vérifiez le réseau mobile ou le Wi-Fi du téléphone, puis attendez le retour de « Connecté au serveur ». L'état se rafraîchit automatiquement toutes les quelques secondes. Ce que vous aviez saisi reste un brouillon sur votre appareil ; rien n'est envoyé sans votre action explicite.

## Profil : Chef de jury et responsable
Rôles : chief, responsable

Le chef de jury et le responsable disposent des onglets Vue d'ensemble, Préparation, Mon jugement, Compétition, Régie & écrans, Récompenses, Collectifs, Examens, Documents et Aide. Le chef voit aussi Traçabilité. Certaines actions sont réservées au seul chef : approuver un accès, fusionner des catégories, valider une manche, saisir un bulletin papier, corriger, confirmer un toutes catégories, réduire un jury, résoudre un incident.

### Créer les accès de l'équipe

1. Ouvrez **Préparation**, rubrique **Jury**, panneau « Inviter un membre ».
2. Saisissez le nom, un code personnel et cochez les rôles. Un code compte de 4 à 128 caractères ; pour un chef, un responsable ou un directeur, il doit compter **au moins 8 caractères**. Touchez « Créer l'accès ».
3. Dans « Accès et approbations », touchez « Approuver » pour chaque compte qui doit travailler (chef uniquement). Un compte non approuvé ne peut rien faire.
4. Remettez chaque code séparément à son titulaire. Un directeur ne vote jamais, même s'il cumule le rôle de juge.

### Renseigner l'événement

- Dans **Préparation**, rubrique **Événement** : nom, date, lieu et mode (National ou International), puis « Enregistrer l'événement ».
- Les trois cases de contrôle (référentiel vérifié, réseau contrôlé, sauvegarde de départ réalisée) servent de liste de vérification avant le démarrage.
- Le mode ne peut plus être changé une fois la compétition démarrée.

### Enregistrer les athlètes

1. Rubrique **Personnes** : identité, date de naissance, sexe, nationalités, pays, club et section (Amateur ou Professionnel), puis « Enregistrer ».
2. Sous la fiche, ajoutez une inscription dans une catégorie. Cochez « Confirmer cette nouvelle inscription » seulement après contrôle des documents et des mesures. Une inscription tardive exige un motif.
3. « Propositions et motifs du référentiel » affiche les catégories admissibles calculées par le serveur. Une dérogation du chef se note avec son motif.
4. Un fichier CSV ou XLSX peut être importé depuis « Importer des inscriptions » : lisez la prévisualisation, corrigez les erreurs, puis confirmez.

### Photographies

1. Sur la fiche de la personne (rubrique **Personnes**) ou de l'officiel (rubrique **Officiels**), bloc « Photographie et droit de diffusion » : choisissez le type (Portrait ou Plein pied), le fichier JPEG, PNG ou WEBP, recadrez si besoin, puis « Importer la photo ». La photo est réduite par le navigateur avant l'envoi (1 Mo au maximum) ; une image que le navigateur ne sait pas lire est refusée.
2. Une photo importée est **privée** : elle n'apparaît sur aucun écran public tant qu'elle n'est pas approuvée. Cochez « Consentement de diffusion recueilli et photo vérifiée » seulement si l'autorisation de la personne (ou de son représentant légal pour un mineur) est en votre possession, puis « Autoriser la diffusion publique ».
3. Importer une nouvelle photo remplace la précédente et annule l'approbation : il faut approuver de nouveau.
4. L'import par archive ZIP n'est pas disponible sur cette version : ajoutez les photos une par une.

### Contrôler les mesures

- Rubrique **Mesures** : saisissez la taille et le poids réellement mesurés, puis touchez « Confirmer » sur chaque ligne après contrôle physique.
- Le compteur « Mesures confirmées » de la Vue d'ensemble suit l'avancement.

### Préparer les catégories

- Rubrique **Catégories** : choisissez une règle du catalogue, le nom affiché, la section, la première phase, les places en finale et le quota éliminatoire, puis « Enregistrer la catégorie ».
- « Fusion avant attribution des dossards » (chef uniquement) réunit des catégories compatibles sous un nom commun. La fusion n'est plus possible après les dossards.

### Dossards et programme

1. Rubrique **Programme** : ordonnez les catégories dans « Ordre de passage ».
2. Touchez « Attribuer les dossards » : l'action est unique, le bouton se grise ensuite. Le dossard appartient à l'inscription, pas à la personne.
3. Touchez « Générer les manches » : le serveur crée les manches (éliminatoires, demi-finale, finale) selon chaque catégorie. Elles apparaissent dans « Manches prévues ».

### Composer le jury

- Rubrique **Jury**, panneau « Composition du jury » : cochez les juges officiels, les stagiaires (hors calcul), définissez l'ordre de retrait des juges, puis « Enregistrer le jury ».
- Un juge ne reçoit un bulletin que s'il est approuvé et affecté au jury de la manche.

### Démarrer la compétition

- Rubrique **Événement**, bouton « Démarrer la compétition ». L'état passe de « Préparation » à « En cours » et le mode se verrouille.
- Faites une sauvegarde juste après (voir « Sauvegarder »).

### Ouvrir une manche et suivre les bulletins

1. Onglet **Compétition** : dans « Programme sportif », touchez « Ouvrir le dossier » de la manche voulue.
2. Touchez « Ouvrir cette manche ». Les juges affectés voient aussitôt le bulletin sur leur téléphone.
3. Le panneau affiche « Juges officiels reçus », « Stagiaires reçus » et, pour chaque personne, « Reçu », « En attente » ou « Délai expiré ». Un juge n'a pas terminé tant que la ligne n'indique pas « Reçu ».
4. Après le dernier bulletin officiel, le serveur attend au plus 60 secondes les stagiaires, puis les marque hors délai sans inventer de note.

### Valider les résultats

- Quand tous les bulletins officiels sont reçus, le résultat calculé apparaît dans le dossier de la manche (rang, athlète, total) et le détail « Calculs, versions et classements ».
- Touchez « Valider les résultats sportifs » (chef uniquement). En cas d'arbitrage, cochez d'abord les athlètes dans « Qualification explicite ».
- « Passer à la manche suivante » ouvre la manche suivante du programme. Calculé, validé et diffusé sont trois états distincts : la diffusion reste sous le contrôle de la régie.

### Incident, jury réduit, bulletin papier et correction

- « Incident et réduction de jury » : « Suspendre et consigner » bloque la manche avec un motif, « Résoudre l'incident » la rouvre, « Appliquer le retrait motivé » retire un juge selon l'ordre autorisé (chef uniquement).
- « Saisie papier et correction contrôlée » (chef uniquement) : choisissez le juge, reconstituez le classement, indiquez la signature de la feuille papier et le motif, puis « Enregistrer le bulletin papier ». Le bulletin original reste conservé.
- « Soumettre la correction » modifie un résultat déjà validé ; elle attend ensuite la signature d'un directeur distinct via « Signer la correction en attente ».

### Récompenses et toutes catégories

1. Après validation d'une finale, les récompenses apparaissent dans l'onglet **Récompenses**. La remise réelle se coche sur chaque carte (« Récompense remise ») avant « Enregistrer la remise ».
2. Onglet **Compétition**, panneau « Toutes catégories et cycle des récompenses » : choisissez la discipline et la section, puis « Créer le toutes catégories ». Le tour réunit les vainqueurs de catégorie. Après réception des bulletins, « Confirmer le toutes catégories » (chef uniquement).
3. Dans **Récompenses**, « Confirmer les remises des catégories », « Confirmer les remises toutes catégories », puis « Terminer cette discipline » (ou « Clôturer le cycle et avancer » dans Compétition).

### Overall : un par discipline et par sexe

- Décision de la fédération pour cette compétition : chaque discipline a son propre toutes catégories (3 chez les dames : bikini, wellness, bodyfitness ; 4 chez les hommes). Il n'y a pas de finale entre disciplines.
- Le toutes catégories d'une discipline réunit les vainqueurs de chacune de ses catégories (étape précédente). Une discipline à une seule catégorie donne un champion unique, à confirmer depuis son dossier.

### Sauvegarder

- Onglet **Documents** (ou rubrique **Documents** de Préparation), panneau « Sauvegarde et restauration », bouton « Télécharger une sauvegarde complète » : le navigateur télécharge un fichier JSON contenant l'événement et les comptes. Faites-le après la préparation, après chaque bloc de finales et à la clôture, et copiez le fichier hors du téléphone ou de l'ordinateur.
- **Ce fichier est sensible** : il contient l'identité des athlètes (dont des mineurs), les photos et les codes hachés. Ne le partagez jamais par messagerie, ne le déposez jamais dans un dépôt de code ; conservez-le sur un support contrôlé et supprimez-le après la compétition.
- La restauration remplace l'événement en ligne par le fichier choisi, conserve une copie serveur de l'état précédent et **déconnecte tous les appareils** : ne l'utilisez qu'après avoir prévenu tout le monde et arrêté le jugement.

### Clôturer la compétition

1. Vérifiez que toutes les manches sont validées et toutes les récompenses remises.
2. Téléchargez la sauvegarde finale et les documents utiles (onglet **Documents** : Résultats, Récompenses, Diplôme, Récapitulatif jury ; export « Résultats CSV »).
3. Rubrique **Événement**, « Terminer la compétition ».

## Profil : Directeur
Rôles : director

Le directeur assure le contrôle organisationnel. Il ne vote jamais : l'onglet Mon jugement lui est retiré même s'il cumule le rôle de juge. Il dispose de Vue d'ensemble, Préparation, Compétition, Régie & écrans, Récompenses, Collectifs, Examens, Documents, Traçabilité et Aide.

### Préparer avec le chef

- Dans **Préparation**, le directeur peut renseigner l'événement, inviter des comptes, enregistrer personnes, inscriptions, mesures et officiels. Il ne peut ni approuver un compte, ni attribuer les dossards, ni composer le jury : ces actions restent au chef ou au responsable.

### Suivre la compétition

- L'onglet **Compétition** montre le programme, l'état de chaque manche, les bulletins reçus et les résultats calculés, en lecture.
- L'onglet **Traçabilité** affiche le journal du serveur : chaque action, son auteur et la version de l'état.

### Signer une correction

- Quand le chef a soumis une correction sur un résultat déjà validé, ouvrez le dossier de la manche dans **Compétition** et touchez « Signer la correction en attente ». La même personne ne peut pas fournir les deux signatures.

### Sauvegarde et restauration

- Dans **Documents**, le directeur peut « Télécharger une sauvegarde complète » (fichier JSON) et restaurer un fichier de sauvegarde. La restauration déconnecte tous les appareils : elle se décide avec le chef.

## Profil : Juge
Rôles : judge

Le juge arrive directement dans **Mon jugement** après connexion. Il dispose aussi des onglets Examens, Documents et Aide.

### Se connecter et vérifier son bulletin

1. Ouvrez l'application, saisissez votre code personnel, touchez « Accéder à la compétition ».
2. Vérifiez votre nom en haut de l'écran, puis la catégorie, la phase et l'état de la manche dans le sélecteur en haut de **Mon jugement**. Le bulletin de la manche ouverte s'affiche automatiquement quand vous êtes affecté.
3. Si l'écran indique « Aucune manche affectée », le chef doit vous intégrer au jury et ouvrir une manche : attendez, l'écran se met à jour seul.

### Classer les dossards

- En finale ou en demi-finale : glissez un dossard sur un rang, ou touchez le dossard puis le rang. Remplacer un rang libère son ancien occupant sans décaler les autres.
- En éliminatoires : touchez les dossards pour les sélectionner ; le bulletin exige exactement le quota demandé (« Sélectionnez exactement N athlètes »).
- « Voir un athlète » ouvre sa fiche (photo autorisée, taille et poids confirmés) ; « Revenir au jugement » la ferme sans rien changer.

### Corriger

- « Annuler » et « Rétablir » reviennent en arrière ou en avant. La croix d'un rang le libère.
- Le compteur « rangs attribués » (ou « sélectionnés ») indique quand le bulletin est complet ; le bouton de validation reste grisé tant qu'il ne l'est pas.

### Valider et attendre l'accusé de réception

1. Touchez « Vérifier et valider ». Relisez le résumé dans « Validation définitive du bulletin ».
2. Touchez « Confirmer et transmettre ». Il s'agit de la seule validation : rien n'est envoyé avant.
3. Attendez « Bulletin reçu et verrouillé par le serveur » avec l'heure de réception. Le bulletin devient non modifiable. Sans ce message, le bulletin n'est pas reçu.
4. Après réception, seul le circuit de correction du chef de jury permet une modification : signalez-lui toute erreur.

### Brouillon local

- Vos placements sont enregistrés comme brouillon sur ce téléphone (« Brouillon local enregistré à … »). Ils ne sont pas envoyés au chef à chaque geste.
- Après un rechargement, l'application propose « Reprendre le brouillon » ou « Écarter le brouillon ». Le brouillon ne se transfère pas sur un autre téléphone.
- Si la connexion se coupe, gardez la page ouverte. Au retour du réseau, vérifiez si le bulletin apparaît comme reçu avant de le renvoyer : l'application n'envoie jamais un ancien brouillon toute seule.

### Documents

- L'onglet **Documents** donne accès aux bulletins vierges, à votre bulletin individuel et à l'examen des stagiaires, en version imprimable.

## Profil : Stagiaire
Rôles : trainee

Le stagiaire juge avec son propre bulletin, hors calcul officiel. Il dispose des onglets Mon jugement, Examens, Documents et Aide.

### Juger comme stagiaire

- Le parcours est le même que pour un juge (voir le profil Juge) : classer, « Vérifier et valider », « Confirmer et transmettre », attendre « Bulletin reçu et verrouillé par le serveur ».
- Le bulletin porte la mention « Bulletin stagiaire, hors calcul officiel ».
- Après le dernier bulletin officiel, un compte à rebours « Temps restant après le dernier juge officiel » s'affiche : vous avez 60 secondes. Passé ce délai, le bulletin est marqué « Délai expiré » et ne peut plus être envoyé.

### Consulter son examen

- L'onglet **Examens** affiche votre rapport : moyenne, catégories évaluées, paires comparées, concordance par manche avec la version de référence du chef. « N/D » signifie qu'une mesure manque, pas une note de zéro.
- L'onglet **Documents** permet d'imprimer votre bulletin individuel et le rapport « Examen des stagiaires ».

## Profil : Secrétariat
Rôles : secretariat

Le secrétariat dispose des onglets Vue d'ensemble, Préparation, Récompenses, Documents et Aide.

### Inscrire les athlètes

1. **Préparation**, rubrique **Personnes** : saisissez identité, date de naissance, sexe, nationalités, pays, club et section, puis « Enregistrer ».
2. Ajoutez l'inscription dans la catégorie voulue. Cochez « Confirmer cette nouvelle inscription » seulement après contrôle des documents, de la licence et du paiement. Une inscription tardive exige un motif.
3. Le champ « Rechercher » retrouve une personne déjà saisie.

### Photographies

1. Sur la fiche de la personne (rubrique **Personnes**) ou de l'officiel (rubrique **Officiels**), bloc « Photographie et droit de diffusion » : choisissez le type (Portrait ou Plein pied), le fichier JPEG, PNG ou WEBP, recadrez si besoin, puis « Importer la photo ». La photo est réduite par le navigateur avant l'envoi (1 Mo au maximum) ; une image que le navigateur ne sait pas lire est refusée.
2. Une photo importée est **privée** : elle n'apparaît sur aucun écran public tant qu'elle n'est pas approuvée. Cochez « Consentement de diffusion recueilli et photo vérifiée » seulement si l'autorisation de la personne (ou de son représentant légal pour un mineur) est en votre possession, puis « Autoriser la diffusion publique ».
3. Importer une nouvelle photo remplace la précédente et annule l'approbation : il faut approuver de nouveau.
4. L'import par archive ZIP n'est pas disponible sur cette version : ajoutez les photos une par une.

### Saisir les mesures

- Rubrique **Mesures** : saisissez la taille (cm) et le poids (kg) réellement mesurés, puis « Confirmer » après contrôle physique.

### Officiels et documents

- Rubrique **Officiels** : fiche de présentation des officiels (nom, parcours). Elle ne donne aucun droit de connexion.
- Rubrique **Documents** : impressions (Inscriptions, Programme, Mesures, Bulletins vierges…) et export « Résultats CSV ». Vérifiez la catégorie et la manche choisies avant d'imprimer.

### Récompenses

- Onglet **Récompenses** : cochez « Récompense préparée » puis, après la remise réelle sur scène, « Récompense remise », et touchez « Enregistrer la remise ». « Imprimer la liste » ouvre la liste imprimable.

## Profil : Régie
Rôles : regie

La régie dispose des onglets Vue d'ensemble, Régie & écrans, Récompenses et Aide. Rien ne s'affiche sur les écrans publics sans son action.

### Ouvrir les écrans publics

- Les écrans publics sont des pages sans connexion, à ouvrir sur l'ordinateur relié au projecteur : ajoutez /screen/main (écran principal), /screen/secondary (écran secondaire), /screen/backstage (coulisses) ou /screen/speaker à l'adresse de l'application. Ces pages se rafraîchissent seules.

### Préparer et diffuser une scène

1. Onglet **Régie & écrans**, panneau « Préparer la scène » : choisissez l'écran cible (principal, secondaire, coulisses).
2. Choisissez le contenu : Accueil, Catégorie / mosaïque, Qualifiés, Révélation progressive, Podium, Classement, Un officiel, Mosaïque des officiels. Selon le contenu, précisez la catégorie, la manche, l'officiel, le nombre de places révélées ou l'athlète appelé, et positionnez les athlètes sur le plateau (ligne, gauche, centre, droite, en attente).
3. Contrôlez « Aperçu du contenu préparé », puis touchez « Diffuser sur … ». « Scènes actuellement diffusées » rappelle ce que chaque écran montre.
4. Les classements et podiums ne se diffusent qu'après validation par le chef. Les photos non approuvées ne s'affichent pas : l'écran public applique lui-même les filtres du serveur.

### Récompenses

- Onglet **Récompenses** : suivi des cartes préparées et remises, « Imprimer la liste » pour la cérémonie.

## Profil : Speaker
Rôles : speaker

Le speaker dispose des onglets Vue d'ensemble, Régie & écrans et Aide.

### Suivre le plateau

1. Onglet **Régie & écrans** : l'écran « Espace speaker » propose « Ouvrir l'écran speaker ».
2. La vue speaker affiche la scène en cours et le tableau « Conduite et prononciations » : dossard, athlète, prononciation du nom, club et pays, pour les athlètes actuellement appelés sur le plateau.
3. Le speaker n'annonce que ce qui est affiché : la régie pilote les scènes, le chef valide les résultats.

## Profil : Commission
Rôles : commission

La commission dispose des onglets Vue d'ensemble, Collectifs, Examens, Documents et Aide.

### Programmer et décider un examen

1. Onglet **Examens**, panneau « Planifier et décider » : choisissez le stagiaire, cochez les manches à examiner, puis « Enregistrer le programme d'examen ».
2. Le rapport compare le bulletin du stagiaire au bulletin versionné du chef : moyenne, catégories évaluées, paires comparées, concordance par manche.
3. Saisissez la décision et son motif, puis « Consigner la décision signée ». « Imprimer le rapport » produit la version papier.

### Classements collectifs

- Onglet **Collectifs** : classements par club ou par pays calculés par le serveur, et « Départage documenté » pour consigner un départage avec motif (« Signer le départage » est réservé à la direction).

## Tous les profils
Rôles : tous

### Plan papier de secours

- Avant la compétition, le secrétariat ou le chef imprime les « Bulletins vierges » de chaque catégorie depuis l'onglet **Documents** (bulletin de sélection avec cases pour les éliminatoires, bulletin de classement avec rangs pour les finales).
- Si le réseau tombe pendant une manche, le chef distribue les feuilles ; chaque juge remplit, signe et remet sa feuille. Le chef saisit ensuite chaque feuille dans **Compétition**, « Saisie papier et correction contrôlée », avec le nom du juge, la signature et le motif. Les feuilles signées sont conservées.

### Perte de connexion

- Gardez la page ouverte et rétablissez le réseau (données mobiles ou Wi-Fi). L'application se reconnecte seule et affiche « Connecté au serveur ».
- Si le message « L'état a changé sur un autre appareil » apparaît, les données ont été actualisées : relisez votre saisie puis relancez l'action.
- Si « Session expirée » ou l'écran de connexion apparaît, reconnectez-vous avec le même code.
- Ne considérez jamais une action comme faite sur la seule foi de l'écran local : cherchez le message d'enregistrement ou l'accusé de réception.

### Qui appeler

- Question de jugement, de jury ou de résultat : le chef de jury.
- Problème de compte, de code ou d'accès : le chef de jury ou le responsable, qui créent et approuvent les accès.
- Écrans publics : la régie.
- Panne de l'application pour tout le monde : le responsable technique de l'organisation ; en attendant, appliquez le plan papier.
