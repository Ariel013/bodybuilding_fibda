# Matrice des droits FIBDA

Cette matrice précise les responsabilités attendues. Les gardes serveur sont l'autorité technique et doivent être contrôlées par les tests d'intégration. Masquer un bouton ne constitue pas un contrôle d'accès.

## Comptes et préparation

Le chef initialise le premier compte, invite et approuve les comptes. Un compte inactif ou non approuvé ne peut pas agir. Le secrétariat prépare les identités, inscriptions et mesures. Le chef et le responsable organisent catégories, programme et jury. Les modifications de catégories après distribution des dossards sont soumises aux gardes métier. Le directeur assure le contrôle organisationnel sans bulletin officiel.

## Jugement et validation

Chaque juge officiel soumet son propre bulletin pour une manche où il est affecté. Le stagiaire soumet son propre exercice dans le délai prévu et ne contribue jamais au résultat officiel. Un directeur ne vote pas, même si plusieurs rôles figurent sur son compte. Le chef saisit une feuille papier avec motif et signature, sans effacer l'original. Le chef valide le résultat sportif.

Une correction déjà publiée exige le chef et un directeur distinct. Une même personne ne peut fournir les deux signatures. Les bulletins individuels ne contiennent pas les comparaisons d'examen. La commission consulte les éléments d'examen selon l'autorisation serveur.

## Diffusion et exploitation

La régie pilote les scènes publiques ; le présentateur lit les informations autorisées. Aucun écran public ne reçoit contact privé, bulletin individuel ou décision confidentielle. L'affichage des photos exige consentement et approbation. L'affichage des qualifiés, podiums et classements résulte d'une action explicite de régie.

La sauvegarde et la restauration sont réservées aux responsables autorisés par l'API, notamment chef et directeur pour la restauration. Elles contiennent des données privées : conserver les archives sur un support contrôlé. Une restauration déconnecte les sessions et donne une identité nouvelle à l'événement restauré.

## Vérification par rôle

Créer un compte de chaque rôle dans un événement de démonstration. Pour chaque action sensible, appeler directement l'API avec un rôle interdit : elle doit refuser sans modifier la version. Contrôler également un compte désactivé, un compte non approuvé, un directeur cumulant le rôle juge, un juge non affecté et un stagiaire expiré. Comparer la version et l'audit avant et après chaque refus.
