"""Mode --behind-proxy (Railway) : cookie Secure, boucle locale et limiteur de connexion derrière un proxy."""
from fastapi.testclient import TestClient
from fibda.app import create_app

CODE='Chef-Secure-12345'


def client(tmp_path,behind_proxy,host='127.0.0.1'):
    # testing=False : local_only est réellement appliqué ; sans `with`, le minuteur de fond n'est pas lancé.
    return TestClient(create_app(tmp_path,testing=False,behind_proxy=behind_proxy),client=(host,50000))


def test_proxy_cookie_secure_from_forwarded_proto(tmp_path):
    c=client(tmp_path,True)
    assert c.post('/api/v1/auth/setup',json={'name':'Chef','code':CODE}).status_code==200
    r=c.post('/api/v1/auth/login',json={'code':CODE},headers={'X-Forwarded-For':'203.0.113.7','X-Forwarded-Proto':'https'})
    assert r.status_code==200 and 'Secure' in r.headers['set-cookie'] and 'HttpOnly' in r.headers['set-cookie']
    r=c.post('/api/v1/auth/login',json={'code':CODE},headers={'X-Forwarded-For':'203.0.113.7','X-Forwarded-Proto':'http'})
    assert r.status_code==400 and 'set-cookie' not in r.headers
    r=c.post('/api/v1/auth/login',json={'code':CODE},headers={'X-Forwarded-For':'203.0.113.7'})
    assert r.status_code==400


def test_proxy_local_only_rejects_forwarded_requests(tmp_path):
    c=client(tmp_path,True)
    body={'name':'Chef','code':CODE}
    assert c.post('/api/v1/auth/setup',json=body,headers={'X-Forwarded-For':'1.2.3.4','X-Forwarded-Proto':'https'}).status_code==403
    assert c.post('/api/v1/auth/setup',json=body,headers={'X-Forwarded-For':'127.0.0.1','X-Forwarded-Proto':'https'}).status_code==403
    assert client(tmp_path,True,host='10.0.0.5').post('/api/v1/auth/setup',json=body).status_code==403
    r=c.post('/api/v1/auth/setup',json=body)
    assert r.status_code==200 and 'Secure' in r.headers['set-cookie']
    assert c.post('/api/v1/auth/setup',json=body).status_code==409


def test_proxy_origin_check_uses_forwarded_scheme(tmp_path):
    c=client(tmp_path,True)
    assert c.post('/api/v1/auth/setup',json={'name':'Chef','code':CODE}).status_code==200
    proxied={'X-Forwarded-For':'203.0.113.7','X-Forwarded-Proto':'https','X-Forwarded-Host':'fibda.example.test','Host':'fibda.example.test'}
    assert c.post('/api/v1/auth/login',json={'code':CODE},headers={**proxied,'Origin':'https://fibda.example.test'}).status_code==200
    assert c.post('/api/v1/auth/login',json={'code':CODE},headers={**proxied,'Origin':'http://fibda.example.test'}).status_code==403
    assert c.post('/api/v1/auth/login',json={'code':CODE},headers={**proxied,'Origin':'https://autre.example.test'}).status_code==403


def test_without_proxy_mode_forwarded_headers_are_ignored(tmp_path):
    c=client(tmp_path,False)
    body={'name':'Chef','code':CODE}
    r=c.post('/api/v1/auth/setup',json=body,headers={'X-Forwarded-For':'1.2.3.4','X-Forwarded-Proto':'https'})
    assert r.status_code==200 and 'Secure' not in r.headers['set-cookie']
    assert client(tmp_path,False,host='10.0.0.5').post('/api/v1/auth/setup',json=body).status_code==403
    r=c.post('/api/v1/auth/login',json={'code':CODE},headers={'X-Forwarded-Proto':'https'})
    assert r.status_code==200 and 'Secure' not in r.headers['set-cookie']


def test_proxy_login_limiter_keyed_by_forwarded_address(tmp_path):
    c=client(tmp_path,True)
    assert c.post('/api/v1/auth/setup',json={'name':'Chef','code':CODE}).status_code==200
    def attempt(address,code='faux'):
        return c.post('/api/v1/auth/login',json={'code':code},headers={'X-Forwarded-For':address,'X-Forwarded-Proto':'https'}).status_code
    for _ in range(15):assert attempt('203.0.113.7')==401
    assert attempt('203.0.113.7')==429
    # Un autre juge derrière le même proxy n'est pas bloqué.
    assert attempt('203.0.113.8',CODE)==200
    # Seule la dernière adresse (ajoutée par le proxy) compte : un préfixe forgé ne contourne pas le blocage.
    assert attempt('9.9.9.9, 203.0.113.7')==429
