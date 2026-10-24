import pytest
import sys
import os

# Ensure backend root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from db import db
from phase1_students.models import Student

@pytest.fixture
def client():
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:'
    })

    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            # Seed 2 test students
            s1 = Student(
                roll_number='TEST-01',
                full_name='Alice Smith',
                class_name='Grade 1',
                section='A',
                enrollment_date='2026-01-01'
            )
            s2 = Student(
                roll_number='TEST-02',
                full_name='Bob Jones',
                class_name='Grade 1',
                section='A',
                enrollment_date='2026-01-02'
            )
            db.session.add_all([s1, s2])
            db.session.commit()
        yield client

def test_health_check(client):
    res = client.get('/api/health')
    assert res.status_code == 200
    assert res.json['status'] == 'healthy'

def test_list_students(client):
    res = client.get('/api/students')
    assert res.status_code == 200
    assert res.json['count'] == 2

def test_search_student(client):
    res = client.get('/api/students?q=Alice')
    assert res.status_code == 200
    assert res.json['count'] == 1
    assert res.json['students'][0]['full_name'] == 'Alice Smith'

def test_create_student_success(client):
    payload = {
        'roll_number': 'TEST-03',
        'full_name': 'Charlie Brown',
        'class_name': 'Grade 1',
        'section': 'A',
        'enrollment_date': '2026-01-05'
    }
    res = client.post('/api/students', json=payload)
    assert res.status_code == 201
    assert res.json['success'] is True
    assert res.json['student']['roll_number'] == 'TEST-03'

def test_create_student_duplicate_error(client):
    payload = {
        'roll_number': 'TEST-01',
        'full_name': 'Alice Clone',
        'class_name': 'Grade 1',
        'section': 'A',
        'enrollment_date': '2026-01-05'
    }
    res = client.post('/api/students', json=payload)
    assert res.status_code == 409
    assert res.json['success'] is False

def test_update_student(client):
    res = client.put('/api/students/1', json={'full_name': 'Alice Johnson'})
    assert res.status_code == 200
    assert res.json['student']['full_name'] == 'Alice Johnson'

def test_archive_student(client):
    res = client.patch('/api/students/1/archive')
    assert res.status_code == 200
    assert res.json['student']['is_active'] is False

    # Listed students should now only return 1 active student
    list_res = client.get('/api/students')
    assert list_res.json['count'] == 1
