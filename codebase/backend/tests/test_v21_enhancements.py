import pytest
from app import create_app
from db import db
from phase1_students.models import Student
from phase4_quality.institution_models import AcademicClass, AcademicTerm, InstitutionSettings, WhatsAppNotification
from phase4_quality.models import User


@pytest.fixture
def app(tmp_path):
    db_file = tmp_path / 'classroom_test.db'
    backup_dir = tmp_path / 'backups'
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': f'sqlite:///{db_file.as_posix()}',
        'SECRET_KEY': 'test-secret-key-v21',
        'BACKUP_DIRECTORY': backup_dir,
    })
    return app


@pytest.fixture
def client(app):
    with app.test_client() as test_client:
        yield test_client


@pytest.fixture
def auth_tokens(client):
    res = client.post('/api/auth/bootstrap', json={
        'email': 'admin@school.local',
        'full_name': 'Chief Administrator',
        'password': 'AdminPassword123'
    })
    assert res.status_code == 201
    admin_token = res.json['token']

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


def test_v21_institution_description_and_admin_editability(client, auth_tokens):
    admin_token, _ = auth_tokens
    # Verify GET institution settings
    res = client.get('/api/admin/institution', headers={'Authorization': f'Bearer {admin_token}'})
    assert res.status_code == 200
    data = res.get_json()['settings']
    assert 'description' in data

    # Update institution including description
    update_res = client.put('/api/admin/institution', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'institution_name': 'Greenwood International School',
        'institution_code': 'GW-2026',
        'contact_email': 'principal@greenwood.edu',
        'contact_phone': '+1 (555) 987-6543',
        'address': '450 Academic Way, Greenwood',
        'description': 'A premier institution fostering excellence in foundational education.',
        'academic_year': '2026-2027',
        'current_term': 'Fall Term',
        'timezone': 'America/New_York',
        'min_attendance_warning_rate': 80.0
    })
    assert update_res.status_code == 200
    updated = update_res.get_json()['settings']
    assert updated['institution_name'] == 'Greenwood International School'
    assert updated['description'] == 'A premier institution fostering excellence in foundational education.'
    assert updated['min_attendance_warning_rate'] == 80.0

    # Public profile endpoint must also return description
    pub_res = client.get('/api/institution/profile')
    assert pub_res.status_code == 200
    pub_inst = pub_res.get_json()['institution']
    assert pub_inst['institution_name'] == 'Greenwood International School'
    assert pub_inst['description'] == 'A premier institution fostering excellence in foundational education.'


def test_v21_academic_class_rename_and_student_synchronization(app, client, auth_tokens):
    admin_token, _ = auth_tokens
    # Create an academic class
    create_res = client.post('/api/admin/classes', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'name': 'Grade 9',
        'section': 'Omega',
        'room_number': 'Room 401',
        'capacity': 30
    })
    assert create_res.status_code == 201
    cls_id = create_res.get_json()['class']['id']

    # Create student in this class
    s_res = client.post('/api/students', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'roll_number': 'G9-01',
        'full_name': 'Alexander Stone',
        'class_name': 'Grade 9',
        'section': 'Omega',
        'enrollment_date': '2026-09-01'
    })
    assert s_res.status_code == 201
    s_id = s_res.get_json()['student']['id']

    # Rename class from Grade 9 Omega to Grade 10 Alpha
    edit_res = client.put(f'/api/admin/classes/{cls_id}', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'name': 'Grade 10',
        'section': 'Alpha',
        'room_number': 'Room 402',
        'capacity': 32
    })
    assert edit_res.status_code == 200
    cls_data = edit_res.get_json()['class']
    assert cls_data['name'] == 'Grade 10'
    assert cls_data['section'] == 'Alpha'

    # Verify enrolled student's class_name and section were synchronized automatically
    with app.app_context():
        student = db.session.get(Student, s_id)
        assert student.class_name == 'Grade 10'
        assert student.section == 'Alpha'


def test_v21_academic_terms_management(client, auth_tokens):
    admin_token, _ = auth_tokens
    # Create term
    create_res = client.post('/api/admin/terms', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'name': 'Winter Session 2026',
        'start_date': '2026-11-01',
        'end_date': '2027-01-31',
        'is_active': False
    })
    assert create_res.status_code == 201
    term_id = create_res.get_json()['term']['id']

    # Update term
    update_res = client.put(f'/api/admin/terms/{term_id}', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'name': 'Winter Session 2026 (Updated)',
        'start_date': '2026-11-05',
        'end_date': '2027-02-15',
        'is_active': True
    })
    assert update_res.status_code == 200
    assert update_res.get_json()['term']['name'] == 'Winter Session 2026 (Updated)'
    assert update_res.get_json()['term']['is_active'] is True

    # Delete term
    del_res = client.delete(f'/api/admin/terms/{term_id}', headers={'Authorization': f'Bearer {admin_token}'})
    assert del_res.status_code == 200


def test_v21_staff_editing_and_rbac(client, auth_tokens):
    admin_token, _ = auth_tokens
    # Create a teacher
    t_res = client.post('/api/auth/users', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'email': 'clarissa@school.local',
        'full_name': 'Clarissa Ray',
        'role': 'teacher',
        'assigned_class': 'Grade 4',
        'password': 'SecurePassword123!'
    })
    assert t_res.status_code == 201
    teacher_id = t_res.get_json()['user']['id']

    # Edit teacher info
    edit_res = client.put(f'/api/auth/users/{teacher_id}', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'full_name': 'Clarissa Ray-Vance',
        'email': 'clarissa.vance@school.local',
        'role': 'teacher',
        'assigned_class': 'Grade 5'
    })
    assert edit_res.status_code == 200
    u = edit_res.get_json()['user']
    assert u['full_name'] == 'Clarissa Ray-Vance'
    assert u['email'] == 'clarissa.vance@school.local'
    assert u['assigned_class'] == 'Grade 5'


def test_v21_guardian_whatsapp_information_and_manual_logging(app, client, auth_tokens):
    admin_token, teacher_token = auth_tokens
    # Create student with detailed guardian and WhatsApp contact info
    res = client.post('/api/students', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'roll_number': 'WAPP-01',
        'full_name': 'Samuel Jenkins',
        'class_name': 'Grade 4',
        'section': 'A',
        'enrollment_date': '2026-09-01',
        'guardian_name': 'Rebecca Jenkins',
        'guardian_relationship': 'Mother',
        'whatsapp_number': '+15552345678',
        'whatsapp_consent': True,
        'notification_preferences': 'attendance'
    })
    assert res.status_code == 201
    st = res.get_json()['student']
    assert st['guardian_name'] == 'Rebecca Jenkins'
    assert st['whatsapp_number'] == '+15552345678'
    assert st['whatsapp_consent'] is True
    assert st['whatsapp_consent_date'] is not None

    # Log a manual WhatsApp notification dispatch
    log_res = client.post('/api/whatsapp/manual-log', headers={'Authorization': f'Bearer {teacher_token}'}, json={
        'student_id': st['id'],
        'recipient_phone': '+15552345678',
        'recipient_name': 'Rebecca Jenkins',
        'message_type': 'absent_alert',
        'message_text': 'Dear Rebecca, Samuel was marked Absent today at Greenwood School.'
    })
    assert log_res.status_code == 201
    notif = log_res.get_json()['notification']
    assert notif['status'] == 'prepared'
    assert notif['mode'] == 'manual_link'


def test_v21_whatsapp_admin_configuration_and_mock_testing(client, auth_tokens):
    admin_token, _ = auth_tokens
    # Fetch initial config
    cfg_res = client.get('/api/admin/whatsapp/config', headers={'Authorization': f'Bearer {admin_token}'})
    assert cfg_res.status_code == 200

    # Update config
    put_res = client.put('/api/admin/whatsapp/config', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'whatsapp_enabled': True,
        'whatsapp_provider': 'cloud_api',
        'whatsapp_phone_number_id': '104829103948',
        'whatsapp_business_account_id': '209384019283',
        'whatsapp_api_token': 'EAABtesting_token_secret_9999',
        'whatsapp_auto_notify_absent': True,
        'whatsapp_auto_notify_late': False,
        'whatsapp_template_absent': 'Notice: {student_name} is absent today.'
    })
    assert put_res.status_code == 200
    cfg = put_res.get_json()['config']
    assert cfg['whatsapp_enabled'] is True
    assert cfg['whatsapp_api_token_configured'] is True
    assert '...9999' in cfg['whatsapp_api_token_preview']

    # Send simulated test message
    test_res = client.post('/api/admin/whatsapp/test-message', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'recipient_phone': '+15550001111',
        'message_text': 'ClassroomOS test verification message'
    })
    assert test_res.status_code == 200
    assert test_res.get_json()['notification']['status'] == 'sent'

    # List logs
    logs_res = client.get('/api/admin/whatsapp/logs', headers={'Authorization': f'Bearer {admin_token}'})
    assert logs_res.status_code == 200
    assert len(logs_res.get_json()['logs']) >= 1


def test_v21_database_storage_panel_backup_and_safe_restore(client, auth_tokens):
    admin_token, _ = auth_tokens
    # Storage info endpoint
    st_res = client.get('/api/admin/storage', headers={'Authorization': f'Bearer {admin_token}'})
    assert st_res.status_code == 200
    storage = st_res.get_json()['storage']
    assert 'database_path' in storage
    assert 'database_size_bytes' in storage
    assert 'disk_free_display' in storage

    # Create manual backup
    bk_res = client.post('/api/admin/backups', headers={'Authorization': f'Bearer {admin_token}'})
    assert bk_res.status_code == 201
    manifest = bk_res.get_json()['manifest']
    filename = manifest['database_file']
    assert filename.endswith('.db')

    # Safe restore from the backup
    rst_res = client.post('/api/admin/backups/restore', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'filename': filename
    })
    assert rst_res.status_code == 200
    assert 'Database restored successfully' in rst_res.get_json()['message']

    # Delete the backup
    del_res = client.delete(f'/api/admin/backups/{filename}', headers={'Authorization': f'Bearer {admin_token}'})
    assert del_res.status_code == 200
