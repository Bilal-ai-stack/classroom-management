from datetime import datetime, timezone
from db import db

class Attendance(db.Model):
    __tablename__ = 'attendances'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id', ondelete='CASCADE'), nullable=False)
    date = db.Column(db.String(10), nullable=False) # Format: YYYY-MM-DD
    status = db.Column(db.String(20), nullable=False, default='Present') # Present, Absent, Late
    remarks = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Composite unique constraint: a student can have at most one attendance record per day
    __table_args__ = (
        db.UniqueConstraint('student_id', 'date', name='uq_student_date'),
    )

    # Relationship to student
    student = db.relationship('Student', backref=db.backref('attendances', lazy=True, cascade='all, delete-orphan'))

    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'student_name': self.student.full_name if self.student else None,
            'roll_number': self.student.roll_number if self.student else None,
            'class_name': self.student.class_name if self.student else None,
            'section': self.student.section if self.student else None,
            'date': self.date,
            'status': self.status,
            'remarks': self.remarks,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
