# Référentiel sportif FIBDA — version 2026-09-22.1

Implémentation isolée du catalogue autorisé dans `../cadrage/design/photos-affichages/v3/VERIFICATION-CATALOGUE.md`. Les éditions PDF, URL, pages et décisions A04/A17 sont conservées dans `backend/fibda/catalogue.json`. Neuf disciplines, sections amateur et pro FIBDA, bornes Senior/Junior/Masters disponibles. Il ne s'agit pas d'un profil IFBB Pro League. Les textes 2024 restent nommés 2024. Le contrôle distant du 22 septembre est celui du document source ; ce lot n'a pas effectué une nouvelle vérification distante. Corpus 2027 à vérifier avant usage.

Les mesures utilisent Decimal sans tolérance ni arrondi : toute précision inférieure au dixième est rejetée. Un seuil supérieur est inclus ; le seuil inférieur est exclu. Les plafonds classiques utilisent la division d'inscription, même en crossover. L'âge annuel utilise année événement moins année naissance, jamais l'âge au jour courant. Senior ne reçoit pas de borne 24–39 inventée ; une proposition Senior rappelle le contrôle des conditions d'admission/crossover. La conformité de l'âge et des mesures ne vaut pas autorisation d'inscription : pièces, consentements, paiements et autorisations restent des contrôles serveur.

À 15 ans, Bodybuilding, Classic Bodybuilding et demande Junior Men's Physique gardent un statut explicite à confirmer pour contradiction IFBB. Aucune admission automatique ni refus définitif de ces demandes. Les divisions autonomes non documentées de Muscular et Junior Women's Physique restent absentes.

Calcul FIBDA : jury de 5/7/9/11, un seul minimum et maximum retirés par participant, même à 9 et 11. Adaptation FIBDA distincte du calcul IFBB. Chaque bulletin national est filtré puis renuméroté avant agrégation ; le serveur fournit les inscriptions des personnes de nationalité CI. Un classement est une permutation complète. Les égalités de somme passent par majorité paire à paire, condensation du graphe en composantes fortement connexes et ordre du chef à l'intérieur des cycles. Le chef doit figurer dans le jury ; directeur et stagiaire ne peuvent voter comme officiels.

Élimination : comptage sans retrait, quota exact par bulletin ; une égalité au seuil renvoie les places certaines, les ex aequo, les places restantes et `pending=true`. Le serveur conserve ce blocage jusqu'à décision sportive autorisée. Une finale se calcule exclusivement avec ses bulletins : aucun report du tour précédent.

Overall : champions dédupliqués par personne dans l'ordre fourni. Le serveur fournit exclusivement les finales validées de même discipline/section et les éligibles au titre. Collectifs : meilleur rang individuel de chaque personne, 10/6/4/3/2/1 points, aucun overall, décompte des places 1–6. Le serveur sépare sections et fournit les seuls résultats officiels pertinents ; `eligible_ids` filtre les hors concours. Le départage par nombres de premières, puis deuxièmes jusqu'aux sixièmes places est obligatoire après les points. Le critère personnalisé n'intervient qu'après une égalité persistante. Les égalités restantes gardent le même rang : un tri alphabétique d'affichage n'attribue aucun vainqueur.

Examen : bulletin original, référence chef gelée à la validation dans `result.reference_ranking` et `reference_version`. Concordance par paires, Fraction exacte, moyenne non pondérée des pourcentages par épreuve, quatre catégories distinctes hors overall, soixante paires, toutes les épreuves planifiées reçues. L'overall compte dans la moyenne et les paires mais pas comme catégorie ; l'élimination et les tours de moins de deux participants sont exclus du programme évaluable sans produire un faux manquant. Aucune note zéro inventée pour une absence. `passed` exige tous les critères et la moyenne brute >=85 ; `mean.display` sert uniquement à afficher. La décision de commission reste distincte du calcul.

## Interfaces pures

- `validate_panel(panel, users, chief_id=None)` ; users liste ou dictionnaire, exception DomainError si invalide.
- `validate_ranking(ranking, participants)` ; permutation exacte.
- `rank_ballots(ballots, participants=None, chief_id=None, eligible_ids=None)` ; liste entry_id/rank/total/ranks/removed_min/removed_max.
- `elimination_result(ballots, participants, quota, chief_id=None)` ; counts/qualified/tied/slots/pending. Le chief_id n'annule pas une égalité de qualification.
- `overall_candidates(results, entries, eligible_ids=None)` ; liste d'inscriptions uniques par personne.
- `exam_report(program, rounds, user_id)` ; mean fraction ou null, categories, pairs, missing, complete, sufficient, passed, details.
- `collective_results(results, entries, people, kind='club', eligible_ids=None, tiebreak=None)` ; liste name/points/counts/people/rank.
- `load_catalogue()` ; dictionnaire versionné indépendant à chaque appel.
- `eligibility(person, event_year, section=None, division=None, discipline=None)` ; propositions partielles, motifs et référence de règle.
- `measure(value)` et `weight_limit(discipline, division, height)` ; Decimal exact, plafond null pour discipline non classique.


## Préparation et inscriptions

`apply_preparation(store, conn, state, actor, kind, payload)` couvre les commandes de préparation du contrat ; seuls les états candidats réussis remplacent `state`. Aucun accès SQL. Les erreurs métier lèvent `auth.Problem` et les habilitations passent par `auth.require`. Le serveur fournit transaction, audit et idempotence.

Brouillons autorisés ; confirmation exige sexe/section, contrôles administratifs, mesures/âge et autorisations internationales. Le chef peut signer une dérogation motivée, conservée avec les écarts, sans convertir une incertitude IFBB en certification. Un crossover d'âge Junior/Masters vers Senior réclame autorisation chef (`crossover_approved`) ou dérogation motivée. Les hors concours de nationalité étrangère sont admis au programme national ; leurs titres sont filtrés au calcul. Les codes pays sont contrôlés au format ISO alpha-2 (syntaxe, pas un registre exhaustif).

Les cumuls d'inscriptions sont réservés au chef. Dossards distincts par inscription confirmée, suivant ordre programme, sans renumérotation ultérieure. Retard réservé chef/responsable, motif obligatoire, avant tout premier tour de la catégorie, maximum global +1. Les fusions avant dossards exigent mêmes discipline/sexe/section/groupe d'âge, archivent les origines et réaffectent les inscriptions ; un doublon personne est refusé avec résolution manuelle préalable. Les nouvelles photos approuvées ne peuvent être injectées dans person.save ou official.save : circuit photo serveur séparé.


Les inscriptions tardives actualisent le premier tour déjà généré de leur catégorie tant qu'il est pending. Le passage 6→7 insère une demi-finale ; 15→16 insère une élimination (sauf phase explicitement configurée). Les identifiants des tours existants, les programmes d'examen qui les référencent et les dossards antérieurs restent stables. Les dépendances sont recâblées et les catégories voisines restent intactes.

`validate_confirmed_entries(state)` recontrôle les inscriptions confirmées sans les modifier. Le serveur l'appelle avant démarrage ; event.update l'appelle déjà après changement date/mode, dans la copie transactionnelle de préparation. Seuls les écarts explicitement consignés dans une dérogation signée sont couverts. Le critère collectif ne peut plus être changé après démarrage ; les positions des catégories engagées restent fixes lors des réorganisations. Aucun dossard n'est attribué quand aucune inscription n'est confirmée.

Un tour prévu dont les participants attendent une qualification reste manquant dans l'examen : une liste provisoirement vide ne justifie pas l'exclusion « moins de deux athlètes ». Cette exclusion s'applique lorsque le nombre est connu, y compris depuis la qualification validée du tour précédent.

Depuis `FIBDA-2026-09-22.2`, le JSON versionné contient les sept bandes de plafonds classiques et leurs coefficients pour chaque division, les empreintes SHA-256 des neuf PDF archivés et les normalisations FIBDA détaillées liées à chaque règle. Le calcul lit ces tables ; les admissions après démarrage utilisent le snapshot figé. Les archives restent dans `recherche-ifbb`, hors paquet applicatif.
