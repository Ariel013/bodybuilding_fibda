# État de livraison — FIBDA Bodybuilding 0.1.0

Application fonctionnelle en réception locale, livrée avec code source, frontend construit, paquet Mac Apple Silicon et dossier développeur. Le prototype de cadrage reste intact. Aucune mise en service officielle ni diffusion externe n'a été effectuée.

## Fonctions livrées

| Domaine | État et preuve principale |
|---|---|
| Référentiel | Neuf disciplines, 106 règles, coefficients classiques versionnés, neuf sources archivées et empreintes ; tests catalogue et préparation |
| Socle | Comptes, habilitations serveur, persistance, migration, commandes idempotentes, WebSocket, démo distincte ; tests serveur |
| Préparation | Inscriptions multiples, imports CSV/XLSX, mesures et propositions, fusions, programme, dossards, retards, officiels/pedigree ; tests préparation et opérations |
| Jugement | Variante A, toucher/glisser, remplacement sans décalage, annuler/rétablir, brouillon IndexedDB, accusé et verrouillage ; tests frontend et serveur |
| Transitions | Dernier officiel puis stagiaires ou 60 secondes, attente des qualifications et passage unique ; tests workflow/concurrence |
| Sport | National/international, écrêtage, égalités, qualifications, finales à zéro, overall, corrections signées ; tests domaine/audit/parcours API |
| Examens | Programme, paires exactes, références, seuil brut et dossier incomplet bloquant ; tests domaine et parcours overall |
| Exploitation | Régie, cinq contextes d'affichage, photos approuvées, récompenses et collectifs, documents HTML/CSV/XLSX/PDF ; tests de confidentialité et opérations |
| Sauvegarde | Instantané SQLite et photos, contrôle ZIP, restauration avec état antérieur et invalidation des sessions ; tests restauration, y compris erreur de copie |
| Distribution | Lanceurs source Windows/Mac ; paquet macOS arm64 construit et démarré sur ce Mac ; manifeste package-smoke.json |

## Limites explicites de cette livraison

- La personne et sa participation sont réunies dans la fiche d'un événement. Un registre fédéral transversal et une bibliothèque d'archives dans l'interface restent à développer ; les événements s'archivent actuellement par dossiers et sauvegardes distincts.
- Le lanceur réalise les contrôles, affiche l'adresse et un QR dans le terminal. Il ne fournit pas d'assistant graphique natif de configuration réseau.
- La restauration et l'utilisation du paquet ont été contrôlées localement ; Windows, un Mac propre, les signatures de distribution et la notarisation n'ont pas été réceptionnés.
- Les commandes JSON sont documentées dans CONTRACT.md et contrôlées côté serveur. Le schéma OpenAPI n'énumère pas un modèle typé complet pour chaque commande.
- Les photos peuvent être chargées, recadrées et associées en groupe. La prise de photo dépend du navigateur et de son autorisation caméra ; elle reste à éprouver sur les appareils de la fédération.
- Le catalogue reprend le corpus local vérifié. Les admissions documentaires à confirmer et la validation du règlement 2027 restent visibles ; elles ne sont pas présentées comme des homologations obtenues.

## Vérification locale et réception restante

Le rapport REPORT-RECETTE-LOCALE.md donne les commandes et observations fraîches. Les tests ASGI simulant quarante envois simultanés utilisent SQLite réel, mais aucun réseau radio. Le parcours API complet comprend deux disciplines, qualifications, finales, overall et clôture.

La mise en service exige encore : domaine/certificat/DNS local, contrôles iPhone/iPad/Android et Windows, gestes tactiles physiques, 300 athlètes et inscriptions multiples, 100 photos sur l'écran retenu, 40 appareils réels, panne/redémarrage de la machine, restauration sur ordinateur de secours, imprimante et lisibilité des écrans de salle. Les contrastes de toutes les surfaces composées n'ont pas fait l'objet d'une certification d'accessibilité.

Les paramètres réels de l'événement restent à saisir et valider par ses responsables. Le directeur ne vote pas ; les signatures sportives et celles des corrections publiées restent distinctes des accès administratifs. Une démo et un PDF ne constituent pas une réception sportive ou matérielle.
