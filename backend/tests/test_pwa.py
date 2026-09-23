"""Fichiers PWA servis depuis frontend/dist : manifest, service worker, icônes, et /api/ jamais rabattu sur index.html."""
import json
import pytest
from fastapi.testclient import TestClient
from fibda import app as app_module
from fibda.app import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    dist = tmp_path / 'dist'
    (dist / 'assets').mkdir(parents=True)
    (dist / 'icons').mkdir()
    (dist / 'index.html').write_text('<!doctype html><title>FIBDA</title>', encoding='utf-8')
    (dist / 'manifest.webmanifest').write_text(json.dumps({'name': 'FIBDA Compétition', 'start_url': '/', 'display': 'standalone'}), encoding='utf-8')
    (dist / 'sw.js').write_text('self.addEventListener("fetch", () => {});', encoding='utf-8')
    (dist / 'icons' / 'icon-192.png').write_bytes(b'\x89PNG\r\n\x1a\n')
    (tmp_path / 'secret.txt').write_text('hors de dist', encoding='utf-8')
    monkeypatch.setattr(app_module, 'resource_path', lambda *parts: dist)
    with TestClient(create_app(tmp_path / 'data', testing=True)) as c:
        yield c


def test_manifest_is_served_as_json(client):
    r = client.get('/manifest.webmanifest')
    assert r.status_code == 200
    assert r.headers['content-type'].startswith('application/manifest+json')
    assert json.loads(r.text)['start_url'] == '/'


def test_service_worker_is_served_at_root(client):
    r = client.get('/sw.js')
    assert r.status_code == 200
    assert 'javascript' in r.headers['content-type']
    assert 'addEventListener' in r.text


def test_icon_is_served(client):
    r = client.get('/icons/icon-192.png')
    assert r.status_code == 200
    assert r.headers['content-type'] == 'image/png'


def test_unknown_api_route_is_404_not_index(client):
    r = client.get('/api/inexistant')
    assert r.status_code == 404
    assert 'FIBDA' not in r.text


def test_unknown_path_falls_back_to_index(client):
    r = client.get('/jugement/tour-1')
    assert r.status_code == 200 and 'FIBDA' in r.text


def test_no_escape_from_dist(client, tmp_path):
    # httpx normalise « .. » avant l'envoi : on passe donc par des variantes encodées, un lien
    # symbolique sortant de dist, et un scope ASGI brut qui envoie le chemin tel quel.
    (tmp_path / 'dist' / 'lien.txt').symlink_to(tmp_path / 'secret.txt')
    for path in ('/%2e%2e/secret.txt', '/..%2fsecret.txt', '/lien.txt', '/assets/../../secret.txt'):
        r = client.get(path)
        assert 'hors de dist' not in r.text, path
    import asyncio
    async def raw(path):
        sent = []
        scope = {'type': 'http', 'asgi': {'version': '3.0'}, 'http_version': '1.1', 'method': 'GET', 'scheme': 'http',
                 'path': path, 'raw_path': path.encode(), 'query_string': b'', 'headers': [(b'host', b'testserver')],
                 'client': ('127.0.0.1', 1), 'server': ('testserver', 80), 'root_path': ''}
        async def receive(): return {'type': 'http.request', 'body': b'', 'more_body': False}
        async def send(m): sent.append(m)
        await client.app(scope, receive, send)
        return b''.join(m.get('body', b'') for m in sent if m['type'] == 'http.response.body')
    for path in ('/../secret.txt', '/' + 'a' * 5000):
        body = asyncio.run(raw(path))
        assert b'hors de dist' not in body, path
        assert b'FIBDA' in body, path  # repli sur index.html, pas d'erreur 500
