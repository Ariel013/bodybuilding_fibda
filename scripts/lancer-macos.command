#!/bin/zsh
set -eu
SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
APP_DIR="$(dirname -- "$SCRIPT_DIR")"
if [[ ! -x "$APP_DIR/.venv/bin/python" ]]; then
  print 'Installer les dépendances selon docs/LANCEMENT.md avant le lancement.'
  exit 1
fi
exec "$APP_DIR/.venv/bin/python" "$APP_DIR/launch.py" "$@"
