import pytest
from app import create_app
from db import db
from phase1_students.models import Student
from phase4_quality.institution_models import AcademicClass, AcademicTerm, InstitutionSettings
from phase4_quality.models import AuditEvent, User


@pytest.fixture
def client():
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'SECRET_KEY': 'test-secret-key-admin',
    })
    with app.test_client() as test_client:
        yield test_client


def setup_users(client):
    # Bootstrap Admin
    res = client.post('/api/auth/bootstrap', json={
        'email': 'admin@school.local',
        'full_name': 'Chief Administrator',
        'password': 'AdminPassword123'
    })
    assert res.status_code == 201
    admin_token = res.json['token']

    # Create Teacher
    res2 = client.post('/api/auth/users', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'email': 'teacher@school.local',
        'full_name': 'Grade 4 Teacher',
        'role': 'teacher',
        'assigned_class': 'Grade 4',
        'password': 'TeacherPass123'
    })
    assert res2.status_code == 201

    login = client.post('/api/auth/login', json={
        'email': 'teacher@school.local',
        'password': 'TeacherPass123'
    })
    teacher_token = login.json['token']

    return admin_token, teacher_token


# ---------------------------------------------------------------------------
# Institution Settings Tests
# ---------------------------------------------------------------------------

def test_default_institution_settings(client):
    admin_token, _ = setup_users(client)
    res = client.get('/api/admin/institution', headers={'Authorization': f'Bearer {admin_token}'})
    assert res.status_code == 200
    data = res.json['settings']
    assert data['institution_name'] == 'Springfield Academy'
    assert data['institution_code'] == 'SCH-001'
    assert data['min_attendance_warning_rate'] == 75.0


def test_update_institution_settings_success(client):
    admin_token, _ = setup_users(client)
    payload = {
        'institution_name': 'Greenwood High',
        'institution_code': 'GWD-100',
        'contact_email': 'principal@greenwood.edu',
        'academic_year': '2026-2027',
        'current_term': 'Semester 1',
        'min_attendance_warning_rate': 80.0,
        'timezone': 'America/New_York'
    }
    res = client.put('/api/admin/institution', headers={'Authorization': f'Bearer {admin_token}'}, json=payload)
    assert res.status_code == 200
    assert res.json['settings']['institution_name'] == 'Greenwood High'
    assert res.json['settings']['min_attendance_warning_rate'] == 80.0

    # Verify audit event
    with client.application.app_context():
        audit = AuditEvent.query.filter_by(action='institution.update').first()
        assert audit is not None
        assert audit.to_dict()['details']['updated']['institution_name'] == 'Greenwood High'


def test_update_institution_settings_validation(client):
    admin_token, _ = setup_users(client)

    # Invalid email
    res = client.put('/api/admin/institution', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'institution_name': 'Test School',
        'institution_code': 'TS-1',
        'contact_email': 'invalid-email-address',
    })
    assert res.status_code == 400

    # Invalid percentage (> 100)
    res = client.put('/api/admin/institution', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'institution_name': 'Test School',
        'institution_code': 'TS-1',
        'contact_email': 'admin@test.local',
        'min_attendance_warning_rate': 120.0
    })
    assert res.status_code == 400
    assert 'between 0 and 100' in res.json['error']


def test_teacher_cannot_update_institution(client):
    _, teacher_token = setup_users(client)
    res = client.put('/api/admin/institution', headers={'Authorization': f'Bearer {teacher_token}'}, json={
        'institution_name': 'Hacked Academy',
        'institution_code': 'HCK',
        'contact_email': 'hacker@school.local'
    })
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# Academic Classes Tests
# ---------------------------------------------------------------------------

def test_list_academic_classes(client):
    admin_token, _ = setup_users(client)
    res = client.get('/api/admin/classes', headers={'Authorization': f'Bearer {admin_token}'})
    assert res.status_code == 200
    classes = res.json['classes']
    assert len(classes) >= 5
    names = [c['name'] for c in classes]
    assert 'Grade 1' in names
    assert 'Grade 4' in names


def test_create_and_update_academic_class(client):
    admin_token, _ = setup_users(client)

    # Create new Grade 6 class
    payload = {
        'name': 'Grade 6',
        'section': 'A',
        'room_number': '301',
        'capacity': 32
    }
    res = client.post('/api/admin/classes', headers={'Authorization': f'Bearer {admin_token}'}, json=payload)
    assert res.status_code == 201
    class_id = res.json['class']['id']
    assert res.json['class']['name'] == 'Grade 6'

    # Duplicate creation rejected
    res_dup = client.post('/api/admin/classes', headers={'Authorization': f'Bearer {admin_token}'}, json=payload)
    assert res_dup.status_code == 409
    assert 'already exists' in res_dup.json['error']

    # Update capacity and room
    res_upd = client.put(f'/api/admin/classes/{class_id}', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'room_number': '302-B',
        'capacity': 36
    })
    assert res_upd.status_code == 200
    assert res_upd.json['class']['room_number'] == '302-B'
    assert res_upd.json['class']['capacity'] == 36


def test_delete_academic_class_empty_vs_with_students(client):
    admin_token, _ = setup_users(client)

    # Create empty class and delete
    res = client.post('/api/admin/classes', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'name': 'Music 101',
        'section': 'M',
        'capacity': 25
    })
    class_id = res.json['class']['id']

    del_res = client.delete(f'/api/admin/classes/{class_id}', headers={'Authorization': f'Bearer {admin_token}'})
    assert del_res.status_code == 200
    assert del_res.json['action'] == 'deleted'

    # Add a student to Grade 4 Section A, then attempt delete
    client.post('/api/students', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'roll_number': 'G4-01',
        'full_name': 'Alice Smith',
        'class_name': 'Grade 4',
        'section': 'A',
        'enrollment_date': '2026-09-01'
    })

    # Find Grade 4 A class_id
    classes = client.get('/api/admin/classes', headers={'Authorization': f'Bearer {admin_token}'}).json['classes']
    grade4_id = next(c['id'] for c in classes if c['name'] == 'Grade 4' and c['section'] == 'A')

    del_res2 = client.delete(f'/api/admin/classes/{grade4_id}', headers={'Authorization': f'Bearer {admin_token}'})
    assert del_res2.status_code == 200
    assert del_res2.json['action'] == 'archived'
    assert 'archived instead of deleted' in del_res2.json['message']


# ---------------------------------------------------------------------------
# User Administration & Status Management Tests
# ---------------------------------------------------------------------------

def test_list_and_toggle_user_status(client):
    admin_token, _ = setup_users(client)

    users_res = client.get('/api/admin/users', headers={'Authorization': f'Bearer {admin_token}'})
    assert users_res.status_code == 200
    users = users_res.json['users']
    teacher_account = next(u for u in users if u['email'] == 'teacher@school.local')
    admin_account = next(u for u in users if u['email'] == 'admin@school.local')

    # Deactivate teacher
    toggle_res = client.patch(f"/api/admin/users/{teacher_account['id']}/status", headers={'Authorization': f'Bearer {admin_token}'}, json={'is_active': False})
    assert toggle_res.status_code == 200
    assert toggle_res.json['user']['is_active'] is False

    # Attempt login with deactivated teacher
    login = client.post('/api/auth/login', json={'email': 'teacher@school.local', 'password': 'TeacherPass123'})
    assert login.status_code == 401

    # Reactivate teacher
    toggle_res2 = client.patch(f"/api/admin/users/{teacher_account['id']}/status", headers={'Authorization': f'Bearer {admin_token}'}, json={'is_active': True})
    assert toggle_res2.status_code == 200
    assert toggle_res2.json['user']['is_active'] is True

    # Admin cannot deactivate own account
    self_deact = client.patch(f"/api/admin/users/{admin_account['id']}/status", headers={'Authorization': f'Bearer {admin_token}'}, json={'is_active': False})
    assert self_deact.status_code == 400
    assert 'cannot deactivate their own account' in self_deact.json['error']


# ---------------------------------------------------------------------------
# Academic Terms & Dynamic Classes Dropdown Tests
# ---------------------------------------------------------------------------

def test_academic_terms_management(client):
    admin_token, _ = setup_users(client)

    # List terms
    terms_res = client.get('/api/admin/terms', headers={'Authorization': f'Bearer {admin_token}'})
    assert terms_res.status_code == 200
    assert len(terms_res.json['terms']) >= 2

    # Create new term
    term_res = client.post('/api/admin/terms', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'name': 'Summer Session 2027',
        'start_date': '2027-06-15',
        'end_date': '2027-08-10',
        'is_active': False
    })
    assert term_res.status_code == 201
    assert term_res.json['term']['name'] == 'Summer Session 2027'


def test_list_classes_dropdown_includes_configured_classes(client):
    admin_token, teacher_token = setup_users(client)

    # Admin view includes all configured classes
    res_admin = client.get('/api/classes', headers={'Authorization': f'Bearer {admin_token}'})
    assert res_admin.status_code == 200
    classes = res_admin.json['classes']
    assert 'Grade 1' in classes
    assert 'Grade 4' in classes
    assert 'Grade 5' in classes

    # Teacher view is scoped to their assigned class
    res_teacher = client.get('/api/classes', headers={'Authorization': f'Bearer {teacher_token}'})
    assert res_teacher.status_code == 200
    assert res_teacher.json['classes'] == ['Grade 4']


# ---------------------------------------------------------------------------
# Institution Logo & Branding Tests
# ---------------------------------------------------------------------------

def test_get_default_school_logo_returns_svg_crest(client):
    res = client.get('/api/institution/logo')
    assert res.status_code == 200
    assert 'image/svg+xml' in res.content_type
    assert b'<svg' in res.data
    assert b'shieldGrad' in res.data


def test_admin_can_upload_valid_svg_logo(client):
    import io
    admin_token, _ = setup_users(client)

    svg_content = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#1e3a8a"/></svg>'
    data = {
        'logo': (io.BytesIO(svg_content), 'crest.svg', 'image/svg+xml')
    }
    res = client.post(
        '/api/admin/institution/logo',
        headers={'Authorization': f'Bearer {admin_token}'},
        data=data,
        content_type='multipart/form-data'
    )
    assert res.status_code == 200
    settings = res.json['settings']
    assert settings['has_custom_logo'] is True
    assert '/api/institution/logo?v=' in settings['logo_url']

    # Public endpoint now serves uploaded SVG
    fetch_res = client.get('/api/institution/logo')
    assert fetch_res.status_code == 200
    assert 'image/svg+xml' in fetch_res.content_type
    assert b'circle cx="50"' in fetch_res.data


def test_admin_can_upload_valid_png_logo(client):
    import io
    from PIL import Image
    admin_token, _ = setup_users(client)

    img_io = io.BytesIO()
    img = Image.new('RGB', (120, 120), color=(30, 58, 138))
    img.save(img_io, format='PNG')
    img_io.seek(0)

    data = {
        'logo': (img_io, 'badge.png', 'image/png')
    }
    res = client.post(
        '/api/admin/institution/logo',
        headers={'Authorization': f'Bearer {admin_token}'},
        data=data,
        content_type='multipart/form-data'
    )
    assert res.status_code == 200
    settings = res.json['settings']
    assert settings['has_custom_logo'] is True

    # Public endpoint returns the uploaded PNG
    fetch_res = client.get('/api/institution/logo')
    assert fetch_res.status_code == 200
    assert 'image/png' in fetch_res.content_type


def test_malicious_svg_rejected_by_sanitizer(client):
    import io
    admin_token, _ = setup_users(client)

    malicious_payloads = [
        b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script></svg>',
        b'<svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="5" onload="alert(1)"/></svg>',
        b'<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "system.dtd"><svg xmlns="http://www.w3.org/2000/svg"><text>XXE</text></svg>',
        b'<svg xmlns="http://www.w3.org/2000/svg"><a href="https://evil.local/steal"><text>Click</text></a></svg>',
    ]

    for payload in malicious_payloads:
        data = {'logo': (io.BytesIO(payload), 'test.svg', 'image/svg+xml')}
        res = client.post(
            '/api/admin/institution/logo',
            headers={'Authorization': f'Bearer {admin_token}'},
            data=data,
            content_type='multipart/form-data'
        )
        assert res.status_code == 400
        assert 'SVG validation failed' in res.json['error']


def test_raster_validation_rejects_corrupted_and_invalid_files(client):
    import io
    admin_token, _ = setup_users(client)

    # Empty file
    res = client.post(
        '/api/admin/institution/logo',
        headers={'Authorization': f'Bearer {admin_token}'},
        data={'logo': (io.BytesIO(b''), 'empty.png', 'image/png')},
        content_type='multipart/form-data'
    )
    assert res.status_code == 400

    # Corrupt fake PNG
    res = client.post(
        '/api/admin/institution/logo',
        headers={'Authorization': f'Bearer {admin_token}'},
        data={'logo': (io.BytesIO(b'not a real png file'), 'fake.png', 'image/png')},
        content_type='multipart/form-data'
    )
    assert res.status_code == 400
    assert 'Image validation failed' in res.json['error']

    # Unsupported extension
    res = client.post(
        '/api/admin/institution/logo',
        headers={'Authorization': f'Bearer {admin_token}'},
        data={'logo': (io.BytesIO(b'content'), 'file.exe', 'application/octet-stream')},
        content_type='multipart/form-data'
    )
    assert res.status_code == 400
    assert 'Unsupported image extension' in res.json['error']


def test_admin_can_delete_logo_and_reverts_to_default(client):
    import io
    from PIL import Image
    admin_token, _ = setup_users(client)

    img_io = io.BytesIO()
    img = Image.new('RGB', (64, 64), color=(50, 100, 150))
    img.save(img_io, format='PNG')
    img_io.seek(0)

    client.post(
        '/api/admin/institution/logo',
        headers={'Authorization': f'Bearer {admin_token}'},
        data={'logo': (img_io, 'temp.png', 'image/png')},
        content_type='multipart/form-data'
    )

    del_res = client.delete('/api/admin/institution/logo', headers={'Authorization': f'Bearer {admin_token}'})
    assert del_res.status_code == 200
    assert del_res.json['settings']['has_custom_logo'] is False

    # Default SVG crest restored
    res = client.get('/api/institution/logo')
    assert res.status_code == 200
    assert 'image/svg+xml' in res.content_type
    assert b'shieldGrad' in res.data


def test_teacher_cannot_upload_or_delete_logo(client):
    import io
    _, teacher_token = setup_users(client)

    res = client.post(
        '/api/admin/institution/logo',
        headers={'Authorization': f'Bearer {teacher_token}'},
        data={'logo': (io.BytesIO(b'data'), 'logo.png', 'image/png')},
        content_type='multipart/form-data'
    )
    assert res.status_code == 403

    del_res = client.delete(
        '/api/admin/institution/logo',
        headers={'Authorization': f'Bearer {teacher_token}'}
    )
    assert del_res.status_code == 403

