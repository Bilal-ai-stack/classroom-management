import pytest
from app import create_app
from db import db

@pytest.fixture
def client():
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'SECRET_KEY': 'test-secret-key'
    })
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
        yield client

def test_login_success(client):
    res = client.post('/api/auth/login', json={
        'email': 'teacher@school.edu',
        'password': 'classroom2026'
    })
    assert res.status_code == 200
    assert res.json['success'] is True
    assert 'token' in res.json
    assert res.json['teacher']['email'] == 'teacher@school.edu'

def test_login_invalid_password(client):
    res = client.post('/api/auth/login', json={
        'email': 'teacher@school.edu',
        'password': 'wrongpassword'
    })
    assert res.status_code == 401
    assert res.json['success'] is False
    assert 'Invalid email or password' in res.json['error']

def test_login_missing_fields(client):
    res = client.post('/api/auth/login', json={'email': 'teacher@school.edu'})
    assert res.status_code == 400
    assert res.json['success'] is False

def test_get_current_user_unauthenticated(client):
    res = client.get('/api/auth/me')
    assert res.status_code == 200
    assert res.json['success'] is True
    assert res.json['authenticated'] is False

def test_get_current_user_authenticated(client):
    # Log in first
    login_res = client.post('/api/auth/login', json={
        'email': 'teacher@school.edu',
        'password': 'classroom2026'
    })
    token = login_res.json['token']

    res = client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    assert res.json['success'] is True
    assert res.json['authenticated'] is True
    assert res.json['teacher']['name'] == 'Ms. Clara Vance'

def test_logout(client):
    login_res = client.post('/api/auth/login', json={
        'email': 'teacher@school.edu',
        'password': 'classroom2026'
    })
    token = login_res.json['token']

    res = client.post('/api/auth/logout', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    assert res.json['success'] is True

def test_privacy_policy(client):
    res = client.get('/api/privacy/policy')
    assert res.status_code == 200
    assert res.json['success'] is True
    assert 'compliance' in res.json['policy']
    assert any('Zero Biometric' in c for c in res.json['policy']['compliance'])

def test_privacy_purge(client):
    res = client.post('/api/privacy/purge')
    assert res.status_code == 200
    assert res.json['success'] is True
    assert 'deleted_count' in res.json

def test_privacy_audit(client):
    res = client.get('/api/privacy/audit')
    assert res.status_code == 200
    assert res.json['success'] is True
    assert res.json['audit']['cloud_sync_enabled'] is False
    assert res.json['audit']['status'] == 'Compliant'

def test_json_404_error_handler(client):
    res = client.get('/api/non-existent-endpoint')
    assert res.status_code == 404
    assert res.json['success'] is False
    assert res.json['status_code'] == 404

def test_json_405_error_handler(client):
    # /api/health only accepts GET
    res = client.post('/api/health')
    assert res.status_code == 405
    assert res.json['success'] is False
    assert res.json['status_code'] == 405
