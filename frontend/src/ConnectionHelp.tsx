export function ConnectionHelp() {
  return (
    <details className="connection-help">
      <summary>Aide · connexion et envoi du bulletin</summary>
      <ol>
        <li>Connectez le téléphone au même Wi-Fi que le poste central.</li>
        <li>
          Scannez le QR commun du lanceur, ou saisissez l’adresse HTTPS fournie
          par l’organisation.
        </li>
        <li>
          Saisissez votre code personnel, remis après approbation du chef de
          jury. Le QR ouvre l’application ; il ne remplace pas le code.
        </li>
        <li>
          Classez les dossards, puis vérifiez et validez. Attendez « Bulletin
          reçu et verrouillé par le serveur » : c’est la confirmation de
          réception par le poste central.
        </li>
      </ol>
      <p>
        Les tours et leur état se mettent à jour automatiquement. Vos positions
        restent un brouillon sur ce téléphone jusqu’à la validation. « Connecté
        au serveur » ne signifie pas que votre bulletin a été envoyé.
      </p>
      <p>
        Si la connexion se coupe, gardez la page ouverte. Au retour du réseau,
        vérifiez si le bulletin a été reçu avant de le renvoyer.
      </p>
    </details>
  );
}
