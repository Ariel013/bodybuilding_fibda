export function ConnectionHelp() {
  return (
    <details className="connection-help">
      <summary>Aide · connexion et envoi du bulletin</summary>
      <ol>
        <li>
          Ouvrez l’adresse de l’application transmise par l’organisation, avec le
          Wi-Fi de la salle ou votre connexion mobile. Ajoutez-la à l’écran
          d’accueil pour la retrouver d’un geste.
        </li>
        <li>
          Saisissez votre code personnel, remis après approbation du chef de
          jury. Ne le communiquez à personne.
        </li>
        <li>
          Classez les dossards, puis vérifiez et validez. Attendez « Bulletin
          reçu et verrouillé par le serveur » : c’est la seule confirmation de
          réception.
        </li>
      </ol>
      <p>
        Les tours et leur état se mettent à jour automatiquement, toutes les
        quelques secondes. Vos positions restent un brouillon sur ce téléphone
        jusqu’à la validation. « Connecté au serveur » ne signifie pas que votre
        bulletin a été envoyé.
      </p>
      <p>
        Si la connexion se coupe, gardez la page ouverte. Au retour du réseau,
        vérifiez si le bulletin a été reçu avant de le renvoyer. L’onglet
        « Aide » contient le mode d’emploi complet de votre profil.
      </p>
    </details>
  );
}
