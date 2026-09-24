# Mode d'emploi — FIBDA Compétition

Ce mode d'emploi décrit ce que l'application fait réellement, profil par profil. Il est affiché dans l'application, onglet **Aide**, filtré selon vos rôles. Si vous lisez le fichier complet, cherchez la section « Profil » qui vous concerne, puis « Tous les profils » à la fin. Chaque profil commence par un « En bref » : les gestes à faire, dans l'ordre. Le détail suit pour ceux qui veulent comprendre.

**Se connecter.** Ouvrez l'adresse remise par l'organisation dans Safari ou Chrome : https://fibda-bodybuilding.vercel.app (la version d'entraînement est https://fibda-bodybuilding-demo.vercel.app, avec des données fictives). Saisissez votre **code personnel** puis touchez « Accéder à la compétition ». Le code est unique et personnel : ne le partagez jamais, même pour dépanner un collègue. Sur téléphone, ajoutez la page à l'écran d'accueil (menu « Partager » puis « Sur l'écran d'accueil » sur iPhone ; menu du navigateur puis « Ajouter à l'écran d'accueil » sur Android) : l'application s'ouvre ensuite comme une application ordinaire. La session reste ouverte au maximum 16 heures ; « Déconnexion » en haut à droite la ferme.

**Accusé de réception.** Le serveur en ligne est la seule référence. Une action n'est enregistrée que lorsque l'application affiche « Modification enregistrée sur le serveur » ou, pour un bulletin, « Bulletin reçu et verrouillé par le serveur ». L'indicateur « Connecté au serveur » signifie seulement que la liaison est récente : il ne prouve pas qu'un bulletin a été envoyé.

**Connexion interrompue.** Si l'application affiche « Connexion interrompue » ou « Reconnexion… », gardez la page ouverte, vérifiez le réseau mobile ou le Wi-Fi du téléphone, puis attendez le retour de « Connecté au serveur ». L'état se rafraîchit automatiquement toutes les quelques secondes. Ce que vous aviez saisi reste un brouillon sur votre appareil ; rien n'est envoyé sans votre action explicite.

## Profil : Déroulé complet d'une compétition
Rôles : chief, responsable

### En bref : ce que vous avez à faire

1. Créez et approuvez les accès de l'équipe dans **Préparation**, rubrique **Jury** (voir « 1. Créer les accès de l'équipe »).
2. Renseignez l'événement, le critère collectif et les trois cases de contrôle dans la rubrique **Événement**, puis « Enregistrer l'événement » (voir « 2. Renseigner l'événement et sa liste de contrôle »).
3. Créez les catégories, enregistrez les athlètes, saisissez et confirmez les mesures, puis confirmez les inscriptions (rubriques **Catégories**, **Personnes** et **Mesures** ; voir les étapes 3 à 5).
4. Ordonnez le programme et touchez « Attribuer les dossards », composez le jury et « Enregistrer le jury », puis « Générer les manches » (rubriques **Programme** et **Jury** ; voir les étapes 6 à 8).
5. Touchez « Démarrer la compétition » dans la rubrique **Événement**, puis « Télécharger une sauvegarde complète » dans **Documents** (voir « 9. Démarrer la compétition »).
6. Pour chaque manche, dans **Compétition** : « Ouvrir le dossier », attendez « Reçu » pour chaque juge officiel, puis « Valider les résultats sportifs » (voir « 10. Conduire une manche »).
7. Faites diffuser les résultats validés par la régie dans **Régie & écrans** ; discipline terminée, remettez les récompenses dans **Récompenses**, « Créer le toutes catégories » dans **Compétition**, puis « Terminer cette discipline » (voir les étapes 11 et 12).
8. Téléchargez la sauvegarde finale et les documents dans **Documents**, puis « Terminer la compétition » dans la rubrique **Événement** (voir « 13. Clôturer la compétition »).

Cette section suit une compétition du début à la fin, dans l'ordre que le serveur impose. Chaque étape indique où agir (onglet, rubrique, panneau, bouton), ce que l'action fait réellement, pourquoi elle est exigée, et le message affiché si elle a été oubliée. Les profils détaillés plus bas reprennent chaque écran ; ici, seul l'enchaînement compte. Faites une sauvegarde après chaque étape clé (étape 14).

### 1. Créer les accès de l'équipe

- Où : onglet **Préparation**, rubrique **Jury**, panneau « Inviter un membre », bouton « Créer l'accès ». Puis panneau « Accès et approbations », bouton « Approuver » sur chaque compte (chef uniquement).
- Ce que cela fait : chaque personne reçoit un code personnel et des rôles. Un code compte de 4 à 128 caractères ; pour un chef, un responsable ou un directeur, le serveur refuse moins de 8 caractères avec « Le code d'un accès de direction doit contenir au moins 8 caractères. ». Seul le chef peut créer un accès de direction.
- Pourquoi : un compte non approuvé ne peut rien faire, et un juge ne peut être placé dans le jury (étape 7) que s'il est approuvé. Créez et approuvez tous les juges avant de composer le jury.
- Si oublié : le juge voit « Aucune manche affectée » et le jury ne peut pas être enregistré avec lui.

### 2. Renseigner l'événement et sa liste de contrôle

- Où : **Préparation**, rubrique **Événement** : nom, date, lieu, mode, puis « Enregistrer l'événement ».
- Le mode : « National · classement officiel ivoirien » réserve le classement officiel (titres, récompenses, toutes catégories) aux athlètes de nationalité CI ; « International · délégations approuvées » le réserve aux athlètes dont la délégation et l'organisation ont été approuvées sur la fiche. La date et le mode sont figés au démarrage (« Date et mode figés après démarrage. »).
- Le « Critère collectif publié de départage » est un texte libre : la règle, annoncée avant la compétition, qui départage deux clubs ou deux pays à égalité dans les classements collectifs (onglet Collectifs). Le serveur l'exige avant le démarrage et le fige ensuite (« Le critère collectif est figé dès le démarrage. »), pour qu'aucun départage ne soit inventé après coup.
- Les trois cases « Le référentiel applicable et ses réserves ont été vérifiés par l'organisation », « Réseau local et accès des appareils contrôlés » et « Sauvegarde de départ réalisée et contrôlée » sont une liste de vérification signée par la direction : cocher ne déclenche rien, mais atteste que le contrôle a été fait.
- Si oublié : « Démarrer la compétition » répond « Validez le règlement, le réseau, la sauvegarde et le critère collectif avant ouverture. » tant qu'une case ou le critère manque.

### 3. Créer les catégories

- Où : **Préparation**, rubrique **Catégories**, panneau « Catégorie et référentiel » : « Règle du catalogue », « Nom affiché », « Section » (Amateur ou Professionnel), « Première phase », « Places en finale », « Quota éliminatoire », puis « Enregistrer la catégorie ».
- Ce que cela fait : la règle du catalogue fixe la discipline, le sexe, la division (senior, junior ou masters avec ses bornes d'âge) et la tranche de taille ou de poids. Le nom d'une règle se lit ainsi : « Bikini senior > 162 à ≤ 164 » accepte une taille strictement supérieure à 162 cm et jusqu'à 164 cm inclus ; « Bodybuilding senior ≤ 65 » accepte jusqu'à 65 kg inclus ; « Bodybuilding senior > 100 » commence strictement au-dessus de 100 kg. Une athlète mesurant exactement 162,0 cm relève donc de la tranche « > 160 à ≤ 162 ».
- « Première phase » laissée sur « Automatique selon l'effectif » laisse le serveur décider (étape 8). « Places en finale » (6 par défaut) est le nombre de qualifiés à l'issue d'une demi-finale ; « Quota éliminatoire » (15 par défaut) le nombre de qualifiés à l'issue d'une éliminatoire.
- Pourquoi : chaque inscription est contrôlée contre les bornes de sa règle (étape 4). Une catégorie inscrite ne peut plus changer de règle ni de section.
- Si oublié : aucune inscription n'est possible sans catégorie. Après les dossards, les catégories sont figées (« Catégories figées après attribution des dossards. »).

### 4. Enregistrer les athlètes et contrôler les inscriptions

- Où : **Préparation**, rubrique **Personnes** : identité, date de naissance, sexe, nationalités, pays, club, section, cases de contrôle, puis « Enregistrer ». « Vérifier les catégories proposées » affiche « Propositions et motifs du référentiel ».
- Nationalités : en mode national, seuls les athlètes dont les nationalités contiennent CI entrent dans le classement officiel, quel que soit le pays représenté. Les autres sont jugés et classés dans le classement commun, sans titre.
- Les cases « Statut approuvé », « Licence contrôlée », « Paiement reçu » sont exigées pour confirmer une inscription ; « Autorisation du mineur » l'est pour un athlète de moins de 18 ans ; « Délégation approuvée » et « Organisation approuvée » le sont en mode international.
- L'âge retenu est l'année de l'événement moins l'année de naissance, sans tenir compte du jour. Il sert aux divisions junior et masters et au contrôle des mineurs.
- « Inscription à contrôler : Âge ou mesures hors catégorie. » : la fiche (âge, taille, poids) ne correspond à aucune borne de la règle de la catégorie choisie. Corrigez la fiche, choisissez une autre catégorie, ou (chef uniquement) saisissez un « Motif de dérogation, réservé au chef (facultatif) » avant de confirmer : la dérogation est signée du chef et conservée avec ses motifs.
- « Inscription à contrôler : Crossover Junior/Masters vers Senior à autoriser par le chef. » : l'athlète a l'âge d'une division junior ou masters de cette discipline mais s'inscrit en senior. Seul le chef peut cocher « Crossover Junior/Masters vers Senior autorisé par le chef » sur la fiche.
- « Inscription à contrôler : Contrôle requis : … » : une case de contrôle manque ; « measurements_confirmed » désigne la confirmation des mesures (étape 5).

### 5. Saisir et confirmer les mesures, confirmer les inscriptions

- Où : **Préparation**, rubrique **Mesures** : taille en cm et poids en kg, puis « Confirmer » sur la ligne après contrôle physique. Le serveur accepte une décimale (« Mesure positive au dixième requise. ») et refuse une mesure qui sortirait une inscription déjà confirmée de sa catégorie (« Mesures incompatibles avec une inscription confirmée. »).
- Puis rubrique **Personnes**, sous la fiche : « Confirmer cette nouvelle inscription (contrôles et mesures requis) » ou « Confirmer l'inscription » sur une inscription existante.
- Pourquoi : seules les inscriptions confirmées reçoivent un dossard et entrent dans les manches. Une inscription confirmée refuse ensuite toute modification incompatible de taille ou de poids (« Modification incompatible avec une inscription confirmée ; déconfirmer avant correction. »).
- Le compteur « Mesures confirmées » de la Vue d'ensemble suit l'avancement.
- Si oublié : au démarrage, le serveur recontrôle chaque inscription confirmée et refuse d'ouvrir avec « Inscriptions confirmées à recontrôler : … ».

### 6. Ordonner le programme et attribuer les dossards

- Où : **Préparation**, rubrique **Programme**, panneau « Ordre de passage » : flèches ↑ et ↓ pour ordonner les catégories, puis « Attribuer les dossards ».
- Ce que cela fait : le serveur numérote de 1 à N toutes les inscriptions confirmées, catégorie par catégorie dans l'ordre de passage. Le dossard appartient à l'inscription, pas à la personne.
- Pourquoi une action unique : après les dossards, les catégories, les fusions et les inscriptions ordinaires sont figées, pour qu'aucun numéro ne change une fois les feuilles imprimées. Le bouton se grise ; une seconde tentative répond « Dossards déjà attribués. ». Une arrivée tardive passe par « Inscription tardive (motif obligatoire) » et reçoit le numéro suivant.
- Si oublié : « Générer les manches » répond « Attribuez les dossards avant de préparer les tours. ». Sans aucune inscription confirmée : « Aucune inscription confirmée : attribution des dossards impossible. ».

### 7. Composer le jury

- Où : **Préparation**, rubrique **Jury**, panneau « Composition du jury » : « Juges officiels », « Stagiaires, hors calcul des résultats », « Ordre de retrait des juges », puis « Enregistrer le jury ».
- Ce que cela fait : le jury doit compter 5, 7, 9 ou 11 juges officiels distincts, chef inclus ; un directeur ne vote jamais. Les stagiaires reçoivent un bulletin mais n'entrent pas dans le calcul. Chaque manche générée ensuite (étape 8) reçoit une copie de ce jury.
- L'ordre de retrait : si un juge officiel manque pendant une manche (malaise, absence), le chef pourra le retirer avec « Appliquer le retrait motivé » dans **Compétition**, mais uniquement dans cet ordre, du premier au suivant, et le nombre restant doit rester 5, 7, 9 ou 11 (on retire donc deux juges à la fois pour passer de 7 à 5). Le chef ne figure jamais dans l'ordre de retrait. Décider cet ordre à froid évite de choisir sous pression qui sort.
- Si oublié ou incorrect : « Jury distinct de 5, 7, 9 ou 11 requis. » apparaît à l'enregistrement, à « Générer les manches » et à « Démarrer la compétition ». Après le démarrage, le jury général est figé (« Le jury général est figé ; configurez un tour non ouvert. ») : seule la « Configuration de cette manche » d'une manche non ouverte reste modifiable.

### 8. Générer les manches

- Où : **Préparation**, rubrique **Programme**, panneau « Ordre de passage », bouton « Générer les manches ». Le résultat apparaît dans « Manches prévues ». Ce bouton n'existe pas dans l'onglet Compétition.
- Ce que cela fait : pour chaque catégorie ayant au moins une inscription confirmée, le serveur crée la suite de manches selon l'effectif, sauf si « Première phase » a été fixée à la main : jusqu'à 6 inscrits, une finale directe ; de 7 à 15 inscrits, une demi-finale puis une finale ; à partir de 16 inscrits, une éliminatoire, puis une demi-finale, puis une finale. La demi-finale qualifie « Places en finale » athlètes ; l'éliminatoire en qualifie « Quota éliminatoire », ramenés à l'effectif réel. Chaque manche est créée « en attente » avec le jury de l'étape 7.
- Pourquoi : les manches suivantes ne connaissent leurs participants qu'après validation de la précédente ; le programme complet doit donc exister avant l'ouverture.
- Si le jury change après cette étape, régénérez les manches : c'est possible tant qu'aucune manche n'est ouverte (« Un programme engagé ne peut être régénéré. »).
- Si oublié : « Démarrer la compétition » répond « Préparez les tours avant ouverture. ».

### 9. Démarrer la compétition

- Où : **Préparation**, rubrique **Événement**, bouton « Démarrer la compétition ».
- Ce que cela fait, dans l'ordre : contrôle des trois cases et du critère collectif, présence des manches, recontrôle de toutes les inscriptions confirmées, contrôle du jury ; puis le référentiel (catalogue des règles) est figé dans une copie, le mode et la date sont verrouillés, l'état passe à « En cours » et **la première manche du programme s'ouvre d'elle-même** : les juges affectés voient aussitôt leur bulletin.
- Pourquoi : à partir de là, aucune règle ne change en cours de compétition ; ce qui est calculé le soir l'est avec le référentiel du matin.
- Faites une sauvegarde juste après (étape 14).

### 10. Conduire une manche

1. Où : onglet **Compétition**, panneau « Programme sportif », bouton « Ouvrir le dossier » de la manche. La manche active est déjà ouverte ; pour une autre, « Ouvrir cette manche » (une seule manche ouverte à la fois, dans l'ordre du programme : sinon « Ce tour attend les bulletins, qualifications ou étapes précédentes. »).
2. Le dossier affiche « Juges officiels reçus », « Stagiaires reçus » et, par juge, « Reçu », « En attente » ou « Délai expiré ». Côté juge, le bulletin est envoyé par « Confirmer et transmettre » et reçu quand son téléphone affiche « Bulletin reçu et verrouillé par le serveur. » ; il devient alors non modifiable.
3. Après le dernier bulletin officiel, le serveur attend au plus 60 secondes les stagiaires, puis les marque « Délai expiré » sans inventer de note, et la manche passe en attente de validation. La manche suivante ne s'ouvre pas encore.
4. Le calcul : pour une finale ou une demi-finale, chaque athlète reçoit un rang par juge ; le serveur retire son meilleur et son pire rang, additionne les rangs restants, et classe du plus petit total au plus grand ; à total égal, l'athlète placé devant par la majorité des juges passe devant. Pour une éliminatoire, chaque juge sélectionne exactement le quota d'athlètes ; les plus sélectionnés se qualifient. Le résultat calculé apparaît dans le dossier avec le détail « Calculs, versions et classements ».
5. « Valider les résultats sportifs » (chef uniquement) fige ce calcul comme résultat officiel et prépare les récompenses d'une finale. Si des ex æquo se trouvent à la frontière du quota d'une éliminatoire, le serveur répond « Le chef doit résoudre les ex æquo à la frontière du quota. » : cochez les athlètes dans « Qualification explicite si un arbitrage est requis », avec un motif si le quota est respecté au lieu d'admettre tous les ex æquo.
6. Calculé, validé, diffusé : calculé signifie que le serveur a fait la somme ; validé que le chef l'a arrêtée ; diffusé que la régie l'a mise sur un écran public. Rien ne s'affiche en salle sans les deux dernières étapes.
7. Une fois la manche validée, la manche suivante prête s'ouvre d'elle-même ; « Passer à la manche suivante » force ce passage et répond « Des bulletins officiels ou stagiaires sont encore attendus. » s'il est trop tôt.
8. Incident : « Suspendre et consigner » bloque la manche avec un motif ; « Résoudre l'incident » la rouvre. Réseau tombé : « Saisie papier et correction contrôlée » (chef uniquement) saisit une feuille signée à la place du bulletin d'un juge, avec « Signature de la feuille papier » et « Motif de saisie ou correction ». Erreur après validation : « Soumettre la correction » recalcule aussitôt si le résultat n'a pas été diffusé ; s'il l'a été, elle attend « Signer la correction en attente » par un directeur, et les écrans publics repassent à l'accueil avec « Résultat en cours de mise à jour ».

### 11. Diffuser sur l'écran public

- Où : onglet **Régie & écrans**, panneau « Préparer la scène » : « Écran cible », « Contenu », puis « Diffuser sur … » après contrôle de « Aperçu du contenu préparé ».
- Les contenus : « Accueil » (page neutre), « Catégorie / mosaïque » (athlètes appelés sur le plateau), « Qualifiés » (après une éliminatoire ou une demi-finale validée), « Révélation progressive », « Podium », « Classement » (finales et toutes catégories validés), « Un officiel », « Mosaïque des officiels ».
- Le serveur refuse toute scène de résultat sur une manche non validée (« Résultat non validé : diffusion interdite. »).
- « Révélation progressive » annonce les athlètes un par un, du dernier au premier, avec « Nombre de places révélées » qui augmente d'une unité à chaque diffusion (« Annoncez les athlètes un par un du dernier au premier. »). « Podium » et « Classement » restent refusés tant que tous les athlètes de la manche n'ont pas été annoncés sur cet écran (« Terminez les annonces avant le podium et le classement complet. ») : le suspense de la cérémonie est garanti par le serveur, pas par la prudence de la régie.
- Les photos non approuvées sont remplacées par l'emblème sur tous les écrans.

### 12. Terminer une discipline : récompenses et toutes catégories

1. Le programme se déroule discipline par discipline, dans l'ordre de passage des catégories. Quand toutes les finales d'une discipline sont validées, onglet **Récompenses** : cochez « Récompense préparée » puis « Récompense remise » sur chaque carte, et « Enregistrer la remise ».
2. Panneau « Clôture des cycles de remise » : choisissez la discipline, puis « Confirmer les remises des catégories ». Le serveur refuse tant qu'une finale de la discipline n'est pas validée (« Validez les résultats avant la fin des récompenses. »).
3. Onglet **Compétition**, panneau « Toutes catégories et cycle des récompenses » : choisissez la discipline et la section, puis « Créer le toutes catégories ». Le serveur réunit les vainqueurs de chaque catégorie de cette discipline et de cette section (classement officiel), un toutes catégories par discipline et par sexe. Sans les remises confirmées : « Terminez les récompenses des catégories avant l'overall. ».
4. À deux vainqueurs ou plus, le toutes catégories s'ouvre comme une manche ordinaire et se juge de la même façon (étape 10). Un seul vainqueur : la manche ne s'ouvre pas (« Un champion seul exige la confirmation du chef. ») ; ouvrez son dossier et touchez « Confirmer le toutes catégories » (chef uniquement), qui le déclare champion sans bulletin.
5. Remettez la récompense du champion dans **Récompenses**, puis « Confirmer les remises toutes catégories ». Le serveur exige un toutes catégories par section inscrite dans la discipline (« Constituez chaque overall avant de terminer ses récompenses. »).
6. « Terminer cette discipline » (ou « Clôturer le cycle et avancer » dans Compétition) : la discipline est marquée terminée et la première manche de la discipline suivante s'ouvre d'elle-même. Tant que les deux confirmations manquent : « Terminez les deux étapes de récompenses et l'overall. ».

### 13. Clôturer la compétition

- Où : **Préparation**, rubrique **Événement**, bouton « Terminer la compétition ».
- Ce que cela fait : l'événement passe à « Terminé » ; toute modification de préparation est ensuite refusée (« Événement terminé. »).
- Le serveur refuse tant qu'une discipline n'a pas été terminée à l'étape 12 : « Toutes les disciplines et récompenses doivent être terminées. ».
- Avant de toucher le bouton : téléchargez la sauvegarde finale (étape 14) et les documents de l'onglet **Documents** (Résultats, Récompenses, Diplôme, Récapitulatif jury, export « Résultats CSV »).

### 14. Sauvegarder à chaque étape clé

- Où : onglet **Documents** (ou rubrique **Documents** de Préparation), panneau « Sauvegarde et restauration », bouton « Télécharger une sauvegarde complète ».
- Quand : après les dossards et les manches (fin de l'étape 8), juste après « Démarrer la compétition », après chaque discipline terminée, avant et après « Terminer la compétition ».
- Quoi : un fichier JSON contenant l'événement complet et les comptes. Copiez-le hors du téléphone ou de l'ordinateur, sur un support contrôlé.
- Sensibilité : le fichier contient l'identité des athlètes (dont des mineurs), les photos et les codes hachés. Ne le partagez jamais par messagerie et supprimez-le après la compétition. La restauration remplace l'événement en ligne et déconnecte tous les appareils : ne l'utilisez qu'après avoir prévenu tout le monde et arrêté le jugement.

## Profil : Chef de jury et responsable
Rôles : chief, responsable

### En bref : ce que vous avez à faire

1. Créez les accès dans **Préparation**, rubrique **Jury**, puis « Approuver » chaque compte (voir « Créer les accès de l'équipe »).
2. Renseignez l'événement, enregistrez les athlètes, leurs inscriptions, leurs photos et leurs mesures, puis préparez les catégories (rubriques **Événement**, **Personnes**, **Mesures** et **Catégories**).
3. Ordonnez le programme, « Attribuer les dossards », composez le jury, puis « Générer les manches » (rubriques **Programme** et **Jury** ; voir « Dossards et programme » et « Composer le jury »).
4. Touchez « Démarrer la compétition » dans la rubrique **Événement**, puis « Télécharger une sauvegarde complète » dans **Documents** (voir « Sauvegarder »).
5. Dans **Compétition**, ouvrez le dossier de chaque manche et attendez « Reçu » pour chaque juge officiel (voir « Ouvrir une manche et suivre les bulletins »).
6. Touchez « Valider les résultats sportifs », puis « Passer à la manche suivante » si elle ne s'ouvre pas seule (voir « Valider les résultats »).
7. Après les finales d'une discipline : remises dans **Récompenses**, « Créer le toutes catégories » dans **Compétition**, puis « Terminer cette discipline » (voir « Récompenses et toutes catégories »).
8. Téléchargez la sauvegarde finale et les documents dans **Documents**, puis « Terminer la compétition » dans la rubrique **Événement** (voir « Clôturer la compétition »).

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

### En bref : ce que vous avez à faire

1. Ouvrez l'adresse remise par l'organisation, saisissez votre code personnel et touchez « Accéder à la compétition ».
2. Participez à la préparation dans **Préparation** : événement, comptes, personnes, inscriptions, mesures et officiels (voir « Préparer avec le chef »).
3. Pendant la compétition, suivez les manches dans **Compétition** et le journal du serveur dans **Traçabilité** (voir « Suivre la compétition »).
4. Si le chef a soumis une correction sur un résultat validé, ouvrez le dossier de la manche dans **Compétition** et touchez « Signer la correction en attente » (voir « Signer une correction »).
5. Avec le chef, touchez « Télécharger une sauvegarde complète » dans **Documents** aux étapes clés ; ne restaurez jamais sans avoir prévenu tout le monde (voir « Sauvegarde et restauration »).

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

### En bref : ce que vous avez à faire

1. Ouvrez l'adresse remise par l'organisation dans Safari ou Chrome et ajoutez la page à l'écran d'accueil du téléphone.
2. Saisissez votre code personnel, touchez « Accéder à la compétition » et vérifiez votre nom en haut de l'écran.
3. Dans **Mon jugement**, attendez que le bulletin de la manche ouverte s'affiche ; « Aucune manche affectée » signifie que le chef n'a pas encore ouvert la manche, l'écran se met à jour seul.
4. Classez les dossards : glissez chaque dossard sur un rang en finale ou demi-finale, touchez les dossards à sélectionner en éliminatoires (voir « Classer les dossards »).
5. Vérifiez le compteur « rangs attribués » (ou « sélectionnés ») ; corrigez avec « Annuler », « Rétablir » ou la croix d'un rang (voir « Corriger »).
6. Touchez « Vérifier et valider », relisez le résumé, puis « Confirmer et transmettre » (voir « Valider et attendre l'accusé de réception »).
7. Attendez « Bulletin reçu et verrouillé par le serveur » : sans ce message, le bulletin n'est pas reçu.
8. Si la connexion se coupe, gardez la page ouverte et, au retour du réseau, vérifiez si le bulletin est reçu avant de renvoyer quoi que ce soit (voir « Brouillon local »).

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

### En bref : ce que vous avez à faire

1. Ouvrez l'adresse remise par l'organisation, saisissez votre code personnel et touchez « Accéder à la compétition ».
2. Dans **Mon jugement**, attendez le bulletin portant la mention « Bulletin stagiaire, hors calcul officiel ».
3. Classez les dossards (glisser sur un rang) ou sélectionnez-les (éliminatoires) comme un juge (voir « Juger comme stagiaire »).
4. Touchez « Vérifier et valider » puis « Confirmer et transmettre » avant la fin du compte à rebours « Temps restant après le dernier juge officiel » (60 secondes).
5. Attendez « Bulletin reçu et verrouillé par le serveur » : sans ce message, le bulletin n'est pas reçu.
6. Après la compétition, lisez votre rapport dans **Examens** et imprimez-le depuis **Documents** (voir « Consulter son examen »).

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

### En bref : ce que vous avez à faire

1. Saisissez votre code personnel, touchez « Accéder à la compétition », puis ouvrez **Préparation**, rubrique **Personnes**.
2. Enregistrez chaque athlète et son inscription ; cochez « Confirmer cette nouvelle inscription » seulement après contrôle des documents, de la licence et du paiement (voir « Inscrire les athlètes »).
3. Importez les photos une par une et touchez « Autoriser la diffusion publique » seulement avec le consentement en main (voir « Photographies »).
4. Saisissez la taille et le poids dans la rubrique **Mesures**, puis « Confirmer » après contrôle physique (voir « Saisir les mesures »).
5. Renseignez les officiels (rubrique **Officiels**) et imprimez les documents, dont les « Bulletins vierges », depuis la rubrique **Documents** (voir « Officiels et documents »).
6. Pendant la cérémonie, dans **Récompenses** : « Récompense préparée », « Récompense remise », puis « Enregistrer la remise » (voir « Récompenses »).

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

### En bref : ce que vous avez à faire

1. Saisissez votre code personnel et touchez « Accéder à la compétition » sur l'ordinateur de régie.
2. Sur l'ordinateur relié au projecteur, ouvrez /screen/main, /screen/secondary, /screen/backstage ou /screen/speaker (voir « Ouvrir les écrans publics »).
3. Dans **Régie & écrans**, panneau « Préparer la scène », choisissez l'écran cible et le contenu (voir « Préparer et diffuser une scène »).
4. Contrôlez « Aperçu du contenu préparé », puis touchez « Diffuser sur … ».
5. Pour un résultat, attendez la validation du chef ; pour une cérémonie, diffusez « Révélation progressive » place par place avant « Podium » et « Classement ».
6. Suivez les cartes de **Récompenses** et touchez « Imprimer la liste » pour la cérémonie (voir « Récompenses »).

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

### En bref : ce que vous avez à faire

1. Saisissez votre code personnel et touchez « Accéder à la compétition ».
2. Dans **Régie & écrans**, touchez « Ouvrir l'écran speaker » (voir « Suivre le plateau »).
3. Lisez le tableau « Conduite et prononciations » : dossard, athlète, prononciation du nom, club et pays des athlètes appelés sur le plateau.
4. N'annoncez que ce qui est affiché : la régie pilote les scènes, le chef valide les résultats.

Le speaker dispose des onglets Vue d'ensemble, Régie & écrans et Aide.

### Suivre le plateau

1. Onglet **Régie & écrans** : l'écran « Espace speaker » propose « Ouvrir l'écran speaker ».
2. La vue speaker affiche la scène en cours et le tableau « Conduite et prononciations » : dossard, athlète, prononciation du nom, club et pays, pour les athlètes actuellement appelés sur le plateau.
3. Le speaker n'annonce que ce qui est affiché : la régie pilote les scènes, le chef valide les résultats.

## Profil : Commission
Rôles : commission

### En bref : ce que vous avez à faire

1. Saisissez votre code personnel et touchez « Accéder à la compétition ».
2. Dans **Examens**, panneau « Planifier et décider », choisissez le stagiaire, cochez les manches, puis « Enregistrer le programme d'examen » (voir « Programmer et décider un examen »).
3. Après les manches examinées, lisez le rapport de concordance du stagiaire dans **Examens**.
4. Saisissez la décision et son motif, puis « Consigner la décision signée » ; « Imprimer le rapport » produit la version papier.
5. Dans **Collectifs**, consultez les classements par club ou par pays et consignez un « Départage documenté » si nécessaire (voir « Classements collectifs »).

La commission dispose des onglets Vue d'ensemble, Collectifs, Examens, Documents et Aide.

### Programmer et décider un examen

1. Onglet **Examens**, panneau « Planifier et décider » : choisissez le stagiaire, cochez les manches à examiner, puis « Enregistrer le programme d'examen ».
2. Le rapport compare le bulletin du stagiaire au bulletin versionné du chef : moyenne, catégories évaluées, paires comparées, concordance par manche.
3. Saisissez la décision et son motif, puis « Consigner la décision signée ». « Imprimer le rapport » produit la version papier.

### Classements collectifs

- Onglet **Collectifs** : classements par club ou par pays calculés par le serveur, et « Départage documenté » pour consigner un départage avec motif (« Signer le départage » est réservé à la direction).

## Tous les profils
Rôles : tous

### En bref : ce que vous avez à faire

1. Avant la compétition, vérifiez que les « Bulletins vierges » de chaque catégorie sont imprimés depuis **Documents** (voir « Plan papier de secours »).
2. Après chaque action, attendez « Modification enregistrée sur le serveur » ou « Bulletin reçu et verrouillé par le serveur » : sans ce message, rien n'est enregistré.
3. Si la connexion se coupe, gardez la page ouverte, rétablissez le réseau et attendez « Connecté au serveur » (voir « Perte de connexion »).
4. Si « L'état a changé sur un autre appareil » apparaît, relisez votre saisie puis relancez l'action ; si « Session expirée » apparaît, reconnectez-vous avec le même code.
5. Si le réseau reste coupé pendant une manche, appliquez le plan papier : feuille remplie, signée et remise au chef (voir « Plan papier de secours »).
6. En cas de doute, appelez la personne compétente (voir « Qui appeler »).

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
