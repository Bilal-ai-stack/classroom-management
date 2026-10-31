"""
Tests for attendance sessions, finalization, reopen-with-reason,
correction audit, and policy-driven attendance math.
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from db import db
from phase1_students.models import Student
from phase2_attendance.models import Attendance, AttendanceSession
from phase4_quality.models import AuditEvent


# ─────────────────────────── fixtures ───────────────────────────

@pytest.fixture
def app():
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
    })
    return app


@pytest.fixture
def client(app):
    with app.test_client() as c:
        with app.app_context():
            db.session.add_all([
                Student(roll_number='S01', full_name='Alice Ahmed', class_name='Grade 5', section='A', enrollment_date='2026-01-01'),
                Student(roll_number='S02', full_name='Bob Mirza', class_name='Grade 5', section='A', enrollment_date='2026-01-01'),
                Student(roll_number='S03', full_name='Carol Zia', class_name='Grade 5', section='B', enrollment_date='2026-01-01'),
            ])
            db.session.commit()

        # Bootstrap admin
        resp = c.post('/api/auth/bootstrap', json={
            'email': 'admin@school.test',
            'full_name': 'Admin User',
            'password': 'AdminTest1234!'
        })
        assert resp.status_code in (200, 201), resp.get_json()
        c.environ_base['HTTP_AUTHORIZATION'] = f"Bearer {resp.json['token']}"
        yield c


@pytest.fixture
def teacher_client(app):
    """A second client logged in as a teacher assigned to Grade 5."""
    with app.test_client() as c:
        with app.app_context():
            db.session.add_all([
                Student(roll_number='T01', full_name='Dan Tariq', class_name='Grade 5', section='A', enrollment_date='2026-01-01'),
            ])
            db.session.commit()

        # Bootstrap admin first, then create teacher
        resp = c.post('/api/auth/bootstrap', json={
            'email': 'ta@school.test', 'full_name': 'TA', 'password': 'AdminTest1234!'
        })
        assert resp.status_code in (200, 201)
        c.environ_base['HTTP_AUTHORIZATION'] = f"Bearer {resp.json['token']}"

        c.post('/api/auth/users', json={
            'email': 'teacher@school.test',
            'full_name': 'Ms Teacher',
            'role': 'teacher',
            'assigned_class': 'Grade 5',
            'password': 'TeacherTest1234!'
        })

        login_resp = c.post('/api/auth/login', json={
            'email': 'teacher@school.test',
            'password': 'TeacherTest1234!'
        })
        c.environ_base['HTTP_AUTHORIZATION'] = f"Bearer {login_resp.json['token']}"
        yield c


def _save(client, date, records):
    return client.post('/api/attendance/bulk', json={'date': date, 'records': records})


def _finalize(client, date, class_name, section='A'):
    return client.post('/api/attendance/session/finalize', json={
        'date': date, 'class_name': class_name, 'section': section
    })


def _reopen(client, date, class_name, reason, section='A'):
    return client.post('/api/attendance/session/reopen', json={
        'date': date, 'class_name': class_name, 'section': section, 'reason': reason
    })


# ─────────────────────────── session basics ───────────────────────────

def test_session_created_implicitly_on_save(client):
    """Saving attendance should create an open AttendanceSession."""
    res = _save(client, '2026-11-01', [
        {'student_id': 1, 'status': 'Present'},
        {'student_id': 2, 'status': 'Absent'},
    ])
    assert res.status_code == 200
    with client.application.app_context():
        sess = AttendanceSession.query.filter_by(
            class_name='Grade 5', section='A', date='2026-11-01'
        ).first()
        assert sess is not None
        assert sess.status == 'open'
        assert not sess.is_finalized


def test_roster_includes_session_status(client):
    """GET /attendance must include session metadata."""
    res = client.get('/api/attendance?date=2026-11-01&class_name=Grade 5&section=A')
    assert res.status_code == 200
    data = res.get_json()
    assert 'session' in data
    assert data['session']['status'] in ('open', 'finalized')
    assert data['session']['is_finalized'] is False


# ─────────────────────────── finalization ───────────────────────────

def test_finalize_session_marks_session_and_links_attendance(client):
    _save(client, '2026-11-02', [
        {'student_id': 1, 'status': 'Present'},
        {'student_id': 2, 'status': 'Late'},
    ])
    res = _finalize(client, '2026-11-02', 'Grade 5')
    assert res.status_code == 200
    data = res.get_json()
    assert data['success'] is True
    assert data['session']['status'] == 'finalized'
    assert data['session']['finalized_at'] is not None

    with client.application.app_context():
        sess = AttendanceSession.query.filter_by(
            class_name='Grade 5', section='A', date='2026-11-02'
        ).first()
        assert sess.is_finalized
        linked = Attendance.query.filter_by(session_id=sess.id).count()
        assert linked == 2


def test_cannot_save_to_finalized_session(client):
    """Saving attendance into a finalized session returns 409."""
    _save(client, '2026-11-03', [{'student_id': 1, 'status': 'Present'}])
    _finalize(client, '2026-11-03', 'Grade 5')

    res = _save(client, '2026-11-03', [{'student_id': 1, 'status': 'Absent'}])
    assert res.status_code == 409
    assert 'finalized' in res.get_json()['error'].lower()


def test_finalize_already_finalized_is_idempotent(client):
    """Finalizing an already-finalized session succeeds idempotently."""
    _save(client, '2026-11-04', [{'student_id': 1, 'status': 'Present'}])
    _finalize(client, '2026-11-04', 'Grade 5')
    res = _finalize(client, '2026-11-04', 'Grade 5')
    assert res.status_code == 200
    assert res.get_json()['success'] is True


def test_finalize_creates_session_if_missing(client):
    """Finalize on a date with no saved records still creates a session."""
    res = _finalize(client, '2026-11-10', 'Grade 5')
    assert res.status_code == 200
    with client.application.app_context():
        sess = AttendanceSession.query.filter_by(
            class_name='Grade 5', section='A', date='2026-11-10'
        ).first()
        assert sess is not None
        assert sess.is_finalized


# ─────────────────────────── reopen ───────────────────────────

def test_reopen_finalized_session(client):
    """Reopen must record reason and auditor."""
    _save(client, '2026-11-05', [{'student_id': 1, 'status': 'Present'}])
    _finalize(client, '2026-11-05', 'Grade 5')

    res = _reopen(client, '2026-11-05', 'Grade 5', reason='Incorrect marking for absent students')
    assert res.status_code == 200
    data = res.get_json()
    assert data['session']['status'] == 'open'
    assert data['session']['reopen_reason'] == 'Incorrect marking for absent students'
    assert data['session']['reopened_at'] is not None


def test_reopen_requires_reason(client):
    """Reopening with a too-short reason must be rejected."""
    _save(client, '2026-11-06', [{'student_id': 1, 'status': 'Present'}])
    _finalize(client, '2026-11-06', 'Grade 5')

    res = _reopen(client, '2026-11-06', 'Grade 5', reason='fix')
    assert res.status_code == 400
    assert 'reason' in res.get_json()['error'].lower()


def test_reopen_open_session_returns_400(client):
    """Cannot reopen a session that is not finalized."""
    _save(client, '2026-11-07', [{'student_id': 1, 'status': 'Present'}])
    res = _reopen(client, '2026-11-07', 'Grade 5', reason='Trying to reopen an open session')
    assert res.status_code == 400


def test_can_save_after_reopen(client):
    """Attendance can be saved again after a session is reopened."""
    _save(client, '2026-11-08', [{'student_id': 1, 'status': 'Present'}])
    _finalize(client, '2026-11-08', 'Grade 5')
    _reopen(client, '2026-11-08', 'Grade 5', reason='Correction needed for medical absence')

    res = _save(client, '2026-11-08', [{'student_id': 1, 'status': 'Excused'}])
    assert res.status_code == 200


# ─────────────────────────── correction audit ───────────────────────────

def test_correction_creates_audit_event(client):
    """Changing attendance status produces a correction audit event."""
    _save(client, '2026-11-09', [{'student_id': 1, 'status': 'Present'}])
    # Correct status
    _save(client, '2026-11-09', [{'student_id': 1, 'status': 'Absent', 'remarks': 'Hospital visit'}])

    with client.application.app_context():
        events = AuditEvent.query.filter_by(action='attendance.correction').all()
        assert len(events) == 1
        import json
        details = json.loads(events[0].details)
        assert details['old_status'] == 'Present'
        assert details['new_status'] == 'Absent'


def test_no_correction_event_when_unchanged(client):
    """Re-saving with identical data must NOT generate a correction audit event."""
    _save(client, '2026-11-09', [{'student_id': 1, 'status': 'Present', 'remarks': 'On time'}])
    _save(client, '2026-11-09', [{'student_id': 1, 'status': 'Present', 'remarks': 'On time'}])

    with client.application.app_context():
        events = AuditEvent.query.filter_by(action='attendance.correction').all()
        assert len(events) == 0


def test_session_audit_trail_via_api(client):
    """GET /attendance/session returns an audit_history list."""
    _save(client, '2026-11-12', [{'student_id': 1, 'status': 'Present'}])
    _finalize(client, '2026-11-12', 'Grade 5')
    _reopen(client, '2026-11-12', 'Grade 5', reason='Found duplicate records that need correction')

    res = client.get('/api/attendance/session?date=2026-11-12&class_name=Grade 5&section=A')
    assert res.status_code == 200
    data = res.get_json()
    assert 'audit_history' in data
    assert len(data['audit_history']) >= 2
    actions = {e['action'] for e in data['audit_history']}
    assert 'attendance.session_finalize' in actions
    assert 'attendance.session_reopen' in actions


# ─────────────────────────── new status values ───────────────────────────

def test_excused_and_unverified_statuses_accepted(client):
    """Excused and Unverified are valid statuses."""
    res = _save(client, '2026-11-13', [
        {'student_id': 1, 'status': 'Excused', 'remarks': 'Doctor note'},
        {'student_id': 2, 'status': 'Unverified'},
    ])
    assert res.status_code == 200
    with client.application.app_context():
        excused = Attendance.query.filter_by(student_id=1, date='2026-11-13').first()
        assert excused.status == 'Excused'


def test_status_is_case_insensitive(client):
    """Status values are normalised case-insensitively."""
    res = _save(client, '2026-11-14', [
        {'student_id': 1, 'status': 'PRESENT'},
        {'student_id': 2, 'status': 'absent'},
    ])
    assert res.status_code == 200


# ─────────────────────────── policy attendance math ───────────────────────────

def test_attendance_rate_excludes_excused_from_denominator(client):
    """
    Policy: rate = (Present + Late) / (Present + Late + Absent + Unverified).
    Excused days are excluded from the denominator entirely.
    """
    _save(client, '2026-11-15', [
        {'student_id': 1, 'status': 'Present'},   # eligible
    ])
    _save(client, '2026-11-16', [
        {'student_id': 1, 'status': 'Absent'},    # eligible
    ])
    _save(client, '2026-11-17', [
        {'student_id': 1, 'status': 'Excused'},   # excluded from denominator
    ])

    res = client.get('/api/students/1/attendance')
    assert res.status_code == 200
    metrics = res.get_json()['metrics']
    # denominator = Present(1) + Late(0) + Absent(1) + Unverified(0) = 2
    # rate = 1/2 = 50.0
    assert metrics['eligible_days'] == 2
    assert metrics['attendance_rate'] == 50.0
    assert metrics['excused_days'] == 1


def test_empty_attendance_returns_zero_rate(client):
    """With no eligible records the rate is 0.0, not 100%."""
    res = client.get('/api/students/1/attendance')
    assert res.status_code == 200
    metrics = res.get_json()['metrics']
    assert metrics['total_days'] == 0
    assert metrics['attendance_rate'] == 0.0


def test_report_attendance_rate_uses_policy_math(client):
    """Report endpoint should use the same policy-driven rate calculation."""
    _save(client, '2026-11-20', [
        {'student_id': 1, 'status': 'Present'},
        {'student_id': 2, 'status': 'Excused'},
    ])
    res = client.get('/api/reports/attendance?start_date=2026-11-20&end_date=2026-11-20')
    assert res.status_code == 200
    summary = res.get_json()['summary']
    # denominator = Present(1) only; Excused excluded
    assert summary['excused_count'] == 1
    assert summary['eligible_count'] == 1
    assert summary['overall_rate'] == 100.0


# ─────────────────────────── snapshot ───────────────────────────

def test_snapshot_preserves_historical_class(client):
    """
    Class/section snapshot is captured on save so a student transfer
    does not corrupt old records.
    """
    _save(client, '2026-11-21', [{'student_id': 1, 'status': 'Present'}])

    # Simulate a transfer by changing class_name directly in the DB
    with client.application.app_context():
        s = db.session.get(Student, 1)
        original_class = s.class_name
        s.class_name = 'Grade 6'
        db.session.commit()

        att = Attendance.query.filter_by(student_id=1, date='2026-11-21').first()
        # Historical record should reflect Grade 5, not Grade 6
        assert att.snapshot_class_name == original_class


def test_report_uses_historical_snapshot_for_class_filter(client):
    """
    After a student transfer, attendance filtered by the old class_name
    should still include the old record via snapshot.
    """
    _save(client, '2026-11-22', [{'student_id': 1, 'status': 'Present'}])

    with client.application.app_context():
        s = db.session.get(Student, 1)
        s.class_name = 'Grade 6'
        db.session.commit()

    res = client.get('/api/reports/attendance?start_date=2026-11-22&end_date=2026-11-22&class_name=Grade 5')
    assert res.status_code == 200
    assert len(res.get_json()['records']) == 1


# ─────────────────────────── session isolation ───────────────────────────

def test_sections_have_independent_sessions(client):
    """Grade 5 section A and section B finalization are independent."""
    _save(client, '2026-11-23', [{'student_id': 1, 'status': 'Present'}])  # section A
    _save(client, '2026-11-23', [{'student_id': 3, 'status': 'Present'}])  # section B (student 3 is in section B)
    _finalize(client, '2026-11-23', 'Grade 5', section='A')

    # Section B should still be open
    with client.application.app_context():
        sess_a = AttendanceSession.query.filter_by(class_name='Grade 5', section='A', date='2026-11-23').first()
        sess_b = AttendanceSession.query.filter_by(class_name='Grade 5', section='B', date='2026-11-23').first()
        assert sess_a.is_finalized
        assert sess_b is None or not sess_b.is_finalized


def test_session_detail_returns_404_gracefully_when_missing(client):
    """GET session for a date/class with no session returns success with session=None."""
    res = client.get('/api/attendance/session?date=2026-12-01&class_name=Grade 5&section=A')
    assert res.status_code == 200
    data = res.get_json()
    assert data['success'] is True
    assert data['session'] is None
