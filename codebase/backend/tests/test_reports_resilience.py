import pytest
from app import create_app
from phase1_students.models import Student
from phase2_attendance.models import Attendance, AttendanceSession


@pytest.fixture
def client():
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'SECRET_KEY': 'test-secret-reports',
    })
    with app.test_client() as test_client:
        yield test_client


def setup_data(client):
    # Bootstrap Admin
    res = client.post('/api/auth/bootstrap', json={
        'email': 'admin@school.local',
        'full_name': 'Chief Admin',
        'password': 'AdminPassword123'
    })
    admin_token = res.json['token']

    # Create teacher for Grade 4
    client.post('/api/auth/users', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'email': 'teacher4@school.local',
        'full_name': 'Grade 4 Teacher',
        'role': 'teacher',
        'assigned_class': 'Grade 4',
        'password': 'TeacherPassword123'
    })

    t_login = client.post('/api/auth/login', json={
        'email': 'teacher4@school.local',
        'password': 'TeacherPassword123'
    })
    teacher_token = t_login.json['token']

    # Create students
    s1 = client.post('/api/students', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'roll_number': 'G4-001',
        'full_name': 'Alice Adams',
        'class_name': 'Grade 4',
        'section': 'A',
        'enrollment_date': '2026-09-01'
    }).json['student']

    s2 = client.post('/api/students', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'roll_number': 'G5-001',
        'full_name': 'Bob Baker',
        'class_name': 'Grade 5',
        'section': 'A',
        'enrollment_date': '2026-09-01'
    }).json['student']

    # Record attendance
    client.post('/api/attendance/bulk', headers={'Authorization': f'Bearer {admin_token}'}, json={
        'date': '2026-10-15',
        'records': [
            {'student_id': s1['id'], 'status': 'Present', 'remarks': 'On time'},
            {'student_id': s2['id'], 'status': 'Late', 'remarks': 'Bus delay'}
        ]
    })

    return admin_token, teacher_token, s1, s2


def test_export_attendance_csv_stream(client):
    admin_token, _, _, _ = setup_data(client)

    res = client.get('/api/reports/attendance/csv?start_date=2026-10-01&end_date=2026-10-31', headers={'Authorization': f'Bearer {admin_token}'})
    assert res.status_code == 200
    assert 'text/csv' in res.headers['Content-Type']
    assert 'attachment' in res.headers['Content-Disposition']

    csv_text = res.get_data(as_text=True)
    lines = csv_text.strip().split('\r\n')
    assert lines[0] == 'Date,Roll Number,Student Name,Class,Section,Status,Remarks'
    assert len(lines) == 3 # Header + 2 students
    assert 'Alice Adams' in csv_text
    assert 'Bob Baker' in csv_text


def test_export_attendance_csv_teacher_scoping(client):
    _, teacher_token, _, _ = setup_data(client)

    # Teacher requests Grade 4 (allowed)
    res = client.get('/api/reports/attendance/csv?class_name=Grade 4', headers={'Authorization': f'Bearer {teacher_token}'})
    assert res.status_code == 200
    csv_text = res.get_data(as_text=True)
    assert 'Alice Adams' in csv_text
    assert 'Bob Baker' not in csv_text

    # Teacher requests Grade 5 (forbidden)
    res_forbidden = client.get('/api/reports/attendance/csv?class_name=Grade 5', headers={'Authorization': f'Bearer {teacher_token}'})
    assert res_forbidden.status_code == 403


def test_export_attendance_csv_empty_period(client):
    admin_token, _, _, _ = setup_data(client)

    res = client.get('/api/reports/attendance/csv?start_date=2025-01-01&end_date=2025-01-02', headers={'Authorization': f'Bearer {admin_token}'})
    assert res.status_code == 200
    lines = res.get_data(as_text=True).strip().split('\r\n')
    assert len(lines) == 1
    assert lines[0] == 'Date,Roll Number,Student Name,Class,Section,Status,Remarks'


def test_privacy_audit_and_purge_permissions(client):
    admin_token, teacher_token, _, _ = setup_data(client)

    # Policy endpoint is accessible
    p_res = client.get('/api/privacy/policy')
    assert p_res.status_code == 200
    assert 'Zero Biometric Embedding Storage' in p_res.json['policy']['compliance'][0]

    # Audit endpoint requires admin
    t_audit = client.get('/api/privacy/audit', headers={'Authorization': f'Bearer {teacher_token}'})
    assert t_audit.status_code == 403

    a_audit = client.get('/api/privacy/audit', headers={'Authorization': f'Bearer {admin_token}'})
    assert a_audit.status_code == 200
    assert a_audit.json['audit']['cloud_sync_enabled'] is False

    # Purge endpoint requires admin
    t_purge = client.post('/api/privacy/purge', headers={'Authorization': f'Bearer {teacher_token}'})
    assert t_purge.status_code == 403

    a_purge = client.post('/api/privacy/purge', headers={'Authorization': f'Bearer {admin_token}'})
    assert a_purge.status_code == 200
    assert 'Privacy purge completed' in a_purge.json['message']
