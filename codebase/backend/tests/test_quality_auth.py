import pytest

from app import create_app
from db import db
from phase1_students.models import Student
from phase4_quality.models import AuditEvent, AuthSession, User


@pytest.fixture
def client():
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'SECRET_KEY': 'test-secret-key',
        'AUTH_MAX_FAILED_LOGINS': 3,
    })
    with app.test_client() as test_client:
        yield test_client


def bootstrap(client):
    return client.post('/api/auth/bootstrap', json={
        'email': 'admin@example.test',
        'full_name': 'Test Administrator',
        'password': 'SecureAdmin123',
    })


def authorized(token):
    return {'Authorization': f'Bearer {token}'}


def test_bootstrap_is_one_time_and_password_is_hashed(client):
    response = bootstrap(client)
    assert response.status_code == 201
    assert response.json['teacher']['role'] == 'admin'
    assert bootstrap(client).status_code == 409
    with client.application.app_context():
        user = User.query.one()
        assert user.password_hash != 'SecureAdmin123'
        assert user.password_hash.startswith('scrypt:')
        assert AuditEvent.query.filter_by(action='admin.bootstrap').count() == 1


def test_login_session_logout_and_revocation(client):
    bootstrap(client)
    login = client.post('/api/auth/login', json={
        'email': 'admin@example.test', 'password': 'SecureAdmin123'
    })
    assert login.status_code == 200
    headers = authorized(login.json['token'])
    assert client.get('/api/auth/me', headers=headers).status_code == 200
    assert client.post('/api/auth/logout', headers=headers).status_code == 200
    assert client.get('/api/auth/me', headers=headers).status_code == 401
    with client.application.app_context():
        assert AuthSession.query.filter(AuthSession.revoked_at.isnot(None)).count() == 1


def test_login_validation_and_persistent_lockout(client):
    bootstrap(client)
    assert client.post('/api/auth/login', json={'email': 'admin@example.test'}).status_code == 400
    for _ in range(3):
        response = client.post('/api/auth/login', json={
            'email': 'admin@example.test', 'password': 'WrongPassword123'
        })
        assert response.status_code == 401
    locked = client.post('/api/auth/login', json={
        'email': 'admin@example.test', 'password': 'SecureAdmin123'
    })
    assert locked.status_code == 429
    with client.application.app_context():
        assert User.query.one().locked_until is not None


def test_admin_creates_teacher_and_rbac_scopes_student_data(client):
    admin = bootstrap(client)
    admin_headers = authorized(admin.json['token'])
    created = client.post('/api/auth/users', headers=admin_headers, json={
        'email': 'teacher@example.test',
        'full_name': 'Test Teacher',
        'password': 'SecureTeacher123',
        'role': 'teacher',
        'assigned_class': 'Grade 1',
    })
    assert created.status_code == 201

    with client.application.app_context():
        db.session.add_all([
            Student(roll_number='G1-1', full_name='Grade One Student', class_name='Grade 1', section='A', enrollment_date='2026-01-01'),
            Student(roll_number='G2-1', full_name='Grade Two Student', class_name='Grade 2', section='A', enrollment_date='2026-01-01'),
        ])
        db.session.commit()

    login = client.post('/api/auth/login', json={
        'email': 'teacher@example.test', 'password': 'SecureTeacher123'
    })
    teacher_headers = authorized(login.json['token'])
    students = client.get('/api/students', headers=teacher_headers)
    assert students.status_code == 200
    assert [student['class_name'] for student in students.json['students']] == ['Grade 1']
    assert client.get('/api/students/2', headers=teacher_headers).status_code == 403
    assert client.post('/api/students', headers=teacher_headers, json={}).status_code == 403
    assert client.get('/api/admin/audit-events', headers=teacher_headers).status_code == 403


def test_admin_password_reset_revokes_sessions_and_is_audited(client):
    admin = bootstrap(client)
    admin_headers = authorized(admin.json['token'])
    created = client.post('/api/auth/users', headers=admin_headers, json={
        'email': 'teacher@example.test', 'full_name': 'Teacher',
        'password': 'SecureTeacher123', 'role': 'teacher', 'assigned_class': 'Grade 1'
    })
    user_id = created.json['user']['id']
    teacher_login = client.post('/api/auth/login', json={
        'email': 'teacher@example.test', 'password': 'SecureTeacher123'
    })
    teacher_headers = authorized(teacher_login.json['token'])

    reset = client.post(f'/api/auth/users/{user_id}/reset-password', headers=admin_headers, json={
        'new_password': 'Replacement456'
    })
    assert reset.status_code == 200
    assert client.get('/api/auth/me', headers=teacher_headers).status_code == 401
    assert client.post('/api/auth/login', json={
        'email': 'teacher@example.test', 'password': 'Replacement456'
    }).status_code == 200
    audit = client.get('/api/admin/audit-events', headers=admin_headers)
    assert any(event['action'] == 'user.password_reset' for event in audit.json['events'])


def test_student_and_dashboard_data_require_authentication(client):
    bootstrap(client)
    assert client.get('/api/students').status_code == 401
    assert client.get('/api/dashboard/stats').status_code == 401
    assert client.get('/api/reports/attendance').status_code == 401


def test_privacy_and_json_error_handlers(client):
    admin = bootstrap(client)
    headers = authorized(admin.json['token'])
    assert client.get('/api/privacy/policy').status_code == 200
    assert client.post('/api/privacy/purge', headers=headers).status_code == 200
    assert client.get('/api/privacy/audit', headers=headers).status_code == 200
    not_found = client.get('/api/non-existent-endpoint')
    assert not_found.status_code == 404
    assert not_found.json['status_code'] == 404
    method = client.post('/api/health')
    assert method.status_code == 405
    assert method.json['status_code'] == 405
