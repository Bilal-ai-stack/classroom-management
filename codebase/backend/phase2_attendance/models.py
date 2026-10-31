from datetime import datetime, timezone
from db import db


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AttendanceSession(db.Model):
    __tablename__ = 'attendance_sessions'

    id = db.Column(db.Integer, primary_key=True)
    class_name = db.Column(db.String(50), nullable=False)
    section = db.Column(db.String(20), nullable=False, default='A')
    date = db.Column(db.String(10), nullable=False)  # ISO YYYY-MM-DD
    session_type = db.Column(db.String(20), nullable=False, default='Daily')
    status = db.Column(db.String(20), nullable=False, default='open')  # open, finalized
    finalized_at = db.Column(db.DateTime, nullable=True)
    finalized_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    reopened_at = db.Column(db.DateTime, nullable=True)
    reopened_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    reopen_reason = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        db.UniqueConstraint('class_name', 'section', 'date', name='uq_session_class_section_date'),
        db.CheckConstraint("status IN ('open', 'finalized')", name='ck_session_status'),
    )

    finalized_by = db.relationship('User', foreign_keys=[finalized_by_user_id], lazy='joined')
    reopened_by = db.relationship('User', foreign_keys=[reopened_by_user_id], lazy='joined')
    attendances = db.relationship('Attendance', backref=db.backref('session', lazy=True), foreign_keys='Attendance.session_id')

    @property
    def is_finalized(self):
        return self.status == 'finalized'

    def to_dict(self):
        return {
            'id': self.id,
            'class_name': self.class_name,
            'section': self.section,
            'date': self.date,
            'session_type': self.session_type,
            'status': self.status,
            'is_finalized': self.is_finalized,
            'finalized_at': self.finalized_at.isoformat() if self.finalized_at else None,
            'finalized_by_user_id': self.finalized_by_user_id,
            'finalized_by_name': self.finalized_by.full_name if self.finalized_by else None,
            'reopened_at': self.reopened_at.isoformat() if self.reopened_at else None,
            'reopened_by_user_id': self.reopened_by_user_id,
            'reopened_by_name': self.reopened_by.full_name if self.reopened_by else None,
            'reopen_reason': self.reopen_reason,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class Attendance(db.Model):
    __tablename__ = 'attendances'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id', ondelete='CASCADE'), nullable=False)
    date = db.Column(db.String(10), nullable=False)  # Format: YYYY-MM-DD
    status = db.Column(db.String(20), nullable=False, default='Present')  # Present, Absent, Late, Excused, Unverified
    remarks = db.Column(db.String(255), nullable=True)
    session_id = db.Column(db.Integer, db.ForeignKey('attendance_sessions.id', ondelete='SET NULL'), nullable=True)
    snapshot_class_name = db.Column(db.String(50), nullable=True)
    snapshot_section = db.Column(db.String(20), nullable=True)
    updated_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    # Composite unique constraint: a student can have at most one attendance record per day
    __table_args__ = (
        db.UniqueConstraint('student_id', 'date', name='uq_student_date'),
    )

    student = db.relationship('Student', backref=db.backref('attendances', lazy=True, cascade='all, delete-orphan'))
    updated_by = db.relationship('User', foreign_keys=[updated_by_user_id], lazy='joined')

    def to_dict(self):
        class_name = self.snapshot_class_name or (self.student.class_name if self.student else None)
        section = self.snapshot_section or (self.student.section if self.student else None)
        return {
            'id': self.id,
            'student_id': self.student_id,
            'student_name': self.student.full_name if self.student else None,
            'roll_number': self.student.roll_number if self.student else None,
            'class_name': class_name,
            'section': section,
            'date': self.date,
            'status': self.status,
            'remarks': self.remarks,
            'session_id': self.session_id,
            'updated_by_user_id': self.updated_by_user_id,
            'updated_by_name': self.updated_by.full_name if self.updated_by else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
