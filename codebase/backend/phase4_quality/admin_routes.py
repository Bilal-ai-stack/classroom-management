from flask import Blueprint, jsonify, request
from db import db
from phase1_students.models import Student
from phase4_quality.auth import require_auth, require_roles
from phase4_quality.institution_models import AcademicClass, AcademicTerm, InstitutionSettings
from phase4_quality.models import AuditEvent, User, record_audit

admin_bp = Blueprint('admin', __name__)


def get_or_create_settings():
    settings = db.session.get(InstitutionSettings, 1)
    if not settings:
        settings = InstitutionSettings(
            id=1,
            institution_name='Springfield Academy',
            institution_code='SCH-001',
            academic_year='2026-2027',
            current_term='Fall 2026',
            contact_email='admin@school.local',
            timezone='UTC',
            min_attendance_warning_rate=75.0,
        )
        db.session.add(settings)
        db.session.commit()
    return settings


# ---------------------------------------------------------------------------
# Institution Configuration Endpoints
# ---------------------------------------------------------------------------

@admin_bp.route('/admin/institution', methods=['GET'])
@require_auth
def get_institution_settings():
    """Get current institution configuration."""
    settings = get_or_create_settings()
    return jsonify({
        'success': True,
        'settings': settings.to_dict()
    }), 200


@admin_bp.route('/admin/institution', methods=['PUT'])
@require_roles('admin')
def update_institution_settings():
    """Update institution settings (admin only, audited)."""
    settings = get_or_create_settings()
    data = request.get_json() or {}

    name = str(data.get('institution_name', '')).strip()
    code = str(data.get('institution_code', '')).strip()
    email = str(data.get('contact_email', '')).strip()

    if not name or not code or not email or '@' not in email:
        return jsonify({
            'success': False,
            'error': 'Valid institution name, code, and contact email are required.'
        }), 400

    min_rate = data.get('min_attendance_warning_rate', settings.min_attendance_warning_rate)
    try:
        min_rate = float(min_rate)
        if not (0.0 <= min_rate <= 100.0):
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({
            'success': False,
            'error': 'Attendance warning threshold must be a percentage between 0 and 100.'
        }), 400

    old_values = settings.to_dict()

    settings.institution_name = name
    settings.institution_code = code
    settings.academic_year = str(data.get('academic_year', settings.academic_year)).strip() or settings.academic_year
    settings.current_term = str(data.get('current_term', settings.current_term)).strip() or settings.current_term
    settings.contact_email = email
    settings.contact_phone = str(data.get('contact_phone', '')).strip()
    settings.address = str(data.get('address', '')).strip()
    settings.timezone = str(data.get('timezone', settings.timezone)).strip() or 'UTC'
    settings.min_attendance_warning_rate = min_rate

    record_audit(
        'institution.update',
        'institution_settings',
        settings.id,
        {'previous': old_values, 'updated': settings.to_dict()},
        actor_user_id=request.current_user.id
    )
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Institution settings updated successfully.',
        'settings': settings.to_dict()
    }), 200


# ---------------------------------------------------------------------------
# Academic Classes & Sections Management
# ---------------------------------------------------------------------------

@admin_bp.route('/admin/classes', methods=['GET'])
@require_auth
def list_academic_classes():
    """List configured classes and sections."""
    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
    query = AcademicClass.query
    if not include_inactive:
        query = query.filter_by(is_active=True)

    classes = query.order_by(AcademicClass.name, AcademicClass.section).all()

    # Calculate enrolled student count per class and section
    results = []
    for cls in classes:
        student_count = Student.query.filter_by(
            class_name=cls.name,
            section=cls.section,
            is_active=True
        ).count()
        item = cls.to_dict()
        item['enrolled_students'] = student_count
        results.append(item)

    return jsonify({
        'success': True,
        'count': len(results),
        'classes': results
    }), 200


@admin_bp.route('/admin/classes', methods=['POST'])
@require_roles('admin')
def create_academic_class():
    """Create a new academic class / section."""
    data = request.get_json() or {}
    name = str(data.get('name', '')).strip()
    section = str(data.get('section', 'A')).strip() or 'A'
    room = str(data.get('room_number', '')).strip()
    capacity = data.get('capacity', 35)
    teacher_id = data.get('class_teacher_user_id')

    if not name:
        return jsonify({'success': False, 'error': 'Class name is required (e.g. Grade 6).'}), 400

    try:
        capacity = int(capacity)
        if capacity <= 0 or capacity > 200:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({'success': False, 'error': 'Capacity must be an integer between 1 and 200.'}), 400

    existing = AcademicClass.query.filter_by(name=name, section=section).first()
    if existing:
        return jsonify({
            'success': False,
            'error': f"Class '{name}' Section '{section}' already exists."
        }), 409

    if teacher_id:
        teacher = db.session.get(User, teacher_id)
        if not teacher:
            return jsonify({'success': False, 'error': 'Assigned teacher not found.'}), 404
    else:
        teacher_id = None

    new_class = AcademicClass(
        name=name,
        section=section,
        room_number=room,
        capacity=capacity,
        class_teacher_user_id=teacher_id,
        is_active=True
    )
    db.session.add(new_class)
    db.session.flush()

    record_audit(
        'class.create',
        'academic_class',
        new_class.id,
        {'name': name, 'section': section, 'capacity': capacity, 'room': room},
        actor_user_id=request.current_user.id
    )
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f"Class {name} Section {section} created successfully.",
        'class': new_class.to_dict()
    }), 201


@admin_bp.route('/admin/classes/<int:class_id>', methods=['PUT'])
@require_roles('admin')
def update_academic_class(class_id):
    """Update class details (room, capacity, teacher, status)."""
    cls = db.session.get(AcademicClass, class_id)
    if not cls:
        return jsonify({'success': False, 'error': 'Class not found.'}), 404

    data = request.get_json() or {}
    if 'room_number' in data:
        cls.room_number = str(data['room_number']).strip()
    if 'capacity' in data:
        try:
            cap = int(data['capacity'])
            if cap <= 0:
                raise ValueError()
            cls.capacity = cap
        except (ValueError, TypeError):
            return jsonify({'success': False, 'error': 'Valid positive capacity required.'}), 400

    if 'class_teacher_user_id' in data:
        tid = data['class_teacher_user_id']
        if tid:
            teacher = db.session.get(User, tid)
            if not teacher:
                return jsonify({'success': False, 'error': 'Teacher not found.'}), 404
            cls.class_teacher_user_id = teacher.id
        else:
            cls.class_teacher_user_id = None

    if 'is_active' in data:
        cls.is_active = bool(data['is_active'])

    record_audit(
        'class.update',
        'academic_class',
        cls.id,
        {'name': cls.name, 'section': cls.section, 'capacity': cls.capacity, 'is_active': cls.is_active},
        actor_user_id=request.current_user.id
    )
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f"Class {cls.name} updated.",
        'class': cls.to_dict()
    }), 200


@admin_bp.route('/admin/classes/<int:class_id>', methods=['DELETE'])
@require_roles('admin')
def delete_academic_class(class_id):
    """Deactivate or remove a class if no students are assigned."""
    cls = db.session.get(AcademicClass, class_id)
    if not cls:
        return jsonify({'success': False, 'error': 'Class not found.'}), 404

    enrolled = Student.query.filter_by(class_name=cls.name, section=cls.section, is_active=True).count()
    if enrolled > 0:
        # Soft deactivate instead of hard delete to preserve foreign key & historical integrity
        cls.is_active = False
        record_audit('class.deactivate', 'academic_class', cls.id, {'enrolled_students': enrolled}, request.current_user.id)
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f"Class has {enrolled} active students enrolled. It was archived instead of deleted.",
            'action': 'archived'
        }), 200

    db.session.delete(cls)
    record_audit('class.delete', 'academic_class', class_id, {'name': cls.name, 'section': cls.section}, request.current_user.id)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f"Class {cls.name} Section {cls.section} deleted successfully.",
        'action': 'deleted'
    }), 200


# ---------------------------------------------------------------------------
# User Administration & Lifecycle
# ---------------------------------------------------------------------------

@admin_bp.route('/admin/users', methods=['GET'])
@require_roles('admin')
def list_system_users():
    """List all accounts for user administration."""
    users = User.query.order_by(User.role, User.full_name).all()
    return jsonify({
        'success': True,
        'count': len(users),
        'users': [u.public_dict() for u in users]
    }), 200


@admin_bp.route('/admin/users/<int:user_id>/status', methods=['PATCH'])
@require_roles('admin')
def toggle_user_status(user_id):
    """Activate or deactivate a user account."""
    if user_id == request.current_user.id:
        return jsonify({
            'success': False,
            'error': 'Administrators cannot deactivate their own account.'
        }), 400

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'success': False, 'error': 'User not found.'}), 404

    data = request.get_json(silent=True) or {}
    if 'is_active' in data:
        user.is_active = bool(data['is_active'])
    else:
        user.is_active = not user.is_active

    action = 'activate' if user.is_active else 'deactivate'
    record_audit(f'user.{action}', 'user', user.id, {'email': user.email}, request.current_user.id)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f"User account has been {action}d.",
        'user': user.public_dict()
    }), 200


# ---------------------------------------------------------------------------
# Academic Terms Management
# ---------------------------------------------------------------------------

@admin_bp.route('/admin/terms', methods=['GET'])
@require_auth
def list_academic_terms():
    """List academic terms."""
    terms = AcademicTerm.query.order_by(AcademicTerm.start_date.desc()).all()
    return jsonify({
        'success': True,
        'count': len(terms),
        'terms': [t.to_dict() for t in terms]
    }), 200


@admin_bp.route('/admin/terms', methods=['POST'])
@require_roles('admin')
def create_academic_term():
    """Create a new academic term."""
    data = request.get_json() or {}
    name = str(data.get('name', '')).strip()
    start_date = str(data.get('start_date', '')).strip()
    end_date = str(data.get('end_date', '')).strip()

    if not name or not start_date or not end_date:
        return jsonify({'success': False, 'error': 'Term name, start date, and end date are required.'}), 400

    if start_date >= end_date:
        return jsonify({'success': False, 'error': 'Start date must be before end date.'}), 400

    term = AcademicTerm(
        name=name,
        start_date=start_date,
        end_date=end_date,
        is_active=bool(data.get('is_active', False))
    )
    db.session.add(term)
    db.session.flush()

    record_audit('term.create', 'academic_term', term.id, {'name': name}, request.current_user.id)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f"Term '{name}' created successfully.",
        'term': term.to_dict()
    }), 201
