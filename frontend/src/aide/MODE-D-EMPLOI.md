# Mode d'emploi — FIBDA Compétition

Ce mode d'emploi décrit ce que l'application fait réellement, profil par profil. Il est affiché dans l'application, onglet **Aide**, filtré selon vos rôles. Si vous lisez le fichier complet, cherchez la section « Profil » qui vous concerne, puis « Tous les profils » à la fin. Chaque profil commence par un « En bref » : les gestes à faire, dans l'ordre. Le détail suit pour ceux qui veulent comprendre.

**Se connecter.** Ouvrez l'adresse remise par l'organisation dans Safari ou Chrome : https://fibda-bodybuilding.vercel.app (la version d'entraînement est https://fibda-bodybuilding-demo.vercel.app, avec des données fictives). Saisissez votre **code personnel** puis touchez « Accéder à la compétition ». Le code est unique et personnel : ne le partagez jamais, même pour dépanner un collègue. Sur téléphone, ajoutez la page à l'écran d'accueil (menu « Partager » puis « Sur l'écran d'accueil » sur iPhone ; menu du navigateur puis « Ajouter à l'écran d'accueil » sur Android) : l'application s'ouvre ensuite comme une application ordinaire. La session reste ouverte au maximum 16 heures ; « Déconnexion » en haut à droite la ferme.

**Accusé de réception.** Le serveur en ligne est la seule référence. Une action n'est enregistrée que lorsque l'application affiche « Modification enregistrée sur le serveur » ou, pour un bulletin, « Bulletin reçu et verrouillé par le serveur ». L'indicateur « Connecté au serveur » signifie seulement que la liaison est récente : il ne prouve pas qu'un bulletin a été envoyé.

**Connexion interrompue.** Si l'application affiche « Connexion interrompue » ou « Reconnexion… », gardez la page ouverte, vérifiez le réseau mobile ou le Wi-Fi du téléphone, puis attendez le retour de « Connecté au serveur ». L'état se rafraîchit automatiquement toutes les quelques secondes. Ce que vous aviez saisi reste un brouillon sur votre appareil ; rien n'est envoyé sans votre action explicite.

## Profil : Déroulé complet d'une compétition
Rôles : chief, responsable, director, secretariat

### En bref : ce que vous avez à faire

Avant tout, ouvrez l'onglet **Parcours** (onglet d'arrivée après connexion) : il présente ces étapes dans l'ordre, marque celle à faire maintenant, explique ce qui bloque, et porte le bouton de chaque étape et ses documents à imprimer (voir « Suivre le parcours »).

1. Créez et approuvez les accès de l'équipe dans **Préparation**, rubrique **Jury** (voir « 1. Créer les accès de l'équipe »).
2. Renseignez l'événement, le critère collectif et les trois cases de contrôle dans la rubrique **Événement**, puis « Enregistrer l'événement » (voir « 2. Renseigner l'événement et sa liste de contrôle »).
3. Enregistrez chaque athlète sur une seule fiche (identité, contrôles, taille et poids, « Mesures confirmées ») dans la rubrique **Athlètes** : cochez une ou plusieurs catégories actives dans « Catégories d'inscription » (un athlète peut concourir dans plusieurs catégories) ou laissez tout décoché pour que le référentiel propose la catégorie et la crée si elle manque ; à « Enregistrer », une inscription est créée par catégorie cochée (confirmée si les contrôles sont cochés, sinon en brouillon). Dans **Catégories**, créez autant de catégories que nécessaire, activez ou désactivez-les (seules les actives reçoivent des athlètes et sont jouées) et fusionnez celles trop peu fournies (voir les étapes 3 à 5).
4. Ordonnez le programme et touchez « Attribuer les dossards », composez le jury et « Enregistrer le jury », puis « Générer les manches » (rubriques **Programme** et **Jury** ; voir les étapes 6 à 8).
5. Touchez « Démarrer la compétition » dans la rubrique **Événement**, puis « Télécharger une sauvegarde complète » dans **Documents** (voir « 9. Démarrer la compétition »).
6. Pour chaque manche, dans **Compétition** : « Ouvrir le dossier », attendez « Reçu » pour chaque juge officiel, puis « Valider les résultats sportifs » (voir « 10. Conduire une manche »).
7. Faites diffuser les résultats validés par la régie dans **Régie & écrans** ; discipline terminée, remettez les récompenses dans **Récompenses**, « Créer le toutes catégories » dans **Compétition**, puis « Terminer cette discipline » (voir les étapes 11 et 12).
8. Téléchargez la sauvegarde finale et les documents dans **Documents**, puis « Terminer la compétition » dans la rubrique **Événement** (voir « 13. Clôturer la compétition »).

Cette section suit une compétition du début à la fin, dans l'ordre que le serveur impose. Chaque étape indique où agir (onglet, rubrique, panneau, bouton), ce que l'action fait réellement, pourquoi elle est exigée, et le message affiché si elle a été oubliée. Les profils détaillés plus bas reprennent chaque écran ; ici, seul l'enchaînement compte. Faites une sauvegarde après chaque étape clé (étape 14).

### Suivre le parcours

- Où : onglet **Parcours**, premier onglet, ouvert d'office après connexion pour le chef, le responsable, le directeur et le secrétariat (les juges et stagiaires ne le voient pas).
- Ce que cela montre : les onze étapes ci-dessous, de « Créer les accès de l'équipe » à « Clôturer la compétition », dans l'ordre imposé par le serveur. Chaque étape porte un état : **Fait** (coche verte), **À faire maintenant** (une seule à la fois : la première non faite dont les conditions sont remplies), **Bloqué** (grisé, avec la raison en une phrase : « 2 juges approuvés sur 5 requis », « aucune inscription confirmée », « dossards non attribués », « 1 finale de bodybuilding reste à valider »…), **À venir**. Les étapes de compétition restent « À venir » tant que la compétition n'est pas démarrée.
- Le bouton de l'étape : quand l'action est une commande simple, le bouton agit sur place (« Attribuer les dossards », « Générer les manches », « Démarrer la compétition », « Valider les résultats sportifs », « Passer à la manche suivante », « Confirmer les remises des catégories », « Créer le toutes catégories Amateur », « Terminer cette discipline », « Terminer la compétition »). Quand il faut saisir (comptes, événement, athlètes, catégories, jury), le bouton ouvre l'onglet **Préparation** et nomme la rubrique à choisir (« Ouvrir Préparation › Athlètes »). Un bouton réservé à un autre rôle est remplacé par la mention du rôle. Si le serveur refuse malgré tout, son message s'affiche tel quel sous le bouton.
- Les documents de l'étape : fiches d'inscription et fiches vierges dès les athlètes, ordre de passage après les manches, fiches de notation après le démarrage (et celles de la manche en cours), résultats, récompenses, diplômes, récapitulatif jury et exports à la clôture. La sauvegarde complète est proposée après les manches, après le démarrage, à chaque fin de discipline et à la clôture (chef et directeur).
- Pendant la compétition : l'étape « Conduire la manche en cours » affiche la manche active (catégorie, phase, bulletins officiels et stagiaires reçus, absents déclarés), « Ouvrir le dossier (Compétition) », « Valider les résultats sportifs » quand tous les bulletins sont reçus, « Passer à la manche suivante », ou « Confirmer le toutes catégories » pour un champion seul. L'étape « Terminer la discipline » liste ses quatre gestes dans l'ordre du serveur, chacun coché quand il est fait.
- Le parcours ne remplace pas les rubriques : tous les onglets restent accessibles pour sortir du couloir prévu (décision du PO, 24/09/2026).

### 1. Créer les accès de l'équipe

- Où : onglet **Préparation**, rubrique **Jury**, panneau « Inviter un membre », bouton « Créer l'accès ». Puis panneau « Accès et approbations », bouton « Approuver » sur chaque compte (chef uniquement).
- Ce que cela fait : chaque personne reçoit un code personnel et des rôles. Un code compte de 4 à 128 caractères ; pour un chef, un responsable ou un directeur, le serveur refuse moins de 8 caractères avec « Le code d'un accès de direction doit contenir au moins 8 caractères. ». Seul le chef peut créer un accès de direction. Jusqu'à trois comptes « chef de jury » peuvent exister (un chef en crée un autre depuis « Inviter un membre ») ; chaque manche garde un seul chef dans son panel, et c'est son bulletin qui sert de référence pour cette manche.
- Pourquoi : un compte non approuvé ne peut rien faire, et un juge ne peut être placé dans le jury (étape 7) que s'il est approuvé. Créez et approuvez tous les juges avant de composer le jury.
- Si oublié : le juge voit « Aucune manche affectée » et le jury ne peut pas être enregistré avec lui.

### 2. Renseigner l'événement et sa liste de contrôle

- Où : **Préparation**, rubrique **Événement** : nom, date, lieu, mode, puis « Enregistrer l'événement ».
- Le mode : « National · classement officiel ivoirien » réserve le classement officiel (titres, récompenses, toutes catégories) aux athlètes de nationalité CI ; « International · délégations approuvées » le réserve aux athlètes dont la délégation et l'organisation ont été approuvées sur la fiche. La date et le mode sont figés au démarrage (« Date et mode figés après démarrage. »).
- Le « Critère collectif publié de départage » est un texte libre : la règle, annoncée avant la compétition, qui départage deux clubs ou deux pays à égalité de points et de places dans les classements collectifs (onglet Collectifs ; barème 15/10/5/4/3 puis 1 point par place de finale et de toutes catégories, 1 point par éliminé avant la finale, décision FIBDA du 24/09/2026). Le serveur l'exige avant le démarrage et le fige ensuite (« Le critère collectif est figé dès le démarrage. »), pour qu'aucun départage ne soit inventé après coup.
- Les trois cases « Le référentiel applicable et ses réserves ont été vérifiés par l'organisation », « Réseau local et accès des appareils contrôlés » et « Sauvegarde de départ réalisée et contrôlée » sont une liste de vérification signée par la direction : cocher ne déclenche rien, mais atteste que le contrôle a été fait.
- Si oublié : « Démarrer la compétition » répond « Validez le règlement, le réseau, la sauvegarde et le critère collectif avant ouverture. » tant qu'une case ou le critère manque.

### 3. Les catégories : créées automatiquement ou à la main, activables, fusionnables

- Catégories modulables : créez-en autant que vous voulez (à la main ou automatiquement), puis activez ou désactivez chacune (bouton « … » de la ligne) dans « Catégories engagées » (colonne « État » : Active ou Inactive ; bouton « Désactiver » ou « Activer », chef et responsable). Seules les catégories actives reçoivent des athlètes et sont jouées : une catégorie désactivée garde ses inscriptions et reste dans la liste, grisée et barrée, mais elle n'est plus proposée à l'inscription, n'a ni dossard ni manche, et une inscription qu'on tenterait d'y créer est refusée (« Catégorie désactivée. »). Activer ou désactiver reste possible après les dossards et pendant la compétition tant que la catégorie n'a pas commencé ; désactiver retire ses manches en attente, réactiver n'en recrée pas (relancez « Générer les manches »). Une nouvelle catégorie est active à sa création.
- Il n'est plus nécessaire de créer les catégories à l'avance : à l'enregistrement d'une fiche athlète complète (étape 4), le serveur propose la catégorie du référentiel correspondant au sexe, à l'âge, à la taille et au poids, et l'application la crée dans la section de l'athlète si elle n'existe pas encore (« Catégorie proposée : … (créée automatiquement). »). Une catégorie déjà créée pour l'une des règles proposées est toujours préférée à une création.
- Pour créer ou ajuster une catégorie à la main : **Préparation**, rubrique **Catégories**, panneau « Catégorie et référentiel » : « Règle du catalogue » (référentiel IFBB) ou, quand la classe voulue n'y est pas, « Règle personnalisée (hors référentiel) » : discipline, division, mesure (taille, poids ou aucune pour une classe ouverte), « Au-dessus de » (exclu) et « Jusqu'à » (inclus), âges facultatifs, nom de la règle ; puis « Nom affiché », « Section » (Amateur ou Professionnel), « Première phase », « Places en finale », « Quota éliminatoire », puis « Enregistrer la catégorie ». Une règle personnalisée contrôle l'admission des athlètes exactement comme une règle du référentiel (sexe de la discipline, bornes, âges) ; l'organisateur en répond. « Modifier » dans « Catégories engagées » ouvre une catégorie existante (par exemple pour changer son nom affiché ou sa première phase). La création manuelle n'est pas limitée en nombre.
- Fusionner (chef uniquement, avant les dossards) : panneau « Catégories engagées », bloc « Fusion de catégories (chef, avant attribution des dossards) » : cochez au moins deux catégories actives de même discipline, sexe, section et groupe d'âge (chaque ligne rappelle ces critères et le nombre d'inscrits), donnez éventuellement un « Nom de la catégorie fusionnée » (sinon les noms sont enchaînés, « A / B »), puis « Fusionner les catégories sélectionnées ». Les inscriptions sont réaffectées à la catégorie fusionnée et les catégories d'origine archivées. Refus du serveur : « Fusion incompatible : discipline, sexe, section et groupe d'âge doivent correspondre. », « Fusion interdite après attribution des dossards. », « Fusion refusée : une personne figurerait deux fois. ».
- Ce que cela fait : la règle du catalogue fixe la discipline, le sexe, la division (senior, junior ou masters avec ses bornes d'âge) et la tranche de taille ou de poids. Le nom d'une règle se lit ainsi : « Bikini senior > 162 à ≤ 164 » accepte une taille strictement supérieure à 162 cm et jusqu'à 164 cm inclus ; « Bodybuilding senior ≤ 65 » accepte jusqu'à 65 kg inclus ; « Bodybuilding senior > 100 » commence strictement au-dessus de 100 kg. Une athlète mesurant exactement 162,0 cm relève donc de la tranche « > 160 à ≤ 162 ».
- « Première phase » laissée sur « Automatique selon l'effectif » laisse le serveur décider (étape 8). « Places en finale » (6 par défaut) est le nombre de qualifiés à l'issue d'une demi-finale ; « Quota éliminatoire » (15 par défaut) le nombre de qualifiés à l'issue d'une éliminatoire.
- Pourquoi : chaque inscription est contrôlée contre les bornes de sa règle (étape 4). Une catégorie inscrite ne peut plus changer de règle ni de section.
- Après les dossards, une catégorie peut encore être créée ou modifiée tant qu'elle n'a pas commencé (règle assouplie le 26/09) ; une inscription qui arrive alors est tardive et reçoit un nouveau dossard. Seule la fusion de catégories reste figée après les dossards.

### 4. Enregistrer les athlètes : une seule fiche, une ou plusieurs catégories

- Où : **Préparation**, rubrique **Athlètes**, panneau « Nouvelle fiche athlète » : identité, date de naissance, sexe, nationalités, pays, club, « Téléphone (WhatsApp de préférence) », section, « Taille (cm) », « Poids (kg) — pesée », cases de contrôle dont « Mesures confirmées (taille et poids contrôlés) », bloc « Catégories d'inscription », puis « Enregistrer ».
- Plusieurs catégories : le bloc « Catégories d'inscription » liste, sous forme de cases à cocher, les catégories actives de la section de la fiche (Amateur ou Professionnel ; le cumul amateur/pro est interdit et une catégorie désactivée n'est pas proposée). Cochez une ou plusieurs catégories : un athlète peut concourir dans plusieurs catégories. Les catégories où la personne est déjà inscrite apparaissent cochées et verrouillées (« déjà inscrit »).
- Ce que fait « Enregistrer » : la fiche est enregistrée, puis une inscription est créée dans chaque catégorie cochée où la personne n'est pas encore inscrite (une commande par catégorie, dans l'ordre de la liste) : « Inscription confirmée dans … » si « Statut approuvé », « Licence contrôlée », « Paiement reçu » et « Mesures confirmées » sont cochés, sinon « Inscription en brouillon dans … : cochez … puis touchez « Confirmer l'inscription » ». Le message récapitule toutes les inscriptions créées et les refus, chaque refus avec le motif du serveur tel quel (« Refus pour … : … », par exemple « Personne déjà inscrite dans cette catégorie. » ou « Catégorie désactivée. ») ; un refus n'empêche pas les autres catégories. Si le serveur refuse la confirmation, l'inscription reste en brouillon et son motif est affiché. La fiche reste ouverte : « Nouvelle fiche » vide le formulaire pour l'athlète suivant.
- Catégorie proposée automatiquement : si rien n'est coché, que la fiche n'a encore aucune inscription et que sexe, date de naissance, taille et poids sont renseignés, l'application interroge le référentiel, coche la catégorie proposée (créée si elle manque, voir l'étape 3 ; une catégorie existante active est toujours préférée) et crée l'inscription comme ci-dessus. Si la catégorie proposée existe mais est désactivée, rien n'est créé : « Catégorie proposée : …, mais elle est désactivée. Réactivez-la dans la rubrique Catégories ou cochez une autre catégorie. ». Une fiche qui a déjà des inscriptions et rien de nouveau coché est enregistrée sans changement (« Inscriptions inchangées »).
- Ajouter une catégorie ensuite : ouvrez la fiche, cochez la catégorie supplémentaire, « Enregistrer ». « Vérifier les catégories proposées » (fiche déjà enregistrée) affiche la liste « Catégories proposées par le référentiel » avec leurs motifs ; chaque ligne offre « Inscrire dans … » (catégorie existante active) ou « Créer la catégorie … » (autre règle compatible, par exemple Men's Physique plutôt que Bodybuilding) ; une ligne « Catégorie désactivée » n'offre aucune action. Plusieurs propositions (bodybuilding et classic, par exemple) : la première est retenue, les autres sont listées (« Autres catégories possibles : … »).
- Retirer d'une catégorie : le panneau « Inscriptions de cette personne » liste toutes les inscriptions (dossard, état, et le cas échéant « catégorie désactivée, non jouée ») ; « Retirer de cette catégorie » (chef, responsable, directeur, secrétariat) supprime cette inscription seule, après confirmation nommant l'athlète et la catégorie ; la fiche de l'athlète reste et ses autres inscriptions aussi. Refus serveur si la catégorie a commencé (« La catégorie a déjà commencé. »). Ce n'est pas « Supprimer cette fiche », qui efface l'athlète de l'application avec toutes ses inscriptions. Changer de catégorie = cocher la nouvelle puis « Enregistrer », et retirer l'ancienne.
- Aucune proposition : « Aucune catégorie du référentiel ne correspond à cette fiche … » ; cochez une catégorie dans « Catégories d'inscription », le serveur demandera alors la dérogation du chef.
- Nationalités : en mode national, seuls les athlètes dont les nationalités contiennent CI entrent dans le classement officiel, quel que soit le pays représenté. Les autres sont jugés et classés dans le classement commun, sans titre.
- Les cases « Statut approuvé », « Licence contrôlée », « Paiement reçu » sont exigées pour confirmer une inscription ; « Autorisation du mineur » l'est pour un athlète de moins de 18 ans ; « Délégation approuvée » et « Organisation approuvée » le sont en mode international.
- L'âge retenu est l'année de l'événement moins l'année de naissance, sans tenir compte du jour. Il sert aux divisions junior et masters et au contrôle des mineurs.
- « Inscription à contrôler : Âge ou mesures hors catégorie. » : la fiche (âge, taille, poids) ne correspond à aucune borne de la règle de la catégorie choisie. Corrigez la fiche, choisissez une autre catégorie, ou (chef uniquement) saisissez un « Motif de dérogation, réservé au chef (facultatif) » avant de confirmer : la dérogation est signée du chef et conservée avec ses motifs.
- « Inscription à contrôler : Crossover Junior/Masters vers Senior à autoriser par le chef. » : l'athlète a l'âge d'une division junior ou masters de cette discipline mais s'inscrit en senior. Seul le chef peut cocher « Crossover Junior/Masters vers Senior autorisé par le chef » sur la fiche.
- « Inscription à contrôler : Contrôle requis : … » : une case de contrôle manque ; « measurements_confirmed » désigne « Mesures confirmées ».
- Supprimer des athlètes (chef seulement) : dans la liste « … personnes », cochez une ou plusieurs fiches (ou « Tout sélectionner ») puis « Supprimer la sélection » ; sur une fiche ouverte, « Supprimer cette fiche ». Une confirmation nomme les personnes concernées. La suppression retire la fiche, ses inscriptions, son dossard et ses photos ; elle est refusée dès qu'une catégorie de la personne a commencé (« La catégorie a déjà commencé. »). Définitif : seule une sauvegarde antérieure (étape 14) permet de revenir en arrière.
- Inscription tardive : dès que les dossards sont attribués ou la compétition démarrée, un bandeau l'annonce dans la rubrique et « Enregistrer » crée automatiquement une inscription tardive par catégorie cochée (chef et responsable), confirmée, avec un nouveau dossard ; le « Motif d'inscription tardive » est pré-rempli « Inscription tardive » et modifiable. Limite serveur : avant le premier tour de la catégorie (« La catégorie a déjà commencé. ») ; la catégorie peut être créée à ce moment-là si elle manque. Le secrétariat enregistre la fiche ; l'inscription tardive lui est signalée comme réservée au chef et au responsable.

### 5. Mesures et confirmation des inscriptions

- Où : sur la fiche athlète (rubrique **Athlètes**) : « Taille (cm) », « Poids (kg) — pesée » et la case « Mesures confirmées (taille et poids contrôlés) », puis « Enregistrer ». La rubrique **Mesures** reste disponible pour la vue d'ensemble et le contrôle ligne par ligne (« Confirmer »). Le poids est facultatif pour les disciplines classées à la taille (Men's Physique, Classic Physique, Bikini, Wellness) : la taille suffit pour proposer la catégorie et confirmer les mesures ; le poids reste nécessaire pour une classe au poids (Bodybuilding). Le serveur accepte une décimale (« Mesure positive au dixième requise. ») ; modifier la taille ou le poids d'une fiche existante annule la confirmation des mesures, sauf si la case est cochée lors de l'enregistrement ; une mesure qui sortirait une inscription déjà confirmée de sa catégorie est refusée (« Mesures incompatibles avec une inscription confirmée. »).
- Puis, si l'inscription a été créée en brouillon : rubrique **Athlètes**, « Inscriptions de cette personne », « Confirmer l'inscription ».
- Pourquoi : seules les inscriptions confirmées reçoivent un dossard et entrent dans les manches. Une inscription confirmée refuse ensuite toute modification incompatible de taille ou de poids (« Modification incompatible avec une inscription confirmée ; déconfirmer avant correction. »).
- Le compteur « Mesures confirmées » de la Vue d'ensemble suit l'avancement.
- Si oublié : au démarrage, le serveur recontrôle chaque inscription confirmée et refuse d'ouvrir avec « Inscriptions confirmées à recontrôler : … ».

### 6. Ordonner le programme et attribuer les dossards

- Où : **Préparation**, rubrique **Programme**, panneau « Ordre de passage » : flèches ↑ et ↓ pour ordonner les catégories, puis « Attribuer les dossards ».
- Condition : toutes les inscriptions des catégories actives doivent être confirmées. Sinon le serveur refuse et nomme les athlètes concernés (« Inscriptions à confirmer avant les dossards : … ») : ouvrez chaque fiche, cochez les contrôles manquants (dont « Autorisation du mineur » pour un athlète de moins de 18 ans), puis « Confirmer l'inscription » dans « Inscriptions de cette personne », et recommencez.
- « Annuler les dossards » (chef et responsable) efface tous les numéros et permet de recommencer l'attribution ; refusé dès qu'une manche a été ouverte.
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
9. Absent à l'appel : dans le dossier de la manche (en attente ou ouverte, avant le premier bulletin), le panneau « Présence à l'appel » liste les athlètes ; indiquez le « Motif de l'absence » puis « Déclarer absent ». L'athlète est retiré de cette manche et des manches suivantes de la catégorie, et ne rapporte aucun point à son club s'il n'a été aligné dans aucune manche validée (décision du 24/09/2026 : un absent ne compte aucun point) ; un athlète absent après une éliminatoire déjà validée garde le point de participation de cette éliminatoire. « Rétablir » annule l'absence tant qu'aucun bulletin n'est reçu ; après un bulletin, le serveur refuse (« Un bulletin a déjà été reçu : traitez l'absence par un incident. ») et l'absence se traite par « Suspendre et consigner ».

### 11. Diffuser sur l'écran public

- Où : onglet **Régie & écrans**, panneau « Préparer la scène » : « Écran cible », « Contenu », puis « Diffuser sur … » après contrôle de « Aperçu du contenu préparé ».
- Les contenus : « Accueil » (page neutre), « Catégorie / mosaïque » (athlètes appelés sur le plateau), « Qualifiés » (après une éliminatoire ou une demi-finale validée), « Révélation progressive », « Podium », « Classement » (finales et toutes catégories validés), « Un officiel », « Mosaïque des officiels ».
- Le serveur refuse toute scène de résultat sur une manche non validée (« Résultat non validé : diffusion interdite. »). Côté régie, le champ « Manche » ne propose déjà que les manches de la catégorie choisie et, pour un contenu de résultat, que les manches validées.
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
- Avant de toucher le bouton : téléchargez la sauvegarde finale (étape 14) et les documents de l'onglet **Documents** (Résultats, Récompenses, Diplôme, Récapitulatif jury, exports « Résultats CSV », « Résultats XLSX » et « Résultats PDF »).

- **Revenir en préparation** (rubrique **Événement**, chef seulement, saisie de REINITIALISER) : pour rejouer un lancement après des essais. Efface manches, bulletins, résultats, récompenses et examens ; conserve comptes, athlètes, catégories, dossards et jury ; invalide les brouillons des téléphones. À ne jamais utiliser pendant une compétition réelle.
- **Vider la compétition** (rubrique **Événement**, chef seulement, saisie de VIDER) : pour repartir de zéro après des essais ou un semis de test. Efface athlètes, inscriptions, catégories, officiels, jury, manches, résultats, récompenses, examens, photos et logos ; conserve les comptes et l'identité de l'événement (nom, date, lieu, mode, liste de contrôle) ; invalide les brouillons des téléphones. Définitif : téléchargez une sauvegarde avant (étape 14).

### 14. Sauvegarder à chaque étape clé

- Où : onglet **Documents** (ou rubrique **Documents** de Préparation), panneau « Sauvegarde et restauration », bouton « Télécharger une sauvegarde complète ».
- Quand : après les dossards et les manches (fin de l'étape 8), juste après « Démarrer la compétition », après chaque discipline terminée, avant et après « Terminer la compétition ».
- Quoi : un fichier JSON contenant l'événement complet et les comptes. Copiez-le hors du téléphone ou de l'ordinateur, sur un support contrôlé.
- Sensibilité : le fichier contient l'identité des athlètes (dont des mineurs), les photos et les codes hachés. Ne le partagez jamais par messagerie et supprimez-le après la compétition. La restauration remplace l'événement en ligne et déconnecte tous les appareils : ne l'utilisez qu'après avoir prévenu tout le monde et arrêté le jugement.

## Profil : Chef de jury et responsable
Rôles : chief, responsable

### En bref : ce que vous avez à faire

Suivez l'onglet **Parcours** : il indique l'étape à faire maintenant, ce qui bloque, et porte le bouton de chaque étape ; les rubriques ci-dessous restent accessibles à tout moment (voir « Suivre le parcours » dans le déroulé complet).

1. Créez les accès dans **Préparation**, rubrique **Jury**, puis « Approuver » chaque compte (voir « Créer les accès de l'équipe »).
2. Renseignez l'événement, puis enregistrez chaque athlète sur une seule fiche (identité, contrôles, taille, poids, « Mesures confirmées ») en cochant une ou plusieurs catégories actives, ou en laissant le référentiel proposer et créer la catégorie ; créez, activez ou désactivez, ajustez ou fusionnez les catégories (rubriques **Événement**, **Athlètes**, **Catégories** ; **Mesures** pour la vue d'ensemble).
3. Ordonnez le programme, « Attribuer les dossards », composez le jury, puis « Générer les manches » (rubriques **Programme** et **Jury** ; voir « Dossards et programme » et « Composer le jury »).
4. Touchez « Démarrer la compétition » dans la rubrique **Événement**, puis « Télécharger une sauvegarde complète » dans **Documents** (voir « Sauvegarder »).
5. Dans **Compétition**, ouvrez le dossier de chaque manche et attendez « Reçu » pour chaque juge officiel (voir « Ouvrir une manche et suivre les bulletins »).
6. Touchez « Valider les résultats sportifs », puis « Passer à la manche suivante » si elle ne s'ouvre pas seule (voir « Valider les résultats »).
7. Après les finales d'une discipline : remises dans **Récompenses**, « Créer le toutes catégories » dans **Compétition**, puis « Terminer cette discipline » (voir « Récompenses et toutes catégories »).
8. Téléchargez la sauvegarde finale et les documents dans **Documents**, puis « Terminer la compétition » dans la rubrique **Événement** (voir « Clôturer la compétition »).

Le chef de jury et le responsable disposent des onglets Parcours, Vue d'ensemble, Préparation, Mon jugement, Compétition, Régie & écrans, Récompenses, Collectifs, Examens, Documents et Aide. Le chef voit aussi Traçabilité. Certaines actions sont réservées au seul chef : approuver un accès, fusionner des catégories, valider une manche, saisir un bulletin papier, corriger, confirmer un toutes catégories, réduire un jury, résoudre un incident, supprimer ou désactiver (voir « Supprimer (chef seulement) »).

### Créer les accès de l'équipe

1. Ouvrez **Préparation**, rubrique **Jury**, panneau « Inviter un membre ».
2. Saisissez le nom, un code personnel et cochez les rôles. Un code compte de 4 à 128 caractères ; pour un chef, un responsable ou un directeur, il doit compter **au moins 8 caractères**. Touchez « Créer l'accès ».
3. Dans « Accès et approbations », touchez « Approuver » pour chaque compte qui doit travailler (chef uniquement). Un compte non approuvé ne peut rien faire.
4. Remettez chaque code séparément à son titulaire. Un directeur ne vote jamais, même s'il cumule le rôle de juge.
5. Modifier un compte (chef seulement) : dans « Accès et approbations », le bouton « … » de la ligne du compte puis « Modifier » (jamais le vôtre ni un chef) : le panneau de gauche passe en « Modifier le compte de … » avec le nom, les fonctions et « Nouveau code (laisser vide pour conserver) », puis « Enregistrer le compte ». Le rôle de chef ne se donne ni ne se retire ici ; un compte qui a siégé garde sa fonction de vote (refus serveur affiché tel quel). Un nouveau code déconnecte l'appareil du juge : il devra se reconnecter avec le nouveau code.

### Renseigner l'événement

- Dans **Préparation**, rubrique **Événement** : nom, date, lieu et mode (National ou International), puis « Enregistrer l'événement ».
- Les trois cases de contrôle (référentiel vérifié, réseau contrôlé, sauvegarde de départ réalisée) servent de liste de vérification avant le démarrage.
- Le mode ne peut plus être changé une fois la compétition démarrée.

### Enregistrer les athlètes

1. Rubrique **Athlètes**, panneau « Nouvelle fiche athlète » : identité, date de naissance, sexe, nationalités, pays, club, « Téléphone (WhatsApp de préférence) », section (Amateur ou Professionnel), « Taille (cm) », « Poids (kg) — pesée », cases de contrôle et « Mesures confirmées (taille et poids contrôlés) », bloc « Catégories d'inscription », puis « Enregistrer ». Le drapeau affiché à côté des nationalités vient du code pays saisi (CI pour la Côte d'Ivoire).
2. « Catégories d'inscription » : cochez une ou plusieurs catégories actives de la section de la fiche (un athlète peut concourir dans plusieurs catégories ; une catégorie désactivée n'est pas proposée). À l'enregistrement, une inscription est créée par catégorie cochée : « Inscription confirmée dans … » quand « Statut approuvé », « Licence contrôlée », « Paiement reçu » et « Mesures confirmées » sont cochés, sinon « Inscription en brouillon dans … » ; le message récapitule créations et refus (motif serveur tel quel). Rien de coché sur une fiche sans inscription : la catégorie est proposée par le référentiel (créée si elle manque) et l'inscription créée. Pour ajouter une catégorie plus tard : rouvrez la fiche, cochez-la, « Enregistrer ». « Vérifier les catégories proposées » liste les catégories admissibles avec « Inscrire dans … » ou « Créer la catégorie … ». Pour retirer l'athlète d'une catégorie sans effacer sa fiche : « Retirer de cette catégorie » dans « Inscriptions de cette personne » (confirmation nominative, refusé si la catégorie a commencé) ; « Supprimer cette fiche », lui, efface l'athlète de l'application.
3. Une catégorie hors critères exige le « Motif de dérogation, réservé au chef (facultatif) » : la dérogation est signée du chef et conservée avec ses motifs. Après les dossards ou une fois la compétition démarrée, « Enregistrer » crée automatiquement une inscription tardive (motif pré-rempli « Inscription tardive », modifiable), avec un nouveau dossard, dans une catégorie existante et tant qu'elle n'a pas commencé.
4. Un fichier CSV (UTF-8) ou XLSX (première feuille du classeur, sans formule) peut être importé depuis « Importer des inscriptions » : lisez la prévisualisation, corrigez les erreurs, puis confirmez.
5. Pour retirer des fiches (erreur de saisie, athlète de test) : cochez-les dans la liste « … personnes » puis « Supprimer la sélection », ou « Supprimer cette fiche » sur la fiche ouverte. Inscriptions, dossard et photos partent avec ; refusé si une de leurs catégories a commencé. Pour tout effacer sauf les comptes : rubrique **Événement**, « Vider la compétition » (chef, saisie de VIDER), après une sauvegarde.

### Photographies

1. Sur la fiche de la personne (rubrique **Athlètes**) ou de l'officiel (rubrique **Officiels**), bloc « Photographie et droit de diffusion » : choisissez le type (Portrait ou Plein pied), le fichier JPEG, PNG ou WEBP, recadrez si besoin, puis « Importer la photo ». La photo est réduite par le navigateur avant l'envoi (1 Mo au maximum) ; une image que le navigateur ne sait pas lire est refusée.
2. Une photo importée est **privée** : elle n'apparaît sur aucun écran public tant qu'elle n'est pas approuvée. Cochez « Consentement de diffusion recueilli et photo vérifiée » seulement si l'autorisation de la personne (ou de son représentant légal pour un mineur) est en votre possession, puis « Autoriser la diffusion publique ».
3. Importer une nouvelle photo remplace la précédente et annule l'approbation : il faut approuver de nouveau.
4. Import en lot : rubrique **Athlètes**, panneau « Importer un lot de photographies », choisissez plusieurs fichiers d'un coup. Chaque fichier est rattaché par son nom : « 12.jpg » = dossard 12, ou « Prenom Nom.jpg » (accents et majuscules ignorés) ; « 12-plein.jpg » pour la photo en pied, sinon le portrait. Le tableau montre qui est reconnu avant l'envoi ; « Importer N photos » envoie les fichiers un par un, réduits par le navigateur, et affiche le résultat par fichier. Un fichier non reconnu est ignoré : renommez-le ou passez par la fiche. Le consentement de diffusion se coche ensuite sur chaque fiche.
5. **Logo du club** : sur la fiche de l'athlète (rubrique **Athlètes**), le bloc « Logo du club » se trouve sous le champ Club. Il montre le logo déjà enregistré pour le club saisi (nom exact, espaces de bord ignorés) ; « Importer le logo » ou « Remplacer le logo » l'envoie réduit à 400 px de côté (un PNG garde sa transparence). Un logo vaut pour tous les athlètes du même club : il suffit de l'importer une fois. Il reste privé tant que vous n'avez pas coché « Autorisation d'usage du logo obtenue du club » puis « Autoriser l'affichage public du logo » ; un logo remplacé doit être autorisé de nouveau.
6. **Photo d'un officiel** : rubrique **Officiels**, ouvrez ou enregistrez le profil, puis utilisez le bloc « Photographie et droit de diffusion » sous le formulaire (une seule photo par officiel, de type Portrait), avec le même contrôle de consentement.
7. **Photo d'un juge** : un compte utilisateur n'a pas de photo. Rubrique **Jury**, panneau « Accès et approbations », colonne « Fiche officiel » : si aucune fiche officiel ne porte le nom du compte, « Créer la fiche officiel de ce compte » en crée une (prénom = premier mot du nom, nom = la suite, fonction = rôle du compte) ; complétez-la ensuite dans **Officiels**, où se prend la photo. Un compte dont le nom tient en un seul mot se crée directement dans **Officiels**.

### Contrôler les mesures

- Sur la fiche athlète (rubrique **Athlètes**) : « Taille (cm) », « Poids (kg) — pesée » et « Mesures confirmées (taille et poids contrôlés) », puis « Enregistrer ». La rubrique **Mesures** donne la vue d'ensemble et permet aussi de saisir et « Confirmer » ligne par ligne.
- Le compteur « Mesures confirmées » de la Vue d'ensemble suit l'avancement.

### Préparer les catégories

- Les catégories sont créées automatiquement à l'enregistrement des athlètes. Rubrique **Catégories** pour en créer (sans limite) ou ajuster une à la main : règle du catalogue ou « Règle personnalisée (hors référentiel) » quand la classe FIBDA n'existe pas dans l'IFBB (discipline, mesure, bornes, nom), nom affiché, section, première phase, places en finale et quota éliminatoire, puis « Enregistrer la catégorie ».
- Activer ou désactiver : dans « Catégories engagées », chaque ligne affiche son état (« Active » ou « Inactive ») et, sous le bouton « … », « Désactiver » ou « Activer » (chef et responsable). Seules les catégories actives reçoivent des athlètes, des dossards et des manches ; une catégorie désactivée garde ses inscriptions, reste listée grisée, et n'est plus proposée sur la fiche athlète. Possible tant que la catégorie n'a pas commencé (refus serveur sinon) ; réactiver après « Générer les manches » impose de relancer la génération.
- « Fusion de catégories (chef, avant attribution des dossards) » : cochez au moins deux catégories de même discipline, sexe, section et groupe d'âge, nommez éventuellement la catégorie fusionnée, puis « Fusionner les catégories sélectionnées ». Refus du serveur : « Fusion incompatible : discipline, sexe, section et groupe d'âge doivent correspondre. », « Fusion interdite après attribution des dossards. ».

### Dossards et programme

1. Rubrique **Programme** : ordonnez les catégories dans « Ordre de passage ».
2. Touchez « Attribuer les dossards » : l'action est unique, le bouton se grise ensuite. Le dossard appartient à l'inscription, pas à la personne.
3. Touchez « Générer les manches » : le serveur crée les manches (éliminatoires, demi-finale, finale) selon chaque catégorie. Elles apparaissent dans « Manches prévues ».

### Composer le jury

- Rubrique **Jury**, panneau « Composition du jury » : cochez les juges officiels, les stagiaires (hors calcul), définissez l'ordre de retrait des juges, puis « Enregistrer le jury ».
- Un juge ne reçoit un bulletin que s'il est approuvé et affecté au jury de la manche.
- Plusieurs chefs de jury (trois au plus) : un seul par panel. Composez le jury général avec l'un d'eux, puis, manche par manche, « Composition du jury de la manche » pour en placer un autre : le chef présent dans le panel est la référence de cette manche (départage, concordance).

### Démarrer la compétition

- Rubrique **Événement**, bouton « Démarrer la compétition ». L'état passe de « Préparation » à « En cours » et le mode se verrouille.
- Faites une sauvegarde juste après (voir « Sauvegarder »).

### Ouvrir une manche et suivre les bulletins

1. Onglet **Compétition** : dans « Programme sportif », touchez « Ouvrir le dossier » de la manche voulue.
2. Touchez « Ouvrir cette manche ». Les juges affectés voient aussitôt le bulletin sur leur téléphone.
3. Le panneau affiche « Juges officiels reçus », « Stagiaires reçus » et, pour chaque personne, « Reçu », « En attente » ou « Délai expiré ». Un juge n'a pas terminé tant que la ligne n'indique pas « Reçu ».
4. Après le dernier bulletin officiel, le serveur attend au plus 60 secondes les stagiaires, puis les marque hors délai sans inventer de note.
5. Athlète absent à l'appel : avant le premier bulletin, panneau « Présence à l'appel » du dossier, motif puis « Déclarer absent » ; l'athlète est retiré de la manche et des manches suivantes de la catégorie et ne rapporte aucun point à son club. « Rétablir » annule tant qu'aucun bulletin n'est reçu.
6. Après un bulletin reçu, une absence ne se déclare plus ici : suspendez la manche par « Suspendre et consigner » et traitez-la comme un incident.

- **Ordre de passage tiré au sort** : à l'ouverture de chaque manche, l'application tire au sort l'ordre de passage des athlètes encore en lice (après une éliminatoire ou une demi-finale, seuls les qualifiés sont tirés). Le dossier de la manche l'affiche ; « Tirer l'ordre de passage » le retire tant qu'aucun bulletin n'est reçu ; « Imprimer » l'édite pour la scène et le speaker. L'ordre de passage n'influence jamais le classement.

### Valider les résultats

- Quand tous les bulletins officiels sont reçus, le résultat calculé apparaît dans le dossier de la manche (rang, athlète, total) et le détail « Calculs, versions et classements ».
- Touchez « Valider les résultats sportifs » (chef uniquement). En cas d'arbitrage, cochez d'abord les athlètes dans « Qualification explicite ».
- « Passer à la manche suivante » ouvre la manche suivante du programme. Calculé, validé et diffusé sont trois états distincts : la diffusion reste sous le contrôle de la régie.

### Concordance avec le chef

- Dans le dossier d'une manche, le panneau « Concordance avec le chef » (chef de jury et responsable uniquement) affiche, pour chaque juge et stagiaire, le pourcentage de paires d'athlètes classées dans le même ordre que le bulletin du chef, et le nombre de paires comparées. C'est le même calcul que l'examen des stagiaires ; il n'est jamais visible des juges, du directeur ni du public.
- Tant que le bulletin du chef n'est pas reçu, aucune comparaison n'est affichée. Avant validation, la référence est le bulletin actuel du chef ; après validation, le bulletin du chef gelé à la validation (version indiquée). Un juge sans bulletin apparaît « Non reçu », sans pourcentage.
- Les éliminatoires (bulletin de sélection) ne sont pas comparées. Le panneau « Concordance avec le chef sur la compétition » donne, par juge, la moyenne de ses manches comparées, le nombre de manches et de paires. Ce tableau n'a aucun effet sur les résultats ni sur les examens.

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

### Supprimer (chef seulement)

Créer, consulter et modifier sont ouverts aux rôles de préparation ; supprimer est réservé au chef, toujours après une confirmation qui nomme ce qui va disparaître, et toujours définitif (seule une sauvegarde antérieure permet de revenir en arrière, voir « Sauvegarder »).

- Un compte : rubrique **Jury**, panneau « Accès et approbations », colonne « Action », bouton « … » puis « Supprimer le compte » ; jamais sur votre propre compte. Un compte qui a siégé ou voté ne se supprime pas (« Ce compte a siégé ou voté : désactivez-le plutôt que de le supprimer. ») : touchez « Désactiver » à côté, ses sessions sont fermées et son code ne donne plus accès, mais ses bulletins et sa place dans les rapports restent (état « Désactivé »).
- Une catégorie : rubrique **Catégories**, tableau « Catégories engagées », bouton « … » puis « Supprimer » ; la confirmation indique le nombre d'inscrits. Ses inscriptions et ses manches en attente disparaissent, les fiches des athlètes restent. Une catégorie commencée ne se supprime pas (refus serveur affiché tel quel).
- Un officiel : rubrique **Officiels**, bouton « … » sous chaque fiche puis « Supprimer » ; la fiche et sa photo disparaissent, l'écran public revient à l'attente s'il l'affichait. Le compte d'accès de la même personne n'est pas touché.
- Un athlète : rubrique **Athlètes**, « Supprimer cette fiche » ou « Supprimer la sélection » ; refusé si une de ses catégories a commencé. Pour ne retirer qu'une inscription, « Retirer de cette catégorie » (ouvert aux rôles de préparation).

### Sauvegarder

- Onglet **Documents** (ou rubrique **Documents** de Préparation), panneau « Sauvegarde et restauration », bouton « Télécharger une sauvegarde complète » : le navigateur télécharge un fichier JSON contenant l'événement et les comptes. Faites-le après la préparation, après chaque bloc de finales et à la clôture, et copiez le fichier hors du téléphone ou de l'ordinateur.
- **Ce fichier est sensible** : il contient l'identité des athlètes (dont des mineurs), les photos et les codes hachés. Ne le partagez jamais par messagerie, ne le déposez jamais dans un dépôt de code ; conservez-le sur un support contrôlé et supprimez-le après la compétition.
- La restauration remplace l'événement en ligne par le fichier choisi, conserve une copie serveur de l'état précédent et **déconnecte tous les appareils** : ne l'utilisez qu'après avoir prévenu tout le monde et arrêté le jugement.

### Clôturer la compétition

1. Vérifiez que toutes les manches sont validées et toutes les récompenses remises.
2. Téléchargez la sauvegarde finale et les documents utiles (onglet **Documents** : Résultats, Récompenses, Diplôme, Récapitulatif jury ; exports « Résultats CSV », « Résultats XLSX » et « Résultats PDF »).
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
4. Classez les dossards : glissez chaque dossard sur un rang en finale ou demi-finale ; en éliminatoires, glissez-le vers « Sélectionnés » ou touchez-le (voir « Classer les dossards »).
5. Vérifiez le compteur « rangs attribués » (ou « sélectionnés ») ; corrigez avec « Annuler », « Rétablir » ou la croix d'un rang (voir « Corriger »).
6. Touchez « Vérifier et valider », relisez le résumé, puis « Confirmer et transmettre » (voir « Valider et attendre l'accusé de réception »).
7. Attendez « Bulletin reçu et verrouillé par le serveur » : sans ce message, le bulletin n'est pas reçu.
8. L'écran d'attente « Bulletin validé et reçu. Patientez : la prochaine manche s'affichera ici automatiquement. » s'affiche alors en grand : ne touchez à rien, la manche suivante remplace cet écran d'elle-même (voir « Attendre la manche suivante »).
9. Si la connexion se coupe, gardez la page ouverte et, au retour du réseau, vérifiez si le bulletin est reçu avant de renvoyer quoi que ce soit (voir « Brouillon local »).

Un compte qui n'a que le rôle juge arrive directement dans **Mon jugement** après connexion et ne voit que **Mon jugement**, **Documents** (son bulletin imprimable) et **Aide**, plus « Déconnexion » : le bulletin occupe toute la largeur de l'écran, avec des dossards et des rangs plus grands. Un juge qui cumule un autre rôle (chef, responsable, secrétariat…) garde tous les onglets de ses rôles.

### Se connecter et vérifier son bulletin

1. Ouvrez l'application, saisissez votre code personnel, touchez « Accéder à la compétition ». Le code respecte les majuscules et minuscules ; les espaces en début et en fin sont ignorés. « Afficher le code » montre ce que vous tapez : à utiliser si l'écran répond « Code incorrect » alors que le code est bon (un code collé depuis une messagerie porte souvent un espace ou un retour à la ligne, ou une majuscule ajoutée par le clavier).
2. Vérifiez votre nom en haut de l'écran, puis la catégorie, la phase et l'état de la manche dans le sélecteur en haut de **Mon jugement**. Le bulletin de la manche ouverte s'affiche automatiquement quand vous êtes affecté.
3. Si l'écran indique « Aucune manche affectée », le chef doit vous intégrer au jury et ouvrir une manche : attendez, l'écran se met à jour seul.
4. Plusieurs juges sur un même ordinateur (entraînement, test) : la session est un cookie partagé par tous les onglets d'un même navigateur, donc se connecter dans un onglet connecte les autres. Ouvrez chaque juge dans une fenêtre de navigation privée distincte, ou dans un profil de navigateur différent (Chrome : « Ajouter un profil »), ou dans des navigateurs différents. Sur les téléphones de la compétition, un appareil = un juge : rien à faire.

### Classer les dossards

- En finale ou en demi-finale : posez le doigt (ou la souris) sur un dossard et glissez-le sur un rang ; le rang visé se surligne à l'approche, relâchez pour le placer. Autre geste : touchez le dossard, puis touchez le rang. Remplacer un rang libère son ancien occupant sans décaler les autres ; un dossard placé reste dans la liste, marqué « Rang N ».
- En éliminatoires : glissez chaque dossard vers la zone « Sélectionnés », ou touchez-le pour le sélectionner (nouveau toucher : retiré). Le bulletin exige exactement le quota demandé (« Sélectionnez exactement N athlètes ») ; au-delà, la zone refuse le dossard et l'indique.
- Sur téléphone, un dossard ne fait pas défiler la page : pour faire défiler, glissez le doigt sur la colonne des rangs ou sur les titres. Pendant un glisser, la page défile d'elle-même quand le doigt approche du haut ou du bas de l'écran.
- « Voir un athlète » ouvre sa fiche (photo autorisée, taille et poids confirmés) ; « Revenir au jugement » la ferme sans rien changer.

### Corriger

- « Annuler » et « Rétablir » reviennent en arrière ou en avant. La croix d'un rang le libère.
- Le compteur « rangs attribués » (ou « sélectionnés ») indique quand le bulletin est complet ; le bouton de validation reste grisé tant qu'il ne l'est pas.

### Valider et attendre l'accusé de réception

1. Touchez « Vérifier et valider ». Relisez le résumé dans « Validation définitive du bulletin ».
2. Touchez « Confirmer et transmettre ». Il s'agit de la seule validation : rien n'est envoyé avant.
3. Attendez « Bulletin reçu et verrouillé par le serveur » avec l'heure de réception. Le bulletin devient non modifiable. Sans ce message, le bulletin n'est pas reçu.
4. Après réception, seul le circuit de correction du chef de jury permet une modification : signalez-lui toute erreur.

### Attendre la manche suivante

- Dès que le serveur a reçu votre bulletin, **Mon jugement** affiche en grand « Bulletin validé et reçu. Patientez : la prochaine manche s'affichera ici automatiquement. », avec l'heure de réception et l'état de la manche : « Ouvert » tant que le serveur attend d'autres bulletins (puis « Tous les bulletins des juges officiels sont reçus » quand c'est le cas), « À valider » quand le chef de jury valide les résultats, « Validé » ensuite.
- Le nombre de bulletins reçus chez les autres juges n'est pas affiché : le serveur ne transmet à un juge que son propre bulletin.
- « Voir mon bulletin transmis » permet de relire, sans pouvoir le modifier, le classement ou la sélection que vous avez envoyé.
- Quand le chef de jury valide la manche, le serveur ouvre la manche suivante et elle remplace l'écran d'attente sur votre téléphone, sans action de votre part et sans recharger la page : l'écran se met à jour dès que le serveur le signale ou, au plus tard, à la prochaine interrogation automatique (quelques secondes). Si une manche à venir vous est affectée mais pas encore ouverte, l'écran l'indique (« Manche à venir ») et le bulletin s'ouvre de lui-même.
- Si vous n'êtes pas membre du jury de la manche suivante, l'écran d'attente reste affiché sur votre dernière manche : c'est normal.

### Brouillon local

- Vos placements sont enregistrés comme brouillon sur ce téléphone (« Brouillon local enregistré à … »). Ils ne sont pas envoyés au chef à chaque geste.
- Après un rechargement, l'application propose « Reprendre le brouillon » ou « Écarter le brouillon ». Le brouillon ne se transfère pas sur un autre téléphone.
- Si la connexion se coupe, gardez la page ouverte. Au retour du réseau, vérifiez si le bulletin apparaît comme reçu avant de le renvoyer : l'application n'envoie jamais un ancien brouillon toute seule.

### Documents imprimés

- Votre bulletin individuel imprimable est dans votre onglet **Documents** (« Bulletin individuel ») ; les fiches de notation vierges sont éditées par le chef de jury ou le secrétariat.

## Profil : Stagiaire
Rôles : trainee

### En bref : ce que vous avez à faire

1. Ouvrez l'adresse remise par l'organisation, saisissez votre code personnel et touchez « Accéder à la compétition ».
2. Dans **Mon jugement**, attendez le bulletin portant la mention « Bulletin stagiaire, hors calcul officiel ».
3. Classez les dossards (glisser sur un rang) ou sélectionnez-les (éliminatoires) comme un juge (voir « Juger comme stagiaire »).
4. Touchez « Vérifier et valider » puis « Confirmer et transmettre » avant la fin du compte à rebours « Temps restant après le dernier juge officiel » (60 secondes).
5. Attendez « Bulletin reçu et verrouillé par le serveur » : sans ce message, le bulletin n'est pas reçu.
6. L'écran d'attente « Bulletin validé et reçu. Patientez : la prochaine manche s'affichera ici automatiquement. » s'affiche en grand : ne touchez à rien, la manche suivante apparaît d'elle-même (voir « Attendre la manche suivante »).
7. Après la compétition, consultez votre rapport d'examen dans l'onglet **Examens** (voir « Consulter son examen »).

Le stagiaire juge avec son propre bulletin, hors calcul officiel. Un compte qui n'a que le rôle stagiaire (ou juge et stagiaire) ne voit que **Mon jugement**, **Examens** (son rapport), **Documents** et **Aide**, plus « Déconnexion », en pleine largeur.

### Juger comme stagiaire

- Le parcours est le même que pour un juge (voir le profil Juge) : classer, « Vérifier et valider », « Confirmer et transmettre », attendre « Bulletin reçu et verrouillé par le serveur ».
- Le bulletin porte la mention « Bulletin stagiaire, hors calcul officiel ».
- Après le dernier bulletin officiel, un compte à rebours « Temps restant après le dernier juge officiel » s'affiche : vous avez 60 secondes. Passé ce délai, le bulletin est marqué « Délai expiré » et ne peut plus être envoyé.

### Attendre la manche suivante

- Dès réception de votre bulletin, l'écran d'attente « Bulletin validé et reçu. Patientez : la prochaine manche s'affichera ici automatiquement. » remplace le bulletin, avec l'heure de réception et l'état de la manche. « Voir mon bulletin transmis » permet de le relire sans le modifier.
- Quand le chef de jury valide la manche, la suivante s'affiche d'elle-même sur votre téléphone, sans recharger la page. Si vous n'êtes pas affecté à la manche suivante, l'écran d'attente reste sur votre dernière manche.

### Consulter son examen

- Votre rapport (moyenne, catégories évaluées, paires comparées, concordance par manche avec la version de référence du chef) se lit dans votre onglet **Examens** et s'imprime depuis **Documents** (« Examen des stagiaires »). « N/D » signifie qu'une mesure manque, pas une note de zéro.

## Profil : Secrétariat
Rôles : secretariat

### En bref : ce que vous avez à faire

1. Saisissez votre code personnel, touchez « Accéder à la compétition », puis ouvrez **Préparation**, rubrique **Athlètes**.
2. Enregistrez chaque athlète sur une seule fiche (identité, contrôles, taille, poids) : la catégorie et l'inscription sont créées automatiquement ; cochez « Statut approuvé », « Licence contrôlée », « Paiement reçu » et « Mesures confirmées » seulement après contrôle réel, l'inscription est alors confirmée (voir « Inscrire les athlètes »).
3. Importez les photos une par une et touchez « Autoriser la diffusion publique » seulement avec le consentement en main (voir « Photographies »).
4. La taille et le poids se saisissent sur la fiche athlète ; la rubrique **Mesures** sert de vue d'ensemble (voir « Saisir les mesures »).
5. Renseignez les officiels (rubrique **Officiels**) et imprimez les documents, dont les « Fiches de notation (bulletins vierges) » (fiches de notation papier) et la liste « Officiels » avec le jury, depuis la rubrique **Documents** (voir « Officiels et documents »).
6. Pendant la cérémonie, dans **Récompenses** : « Récompense préparée », « Récompense remise », puis « Enregistrer la remise » (voir « Récompenses »).

Le secrétariat dispose des onglets Vue d'ensemble, Préparation, Récompenses, Documents et Aide.

### Inscrire les athlètes

1. **Préparation**, rubrique **Athlètes**, panneau « Nouvelle fiche athlète » : identité, date de naissance, sexe, nationalités, pays, club, « Téléphone (WhatsApp de préférence) », section, « Taille (cm) », « Poids (kg) — pesée », cases de contrôle et « Mesures confirmées (taille et poids contrôlés) », puis « Enregistrer ».
2. À l'enregistrement, la catégorie est proposée par le référentiel et l'inscription créée : « Inscription confirmée dans … » si « Statut approuvé », « Licence contrôlée », « Paiement reçu » et « Mesures confirmées » sont cochés, sinon « Inscription en brouillon dans … » ; cochez ces cases seulement après contrôle réel, puis « Confirmer l'inscription » sous la fiche. Pour choisir les catégories, cochez-en une ou plusieurs dans « Catégories d'inscription » (catégories actives de la section de la fiche ; un athlète peut concourir dans plusieurs) : une inscription est créée par catégorie cochée, et le message récapitule créations et refus. Si la catégorie proposée n'existe pas encore, sa création est réservée au chef et au responsable : le message l'indique, cochez une catégorie existante ou demandez-la. « Retirer de cette catégorie » sous la fiche supprime une inscription sans effacer la fiche (refusé si la catégorie a commencé).
3. Après les dossards ou une fois la compétition démarrée, la fiche est enregistrée mais l'inscription tardive est réservée au chef et au responsable : le message l'indique.
4. Le champ « Rechercher » retrouve une personne déjà saisie.

### Photographies

1. Sur la fiche de la personne (rubrique **Athlètes**) ou de l'officiel (rubrique **Officiels**), bloc « Photographie et droit de diffusion » : choisissez le type (Portrait ou Plein pied), le fichier JPEG, PNG ou WEBP, recadrez si besoin, puis « Importer la photo ». La photo est réduite par le navigateur avant l'envoi (1 Mo au maximum) ; une image que le navigateur ne sait pas lire est refusée.
2. Une photo importée est **privée** : elle n'apparaît sur aucun écran public tant qu'elle n'est pas approuvée. Cochez « Consentement de diffusion recueilli et photo vérifiée » seulement si l'autorisation de la personne (ou de son représentant légal pour un mineur) est en votre possession, puis « Autoriser la diffusion publique ».
3. Importer une nouvelle photo remplace la précédente et annule l'approbation : il faut approuver de nouveau.
4. Import en lot : rubrique **Athlètes**, panneau « Importer un lot de photographies », choisissez plusieurs fichiers d'un coup. Chaque fichier est rattaché par son nom : « 12.jpg » = dossard 12, ou « Prenom Nom.jpg » (accents et majuscules ignorés) ; « 12-plein.jpg » pour la photo en pied, sinon le portrait. Le tableau montre qui est reconnu avant l'envoi ; « Importer N photos » envoie les fichiers un par un, réduits par le navigateur, et affiche le résultat par fichier. Un fichier non reconnu est ignoré : renommez-le ou passez par la fiche. Le consentement de diffusion se coche ensuite sur chaque fiche.
5. **Logo du club** : sur la fiche de l'athlète (rubrique **Athlètes**), le bloc « Logo du club » se trouve sous le champ Club. Il montre le logo déjà enregistré pour le club saisi (nom exact, espaces de bord ignorés) ; « Importer le logo » ou « Remplacer le logo » l'envoie réduit à 400 px de côté (un PNG garde sa transparence). Un logo vaut pour tous les athlètes du même club : il suffit de l'importer une fois. Il reste privé tant que vous n'avez pas coché « Autorisation d'usage du logo obtenue du club » puis « Autoriser l'affichage public du logo » ; un logo remplacé doit être autorisé de nouveau.
6. **Photo d'un officiel** : rubrique **Officiels**, ouvrez ou enregistrez le profil, puis utilisez le bloc « Photographie et droit de diffusion » sous le formulaire (une seule photo par officiel, de type Portrait), avec le même contrôle de consentement.
7. **Photo d'un juge** : un compte utilisateur n'a pas de photo. Rubrique **Jury**, panneau « Accès et approbations », colonne « Fiche officiel » : si aucune fiche officiel ne porte le nom du compte, « Créer la fiche officiel de ce compte » en crée une (prénom = premier mot du nom, nom = la suite, fonction = rôle du compte) ; complétez-la ensuite dans **Officiels**, où se prend la photo. Un compte dont le nom tient en un seul mot se crée directement dans **Officiels**.

### Saisir les mesures

- Sur la fiche athlète (rubrique **Athlètes**) : « Taille (cm) », « Poids (kg) — pesée » et « Mesures confirmées (taille et poids contrôlés) » après contrôle physique, puis « Enregistrer ». La rubrique **Mesures** donne la vue d'ensemble et permet aussi de « Confirmer » ligne par ligne.

### Officiels et documents

- Rubrique **Officiels** : fiche de présentation des officiels (nom, parcours). Elle ne donne aucun droit de connexion.
- Rubrique **Documents** : impressions (Fiches d'inscription, Ordre de passage, Inscriptions, Mesures, Fiches de notation…) et exports « Résultats CSV », « Résultats XLSX » (tableur) et « Résultats PDF » (mise en page simple, une catégorie par page). Vérifiez la catégorie et la manche choisies avant d'imprimer.
- « Fiches de notation (bulletins vierges) » : la fiche de notation papier, une page par manche (voir « Plan papier de secours » dans « Tous les profils »). En-tête « Catégorie <discipline> — Sous-catégorie <catégorie> — <phase> », tableau « Dossard | Position (1 à n) » sans nom d'athlète, ligne « Juge : ______ Signature : ______ ». Pour une éliminatoire, colonne « Sélectionné ☐ » et quota rappelé dans l'en-tête. Une manche choisie donne sa fiche ; une catégorie choisie, toutes ses manches ; sans choix, toutes les manches non encore validées.
- « Officiels » : la liste des officiels (nom, fonction, organisation, pays, parcours) suivie de la section « Jury » : les comptes approuvés du chef de jury, du responsable, des juges et des stagiaires avec leur rôle. Formats HTML, CSV, XLSX et PDF ; jamais de code personnel dans le document.
- « Liste des athlètes » : une ligne par inscription, par ordre alphabétique : nom, prénoms, club, catégorie, dossard, confirmé. « Catégories et athlètes » : la même information regroupée par catégorie (dossard, athlète, club, pays, confirmé).
- « Fiches d'inscription » : une page par athlète en deux parties. En haut, la partie remplie par l'athlète : Nom, Prénoms, Date de naissance, Téléphone (WhatsApp de préférence), Club, Nationalité ; en bas, la « Partie réservée aux juges » : Taille, Poids, Catégorie ; puis les zones de signature « Athlète », « Juge » et « Date ». Toute valeur absente est imprimée comme une ligne à compléter à la main. Pour toute la compétition, une catégorie ou un athlète ; des fiches vierges s'impriment en ajoutant `?blank=10` (de 1 à 50 fiches, une par page) à l'adresse du document. Réservée à la préparation : elle contient le téléphone et la date de naissance des athlètes. Les contrôles administratifs, dossards et photos restent dans « Inscriptions » et « Mesures ».
- « Ordre de passage » : sans filtre, l'ordre général de toutes les catégories ; avec une catégorie ou une manche, l'ordre détaillé des athlètes encore en lice, dans l'ordre tiré au sort.

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
2. Choisissez le contenu : Accueil, Catégorie / mosaïque, Ordre de passage (coulisses), Qualifiés, Révélation progressive, Podium, Classement, Un officiel, Mosaïque des officiels. Selon le contenu, précisez la catégorie, la manche, l'officiel, le nombre de places révélées ou l'athlète appelé, et positionnez les athlètes sur le plateau (ligne, gauche, centre, droite, en attente).
3. La manche suit la catégorie : le champ « Manche » ne propose que les manches de la catégorie choisie (Men's Physique choisi, aucune manche Bikini n'apparaît) ; la manche en cours, ou la dernière validée, est présélectionnée. Pour « Qualifiés », « Révélation progressive », « Podium » et « Classement », seules les manches déjà validées par le chef sont proposées ; sinon le champ indique « Aucune manche validée pour cette catégorie ». Les toutes catégories apparaissent dans la liste des catégories sous « Toutes catégories · discipline ».
4. Contrôlez « Aperçu du contenu préparé », puis touchez « Diffuser sur … ». « Scènes actuellement diffusées » rappelle ce que chaque écran montre.
4 bis. Écran des coulisses pour les athlètes : écran cible « Coulisses », contenu « Ordre de passage (coulisses) », catégorie et manche ; l'écran /screen/backstage affiche la liste dans l'ordre tiré au sort (ou par dossard tant que l'ordre n'est pas tiré, avec la mention correspondante), gros caractères : position, dossard, nom, club. Choisissez « Athlète appelé » pour mettre l'athlète sur le plateau en évidence : les précédents passent en grisé « Passé », le suivant est marqué « À suivre ». Rediffusez à chaque appel. Aucun résultat n'apparaît sur cet écran.
5. Les classements et podiums ne se diffusent qu'après validation par le chef. Les photos non approuvées ne s'affichent pas : l'écran public applique lui-même les filtres du serveur.
6. Logo du club : quand un logo a été enregistré pour le club d'un athlète (nom de club exactement identique), il s'affiche à côté du nom du club dans l'aperçu et sur les écrans publics. Sans logo enregistré, rien ne s'affiche.
7. Championnat national : le classement et la récompense « Meilleur pays » n'existent pas ; seul « Meilleur club » apparaît dans **Récompenses**. Ils ne sont visibles qu'en compétition internationale.

### Récompenses

- Onglet **Récompenses** : suivi des cartes préparées et remises, « Imprimer la liste » pour la cérémonie. En championnat national, aucune carte « Meilleur pays » n'apparaît.

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
2. La vue speaker affiche la scène en cours et le tableau « Conduite et prononciations » : dossard, athlète, prononciation du nom, club et pays, pour les athlètes actuellement appelés sur le plateau. Le logo du club, s'il a été enregistré, apparaît à côté du club dans la mosaïque.
3. Le speaker n'annonce que ce qui est affiché : la régie pilote les scènes, le chef valide les résultats. En championnat national, il n'y a pas de « Meilleur pays » à annoncer.

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
- Barème du meilleur club (et du meilleur pays en mode international), décision FIBDA du 24/09/2026 : chaque place de finale de catégorie et chaque place de toutes catégories rapporte 15 points (1er), 10 (2e), 5 (3e), 4 (4e), 3 (5e) ou 1 (6e et au-delà) ; chaque inscription compte séparément, et un athlète éliminé avant la finale rapporte 1 point de participation. À égalité de points, le nombre de premières places départage, puis de deuxièmes, et ainsi de suite ; si l'égalité persiste, le critère collectif publié s'applique.

## Tous les profils
Rôles : tous

### En bref : ce que vous avez à faire

1. Avant la compétition, vérifiez que les « Fiches de notation (bulletins vierges) » de chaque catégorie sont imprimés depuis **Documents** (voir « Plan papier de secours »).
2. Après chaque action, attendez « Modification enregistrée sur le serveur » ou « Bulletin reçu et verrouillé par le serveur » : sans ce message, rien n'est enregistré.
3. Si la connexion se coupe, gardez la page ouverte, rétablissez le réseau et attendez « Connecté au serveur » (voir « Perte de connexion »).
4. Si « L'état a changé sur un autre appareil » apparaît, relisez votre saisie puis relancez l'action ; si « Session expirée » apparaît, reconnectez-vous avec le même code.
5. Si le réseau reste coupé pendant une manche, appliquez le plan papier : feuille remplie, signée et remise au chef (voir « Plan papier de secours »).
6. En cas de doute, appelez la personne compétente (voir « Qui appeler »).

### Plan papier de secours

- Avant la compétition, le secrétariat ou le chef imprime les « Fiches de notation (bulletins vierges) » depuis l'onglet **Documents** : une fiche de notation par manche et par page, lisible telle quelle, avec la catégorie, la sous-catégorie et la phase en en-tête, les dossards dans l'ordre croissant et une colonne « Position (1 à n) » à remplir (colonne « Sélectionné ☐ » et quota pour une éliminatoire), sans nom d'athlète, puis la ligne « Juge : ______ Signature : ______ ». Sans choix de catégorie ni de manche, le document contient toutes les manches non encore validées. Prévoir un exemplaire par juge et par manche.
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
