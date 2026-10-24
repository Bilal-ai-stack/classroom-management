import pytest
import sys
import os

# Ensure backend root is in python path
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
            # Seed 3 test students
            s1 = Student(
                roll_number='STU-01',
                full_name='Amina Khan',
                class_name='Grade 1',
                section='A',
                enrollment_date='2026-01-01'
            )
            s2 = Student(
                roll_number='STU-02',
                full_name='Bilal Farooq',
                class_name='Grade 1',
                section='A',
                enrollment_date='2026-01-02'
            )
            s3 = Student(
                roll_number='STU-03',
                full_name='Zainab Fatima',
                class_name='Grade 2',
                section='B',
                enrollment_date='2026-01-03'
            )
            db.session.add_all([s1, s2, s3])
            db.session.commit()
        yield client

def test_get_daily_attendance_initial_unrecorded(client):
    res = client.get('/api/attendance?date=2026-10-24&class_name=Grade 1')
    assert res.status_code == 200
    assert res.json['success'] is True
    assert res.json['summary']['total_students'] == 2
    assert res.json['summary']['unrecorded_count'] == 2
    assert res.json['roster'][0]['status'] == 'Unrecorded'

def test_save_bulk_attendance_success(client):
    payload = {
        'date': '2026-10-24',
        'records': [
            {'student_id': 1, 'status': 'Present', 'remarks': 'On time'},
            {'student_id': 2, 'status': 'Late', 'remarks': 'Traffic delay'}
        ]
    }
    res = client.post('/api/attendance/bulk', json=payload)
    assert res.status_code == 200
    assert res.json['success'] is True
    assert res.json['saved_count'] == 2

    # Now verify attendance roster reflects saved data
    roster_res = client.get('/api/attendance?date=2026-10-24&class_name=Grade 1')
    assert roster_res.status_code == 200
    summary = roster_res.json['summary']
    assert summary['present_count'] == 1
    assert summary['late_count'] == 1
    assert summary['unrecorded_count'] == 0

def test_upsert_attendance_same_day_no_duplicates(client):
    # First save: student 1 is Present
    client.post('/api/attendance/bulk', json={
        'date': '2026-10-24',
        'records': [{'student_id': 1, 'status': 'Present'}]
    })

    # Second save: update student 1 to Absent on the same day
    update_res = client.post('/api/attendance/bulk', json={
        'date': '2026-10-24',
        'records': [{'student_id': 1, 'status': 'Absent', 'remarks': 'Sent home sick'}]
    })
    assert update_res.status_code == 200

    # Ensure only 1 record exists in DB for (student_id=1, date=2026-10-24)
    with client.application.app_context():
        count = Attendance.query.filter_by(student_id=1, date='2026-10-24').count()
        assert count == 1
        record = Attendance.query.filter_by(student_id=1, date='2026-10-24').first()
        assert record.status == 'Absent'
        assert record.remarks == 'Sent home sick'

def test_student_attendance_history(client):
    # Record two days of attendance for student 1
    client.post('/api/attendance/bulk', json={
        'date': '2026-10-23',
        'records': [{'student_id': 1, 'status': 'Present'}]
    })
    client.post('/api/attendance/bulk', json={
        'date': '2026-10-24',
        'records': [{'student_id': 1, 'status': 'Present'}]
    })

    res = client.get('/api/students/1/attendance')
    assert res.status_code == 200
    assert res.json['success'] is True
    assert res.json['metrics']['total_days'] == 2
    assert res.json['metrics']['present_days'] == 2
    assert res.json['metrics']['attendance_rate'] == 100.0

def test_attendance_report(client):
    client.post('/api/attendance/bulk', json={
        'date': '2026-10-20',
        'records': [
            {'student_id': 1, 'status': 'Present'},
            {'student_id': 2, 'status': 'Absent'}
        ]
    })
    client.post('/api/attendance/bulk', json={
        'date': '2026-10-21',
        'records': [
            {'student_id': 1, 'status': 'Present'},
            {'student_id': 2, 'status': 'Present'}
        ]
    })

    res = client.get('/api/reports/attendance?start_date=2026-10-20&end_date=2026-10-21')
    assert res.status_code == 200
    assert res.json['success'] is True
    assert res.json['summary']['total_records'] == 4
    assert res.json['summary']['present_count'] == 3
    assert res.json['summary']['absent_count'] == 1
    assert len(res.json['timeline']) == 2

def test_bulk_attendance_validation(client):
    # Missing date
    res1 = client.post('/api/attendance/bulk', json={'records': [{'student_id': 1}]})
    assert res1.status_code == 400

    # Empty records
    res2 = client.post('/api/attendance/bulk', json={'date': '2026-10-24', 'records': []})
    assert res2.status_code == 400
