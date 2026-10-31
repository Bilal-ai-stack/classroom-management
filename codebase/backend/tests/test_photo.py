import pytest
import io
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from db import db
from phase1_students.models import Student
from phase2_attendance.models import Attendance

@pytest.fixture
def client():
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:'
    })

    with app.test_client() as client:
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
            db.session.add_all([s1, s2])
            db.session.commit()
        response = client.post('/api/auth/bootstrap', json={
            'email': 'admin@example.test',
            'full_name': 'Test Administrator',
            'password': 'SecureTest123'
        })
        client.environ_base['HTTP_AUTHORIZATION'] = f"Bearer {response.json['token']}"
        yield client

def test_detect_faces_missing_file(client):
    res = client.post('/api/photo/detect-faces')
    assert res.status_code == 400
    assert res.json['success'] is False

def test_detect_faces_unsupported_file(client):
    data = {
        'photo': (io.BytesIO(b'not an image'), 'document.pdf')
    }
    res = client.post('/api/photo/detect-faces', data=data, content_type='multipart/form-data')
    assert res.status_code == 400
    assert 'Unsupported file type' in res.json['error']

def test_detect_faces_reports_unavailable_engine(client):
    # The minimal test environment intentionally has no OpenCV installed.
    png_header = b'\x89PNG\r\n\x1a\n'
    data = {
        'photo': (io.BytesIO(png_header), 'class_photo.png')
    }
    res = client.post('/api/photo/detect-faces', data=data, content_type='multipart/form-data')
    assert res.status_code == 422
    assert res.json['success'] is False
    assert 'OpenCV is not installed' in res.json['error']

def test_detect_faces_rejects_fake_image_with_allowed_extension(client):
    data = {'photo': (io.BytesIO(b'not really an image'), 'class_photo.png')}
    res = client.post('/api/photo/detect-faces', data=data, content_type='multipart/form-data')
    assert res.status_code == 422
    assert res.json['success'] is False

def test_verify_photo_attendance(client):
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

    # Check attendance was committed in DB
    with client.application.app_context():
        att = Attendance.query.filter_by(student_id=1, date='2026-10-24').first()
        assert att is not None
        assert att.status == 'Present'
        assert att.remarks == 'Face Verified'

def test_photo_cleanup(client):
    res = client.delete('/api/photo/cleanup')
    assert res.status_code == 200
    assert res.json['success'] is True
