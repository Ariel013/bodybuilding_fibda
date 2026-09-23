#!/usr/bin/env python3
"""Create a deterministic developer source archive from an explicit allowlist."""
from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import zipfile


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "livrables" / "FIBDA-autonome"
ARCHIVE = OUT / "FIBDA-sources-developpeur.zip"
STAMP = (1980, 1, 1, 0, 0, 0)
ROOT_FILES = (
    "README.md", "README-OPERATIONS.md", "REPRISE.md", "alembic.ini",
    "launch.py", "pyproject.toml", "requirements.txt", "requirements-lock.txt",
    "frontend/index.html", "frontend/package.json", "frontend/package-lock.json",
    "frontend/tsconfig.json", "frontend/vite.config.ts",
    "standalone/package-sources.py", "standalone/NOTICE-TESTEURS.md",
    "standalone/LIVRAISON-DEVELOPPEUR.md", "standalone/python/README.md",
    "livrables/FIBDA-autonome/RAPPORT-VERIFICATION.md",
    "livrables/FIBDA-autonome/manifest.json",
)
DOCS = (
    "CONNEXION-JUGES.md", "CONTRACT.md", "DESIGN.md", "EXPLOITATION.md",
    "HANDOFF.md", "IMPLEMENTATION.md", "LANCEMENT.md", "MATRICE-DROITS.md",
    "MODELE-DONNEES.md", "NOTICE.md", "PV-RECETTE.md", "RECETTE.md",
    "REFERENTIEL.md", "REPORT-DOMAIN.md", "REPORT-FRONTEND.md",
    "REPORT-OPERATIONS.md", "REPORT-PACKAGE.md", "REPORT-RECETTE-LOCALE.md",
    "STATUT-LIVRAISON.md", "openapi.json", "document-smoke.json", "package-smoke.json",
)
PROOFS = (
    "codes-courts-navigateur.json", "codes-courts-redemarrage.json",
    "frontend-build-codes-courts.txt", "frontend-build.txt", "frontend-tests.txt",
    "frontend-typecheck.txt", "pytest-codes-courts.txt", "pytest.txt",
)
SOURCE_TREES = {
    "backend/fibda": {".py", ".json"},
    "backend/tests": {".py"},
    "frontend/src": {".ts", ".tsx", ".css"},
    "frontend/public/assets": {".png", ".jpg", ".ttf", ".txt"},
    "migrations": {".py"},
    "scripts": {".py", ".command", ".bat"},
    "standalone/src": {".ts", ".tsx", ".css"},
    "standalone/python": {".py"},
    "standalone/tests": {".py"},
    "docs/captures": {".png"},
    "livrables/FIBDA-autonome/preuves": {".json", ".txt", ".js", ".png"},
}
FORBIDDEN_PARTS = {
    ".git", ".venv", "node_modules", "__pycache__", ".pytest_cache", ".build",
    "dist", "data", "backups", "sessions", ".codex", ".agents",
}
SECRET_PATTERNS = (
    rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    rb"\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{30,}\b",
    rb"\bAKIA[0-9A-Z]{16}\b",
    rb"\bxox[baprs]-[A-Za-z0-9-]{20,}\b",
    rb"https?://[^\s/@:]+:[^\s/@]+@",
)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def validate_name(name: str) -> None:
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or "\\" in name:
        raise ValueError(f"Chemin non partageable : {name}")
    if FORBIDDEN_PARTS.intersection(path.parts):
        raise ValueError(f"Dossier interdit : {name}")
    if path.name.startswith(".env") or path.suffix.lower() in {
        ".pem", ".key", ".p12", ".pfx", ".db", ".sqlite", ".sqlite3", ".pyc",
    }:
        raise ValueError(f"Fichier sensible ou généré : {name}")
    if "consultation-design" in name.lower() or "design-consultation" in name.lower():
        raise ValueError(f"Consultation non adoptée : {name}")
    if path.name == "proof-offline.html":
        raise ValueError("La preuve HTML générée ne fait pas partie des sources")


def read_source(relative: str) -> bytes:
    validate_name(relative)
    path = ROOT / relative
    if not path.is_file() or path.is_symlink() or not path.resolve().is_relative_to(ROOT):
        raise ValueError(f"Source manquante ou lien non autorisé : {relative}")
    # Also reject a parent directory replaced by a symlink.
    if any(parent.is_symlink() for parent in path.parents if parent != ROOT.parent):
        raise ValueError(f"Répertoire lié non autorisé : {relative}")
    data = path.read_bytes()
    if path.suffix in {".py", ".ts", ".tsx", ".md", ".json", ".txt", ".ini", ".toml"}:
        for pattern in SECRET_PATTERNS:
            if re.search(pattern, data):
                raise ValueError(f"Signature de secret détectée : {relative}; fichier non archivé")
    return data


def collect() -> dict[str, bytes]:
    paths = set(ROOT_FILES)
    paths.update(f"docs/{name}" for name in DOCS)
    paths.update(f"docs/preuves/{name}" for name in PROOFS)
    for folder, extensions in SOURCE_TREES.items():
        for path in (ROOT / folder).rglob("*"):
            if path.is_file() and path.suffix in extensions:
                if not FORBIDDEN_PARTS.intersection(path.relative_to(ROOT).parts):
                    paths.add(path.relative_to(ROOT).as_posix())
    runtime_manifest = json.loads((ROOT / "standalone/runtime/manifest.json").read_text())
    for item in runtime_manifest["files"]:
        name = "standalone/runtime/" + item["path"]
        data = read_source(name)
        if digest(data) != item["sha256"] or len(data) != item["bytes"]:
            raise ValueError(f"Distribution runtime différente du manifeste : {name}")
        paths.add(name)
    paths.update(
        "standalone/runtime/" + name for name in (
            "README.md", "manifest.json", "runtime.js", "proof_bridge.py", "proof-results.json",
        )
    )
    paths.update(path.relative_to(ROOT).as_posix() for path in (ROOT / "standalone/runtime").glob("LICENSE*"))
    for mandatory in ("PYODIDE", "CPYTHON", "EMSCRIPTEN", "openpyxl", "et_xmlfile"):
        if f"standalone/runtime/LICENSE-{mandatory}" not in paths:
            raise ValueError(f"Licence runtime manquante : {mandatory}")
    files = {name: read_source(name) for name in sorted(paths)}
    for package in ("react", "react-dom", "scheduler"):
        target = f"licenses/frontend/{package}-LICENSE.txt"
        saved = ROOT / target
        installed = ROOT / "frontend/node_modules" / package / "LICENSE"
        # An extracted source archive can be repackaged without npm ci.
        license_path = saved if saved.is_file() else installed
        if not license_path.is_file() or license_path.is_symlink():
            raise ValueError(f"Licence frontend manquante : {package}; lancer npm ci")
        files[target] = license_path.read_bytes()
    return files


README = """# FIBDA — sources destinées au développeur

Cette archive accompagne le HTML autonome de test FIBDA. Elle contient les
sources réellement présentes lors de son emballage, les distributions Python/WASM
figées et leurs licences. Elle ne contient aucune base de compétition ni session
de production. Les codes présents dans les fixtures et le guide sont des codes
publics de démonstration ; employer des personnes et photos fictives pour les essais.

## Lire en premier

- `standalone/LIVRAISON-DEVELOPPEUR.md` : architecture, frontière d'adaptation,
  persistance locale, preuves disponibles et limites du HTML.
- `standalone/NOTICE-TESTEURS.md` : ouverture, comptes de test et parcours.
- `docs/HANDOFF.md`, `docs/CONTRACT.md`, `docs/DESIGN.md` : application serveur,
  contrats métier et charte adoptée.
- `REPRISE.md` : historique et réserves. Les références à une consultation design
  séparée ne signifient pas que ses propositions sont adoptées ; ces fichiers sont exclus.

## Reconstruire le HTML

Dans le dossier extrait, installer les prérequis Node.js et Python, puis :

```sh
cd frontend
npm ci
cd ..
python3 scripts/build-standalone.py
```

Le résultat est `livrables/FIBDA-autonome/FIBDA-application-autonome.html`.
La construction ne lance pas de serveur et ne modifie pas les sources backend
ou frontend. Les ressources runtime sont déjà incluses ; npm ci nécessite l'accès
aux dépendances npm. Le HTML construit n'a pas besoin de CDN pendant son utilisation.
Les prérequis, tests et instructions propres au serveur sont dans `README.md`.

Chaque appareil conserve sa copie indépendante. Le HTML n'assure aucune
synchronisation de juges entre appareils ; il ne remplace pas le serveur central.
La réception Safari/iPhone/Android et imprimante demeure à effectuer. Les
visualiseurs de pièces jointes peuvent ne pas exécuter l'application : ouvrir le
HTML dans un navigateur récent. La compatibilité universelle n'est pas garantie.

## Inventaire et vérification

`MANIFEST-SOURCES.json` donne taille et SHA-256 de chaque entrée, hormis lui-même.
Les entrées sont triées, leurs dates et permissions ZIP sont fixes. Le constructeur
`standalone/package-sources.py` contrôle les noms, les signatures usuelles de secrets,
les empreintes des distributions runtime, la CRC et chaque SHA-256 après création.
Ce contrôle automatique ne remplace pas une revue humaine des fichiers à partager.

Le HTML généré, node_modules, .venv, caches, .build, Git, fichiers d'environnement,
clés/certificats, données et sauvegardes d'exploitation sont exclus. La consultation
design non adoptée et la preuve HTML runtime volumineuse sont également exclues.
Les preuves de développement incluses concernent des essais fictifs locaux ; les
adresses de boucle locale et chemins temporaires qu'elles citent ne sont pas des
liens de diffusion. Les anciennes preuves ne valent pas recette du nouvel HTML.

Les distributions Pyodide/CPython/Emscripten/openpyxl/et_xmlfile et licences restent
dans `standalone/runtime/`. La police et sa licence sont dans `frontend/public/assets/`.
Les notices React, React DOM et Scheduler sont dans `licenses/frontend/`.

Pour reproduire cette archive, depuis le dossier extrait :

```sh
python3 standalone/package-sources.py
```

Le fichier final HTML est remis à côté de cette archive. Son manifeste et le rapport
de vérification sont inclus dans livrables/FIBDA-autonome. Une reconstruction future doit être testée
et accompagnée d'une nouvelle empreinte et de nouvelles preuves appropriées.
"""


def archive_bytes(files: dict[str, bytes]) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(files.items()):
            validate_name(name)
            info = zipfile.ZipInfo(name, STAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data, compresslevel=9)
    return output.getvalue()


def main() -> None:
    files = collect()
    files["README-LIVRAISON.md"] = README.encode("utf-8")
    manifest = {
        "format": "fibda-source-package", "schema": 1,
        "note": "Empreintes des octets archivés ; le manifeste ne se référence pas lui-même.",
        "files": [
            {"path": name, "bytes": len(data), "sha256": digest(data)}
            for name, data in sorted(files.items())
        ],
    }
    manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    files["MANIFEST-SOURCES.json"] = manifest_bytes
    result = archive_bytes(files)
    if result != archive_bytes(files):
        raise RuntimeError("L'archive n'est pas reproductible à sources inchangées")
    with zipfile.ZipFile(io.BytesIO(result)) as archive:
        if archive.testzip() is not None or len(archive.namelist()) != len(files):
            raise RuntimeError("Échec du contrôle ZIP/CRC/inventaire")
        for item in manifest["files"]:
            value = archive.read(item["path"])
            if len(value) != item["bytes"] or digest(value) != item["sha256"]:
                raise RuntimeError(f"Échec du contrôle SHA-256 : {item['path']}")
    OUT.mkdir(parents=True, exist_ok=True)
    temporary = ARCHIVE.with_suffix(".zip.tmp")
    temporary.write_bytes(result)
    temporary.replace(ARCHIVE)
    (OUT / "FIBDA-sources-developpeur-manifest.json").write_bytes(manifest_bytes)
    print(json.dumps({
        "archive": str(ARCHIVE), "files": len(files), "bytes": len(result),
        "sha256": digest(result), "crc": "OK", "sha256_entries": "OK",
        "reproducible_same_inputs": True, "runtime_checksums": "OK",
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
