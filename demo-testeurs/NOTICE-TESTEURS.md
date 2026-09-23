# FIBDA — notice de la version HTML autonome

Cette version sert à découvrir l’application et à tester ses parcours avec des données fictives. Elle contient son interface, ses règles de calcul et ses ressources dans **un seul fichier HTML**. Aucun logiciel Python ni serveur FIBDA n’est à installer pour l’essayer.

**Chaque navigateur possède sa propre compétition de test. Les téléphones ne sont pas reliés entre eux ni à un poste central dans cette version.** Les onglets ouverts à la même adresse dans ce navigateur partagent leurs données. Le fichier permet de passer d’un rôle à l’autre sur un même appareil pour simuler le travail du jury. Il ne doit pas servir à une compétition officielle.

## 1. Ouvrir l’application

Si vous avez reçu `FIBDA-kit-testeurs.zip`, commencez par le décompresser, puis ouvrez `index.html`. Cette page donne accès à l’application et à ce guide.

Sur ordinateur :

1. Enregistrer `FIBDA-application-autonome.html` dans un dossier facile à retrouver.
2. L’ouvrir dans un navigateur récent. Au besoin, faire clic droit puis « Ouvrir avec » et choisir le navigateur.
3. Attendre la fin du message de chargement du moteur sportif. La première ouverture peut prendre quelques secondes, selon l’appareil.
4. Ouvrir **Guide de test** pour retrouver les accès et les explications.

Sur téléphone ou tablette, **un lien HTTPS hébergeant ce même HTML est recommandé**. Ouvrir ce lien dans Safari ou Chrome. Un aperçu de pièce jointe dans une messagerie ou dans l’application Fichiers peut afficher le document sans exécuter l’application. Ce n’est pas un lien de synchronisation : même hébergée, cette version conserve une copie distincte sur chaque appareil.

Il faut un navigateur autorisant JavaScript, WebAssembly et le stockage local IndexedDB. Après le chargement complet du fichier, les opérations de cette copie n’appellent aucun serveur externe. Pour rouvrir une adresse HTTPS, conserver une connexion disponible : l’installation hors ligne et la mise en cache de la page ne sont pas garanties. La compatibilité avec tous les modèles de téléphone n’est pas encore réceptionnée.

## 2. Se connecter avec les codes de test

Les codes suivants sont publics et servent uniquement à la démonstration. Ils ne protègent aucune donnée réelle.

| Rôle | Code initial |
|---|---|
| Chef des juges | `1111` |
| Juge confirmé 1 | `2001` |
| Juge confirmé 2 | `2002` |
| Juge confirmé 3 | `2003` |
| Juge confirmé 4 | `2004` |
| Juge stagiaire | `3001` |
| Responsable des juges | `4444` |
| Directeur de compétition | `5555` |
| Secrétariat | `6666` |
| Régie | `7777` |
| Speaker | `8888` |
| Commission d’examen | `9999` |

Commencer par `1111`. Pour essayer un autre rôle, se déconnecter puis saisir son code, **dans le même navigateur et la même copie**. Il n’est pas nécessaire de créer de nouveaux comptes pour ce premier essai. Les comptes ajoutés pendant vos essais peuvent avoir d’autres codes.

## 3. Parcours de premier essai

La copie initiale propose 24 athlètes fictifs, trois catégories, cinq juges officiels, chef inclus, auxquels s’ajoute un stagiaire. Les cases de contrôle déjà cochées dans cette démonstration ne prouvent aucun contrôle réel.

1. **Préparation.** Examiner l’événement, le mode national/international, les inscriptions par catégorie, les mesures, le jury et les officiels. Le mode se choisit avant le démarrage de la compétition.
2. **Programme.** Vérifier l’ordre, puis utiliser « Générer les manches ». Les inscriptions de démonstration et leurs dossards sont déjà préparés.
3. **Événement.** Démarrer la compétition. Dans **Compétition**, vérifier le tour ouvert ; utiliser « Ouvrir cette manche » seulement si le tour doit être ouvert et si l’application l’autorise.
4. **Mon jugement.** Avec le chef, remplir puis valider le bulletin. Se déconnecter et refaire l’essai avec les quatre juges confirmés, puis avec le stagiaire.
5. **Compétition.** Revenir au compte du chef pour consulter et valider les résultats sportifs. Les qualifications et ouvertures suivantes restent soumises aux règles du programme.
6. **Régie & écrans.** Préparer un appel, vérifier l’aperçu et ouvrir un affichage public. Essayer les photos et une fiche d’officiel avec son pedigree.
7. **Récompenses.** Vérifier les lauréats après validation des finales, puis tester l’overall et ses récompenses avant le passage à la discipline suivante.
8. **Documents.** Produire un bulletin vierge, un bulletin individuel, un récapitulatif et une sauvegarde des essais.

Pour expérimenter une autre configuration, utiliser **Guide de test → Recommencer les essais**. Exporter d’abord une sauvegarde si vous souhaitez conserver le scénario actuel.

## 4. Juger sur téléphone

Glisser un dossard vers un rang, ou toucher le dossard puis le rang. Si le rang est occupé, l’ancien occupant retourne dans la réserve ; les autres rangs ne sont pas décalés. Utiliser **Annuler** et **Rétablir** avant la validation finale.

Contrôler le nom du juge, la catégorie et le tour, puis compléter tous les rangs demandés. Attendre le message indiquant que le bulletin est **enregistré et verrouillé sur cet appareil**. Un classement en cours n’est pas encore un bulletin reçu. Après la validation, les corrections passent par les commandes autorisées au chef.

Sans stagiaire attendu, le dernier bulletin officiel permet la suite. Avec des stagiaires, l’application attend leur validation ou l’expiration des 60 secondes suivant le dernier bulletin officiel. Aucun zéro fictif n’est ajouté pour un stagiaire absent. La suite peut être un écran d’attente lorsqu’une décision sportive reste nécessaire.

Pour tester le stagiaire, se connecter avec `3001` rapidement après le dernier juge officiel. Garder la page active pendant cet essai : le navigateur peut ralentir les temporisateurs quand l’appareil est verrouillé ou lorsque l’onglet est en arrière-plan. La copie utilise l’horloge de l’appareil, pas celle d’un serveur central.

## 5. Photos, écrans et documents

Utiliser des images de test. L’import normalise les photos en JPEG ; leur diffusion exige l’approbation et le consentement prévus dans la fiche. Sans photo approuvée, l’application utilise son affichage de remplacement.

Les écrans publics ouverts depuis la régie ouvrent la même application dans un nouvel onglet, avec l’affichage choisi. Le speaker s’ouvre dans le même onglet pour conserver sa session privée ; revenir avec le bouton précédent du navigateur. Ces onglets retrouvent les données locales partagées dans ce navigateur. Ils ne constituent pas un système de projection synchronisé entre plusieurs appareils. Les gestes privés d’un juge ne déclenchent pas les révélations publiques : celles-ci restent pilotées par la régie après les décisions requises.

Les commandes **Imprimer** et les exports **PDF** ouvrent un document imprimable. Dans la fenêtre du navigateur, choisir l’imprimante ou **Enregistrer au format PDF**. Il n’y a pas de générateur PDF serveur dans cette copie. Autoriser l’ouverture du nouvel onglet si le navigateur la bloque ; si un document HTML est téléchargé à la place, l’ouvrir puis l’imprimer. Vérifier l’aperçu, le format du papier et les sauts de page par catégorie avant l’impression.

## 6. Conserver et transmettre un essai

Les modifications sont enregistrées dans le stockage du navigateur. L’application vérifie l’enregistrement avant de confirmer l’action et protège les écritures si plusieurs onglets de cette copie sont ouverts. **Les données ne sont pas réécrites dans le fichier HTML.** Envoyer seulement le HTML transmet l’application, pas votre compétition modifiée.

Avec un compte autorisé, ouvrir **Documents → Sauvegarde et restauration** et télécharger le ZIP. Conserver ce fichier hors du navigateur. Pour reprendre le scénario ailleurs, ouvrir l’application autonome sur l’autre appareil, se connecter en chef, puis restaurer ce ZIP. La restauration remplace la compétition locale et demande une reconnexion.

La sauvegarde `fibda-sauvegarde.zip` appartient exclusivement à cette version autonome. Elle contient notamment les données, bulletins, photos et comptes de test. **Elle n’est pas une sauvegarde SQLite de l’application serveur et ne doit pas y être restaurée.** Ne pas charger non plus une sauvegarde serveur dans ce kit.

Éviter la navigation privée. L’effacement des données du navigateur, un changement de navigateur, d’adresse ou d’emplacement du fichier peut faire perdre l’accès à l’essai précédent. Télécharger régulièrement un ZIP ; ne pas considérer le stockage local comme une archive durable.

## 7. Envoyer un retour utile

Dans **Guide de test**, « Télécharger une fiche de retour » fournit un fichier JSON à compléter. Noter le rôle, la catégorie, les étapes réalisées, le résultat attendu et le résultat observé. Joindre si utile une capture et la sauvegarde fictive du scénario ; la notice ne transmet rien automatiquement.

Les contrôles locaux du 23 septembre 2026 comprennent 24 tests du moteur et du pont exécutés dans Python/WASM, 11 contrôles navigateur, 9 contrôles du classement et 40 vérifications de largeur réussis. Ils couvrent notamment connexion, photos, import/export, documents, sauvegarde/restauration, corrections du classement et refus d’une fausse confirmation lorsque le stockage échoue. Le rapport joint détaille leurs limites ; ils ne remplacent pas vos essais d’usage.

Les essais attendus portent notamment sur le confort du classement tactile, la lisibilité, le retour en arrière et la compréhension des messages. Les tests sur de vrais iPhone/iPad/Android, la récupération des téléchargements et l’impression physique restent à effectuer. La synchronisation de 40 appareils, le réseau de salle, le serveur de secours et la réception fédérale devront être vérifiés séparément avec l’application serveur.
