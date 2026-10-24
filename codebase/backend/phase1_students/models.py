from datetime import datetime, timezone
from db import db

class Student(db.Model):
    __tablename__ = 'students'

    id = db.Column(db.Integer, primary_key=True)
    roll_number = db.Column(db.String(20), nullable=False)
    full_name = db.Column(db.String(100), nullable=False)
    class_name = db.Column(db.String(50), nullable=False)
    section = db.Column(db.String(20), nullable=False, default='A')
    guardian_contact = db.Column(db.String(50), nullable=True)
    enrollment_date = db.Column(db.String(20), nullable=False)
    photo_path = db.Column(db.String(255), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint('roll_number', 'class_name', 'section', name='uq_student_roll_class_section'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'roll_number': self.roll_number,
            'full_name': self.full_name,
            'class_name': self.class_name,
            'section': self.section,
            'guardian_contact': self.guardian_contact or '',
            'enrollment_date': self.enrollment_date,
            'photo_path': self.photo_path or '',
            'notes': self.notes or '',
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
