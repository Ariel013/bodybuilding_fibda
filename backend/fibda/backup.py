"""Consistent SQLite snapshots and validated restore staging; never overwrite live data."""
import hashlib
import io
import json
import sqlite3
import tempfile
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from .transfers import safe_members, MAX_TOTAL, MAX_FILE


def create_backup(db_path, photos_dir):
    with tempfile.TemporaryDirectory() as temporary:
        snapshot = Path(temporary) / 'database.sqlite'
        with sqlite3.connect(str(db_path)) as source, sqlite3.connect(snapshot) as target:
            source.backup(target)
        files = {'database.sqlite': snapshot.read_bytes()}
        root = Path(photos_dir)
        if root.exists():
            for path in sorted(root.rglob('*')):
                if path.is_symlink():
                    raise ValueError('Lien symbolique interdit dans photos')
                if path.is_file():
                    files['photos/' + path.relative_to(root).as_posix()] = path.read_bytes()
        if any(len(value) > MAX_FILE for value in files.values()):
            raise ValueError('Un fichier dépasse la limite de 20 Mo')
        if sum(map(len, files.values())) > MAX_TOTAL:
            raise ValueError('Sauvegarde trop volumineuse')
        manifest = {'format': 'fibda-backup', 'version': 1, 'created_at': datetime.now(timezone.utc).isoformat(),
                    'files': {name: hashlib.sha256(data).hexdigest() for name, data in files.items()}}
        output = io.BytesIO()
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name, data in files.items():
                archive.writestr(name, data)
            archive.writestr('manifest.json', json.dumps(manifest))
        return output.getvalue()


def validate_backup(data):
    if len(data) > MAX_TOTAL:
        raise ValueError('Archive trop volumineuse')
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            infos = safe_members(archive)
            names = {x.filename for x in infos}
            if 'manifest.json' not in names or 'database.sqlite' not in names:
                raise ValueError('Sauvegarde incomplète')
            manifest = json.loads(archive.read('manifest.json'))
            if manifest.get('format') != 'fibda-backup' or manifest.get('version') != 1:
                raise ValueError('Format de sauvegarde inconnu')
            expected = manifest.get('files', {})
            if set(expected) != names - {'manifest.json'}:
                raise ValueError('Inventaire incohérent')
            files = {}
            for name, digest in expected.items():
                if name != 'database.sqlite' and not name.startswith('photos/'):
                    raise ValueError('Fichier inattendu')
                files[name] = archive.read(name)
                if hashlib.sha256(files[name]).hexdigest() != digest:
                    raise ValueError('Empreinte incorrecte : ' + name)
    except (zipfile.BadZipFile, KeyError, json.JSONDecodeError) as exc:
        raise ValueError('Archive invalide') from exc
    with tempfile.TemporaryDirectory() as temp:
        path = Path(temp) / 'verify.sqlite'
        path.write_bytes(files['database.sqlite'])
        try:
            with sqlite3.connect(f'file:{path}?mode=ro', uri=True) as connection:
                tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                if not {'events', 'users', 'sessions', 'commands', 'audit', 'photos'}.issubset(tables):
                    raise ValueError('Schéma FIBDA incomplet')
                event_rows = connection.execute('SELECT data FROM events').fetchall()
                if len(event_rows) != 1:
                    raise ValueError('Un événement exactement est attendu')
                event = json.loads(event_rows[0][0])
                if not isinstance(event, dict) or not all(isinstance(event.get(k), list) for k in ('people', 'entries', 'categories', 'rounds')):
                    raise ValueError('Événement FIBDA invalide')
                if connection.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    raise ValueError('Base corrompue')
        except sqlite3.DatabaseError as exc:
            raise ValueError('Base SQLite invalide') from exc
    return {'database': files.pop('database.sqlite'), 'photos': {name[7:]: value for name, value in files.items()}, 'manifest': manifest}


def stage_restore(data, target_dir):
    content = validate_backup(data)
    restore_id = str(uuid.uuid4())
    root = Path(target_dir) / ('restore-' + restore_id)
    root.mkdir(parents=True, exist_ok=False)
    database = root / 'database.sqlite'
    database.write_bytes(content['database'])
    photos = root / 'photos'
    photos.mkdir()
    for name, value in content['photos'].items():
        path = photos / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(value)
    return {'database_path': str(database), 'photos_dir': str(photos), 'restore_id': restore_id}
