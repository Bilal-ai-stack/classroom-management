import os
import re
import shutil
import sqlite3
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
import xml.etree.ElementTree as ET
from flask import Blueprint, jsonify, request, send_file, Response, current_app
from database_tools import create_backup, database_path_from_uri, verify_backup, integrity_check
from db import db
from phase1_students.models import Student
from phase4_quality.auth import require_auth, require_roles, utcnow
from phase4_quality.institution_models import AcademicClass, AcademicTerm, InstitutionSettings, WhatsAppNotification
from phase4_quality.models import AuditEvent, User, record_audit

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

admin_bp = Blueprint('admin', __name__)

MAX_LOGO_BYTES = 2 * 1024 * 1024  # 2MB
MAX_RASTER_DIMENSION = 2048
MIN_RASTER_DIMENSION = 16

MIME_MAP = {
    'svg': 'image/svg+xml',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
}

DEFAULT_SCHOOL_CREST_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a8a" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.25"/>
    </filter>
  </defs>
  <path d="M60 8 C88 8 106 18 106 42 C106 78 78 104 60 114 C42 104 14 78 14 42 C14 18 32 8 60 8 Z" fill="url(#shieldGrad)" filter="url(#shadow)" stroke="#3b82f6" stroke-width="2"/>
  <path d="M60 14 C83 14 99 22 99 44 C99 74 74 97 60 106 C46 97 21 74 21 44 C21 22 37 14 60 14 Z" fill="none" stroke="url(#goldGrad)" stroke-width="1.5" stroke-dasharray="2 1" opacity="0.6"/>
  <path d="M60 72 C50 67 36 67 28 72 L28 50 C36 45 50 45 60 50 Z" fill="#ffffff" opacity="0.95"/>
  <path d="M60 72 C70 67 84 67 92 72 L92 50 C84 45 70 45 60 50 Z" fill="#f1f5f9" opacity="0.95"/>
  <line x1="60" y1="50" x2="60" y2="72" stroke="#cbd5e1" stroke-width="1.5"/>
  <polygon points="60,24 86,34 60,44 34,34" fill="url(#goldGrad)"/>
  <polygon points="60,39 78,33 78,37 60,43 42,37 42,33" fill="#b45309"/>
  <path d="M78 34 L82 45" stroke="#fbbf24" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="82" cy="46" r="1.5" fill="#f59e0b"/>
  <polygon points="60,82 62,87 67,87 63,90 65,95 60,92 55,95 57,90 53,87 58,87" fill="url(#goldGrad)"/>
  <polygon points="44,82 45.5,85.5 49.5,85.5 46.5,88 48,91.5 44,89.5 40,91.5 41.5,88 38.5,85.5 42.5,85.5" fill="url(#goldGrad)" opacity="0.8"/>
  <polygon points="76,82 77.5,85.5 81.5,85.5 78.5,88 80,91.5 76,89.5 72,91.5 73.5,88 70.5,85.5 74.5,85.5" fill="url(#goldGrad)" opacity="0.8"/>
</svg>"""


def get_branding_dir():
    branding_dir = current_app.config.get('BRANDING_DIRECTORY')
    if not branding_dir:
        branding_dir = Path(current_app.instance_path) / 'branding'
    path = Path(branding_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def validate_and_sanitize_svg(content: bytes) -> tuple[bool, str]:
    """Sanitize and validate an SVG upload to prevent XSS and XXE attacks."""
    try:
        svg_text = content.decode('utf-8')
    except UnicodeDecodeError:
        return False, 'SVG file must be valid UTF-8 text.'

    lower_text = svg_text.lower()

    # Block script execution and HTML embedding
    forbidden_tokens = [
        '<script', '</script', 'javascript:', 'vbscript:', 'data:text/html',
        '<!entity', '<!doctype', 'system ', 'public ',
        '<foreignobject', '</foreignobject', '<iframe', '<embed', '<object',
    ]
    for token in forbidden_tokens:
        if token in lower_text:
            return False, f'SVG contains unsafe directive: {token}'

    # Block inline event handlers (onload, onerror, onclick, etc.)
    if re.search(r'\bon[a-z]+\s*=', lower_text):
        return False, 'SVG contains prohibited inline event handlers.'

    # Block external network resources (prevent SSRF/data exfiltration)
    if re.search(r'(href|xlink:href)\s*=\s*["\'](https?:|//)', lower_text):
        return False, 'SVG contains prohibited external hyperlinks or resources.'

    # Validate well-formed XML structure without external entities
    try:
        parser = ET.XMLParser()
        root = ET.fromstring(svg_text, parser=parser)
        if not root.tag.endswith('svg'):
            return False, 'Root element of SVG must be <svg>.'
    except Exception as err:
        return False, f'Malformed SVG XML structure: {err}'

    return True, ''


def validate_raster_image(content: bytes, ext: str) -> tuple[bool, str]:
    """Validate raster images (PNG, JPG, JPEG) with Pillow."""
    if not PIL_AVAILABLE:
        return False, 'Server cannot process raster images because Pillow is not available.'

    try:
        Image.MAX_IMAGE_PIXELS = 5_000_000
        with Image.open(BytesIO(content)) as img:
            img.verify()

        with Image.open(BytesIO(content)) as img:
            fmt = (img.format or '').upper()
            if ext in ('jpg', 'jpeg') and fmt != 'JPEG':
                return False, f'File content does not match JPEG format (detected {fmt}).'
            if ext == 'png' and fmt != 'PNG':
                return False, f'File content does not match PNG format (detected {fmt}).'

            w, h = img.size
            if w > MAX_RASTER_DIMENSION or h > MAX_RASTER_DIMENSION:
                return False, f'Logo dimensions ({w}x{h}) exceed maximum allowed size of {MAX_RASTER_DIMENSION}x{MAX_RASTER_DIMENSION} pixels.'
            if w < MIN_RASTER_DIMENSION or h < MIN_RASTER_DIMENSION:
                return False, f'Logo dimensions ({w}x{h}) are too small (minimum {MIN_RASTER_DIMENSION}x{MIN_RASTER_DIMENSION} pixels).'

        return True, ''
    except Image.DecompressionBombError:
        return False, 'Image rejected: decompression bomb detected.'
    except Exception as err:
        return False, f'Invalid or corrupt image file: {err}'



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
    settings.description = str(data.get('description', settings.description or '')).strip()
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


@admin_bp.route('/institution/profile', methods=['GET'])
def get_public_institution_profile():
    """Get public institution profile (name, code, logo)."""
    settings = get_or_create_settings()
    d = settings.to_dict()
    return jsonify({
        'success': True,
        'institution': {
            'institution_name': settings.institution_name,
            'institution_code': settings.institution_code,
            'academic_year': settings.academic_year,
            'current_term': settings.current_term,
            'contact_email': settings.contact_email,
            'contact_phone': settings.contact_phone or '',
            'address': settings.address or '',
            'description': settings.description or '',
            'has_custom_logo': d.get('has_custom_logo', False),
            'logo_url': d.get('logo_url', '/api/institution/logo'),
            'logo_updated_at': d.get('logo_updated_at'),
        }
    }), 200


@admin_bp.route('/institution/logo', methods=['GET'])
def get_institution_logo():
    """Serve the active institution logo or default academic crest."""
    settings = get_or_create_settings()
    if settings.logo_path:
        branding_dir = get_branding_dir()
        target_file = branding_dir / settings.logo_path
        if target_file.is_file():
            ext = settings.logo_path.rsplit('.', 1)[-1].lower()
            mimetype = MIME_MAP.get(ext, 'application/octet-stream')
            response = send_file(target_file, mimetype=mimetype, max_age=3600)
            response.headers['Cache-Control'] = 'public, max-age=3600'
            return response

    response = Response(DEFAULT_SCHOOL_CREST_SVG, mimetype='image/svg+xml')
    response.headers['Cache-Control'] = 'public, max-age=86400'
    return response


@admin_bp.route('/admin/institution/logo', methods=['POST'])
@require_roles('admin')
def upload_institution_logo():
    """Upload, validate, and store a custom institution logo (PNG, JPG, SVG)."""
    settings = get_or_create_settings()

    if 'logo' not in request.files and 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No logo file provided in request.'}), 400

    file = request.files.get('logo') or request.files.get('file')
    if not file or not file.filename:
        return jsonify({'success': False, 'error': 'No file selected for upload.'}), 400

    filename = file.filename.strip()
    if '.' not in filename:
        return jsonify({'success': False, 'error': 'Uploaded file must have an extension.'}), 400

    ext = filename.rsplit('.', 1)[-1].lower()
    if ext not in MIME_MAP:
        return jsonify({
            'success': False,
            'error': f"Unsupported image extension '{ext}'. Allowed formats: PNG, JPG, JPEG, SVG."
        }), 400

    content = file.read()
    if len(content) == 0:
        return jsonify({'success': False, 'error': 'The uploaded logo file is empty.'}), 400

    if len(content) > MAX_LOGO_BYTES:
        return jsonify({
            'success': False,
            'error': f'Logo file size ({len(content)} bytes) exceeds the 2MB limit.'
        }), 400

    # Format-specific validation & sanitization
    if ext == 'svg':
        valid, err = validate_and_sanitize_svg(content)
        if not valid:
            return jsonify({'success': False, 'error': f'SVG validation failed: {err}'}), 400
    else:
        valid, err = validate_raster_image(content, ext)
        if not valid:
            return jsonify({'success': False, 'error': f'Image validation failed: {err}'}), 400

    branding_dir = get_branding_dir()

    # Clean up previous custom logo if it had a different extension
    if settings.logo_path:
        old_file = branding_dir / settings.logo_path
        if old_file.exists():
            try:
                old_file.unlink()
            except OSError:
                pass

    saved_filename = f"school_logo.{ext}"
    target_path = branding_dir / saved_filename
    target_path.write_bytes(content)

    settings.logo_path = saved_filename
    settings.logo_updated_at = utcnow()

    record_audit(
        'institution.logo_upload',
        'institution_settings',
        settings.id,
        {'filename': saved_filename, 'size': len(content), 'type': ext},
        actor_user_id=request.current_user.id
    )
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Institution logo uploaded and activated successfully.',
        'settings': settings.to_dict()
    }), 200


@admin_bp.route('/admin/institution/logo', methods=['DELETE'])
@require_roles('admin')
def delete_institution_logo():
    """Remove custom institution logo and revert to the default crest."""
    settings = get_or_create_settings()

    if settings.logo_path:
        branding_dir = get_branding_dir()
        old_file = branding_dir / settings.logo_path
        if old_file.exists():
            try:
                old_file.unlink()
            except OSError:
                pass

        settings.logo_path = None
        settings.logo_updated_at = None
        record_audit(
            'institution.logo_remove',
            'institution_settings',
            settings.id,
            {},
            actor_user_id=request.current_user.id
        )
        db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Custom school logo removed. Default crest restored.',
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
    """Update class details (name, section, room, capacity, teacher, status)."""
    cls = db.session.get(AcademicClass, class_id)
    if not cls:
        return jsonify({'success': False, 'error': 'Class not found.'}), 404

    data = request.get_json() or {}

    old_name = cls.name
    old_section = cls.section
    new_name = str(data.get('name', old_name)).strip() or old_name
    new_section = str(data.get('section', old_section)).strip() or old_section

    if new_name != old_name or new_section != old_section:
        conflict = AcademicClass.query.filter(
            AcademicClass.id != class_id,
            AcademicClass.name == new_name,
            AcademicClass.section == new_section
        ).first()
        if conflict:
            return jsonify({
                'success': False,
                'error': f"Class '{new_name}' Section '{new_section}' already exists."
            }), 409

        # Synchronize enrolled students safely
        students = Student.query.filter_by(class_name=old_name, section=old_section).all()
        for s in students:
            s.class_name = new_name
            s.section = new_section

        # Synchronize attendance sessions safely
        try:
            from phase2_attendance.models import AttendanceSession
            sessions = AttendanceSession.query.filter_by(class_name=old_name, section=old_section).all()
            for sess in sessions:
                sess.class_name = new_name
                sess.section = new_section
        except Exception:
            pass

        cls.name = new_name
        cls.section = new_section

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


@admin_bp.route('/admin/terms/<int:term_id>', methods=['PUT'])
@require_roles('admin')
def update_academic_term(term_id):
    """Update an existing academic term."""
    term = db.session.get(AcademicTerm, term_id)
    if not term:
        return jsonify({'success': False, 'error': 'Academic term not found.'}), 404

    data = request.get_json() or {}
    name = str(data.get('name', term.name)).strip()
    start_date = str(data.get('start_date', term.start_date)).strip()
    end_date = str(data.get('end_date', term.end_date)).strip()

    if not name or not start_date or not end_date:
        return jsonify({'success': False, 'error': 'Term name, start date, and end date are required.'}), 400

    if start_date >= end_date:
        return jsonify({'success': False, 'error': 'Start date must be before end date.'}), 400

    old_data = term.to_dict()
    term.name = name
    term.start_date = start_date
    term.end_date = end_date
    if 'is_active' in data:
        term.is_active = bool(data['is_active'])

    record_audit('term.update', 'academic_term', term.id, {'previous': old_data, 'updated': term.to_dict()}, request.current_user.id)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f"Term '{name}' updated successfully.",
        'term': term.to_dict()
    }), 200


@admin_bp.route('/admin/terms/<int:term_id>', methods=['DELETE'])
@require_roles('admin')
def delete_academic_term(term_id):
    """Delete an academic term."""
    term = db.session.get(AcademicTerm, term_id)
    if not term:
        return jsonify({'success': False, 'error': 'Academic term not found.'}), 404

    record_audit('term.delete', 'academic_term', term.id, {'name': term.name}, request.current_user.id)
    db.session.delete(term)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f"Term '{term.name}' deleted successfully."
    }), 200


# ---------------------------------------------------------------------------
# WhatsApp Notification Module Endpoints
# ---------------------------------------------------------------------------

@admin_bp.route('/admin/whatsapp/config', methods=['GET'])
@require_roles('admin')
def get_whatsapp_config():
    """Retrieve WhatsApp Business Platform / Cloud API configuration."""
    settings = get_or_create_settings()
    return jsonify({
        'success': True,
        'config': {
            'whatsapp_enabled': settings.whatsapp_enabled,
            'whatsapp_provider': settings.whatsapp_provider,
            'whatsapp_phone_number_id': settings.whatsapp_phone_number_id or '',
            'whatsapp_business_account_id': settings.whatsapp_business_account_id or '',
            'whatsapp_api_token_configured': bool(settings.whatsapp_api_token_preview),
            'whatsapp_api_token_preview': settings.whatsapp_api_token_preview or '',
            'whatsapp_auto_notify_absent': settings.whatsapp_auto_notify_absent,
            'whatsapp_auto_notify_late': settings.whatsapp_auto_notify_late,
            'whatsapp_template_absent': settings.whatsapp_template_absent or '',
            'whatsapp_template_late': settings.whatsapp_template_late or '',
        }
    }), 200


@admin_bp.route('/admin/whatsapp/config', methods=['PUT'])
@require_roles('admin')
def update_whatsapp_config():
    """Update WhatsApp configuration and templates."""
    settings = get_or_create_settings()
    data = request.get_json() or {}

    old_config = {
        'whatsapp_enabled': settings.whatsapp_enabled,
        'whatsapp_provider': settings.whatsapp_provider,
        'whatsapp_auto_notify_absent': settings.whatsapp_auto_notify_absent,
        'whatsapp_auto_notify_late': settings.whatsapp_auto_notify_late
    }

    if 'whatsapp_enabled' in data:
        settings.whatsapp_enabled = bool(data['whatsapp_enabled'])
    if 'whatsapp_provider' in data:
        settings.whatsapp_provider = str(data['whatsapp_provider']).strip() or 'cloud_api'
    if 'whatsapp_phone_number_id' in data:
        settings.whatsapp_phone_number_id = str(data['whatsapp_phone_number_id']).strip()
    if 'whatsapp_business_account_id' in data:
        settings.whatsapp_business_account_id = str(data['whatsapp_business_account_id']).strip()
    if 'whatsapp_auto_notify_absent' in data:
        settings.whatsapp_auto_notify_absent = bool(data['whatsapp_auto_notify_absent'])
    if 'whatsapp_auto_notify_late' in data:
        settings.whatsapp_auto_notify_late = bool(data['whatsapp_auto_notify_late'])
    if 'whatsapp_template_absent' in data:
        settings.whatsapp_template_absent = str(data['whatsapp_template_absent']).strip()
    if 'whatsapp_template_late' in data:
        settings.whatsapp_template_late = str(data['whatsapp_template_late']).strip()

    if 'whatsapp_api_token' in data:
        token = str(data['whatsapp_api_token']).strip()
        if token:
            settings.whatsapp_api_token_preview = f"...{token[-4:]}" if len(token) >= 4 else "configured"
            # Note: in desktop mode or production, live API secrets are passed via system environment
            os.environ['WHATSAPP_CLOUD_API_TOKEN'] = token

    record_audit('whatsapp.config_update', 'institution_settings', settings.id, {'previous': old_config, 'updated': data}, request.current_user.id)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'WhatsApp configuration saved successfully.',
        'config': {
            'whatsapp_enabled': settings.whatsapp_enabled,
            'whatsapp_provider': settings.whatsapp_provider,
            'whatsapp_phone_number_id': settings.whatsapp_phone_number_id or '',
            'whatsapp_business_account_id': settings.whatsapp_business_account_id or '',
            'whatsapp_api_token_configured': bool(settings.whatsapp_api_token_preview),
            'whatsapp_api_token_preview': settings.whatsapp_api_token_preview or '',
            'whatsapp_auto_notify_absent': settings.whatsapp_auto_notify_absent,
            'whatsapp_auto_notify_late': settings.whatsapp_auto_notify_late,
            'whatsapp_template_absent': settings.whatsapp_template_absent or '',
            'whatsapp_template_late': settings.whatsapp_template_late or '',
        }
    }), 200


@admin_bp.route('/admin/whatsapp/test-message', methods=['POST'])
@require_roles('admin')
def test_whatsapp_message():
    """Send or simulate a WhatsApp test notification safely."""
    data = request.get_json() or {}
    phone = str(data.get('recipient_phone', '')).strip()
    message = str(data.get('message_text', 'ClassroomOS test notification message.')).strip()

    cleaned_phone = re.sub(r'[^0-9+]', '', phone)
    if len(cleaned_phone) < 7:
        return jsonify({'success': False, 'error': 'Invalid recipient phone number format.'}), 400

    # Test/development simulated delivery (prevents unauthorized external calls and billing)
    simulated_id = f"sim_wamid_{int(utcnow().timestamp())}"
    notification = WhatsAppNotification(
        recipient_phone=cleaned_phone,
        recipient_name='Test Recipient',
        message_type='test',
        message_text=message,
        mode='automatic_api',
        status='sent',
        provider_message_id=simulated_id,
        created_at=utcnow(),
        updated_at=utcnow(),
        actor_user_id=request.current_user.id
    )
    db.session.add(notification)
    db.session.flush()

    record_audit('whatsapp.test_sent', 'whatsapp_notification', notification.id, {'phone': cleaned_phone}, request.current_user.id)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f"Test notification dispatched successfully (Simulated ID: {simulated_id}).",
        'notification': notification.to_dict()
    }), 200


@admin_bp.route('/admin/whatsapp/logs', methods=['GET'])
@require_roles('admin')
def list_whatsapp_logs():
    """List recent notification log entries."""
    logs = WhatsAppNotification.query.order_by(WhatsAppNotification.created_at.desc()).limit(100).all()
    return jsonify({
        'success': True,
        'count': len(logs),
        'logs': [item.to_dict() for item in logs]
    }), 200


@admin_bp.route('/whatsapp/manual-log', methods=['POST'])
@require_auth
def log_manual_whatsapp():
    """Record when a teacher or administrator generates/opens a manual WhatsApp notification link."""
    data = request.get_json() or {}
    student_id = data.get('student_id')
    phone = str(data.get('recipient_phone', '')).strip()
    name = str(data.get('recipient_name', '')).strip()
    msg_type = str(data.get('message_type', 'attendance')).strip()
    text = str(data.get('message_text', '')).strip()

    cleaned_phone = re.sub(r'[^0-9+]', '', phone)
    if not cleaned_phone or not text:
        return jsonify({'success': False, 'error': 'Recipient phone and message text are required.'}), 400

    notification = WhatsAppNotification(
        student_id=student_id if student_id else None,
        recipient_phone=cleaned_phone,
        recipient_name=name,
        message_type=msg_type,
        message_text=text,
        mode='manual_link',
        status='prepared',
        created_at=utcnow(),
        updated_at=utcnow(),
        actor_user_id=request.current_user.id
    )
    db.session.add(notification)
    db.session.flush()

    record_audit('whatsapp.manual_link_opened', 'whatsapp_notification', notification.id, {
        'phone': cleaned_phone,
        'student_id': student_id,
        'message_type': msg_type
    }, request.current_user.id)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Manual notification link logged.',
        'notification': notification.to_dict()
    }), 201


# ---------------------------------------------------------------------------
# Database Storage, Backups & Reliability Endpoints
# ---------------------------------------------------------------------------

def get_storage_paths():
    uri = current_app.config['SQLALCHEMY_DATABASE_URI']
    db_path = database_path_from_uri(uri)
    backup_dir = Path(current_app.config.get('BACKUP_DIRECTORY') or (db_path.parent / 'backups'))
    backup_dir.mkdir(parents=True, exist_ok=True)
    return db_path, backup_dir


@admin_bp.route('/admin/storage', methods=['GET'])
@require_roles('admin')
def get_storage_info():
    """Get database file size, backups list, integrity status, and available disk space."""
    db_path, backup_dir = get_storage_paths()
    db_size = db_path.stat().st_size if db_path.is_file() else 0

    backups = []
    total_backup_bytes = 0
    if backup_dir.is_dir():
        for f in sorted(backup_dir.glob('*.db'), key=lambda p: p.stat().st_mtime, reverse=True):
            f_size = f.stat().st_size
            total_backup_bytes += f_size
            is_valid = verify_backup(f)
            backups.append({
                'filename': f.name,
                'size_bytes': f_size,
                'size_display': f"{round(f_size / 1024, 1)} KB",
                'created_at': datetime.fromtimestamp(f.stat().st_mtime, timezone.utc).isoformat(),
                'verified': is_valid
            })

    try:
        total, used, free = shutil.disk_usage(str(db_path.parent))
    except Exception:
        total, used, free = 0, 0, 0

    return jsonify({
        'success': True,
        'storage': {
            'database_path': str(db_path),
            'database_size_bytes': db_size,
            'database_size_display': f"{round(db_size / 1024, 1)} KB",
            'backup_directory': str(backup_dir),
            'backup_count': len(backups),
            'total_backup_size_bytes': total_backup_bytes,
            'total_backup_size_display': f"{round(total_backup_bytes / 1024, 1)} KB",
            'disk_free_bytes': free,
            'disk_total_bytes': total,
            'disk_free_display': f"{round(free / (1024 * 1024 * 1024), 2)} GB" if free else 'Unknown',
            'backups': backups
        }
    }), 200


@admin_bp.route('/admin/backups', methods=['POST'])
@require_roles('admin')
def trigger_backup():
    """Create and verify an immediate, non-destructive SQLite database backup."""
    db_path, backup_dir = get_storage_paths()
    timestamp = utcnow().strftime('%Y%m%d_%H%M%S')
    backup_file = backup_dir / f"manual-backup-{timestamp}.db"

    try:
        manifest = create_backup(db_path, backup_file)
        record_audit('database.manual_backup', 'database', 1, {'filename': backup_file.name, 'sha256': manifest['sha256']}, request.current_user.id)
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f"Verified backup created: {backup_file.name}",
            'manifest': manifest
        }), 201
    except Exception as err:
        return jsonify({'success': False, 'error': f"Backup creation failed: {err}"}), 500


@admin_bp.route('/admin/backups/restore', methods=['POST'])
@require_roles('admin')
def restore_backup_endpoint():
    """Safely restore database from a verified backup archive."""
    data = request.get_json() or {}
    filename = str(data.get('filename', '')).strip()

    if not filename or not re.match(r'^[a-zA-Z0-9_\-\.]+\.db$', filename):
        return jsonify({'success': False, 'error': 'Invalid backup filename format.'}), 400

    db_path, backup_dir = get_storage_paths()
    target_backup = backup_dir / filename
    if not target_backup.is_file():
        return jsonify({'success': False, 'error': 'Selected backup file does not exist.'}), 404

    if not verify_backup(target_backup):
        return jsonify({'success': False, 'error': 'Backup failed cryptographic integrity check. Refusing to restore.'}), 400

    # Create safety snapshot of live database prior to restoring
    safety_ts = utcnow().strftime('%Y%m%d_%H%M%S')
    safety_backup = backup_dir / f"safety-pre-restore-{safety_ts}.db"
    try:
        create_backup(db_path, safety_backup)
    except Exception as err:
        return jsonify({'success': False, 'error': f"Failed creating safety snapshot prior to restore: {err}"}), 500

    # Perform online SQLite live restoration
    try:
        src = sqlite3.connect(str(target_backup))
        dest = sqlite3.connect(str(db_path))
        src.backup(dest)
        src.close()
        dest.close()

        record_audit('database.restore', 'database', 1, {'source_backup': filename, 'safety_backup': safety_backup.name}, request.current_user.id)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': f"Database restored successfully from '{filename}'. Safety snapshot preserved as '{safety_backup.name}'."
        }), 200
    except Exception as err:
        return jsonify({'success': False, 'error': f"Database restore failed: {err}"}), 500


@admin_bp.route('/admin/backups/<filename>', methods=['DELETE'])
@require_roles('admin')
def delete_backup_file(filename):
    """Delete an old backup file and its manifest."""
    if not filename or not re.match(r'^[a-zA-Z0-9_\-\.]+\.db$', filename):
        return jsonify({'success': False, 'error': 'Invalid filename.'}), 400

    _, backup_dir = get_storage_paths()
    target = backup_dir / filename
    manifest = target.with_suffix(target.suffix + '.manifest.json')

    if not target.is_file():
        return jsonify({'success': False, 'error': 'Backup file not found.'}), 404

    try:
        target.unlink()
        if manifest.is_file():
            manifest.unlink()
        record_audit('database.backup_delete', 'backup', 0, {'filename': filename}, request.current_user.id)
        db.session.commit()
        return jsonify({'success': True, 'message': f"Backup '{filename}' deleted successfully."}), 200
    except Exception as err:
        return jsonify({'success': False, 'error': f"Failed to delete backup: {err}"}), 500

