from datetime import datetime, timezone
from db import db


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class InstitutionSettings(db.Model):
    __tablename__ = 'institution_settings'

    id = db.Column(db.Integer, primary_key=True)
    institution_name = db.Column(db.String(150), nullable=False, default='Springfield Academy')
    institution_code = db.Column(db.String(50), nullable=False, default='SCH-001')
    academic_year = db.Column(db.String(20), nullable=False, default='2026-2027')
    current_term = db.Column(db.String(50), nullable=False, default='Fall 2026')
    contact_email = db.Column(db.String(254), nullable=False, default='admin@school.local')
    contact_phone = db.Column(db.String(50), nullable=True, default='')
    address = db.Column(db.Text, nullable=True, default='')
    timezone = db.Column(db.String(50), nullable=False, default='UTC')
    min_attendance_warning_rate = db.Column(db.Float, nullable=False, default=75.0)
    logo_path = db.Column(db.String(255), nullable=True)
    logo_updated_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        db.CheckConstraint('id = 1', name='ck_single_institution_row'),
    )

    def to_dict(self):
        return {
            'institution_name': self.institution_name,
            'institution_code': self.institution_code,
            'academic_year': self.academic_year,
            'current_term': self.current_term,
            'contact_email': self.contact_email,
            'contact_phone': self.contact_phone or '',
            'address': self.address or '',
            'timezone': self.timezone,
            'min_attendance_warning_rate': round(float(self.min_attendance_warning_rate), 1),
            'has_custom_logo': bool(self.logo_path),
            'logo_url': f"/api/institution/logo?v={int(self.logo_updated_at.timestamp())}" if self.logo_path and self.logo_updated_at else '/api/institution/logo',
            'logo_updated_at': self.logo_updated_at.isoformat() if self.logo_updated_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class AcademicClass(db.Model):
    __tablename__ = 'academic_classes'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    section = db.Column(db.String(20), nullable=False, default='A')
    room_number = db.Column(db.String(30), nullable=True, default='')
    capacity = db.Column(db.Integer, nullable=False, default=35)
    class_teacher_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    class_teacher = db.relationship('User', foreign_keys=[class_teacher_user_id], backref=db.backref('assigned_classes_list', lazy=True))

    __table_args__ = (
        db.UniqueConstraint('name', 'section', name='uq_academic_class_section'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'section': self.section,
            'full_label': f"{self.name} - Section {self.section}",
            'room_number': self.room_number or '',
            'capacity': self.capacity,
            'class_teacher_user_id': self.class_teacher_user_id,
            'class_teacher_name': self.class_teacher.full_name if self.class_teacher else None,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class AcademicTerm(db.Model):
    __tablename__ = 'academic_terms'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    start_date = db.Column(db.String(10), nullable=False)
    end_date = db.Column(db.String(10), nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'start_date': self.start_date,
            'end_date': self.end_date,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
