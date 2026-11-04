"""Test Suite for ClassroomOS 2.1.2 — WhatsApp Notification Repair.

Covers:
1. Phone normalization for Pakistani local formats (03xx, 3xx, +92, 0092, formatted).
2. Phone normalization for International E.164 formats (+1, +44, +971).
3. Invalid / missing / short phone number handling.
4. Official WhatsApp wa.me click-to-chat URL building and encoding.
5. Daily attendance roster returning guardian contact, name, and WhatsApp fields.
6. Manual WhatsApp log endpoint:
   - Validates and normalizes phone numbers.
   - Generates official wa.me link.
   - Stores mode='manual_link' and status='prepared'.
   - NEVER claims 'sent' or 'delivered' without confirmed API dispatch.
7. Admin test message endpoint:
   - Normalizes Pakistani and international numbers.
   - Logs simulated dispatch without external network calls.
8. WhatsApp logs retrieval endpoint.
"""

import os
import tempfile
from pathlib import Path
import pytest
from werkzeug.security import generate_password_hash

from app import create_app
from db import db
from phase1_students.models import Student
from phase4_quality.models import User
from phase4_quality.institution_models import WhatsAppNotification
from phase4_quality.phone_utils import normalize_phone_number, build_whatsapp_click_to_chat_url
from storage_manager import ensure_storage_directories


@pytest.fixture
def whatsapp_test_env():
    """Setup isolated test environment for WhatsApp notification tests."""
    temp_dir = tempfile.mkdtemp(prefix='test_classroom_v212_whatsapp_')
    data_dir = Path(temp_dir) / 'data'
    storage_dirs = ensure_storage_directories(data_dir)
    config_path = Path(temp_dir) / 'storage_config.json'

    os.environ['CLASSROOM_CONFIG_PATH'] = str(config_path)
    os.environ['CLASSROOM_DATA_DIR'] = str(data_dir)

    app = create_app({
        'TESTING': True,
        'SECRET_KEY': 'test-secret-v212-whatsapp',
        'SQLALCHEMY_DATABASE_URI': f"sqlite:///{data_dir / 'classroom.db'}",
        'DATA_DIRECTORY': data_dir,
        'PHOTOS_DIRECTORY': storage_dirs['photos'],
        'BRANDING_DIRECTORY': storage_dirs['branding'],
        'BACKUP_DIRECTORY': storage_dirs['backups'],
        'LOGS_DIRECTORY': storage_dirs['logs'],
        'AUTO_BACKUP_BEFORE_MIGRATION': False,
    })

    with app.app_context():
        # Create admin user
        admin = User(
            email='admin@school.local',
            full_name='Head Admin',
            role='admin',
            password_hash=generate_password_hash('AdminPass1234!', method='scrypt'),
            is_active=True
        )
        # Create teacher user
        teacher = User(
            email='teacher@school.local',
            full_name='Class Teacher',
            role='teacher',
            assigned_class='Grade 5',
            password_hash=generate_password_hash('TeacherPass1234!', method='scrypt'),
            is_active=True
        )
        db.session.add(admin)
        db.session.add(teacher)
        db.session.commit()

        client = app.test_client()

        # Admin login
        admin_login = client.post('/api/auth/login', json={
            'email': 'admin@school.local',
            'password': 'AdminPass1234!'
        })
        admin_token = admin_login.get_json()['token']

        # Teacher login
        teacher_login = client.post('/api/auth/login', json={
            'email': 'teacher@school.local',
            'password': 'TeacherPass1234!'
        })
        teacher_token = teacher_login.get_json()['token']

    yield {
        'app': app,
        'client': client,
        'admin_token': admin_token,
        'teacher_token': teacher_token,
        'data_dir': data_dir,
    }


# ===========================================================================
# 1. Phone Normalization Unit Tests
# ===========================================================================

def test_phone_utils_pakistani_formats():
    """Verify Pakistani mobile numbers in various entry formats normalize to 923XXXXXXXXX."""
    cases = [
        # Raw input -> expected normalized digits (for wa.me)
        ('03001234567', '923001234567'),
        ('0300-1234567', '923001234567'),
        ('0300 123 4567', '923001234567'),
        ('(0300) 123-4567', '923001234567'),
        ('03217654321', '923217654321'),
        ('3001234567', '923001234567'),          # 10 digits without leading 0
        ('+923001234567', '923001234567'),       # Explicit +92
        ('+92 300 1234567', '923001234567'),     # Formatted +92
        ('00923001234567', '923001234567'),      # Exit code 0092
        ('923001234567', '923001234567'),        # 12 digits starting with 92
    ]
    for raw, expected in cases:
        meta = normalize_phone_number(raw)
        assert meta['is_valid'] is True, f"Failed for {raw}: {meta.get('error')}"
        assert meta['normalized'] == expected, f"Expected {expected} for {raw}, got {meta['normalized']}"
        assert 'Pakistan' in meta['country']
        assert meta['display_format'].startswith('+92')


def test_phone_utils_international_formats():
    """Verify international E.164 formats parse and normalize properly."""
    cases = [
        ('+1 (555) 234-5678', '15552345678'),
        ('+44 7911 123456', '447911123456'),
        ('+971 50 123 4567', '971501234567'),
        ('0015552345678', '15552345678'),
    ]
    for raw, expected in cases:
        meta = normalize_phone_number(raw)
        assert meta['is_valid'] is True, f"Failed for {raw}: {meta.get('error')}"
        assert meta['normalized'] == expected


def test_phone_utils_invalid_and_edge_cases():
    """Verify invalid, missing, or short phone numbers return proper error messages."""
    invalid_cases = ['', '   ', None, '12345', '0300', 'invalid', 'abc-def-ghij']
    for raw in invalid_cases:
        meta = normalize_phone_number(raw)
        assert meta['is_valid'] is False
        assert meta['error'] is not None


def test_build_whatsapp_click_to_chat_url():
    """Verify official wa.me URL structure and message percent encoding."""
    # Simple message
    url = build_whatsapp_click_to_chat_url('923001234567', 'Hello Guardian')
    assert url == 'https://wa.me/923001234567?text=Hello%20Guardian'

    # Complex message with punctuation, symbols and newlines
    msg = "Dear Guardian, Ali (Grade 5, Sec A) was marked ABSENT today (2026-11-03) at Springfield Academy. Please call: 0300-1234567."
    url = build_whatsapp_click_to_chat_url('923001234567', msg)
    assert url.startswith('https://wa.me/923001234567?text=')
    assert 'Dear%20Guardian' in url
    assert 'ABSENT' in url
    assert '+' not in url.split('?text=')[0]  # Number part has no +

    # Empty message
    url_empty = build_whatsapp_click_to_chat_url('923001234567', '')
    assert url_empty == 'https://wa.me/923001234567'


# ===========================================================================
# 2. Daily Attendance Roster Contact Information Tests
# ===========================================================================

def test_daily_attendance_roster_includes_guardian_whatsapp_fields(whatsapp_test_env):
    """Verify /api/attendance roster returns guardian contact, name, and WhatsApp fields."""
    client = whatsapp_test_env['client']
    teacher_token = whatsapp_test_env['teacher_token']
    app = whatsapp_test_env['app']

    with app.app_context():
        student = Student(
            roll_number='WA-01',
            full_name='Tariq Mahmood',
            class_name='Grade 5',
            section='A',
            guardian_name='Mahmood Akhtar',
            guardian_contact='0300-1234567',
            whatsapp_number='0300-1234567',
            guardian_relationship='Father',
            whatsapp_consent=True,
            enrollment_date='2026-01-10',
            is_active=True
        )
        db.session.add(student)
        db.session.commit()
        st_id = student.id

    res = client.get('/api/attendance?date=2026-11-03&class_name=Grade 5', headers={
        'Authorization': f'Bearer {teacher_token}'
    })
    assert res.status_code == 200
    data = res.get_json()
    assert 'roster' in data
    roster = data['roster']
    target = next((item for item in roster if item['student_id'] == st_id), None)
    assert target is not None

    # Crucial v2.1.2 fix verification: guardian info MUST be present on roster item
    assert target['guardian_name'] == 'Mahmood Akhtar'
    assert target['guardian_contact'] == '0300-1234567'
    assert target['whatsapp_number'] == '0300-1234567'
    assert target['guardian_relationship'] == 'Father'
    assert target['whatsapp_consent'] is True


# ===========================================================================
# 3. Manual WhatsApp Dispatch Logging Tests
# ===========================================================================

def test_manual_whatsapp_logging_pakistani_number(whatsapp_test_env):
    """Verify manual WhatsApp link logging normalizes Pakistani numbers and sets prepared status."""
    client = whatsapp_test_env['client']
    teacher_token = whatsapp_test_env['teacher_token']
    app = whatsapp_test_env['app']

    with app.app_context():
        student = Student(
            roll_number='WA-02',
            full_name='Fatima Noor',
            class_name='Grade 5',
            section='A',
            enrollment_date='2026-01-10',
            is_active=True
        )
        db.session.add(student)
        db.session.commit()
        st_id = student.id

    # Post with local Pakistani formatted number
    res = client.post('/api/whatsapp/manual-log', headers={
        'Authorization': f'Bearer {teacher_token}'
    }, json={
        'student_id': st_id,
        'recipient_phone': '0300-7654321',
        'recipient_name': 'Noor Hassan',
        'message_type': 'absent',
        'message_text': 'Dear Noor Hassan, Fatima Noor was marked ABSENT today.'
    })
    assert res.status_code == 201
    data = res.get_json()
    assert data['success'] is True
    assert data['normalized_phone'] == '923007654321'
    assert data['display_phone'] == '+92 300 7654321'
    assert 'https://wa.me/923007654321?text=' in data['wa_url']

    # Database verification
    notif = data['notification']
    assert notif['mode'] == 'manual_link'
    # Strict rule: NEVER report 'sent' or 'delivered' for manual click-to-chat
    assert notif['status'] == 'prepared'
    assert notif['status'] != 'sent'
    assert notif['status'] != 'delivered'


def test_manual_whatsapp_logging_international_number(whatsapp_test_env):
    """Verify manual WhatsApp link logging with international format."""
    client = whatsapp_test_env['client']
    teacher_token = whatsapp_test_env['teacher_token']

    res = client.post('/api/whatsapp/manual-log', headers={
        'Authorization': f'Bearer {teacher_token}'
    }, json={
        'recipient_phone': '+1 (555) 345-6789',
        'recipient_name': 'John Doe',
        'message_type': 'late',
        'message_text': 'Dear John Doe, your child arrived late today.'
    })
    assert res.status_code == 201
    data = res.get_json()
    assert data['normalized_phone'] == '15553456789'
    assert 'https://wa.me/15553456789?text=' in data['wa_url']
    assert data['notification']['status'] == 'prepared'


def test_manual_whatsapp_logging_validation_rejections(whatsapp_test_env):
    """Verify validation rejections for missing or invalid phone and message text."""
    client = whatsapp_test_env['client']
    teacher_token = whatsapp_test_env['teacher_token']

    # Empty phone
    res1 = client.post('/api/whatsapp/manual-log', headers={
        'Authorization': f'Bearer {teacher_token}'
    }, json={
        'recipient_phone': '',
        'message_text': 'Some message'
    })
    assert res1.status_code == 400

    # Short invalid phone
    res2 = client.post('/api/whatsapp/manual-log', headers={
        'Authorization': f'Bearer {teacher_token}'
    }, json={
        'recipient_phone': '12345',
        'message_text': 'Some message'
    })
    assert res2.status_code == 400

    # Empty message text
    res3 = client.post('/api/whatsapp/manual-log', headers={
        'Authorization': f'Bearer {teacher_token}'
    }, json={
        'recipient_phone': '03001234567',
        'message_text': ''
    })
    assert res3.status_code == 400


# ===========================================================================
# 4. Admin WhatsApp Test Message and Log Retrieval Tests
# ===========================================================================

def test_admin_whatsapp_test_message_pakistani_format(whatsapp_test_env):
    """Verify admin test message normalizes Pakistani numbers properly."""
    client = whatsapp_test_env['client']
    admin_token = whatsapp_test_env['admin_token']

    res = client.post('/api/admin/whatsapp/test-message', headers={
        'Authorization': f'Bearer {admin_token}'
    }, json={
        'recipient_phone': '0321-9988776',
        'message_text': 'ClassroomOS test verification notice'
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data['success'] is True
    assert data['notification']['recipient_phone'] == '+92 321 9988776'
    assert data['notification']['status'] == 'sent'  # Simulated API test mode


def test_whatsapp_logs_listing_endpoint(whatsapp_test_env):
    """Verify GET /api/admin/whatsapp/logs lists all generated records."""
    client = whatsapp_test_env['client']
    admin_token = whatsapp_test_env['admin_token']
    teacher_token = whatsapp_test_env['teacher_token']

    # Generate a manual log
    client.post('/api/whatsapp/manual-log', headers={
        'Authorization': f'Bearer {teacher_token}'
    }, json={
        'recipient_phone': '0333-1122334',
        'recipient_name': 'Parent A',
        'message_type': 'general',
        'message_text': 'General school announcement'
    })

    # Retrieve logs
    res = client.get('/api/admin/whatsapp/logs', headers={
        'Authorization': f'Bearer {admin_token}'
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data['count'] >= 1
    recent = data['logs'][0]
    assert recent['recipient_phone'] == '+92 333 1122334'
    assert recent['mode'] == 'manual_link'
    assert recent['status'] == 'prepared'

