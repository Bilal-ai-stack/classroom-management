import pytest
import io
import sys
import os
from unittest.mock import patch, MagicMock
from PIL import Image

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from db import db
from phase1_students.models import Student
from phase2_attendance.models import Attendance
from phase3_photo import detector
from phase4_quality.models import AuditEvent, User


def make_test_image_bytes(width=200, height=200, color=(200, 200, 200), fmt='JPEG'):
    """Generate in-memory valid image bytes using Pillow."""
    img = Image.new('RGB', (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    buf.seek(0)
    return buf.getvalue()


@pytest.fixture
def app():
    application = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:'
    })
    return application


@pytest.fixture
def client(app):
    with app.test_client() as c:
        with app.app_context():
            s1 = Student(
                roll_number='R-101',
                full_name='Aarav Patel',
                class_name='Grade 4',
                section='A',
                enrollment_date='2026-01-15'
            )
            s2 = Student(
                roll_number='R-102',
                full_name='Sophia Chen',
                class_name='Grade 4',
                section='A',
                enrollment_date='2026-01-15'
            )
            s3 = Student(
                roll_number='R-201',
                full_name='Liam Davis',
                class_name='Grade 5',
                section='B',
                enrollment_date='2026-01-15'
            )
            db.session.add_all([s1, s2, s3])
            db.session.commit()

        # Bootstrap admin user
        resp = c.post('/api/auth/bootstrap', json={
            'email': 'admin@example.test',
            'full_name': 'Test Administrator',
            'password': 'SecureAdminTest123!'
        })
        assert resp.status_code in (200, 201)
        c.environ_base['HTTP_AUTHORIZATION'] = f"Bearer {resp.json['token']}"
        yield c


@pytest.fixture
def teacher_client(app, client):
    """Client authenticated as a teacher assigned to Grade 4."""
    with app.test_client() as tc:
        # Create teacher account via admin
        resp = client.post('/api/auth/users', json={
            'email': 'teacher4@school.test',
            'full_name': 'Teacher Four',
            'password': 'TeacherPass1234!',
            'role': 'teacher',
            'assigned_class': 'Grade 4'
        })
        assert resp.status_code == 201

        login_res = tc.post('/api/auth/login', json={
            'email': 'teacher4@school.test',
            'password': 'TeacherPass1234!'
        })
        assert login_res.status_code == 200
        tc.environ_base['HTTP_AUTHORIZATION'] = f"Bearer {login_res.json['token']}"
        yield tc


# ---------------------------------------------------------------------------
# Upload validation & security tests
# ---------------------------------------------------------------------------

def test_detect_faces_missing_file(client):
    res = client.post('/api/photo/detect-faces')
    assert res.status_code == 400
    assert res.json['success'] is False
    assert 'No photo file provided' in res.json['error']


def test_detect_faces_empty_filename(client):
    data = {'photo': (io.BytesIO(b'some bytes'), '')}
    res = client.post('/api/photo/detect-faces', data=data, content_type='multipart/form-data')
    assert res.status_code == 400
    assert 'Empty filename' in res.json['error']


def test_detect_faces_unsupported_file_extension(client):
    data = {'photo': (io.BytesIO(b'not an image'), 'document.pdf')}
    res = client.post('/api/photo/detect-faces', data=data, content_type='multipart/form-data')
    assert res.status_code == 400
    assert 'Unsupported file type' in res.json['error']


def test_detect_faces_empty_file_content(client):
    data = {'photo': (io.BytesIO(b''), 'empty.jpg')}
    res = client.post('/api/photo/detect-faces', data=data, content_type='multipart/form-data')
    assert res.status_code == 400
    assert 'empty' in res.json['error'].lower()


def test_detect_faces_rejects_fake_image_bytes(client):
    data = {'photo': (io.BytesIO(b'PK\x03\x04fake_zip_not_image'), 'photo.jpg')}
    res = client.post('/api/photo/detect-faces', data=data, content_type='multipart/form-data')
    assert res.status_code == 422
    assert res.json['success'] is False
    assert 'not a valid decodable image' in res.json['error'].lower()


def test_detect_faces_oversized_upload_rejected(client):
    # Route enforces MAX_PHOTO_BYTES (10 MB)
    large_payload = b'A' * (10 * 1024 * 1024 + 100)
    data = {'photo': (io.BytesIO(large_payload), 'huge_photo.jpg')}
    res = client.post('/api/photo/detect-faces', data=data, content_type='multipart/form-data')
    assert res.status_code == 413
    assert '10 MB' in res.json['error']


def test_detect_faces_rejects_oversized_dimensions(client):
    # Image exceeding MAX_DIMENSION (6000px)
    huge_img = make_test_image_bytes(width=6500, height=100)
    data = {'photo': (io.BytesIO(huge_img), 'wide.jpg')}
    res = client.post('/api/photo/detect-faces', data=data, content_type='multipart/form-data')
    assert res.status_code == 422
    assert 'exceed safe processing limits' in res.json['error']


# ---------------------------------------------------------------------------
# Engine availability and fail-closed tests
# ---------------------------------------------------------------------------

def test_detect_faces_reports_unavailable_engine_when_opencv_missing(client, monkeypatch):
    monkeypatch.setattr(detector, 'OPENCV_AVAILABLE', False)
    valid_img = make_test_image_bytes()
    data = {'photo': (io.BytesIO(valid_img), 'class.jpg')}
    res = client.post('/api/photo/detect-faces', data=data, content_type='multipart/form-data')
    assert res.status_code == 422
    assert res.json['success'] is False
    assert 'OpenCV is not installed' in res.json['error']


# ---------------------------------------------------------------------------
# Real image processing & face detection tests (OpenCV + Pillow)
# ---------------------------------------------------------------------------

def test_detect_faces_valid_image_no_faces(client):
    """Valid blank image has zero faces, never fabricates detections."""
    valid_img = make_test_image_bytes(width=300, height=200, color=(240, 240, 240))
    data = {'photo': (io.BytesIO(valid_img), 'blank_wall.jpg')}
    res = client.post('/api/photo/detect-faces', data=data, content_type='multipart/form-data')
    assert res.status_code == 200
    assert res.json['success'] is True
    assert res.json['faces_count'] == 0
    assert res.json['detected_faces'] == []
    assert res.json['image_dimensions']['width'] == 300
    assert res.json['image_dimensions']['height'] == 200
    assert 'OpenCV' in res.json['engine']


def test_detect_faces_deterministic_multi_face_mock(client):
    """Simulate OpenCV detecting 2 faces deterministically."""
    valid_img = make_test_image_bytes(width=400, height=300)

    mock_cascade = MagicMock()
    mock_cascade.empty.return_value = False
    # Return 2 bounding boxes (x, y, w, h)
    mock_cascade.detectMultiScale.return_value = [(50, 60, 80, 80), (220, 60, 80, 80)]

    with patch('cv2.CascadeClassifier', return_value=mock_cascade):
        data = {'photo': (io.BytesIO(valid_img), 'two_students.jpg')}
        res = client.post('/api/photo/detect-faces', data=data, content_type='multipart/form-data')

    assert res.status_code == 200
    body = res.json
    assert body['success'] is True
    assert body['faces_count'] == 2
    assert len(body['detected_faces']) == 2

    face1 = body['detected_faces'][0]
    assert face1['id'] == 1
    assert face1['x'] == 50
    assert face1['y'] == 60
    assert face1['width'] == 80
    assert face1['height'] == 80
    assert face1['crop_base64'].startswith('data:image/jpeg;base64,')

    face2 = body['detected_faces'][1]
    assert face2['id'] == 2
    assert face2['x'] == 220
    assert face2['y'] == 60


def test_detect_faces_empty_cascade_fails_gracefully(client):
    """If cascade model fails to load, fail closed with clear error."""
    mock_cascade = MagicMock()
    mock_cascade.empty.return_value = True

    with patch('cv2.CascadeClassifier', return_value=mock_cascade):
        valid_img = make_test_image_bytes()
        data = {'photo': (io.BytesIO(valid_img), 'test.jpg')}
        res = client.post('/api/photo/detect-faces', data=data, content_type='multipart/form-data')

    assert res.status_code == 422
    assert res.json['success'] is False
    assert 'failed to load' in res.json['error'].lower()


# ---------------------------------------------------------------------------
# Attendance verification workflow tests
# ---------------------------------------------------------------------------

def test_verify_photo_attendance_success(client):
    payload = {
        'date': '2026-10-24',
        'verified_students': [
            {'student_id': 1, 'status': 'Present', 'remarks': 'Face Verified'},
            {'student_id': 2, 'status': 'Present', 'remarks': 'Face Verified'}
        ]
    }
    res = client.post('/api/photo/verify-attendance', json=payload)
    assert res.status_code == 200
    assert res.json['success'] is True
    assert res.json['committed_count'] == 2

    # Check database records
    with client.application.app_context():
        att1 = Attendance.query.filter_by(student_id=1, date='2026-10-24').first()
        att2 = Attendance.query.filter_by(student_id=2, date='2026-10-24').first()
        assert att1 is not None and att1.status == 'Present'
        assert att2 is not None and att2.status == 'Present'

        # Check audit event was created
        audit = AuditEvent.query.filter_by(action='attendance.photo_confirm').first()
        assert audit is not None
        assert audit.to_dict()['details'].get('student_count') == 2


def test_verify_photo_attendance_empty_list(client):
    res = client.post('/api/photo/verify-attendance', json={'date': '2026-10-24', 'verified_students': []})
    assert res.status_code == 400
    assert 'No student assignments provided' in res.json['error']


def test_verify_photo_attendance_invalid_student_id(client):
    payload = {
        'date': '2026-10-24',
        'verified_students': [
            {'student_id': 99999, 'status': 'Present'}
        ]
    }
    res = client.post('/api/photo/verify-attendance', json=payload)
    assert res.status_code == 400
    assert res.json['success'] is False
    assert 'not found' in res.json['errors'][0].lower()


def test_verify_photo_attendance_teacher_scoping(teacher_client):
    """Teacher of Grade 4 cannot verify attendance for student in Grade 5."""
    # Student 3 is in Grade 5
    payload = {
        'date': '2026-10-24',
        'verified_students': [
            {'student_id': 3, 'status': 'Present', 'remarks': 'Grade 5 student'}
        ]
    }
    res = teacher_client.post('/api/photo/verify-attendance', json=payload)
    assert res.status_code == 400
    assert 'outside your assigned class' in res.json['errors'][0]


def test_photo_cleanup(client):
    res = client.delete('/api/photo/cleanup')
    assert res.status_code == 200
    assert res.json['success'] is True
