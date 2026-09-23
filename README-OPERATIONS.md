# FIBDA Bodybuilding — exploitation locale

L’application fonctionne depuis l’ordinateur organisateur. Le prototype de cadrage reste séparé. Les données persistent hors du programme ; le mode démonstration utilise un répertoire distinct du mode réel.

## Démarrer

Installer les dépendances de requirements.txt dans .venv, puis construire frontend avec npm ci et npm run build. Lancer scripts/lancer-macos.command ou scripts/lancer-windows.bat. En ligne de commande :

```sh
.venv/bin/python launch.py --demo
```

L’adresse affichée et son QR sont utilisables sur l’ordinateur seulement par défaut. Ouvrir l’application pour initialiser le chef en mode réel ou peupler la démonstration. Aucun code de production fixe n’est fourni. Une fiche d’officiel est un profil d’affichage ; elle ne crée pas de compte.

## Ouvrir aux téléphones

Configurer le DNS local, un certificat reconnu par chaque appareil et un nom exact dans son SAN. Les certificats à joker et les seuls noms CN ne sont pas acceptés par le contrôle du lanceur. Remplacer tous les emplacements ci-dessous par les valeurs réellement configurées :

```sh
.venv/bin/python launch.py --host 0.0.0.0 --port 8443 --public-url https://NOM-CONFIGURE:8443 --cert /chemin/certificat.pem --key /chemin/cle.pem
```

Le QR reprend cette URL explicite. Le lanceur ne crée pas de nom DNS et ne certifie pas la confiance des téléphones. Il vérifie le certificat/clé, la correspondance exacte du SAN, la période de validité, le port disponible, l’écriture et SQLite. SQLite 3.51.3 minimum est exigé pour le réseau ; une version plus ancienne produit un avertissement en local et un refus en réseau. Aucun backport non documenté n’est accepté par défaut.

## Préparer les données

Importer CSV UTF-8 ou XLSX via la prévisualisation, corriger les erreurs, puis confirmer. Colonnes obligatoires : first_name, last_name, birth_date (AAAA-MM-JJ), sex (M/F), section (amateur/pro), country et nationalities (codes pays majuscules de deux lettres ; plusieurs nationalités séparées par |). Colonnes facultatives : club, height_cm, weight_kg, category_id. Une prévisualisation n’écrit rien ; elle devient périmée si l’événement change. Les inscriptions importées restent à confirmer.

Les photos sont normalisées en JPEG sans métadonnées. Associer explicitement chaque photo ZIP à sa personne ou son officiel. Le portrait ne devient public qu’après approbation avec consentement. Les noms et chemins contenus dans une archive ne sont jamais exécutés.

## Sauvegarder et restaurer

Le chef ou la direction télécharge une sauvegarde ZIP contenant la base cohérente, les photos et leurs empreintes. Copier ce fichier sur un support distinct et vérifier une restauration d’essai avant compétition.

La restauration s’effectue depuis l’ordinateur serveur. Elle vérifie l’archive avant remplacement, préserve l’état précédent dans restorations/before-…, attribue une nouvelle identité de restauration et invalide les sessions et commandes antérieures. Reconnecter tous les postes. Une archive invalide laisse la compétition courante et ses accès intacts.

## Contrôles et limites

Les tests automatisés couvrent imports, photos/consentement, confidentialité des impressions et exports, sauvegarde/restauration, démonstration et migrations. Ils ne constituent pas une réception matérielle. Avant usage officiel : tester coupure Wi-Fi/reconnexion, certificats sur tous les téléphones, écran régie/HDMI, imprimante papier, sauvegarde externe et reprise après arrêt brutal. Voir docs/RECETTE.md et docs/LANCEMENT.md.

Le paquet autonome PyInstaller se construit sur chaque OS cible avec scripts/build-package.py après installation de PyInstaller et construction du frontend. Un paquet macOS arm64 a été construit et contrôlé localement ; voir docs/REPORT-PACKAGE.md. La construction Windows et la réception sur les postes cibles restent à effectuer. Les sources modifiables, le dossier DOCX et le PDF se trouvent dans docs et livrables.
