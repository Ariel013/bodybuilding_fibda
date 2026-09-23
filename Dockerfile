# Image Railway (plan B, ADR 0002) : serveur Python derrière le proxy TLS de Railway.
# Le conteneur reçoit du HTTP en clair sur $PORT ; ce port ne doit jamais être exposé directement.

# Étape 1 : interface (Vite/React), construite une fois, servie par le backend.
FROM node:20-bookworm-slim AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Étape 2 : serveur. python:3.13-slim embarque SQLite 3.46.1 (mesuré le 23/09), trop ancien pour le
# lanceur (≥ 3.51.3 exigé en réseau) ; les Python installés par uv embarquent leur propre SQLite.
# uv installé par son script (comme docs/DEPLOIEMENT-INTERNET.md §2) : l'image ghcr.io/astral-sh/uv:bookworm-slim
# pointait le 23/09 sur uv 0.9.30, qui n'installe que CPython 3.13.12 (SQLite 3.50.4, refusé au build).
# CPython 3.13.15 embarque SQLite 3.53.1 (mesuré le 23/09).
FROM debian:bookworm-slim
ENV UV_PYTHON_INSTALL_DIR=/opt/python UV_LINK_MODE=copy PYTHONUNBUFFERED=1 PATH="/root/.local/bin:$PATH"
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/* \
    && curl -LsSf https://astral.sh/uv/0.9.30/install.sh | sh && uv python install 3.13.15
WORKDIR /app
COPY requirements.txt ./
RUN uv venv --python 3.13 .venv && uv pip install --python .venv/bin/python -r requirements.txt
# Contrôle au build : l'image ne se construit pas avec un SQLite trop ancien.
RUN .venv/bin/python -c "import sqlite3,sys; assert sqlite3.sqlite_version_info>=(3,51,3), sqlite3.sqlite_version; print('SQLite', sqlite3.sqlite_version)"
COPY launch.py alembic.ini ./
COPY backend/ backend/
COPY migrations/ migrations/
COPY --from=frontend /src/frontend/dist frontend/dist
# Données de compétition sur le volume Railway monté sur /data (jamais dans l'image).
VOLUME ["/data"]
EXPOSE 8080
CMD ["sh","-c","exec .venv/bin/python launch.py --behind-proxy --host 0.0.0.0 --port \"${PORT:-8080}\" --public-url \"$PUBLIC_URL\" --data-dir /data/official"]
