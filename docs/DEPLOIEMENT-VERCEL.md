# Déploiement de la version TypeScript (Vercel + Turso) — ADR 0002

Statut : **exécuté le 23/09/2026 au soir**. Production : https://fibda-bodybuilding.vercel.app
(santé, jeton, création du chef, connexion, état et écran public vérifiés au curl).
Secrets remis au PO hors dépôt (`~/fibda-secrets-2026-09-23.txt` sur le poste de développement).

## 1. Base Turso (gratuit, sans carte)

```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login                 # ouvre le navigateur, compte GitHub
turso db create fibda --location aws-eu-west-1   # Irlande, le plus proche disponible le 23/09
turso db show fibda --url        # → libsql://fibda-….turso.io
turso db tokens create fibda     # → jeton, à garder secret
```

Deux bases distinctes : `fibda` (officielle) et `fibda-demo` (`FIBDA_DEMO=1`), chacune
avec son projet Vercel. **Déployé le 23/09** : démonstration sur
https://fibda-bodybuilding-demo.vercel.app, peuplée de 24 athlètes fictifs et 9 comptes
(codes dans le fichier de secrets du PO). Sert à l'entraînement des juges et à la revue UX ;
jamais pour la compétition. Pour changer de projet depuis la CLI : le lien est dans
`frontend/.vercel/` (ignoré par git) ; `vercel link --yes --project <nom>` le remplace.

## 2. Projet Vercel

Projet créé et déployé **depuis la CLI**, dans `frontend/` (`vercel link --yes --project
fibda-bodybuilding`, puis `vercel deploy --prod --yes`) : il n'est pas relié au dépôt
GitHub, un push ne déploie rien. `vercel.json` définit le build Vite, la fonction unique et le
repli SPA. **L'API est regroupée par esbuild** (`npm run build:api`, entrée
`server/vercel.ts` → `api/index.js`, ignoré par git) : Vercel ne regroupe pas les modules
ESM lui-même, la première mise en ligne a échoué pour cette raison. Le gestionnaire accepte
les signatures Node `(req, res)` et web `(Request)`.

Variables d'environnement (Production) :

| Variable | Valeur |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://…` |
| `TURSO_AUTH_TOKEN` | jeton Turso |
| `FIBDA_SETUP_TOKEN` | secret long (`openssl rand -hex 32`), connu du seul opérateur |
| `FIBDA_DEMO` | absent en production, `1` pour la base de démonstration |

```bash
npm i -g vercel && vercel login
cd frontend && vercel link --yes --project fibda-bodybuilding
printf '%s' "$URL"   | vercel env add TURSO_DATABASE_URL production --yes
printf '%s' "$TOKEN" | vercel env add TURSO_AUTH_TOKEN production --sensitive --yes
printf '%s' "$SETUP" | vercel env add FIBDA_SETUP_TOKEN production --sensitive --yes
vercel pull --yes --environment=production   # réglages du projet dans .vercel/
vercel build --prod --yes                     # construction locale (Vite + esbuild)
vercel deploy --prebuilt --prod --yes         # n'envoie que .vercel/output
```

**Toujours déployer en `--prebuilt`.** Un `vercel deploy` sans `--prebuilt` a, le 23/09,
envoyé le dépôt entier au lieu de `frontend/` (détection « services » / FastAPI à la racine
du dépôt git), et fait échouer deux déploiements. Pour la démonstration, mêmes commandes
après `vercel link --yes --project fibda-bodybuilding-demo`.

## 3. Premier chef, restauration, démonstration

Ces opérations n'ont pas de « boucle locale » en serverless : elles exigent
l'en-tête `X-Setup-Token` égal à `FIBDA_SETUP_TOKEN`.

```bash
curl -X POST https://NOM.vercel.app/api/v1/auth/setup \
  -H 'content-type: application/json' -H "x-setup-token: $FIBDA_SETUP_TOKEN" \
  -d '{"name":"Nom du chef","code":"CODE-A-CHOISIR"}'
```

Restauration : `POST /api/v1/restore` avec le JSON de sauvegarde en corps, le
cookie du chef et le même en-tête. Le code du chef ne se tape jamais dans un
historique de shell : préfixer la commande d'une espace ou utiliser `read -s`.

## 4. Ce qui change par rapport à la version Python

- Pas de WebSocket : le frontend passe sur son interrogation périodique.
- Sauvegarde = JSON signé SHA-256 (`fibda-sauvegarde.json`), pas un ZIP. **Fichier
  sensible** : identités d'athlètes potentiellement mineurs, hachages des codes, journal
  d'audit. À conserver sur un support contrôlé, jamais dans le dépôt ni dans une messagerie.
- Vercel limite le corps d'une requête à 4,5 Mo : une archive de restauration plus grosse
  échoue (413). Chaque restauration copie l'état précédent dans l'audit, qui n'est pas paginé.
- Les adresses clients (limiteur de connexion) et le schéma (cookie Secure) viennent des
  en-têtes `x-forwarded-*` posés par Vercel, non falsifiables par le client. Si un proxy
  (Cloudflare) est un jour placé devant Vercel, cette hypothèse tombe : à revoir.
- Hachage des codes en 100 000 itérations PBKDF2 (240 000 côté Python) : choix assumé pour
  le coût serverless, compensé par le limiteur de tentatives en base.
- Impressions HTML (bulletins vierges, récapitulatifs, résultats, diplômes, listes) et
  export CSV portés le 23/09 au soir. Pas d'export XLSX/PDF (501), pas d'import XLSX (415,
  convertir en CSV : `OPEN-QUESTIONS.md` P10), pas de photos (P9).
- Les transitions temporisées (délai stagiaires) s'exécutent à chaque lecture
  d'état ou commande, pas par une boucle serveur.

## 5. Recette minimale

Identique à `docs/DEPLOIEMENT-INTERNET.md` §7 : téléphone sur réseau mobile,
installation PWA, connexion juge, bulletin avec accusé, sauvegarde téléchargée.
