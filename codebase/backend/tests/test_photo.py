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
            db.create_all()
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

def test_detect_faces_valid_image(client):
    # Create minimal 1x1 PNG header bytes
    png_bytes = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x03\x20\x00\x00\x02\x58\x08\x02\x00\x00\x00'
    data = {
        'photo': (io.BytesIO(png_bytes), 'class_photo.png')
    }
    res = client.post('/api/photo/detect-faces', data=data, content_type='multipart/form-data')
    assert res.status_code == 200
    assert res.json['success'] is True
    assert res.json['faces_count'] > 0
    assert len(res.json['detected_faces']) > 0

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
