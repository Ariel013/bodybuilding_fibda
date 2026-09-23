from test_server import client, cmd, setup


def test_four_character_chief_code_preserves_leading_zeroes(tmp_path):
    with client(tmp_path) as c:
        for code in ('042', 'x' * 129):
            response = c.post('/api/v1/auth/setup', json={'name': 'Chef', 'code': code})
            assert response.status_code == 422
        assert c.post('/api/v1/auth/setup', json={'name': 'Chef', 'code': '0042'}).status_code == 200
        c.post('/api/v1/auth/logout')
    with client(tmp_path) as c:
        assert c.post('/api/v1/auth/login', json={'code': '42'}).status_code == 401
        assert c.post('/api/v1/auth/login', json={'code': '0042'}).status_code == 200
        assert c.get('/api/v1/state').status_code == 200


def test_short_judge_code_keeps_uniqueness_and_existing_access(tmp_path):
    with client(tmp_path) as c:
        setup(c)
        for code in ('J42', 'x' * 129):
            assert cmd(c, 'user.invite', {'name': 'Juge', 'roles': ['judge'], 'code': code}).status_code == 422
        assert cmd(c, 'user.invite', {'name': 'Juge', 'roles': ['judge'], 'code': 'J042'}).status_code == 200
        assert cmd(c, 'user.invite', {'name': 'Autre juge', 'roles': ['judge'], 'code': 'J042'}).status_code == 409
        c.post('/api/v1/auth/logout')
        assert c.post('/api/v1/auth/login', json={'code': 'J042'}).status_code == 200
        assert c.get('/api/v1/state').status_code == 200
        c.post('/api/v1/auth/logout')
        assert c.post('/api/v1/auth/login', json={'code': 'Chef-Secure-12345'}).status_code == 200
