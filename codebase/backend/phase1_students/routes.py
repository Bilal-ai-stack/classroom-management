import io
import time
from datetime import datetime, timezone
from pathlib import Path
from flask import Blueprint, request, jsonify, send_file, Response, current_app
from PIL import Image, ImageOps
from db import db
from phase1_students.models import Student
from phase4_quality.auth import require_auth, require_roles
from phase4_quality.institution_models import AcademicClass
from phase4_quality.models import record_audit

students_bp = Blueprint('students', __name__)

MAX_STUDENT_PHOTO_BYTES = 5 * 1024 * 1024  # 5MB
ALLOWED_PHOTO_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp'}
PHOTO_MIME_MAP = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp'
}

DEFAULT_STUDENT_AVATAR_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#E2E8F0"/>
  <circle cx="64" cy="48" r="22" fill="#94A3B8"/>
  <path d="M28 106 C28 86, 44 78, 64 78 C84 78, 100 86, 100 106 Z" fill="#94A3B8"/>
</svg>"""


def get_photos_dir():
    """Retrieve or initialize the persistent student photos directory."""
    photos_dir = current_app.config.get('PHOTOS_DIRECTORY')
    if not photos_dir:
        from storage_manager import resolve_data_directory
        photos_dir = resolve_data_directory() / 'photos' / 'students'
    photos_dir = Path(photos_dir)
    photos_dir.mkdir(parents=True, exist_ok=True)
    return photos_dir


def validate_and_process_photo(file_bytes, filename):
    """Validate, auto-orient, optimize, and sanitize student photograph."""
    if len(file_bytes) > MAX_STUDENT_PHOTO_BYTES:
        return False, f"Photo size ({round(len(file_bytes)/1024, 1)} KB) exceeds 5MB limit.", None, None

    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext not in ALLOWED_PHOTO_EXTENSIONS:
        return False, f"Unsupported image format '.{ext}'. Allowed formats: JPG, JPEG, PNG, WEBP.", None, None

    try:
        # Initial verify
        img = Image.open(io.BytesIO(file_bytes))
        img.verify()

        # Reopen for processing
        img = Image.open(io.BytesIO(file_bytes))
        img = ImageOps.exif_transpose(img)

        w, h = img.size
        if w < 32 or h < 32:
            return False, f"Image dimensions ({w}x{h}) are too small (minimum 32x32 pixels).", None, None
        if w > 4096 or h > 4096:
            return False, f"Image dimensions ({w}x{h}) exceed maximum allowed 4096x4096 pixels.", None, None

        # Resize to max 1024 on longest edge for portrait optimization
        if max(w, h) > 1024:
            img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)

        out = io.BytesIO()
        if ext in ('jpg', 'jpeg'):
            if img.mode in ('RGBA', 'P', 'LA'):
                img = img.convert('RGB')
            img.save(out, format='JPEG', quality=88, optimize=True)
            saved_ext = 'jpg'
        elif ext == 'png':
            img.save(out, format='PNG', optimize=True)
            saved_ext = 'png'
        elif ext == 'webp':
            img.save(out, format='WEBP', quality=88)
            saved_ext = 'webp'
        else:
            if img.mode in ('RGBA', 'P', 'LA'):
                img = img.convert('RGB')
            img.save(out, format='JPEG', quality=88, optimize=True)
            saved_ext = 'jpg'

        return True, "", out.getvalue(), saved_ext
    except Image.DecompressionBombError:
        return False, "Image rejected: decompression bomb detected.", None, None
    except Exception as err:
        return False, f"Invalid or corrupted image: {str(err)}", None, None

@students_bp.route('/students', methods=['GET'])
@require_auth
def list_students():
    """List students with search, class filter, and active/archive toggle."""
    query_str = request.args.get('q', '').strip()
    class_name = request.args.get('class_name', '').strip()
    include_archived = request.args.get('include_archived', 'false').lower() == 'true'

    query = Student.query
    if request.current_user.role == 'teacher':
        query = query.filter_by(class_name=request.current_user.assigned_class)
    if not include_archived:
        query = query.filter_by(is_active=True)
    if class_name:
        query = query.filter_by(class_name=class_name)
    if query_str:
        search_filter = f"%{query_str}%"
        query = query.filter(
            (Student.full_name.ilike(search_filter)) |
            (Student.roll_number.ilike(search_filter)) |
            (Student.notes.ilike(search_filter))
        )

    students = query.order_by(Student.class_name, Student.roll_number).all()
    return jsonify({
        'success': True,
        'count': len(students),
        'students': [s.to_dict() for s in students]
    }), 200

@students_bp.route('/students', methods=['POST'])
@require_roles('admin')
def create_student():
    """Create a new student with validation."""
    if request.content_type and 'multipart/form-data' in request.content_type:
        data = request.form.to_dict()
        photo_file = request.files.get('photo')
    else:
        data = request.get_json(silent=True) or {}
        photo_file = None

    roll_number = str(data.get('roll_number', '')).strip()
    full_name = str(data.get('full_name', '')).strip()
    class_name = str(data.get('class_name', '')).strip()
    section = str(data.get('section', 'A')).strip() or 'A'
    enrollment_date = str(data.get('enrollment_date', '')).strip()

    if not roll_number or not full_name or not class_name or not enrollment_date:
        return jsonify({
            'success': False,
            'error': 'Missing required fields: roll_number, full_name, class_name, and enrollment_date are required.'
        }), 400

    # Check for existing student with same roll number in the same class and section
    existing = Student.query.filter_by(
        roll_number=roll_number,
        class_name=class_name,
        section=section
    ).first()
    if existing:
        return jsonify({
            'success': False,
            'error': f"Roll number '{roll_number}' already exists in {class_name} (Section {section})."
        }), 409

    saved_photo_filename = str(data.get('photo_path', '')).strip() or None
    if photo_file and photo_file.filename:
        file_bytes = photo_file.read()
        valid, err_msg, processed_bytes, saved_ext = validate_and_process_photo(file_bytes, photo_file.filename)
        if not valid:
            return jsonify({'success': False, 'error': err_msg}), 400
        photos_dir = get_photos_dir()
        saved_photo_filename = f"student_{roll_number}_{int(time.time())}.{saved_ext}"
        (photos_dir / saved_photo_filename).write_bytes(processed_bytes)

    whatsapp_consent = bool(data.get('whatsapp_consent', False))
    student = Student(
        roll_number=roll_number,
        full_name=full_name,
        class_name=class_name,
        section=section,
        guardian_contact=str(data.get('guardian_contact', '')).strip() or None,
        guardian_name=str(data.get('guardian_name', '')).strip() or '',
        guardian_relationship=str(data.get('guardian_relationship', 'Guardian')).strip() or 'Guardian',
        whatsapp_number=str(data.get('whatsapp_number', '')).strip() or '',
        whatsapp_consent=whatsapp_consent,
        whatsapp_consent_date=datetime.now(timezone.utc).replace(tzinfo=None) if whatsapp_consent else None,
        whatsapp_opt_out=bool(data.get('whatsapp_opt_out', False)),
        notification_preferences=str(data.get('notification_preferences', 'attendance')).strip() or 'attendance',
        enrollment_date=enrollment_date,
        photo_path=saved_photo_filename,
        notes=str(data.get('notes', '')).strip() or None,
        is_active=True
    )

    db.session.add(student)
    db.session.flush()
    record_audit('student.create', 'student', student.id, {'class_name': class_name, 'section': section, 'has_photo': bool(saved_photo_filename)}, request.current_user.id)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f"Student '{full_name}' registered successfully.",
        'student': student.to_dict()
    }), 201

@students_bp.route('/students/<int:student_id>', methods=['GET'])
@require_auth
def get_student(student_id):
    """Fetch individual student portfolio details."""
    student = db.session.get(Student, student_id)
    if not student:
        return jsonify({'success': False, 'error': 'Student not found.'}), 404
    if request.current_user.role == 'teacher' and student.class_name != request.current_user.assigned_class:
        return jsonify({'success': False, 'error': 'You do not have permission to view this student.'}), 403

    return jsonify({
        'success': True,
        'student': student.to_dict()
    }), 200

@students_bp.route('/students/<int:student_id>', methods=['PUT'])
@require_roles('admin')
def update_student(student_id):
    """Update student profile details."""
    student = db.session.get(Student, student_id)
    if not student:
        return jsonify({'success': False, 'error': 'Student not found.'}), 404

    data = request.get_json() or {}
    roll_number = str(data.get('roll_number', student.roll_number)).strip()
    full_name = str(data.get('full_name', student.full_name)).strip()
    class_name = str(data.get('class_name', student.class_name)).strip()
    section = str(data.get('section', student.section)).strip() or 'A'

    if not roll_number or not full_name or not class_name:
        return jsonify({
            'success': False,
            'error': 'roll_number, full_name, and class_name cannot be empty.'
        }), 400

    # Ensure uniqueness when changing roll_number/class/section
    if (roll_number != student.roll_number or class_name != student.class_name or section != student.section):
        conflict = Student.query.filter(
            Student.id != student_id,
            Student.roll_number == roll_number,
            Student.class_name == class_name,
            Student.section == section
        ).first()
        if conflict:
            return jsonify({
                'success': False,
                'error': f"Roll number '{roll_number}' already taken in {class_name} (Section {section})."
            }), 409

    student.roll_number = roll_number
    student.full_name = full_name
    student.class_name = class_name
    student.section = section
    student.guardian_contact = str(data.get('guardian_contact', student.guardian_contact or '')).strip() or None
    if 'guardian_name' in data:
        student.guardian_name = str(data['guardian_name']).strip()
    if 'guardian_relationship' in data:
        student.guardian_relationship = str(data['guardian_relationship']).strip() or 'Guardian'
    if 'whatsapp_number' in data:
        student.whatsapp_number = str(data['whatsapp_number']).strip()
    if 'whatsapp_consent' in data:
        new_consent = bool(data['whatsapp_consent'])
        if new_consent and not student.whatsapp_consent:
            student.whatsapp_consent_date = datetime.now(timezone.utc).replace(tzinfo=None)
        student.whatsapp_consent = new_consent
    if 'whatsapp_opt_out' in data:
        student.whatsapp_opt_out = bool(data['whatsapp_opt_out'])
    if 'notification_preferences' in data:
        student.notification_preferences = str(data['notification_preferences']).strip() or 'attendance'
    student.enrollment_date = str(data.get('enrollment_date', student.enrollment_date)).strip()
    student.photo_path = str(data.get('photo_path', student.photo_path or '')).strip() or None
    student.notes = str(data.get('notes', student.notes or '')).strip() or None
    if 'is_active' in data:
        student.is_active = bool(data['is_active'])

    record_audit('student.update', 'student', student.id, {'class_name': class_name, 'section': section}, request.current_user.id)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Student updated successfully.',
        'student': student.to_dict()
    }), 200

@students_bp.route('/students/<int:student_id>/archive', methods=['PATCH'])
@require_roles('admin')
def archive_student(student_id):
    """Soft archive or restore a student."""
    student = db.session.get(Student, student_id)
    if not student:
        return jsonify({'success': False, 'error': 'Student not found.'}), 404

    # Toggle or explicitly set
    data = request.get_json(silent=True) or {}
    if 'is_active' in data:
        student.is_active = bool(data['is_active'])
    else:
        student.is_active = not student.is_active

    record_audit('student.status_change', 'student', student.id, {'is_active': student.is_active}, request.current_user.id)
    db.session.commit()
    status_text = 'active' if student.is_active else 'archived'

    return jsonify({
        'success': True,
        'message': f"Student status changed to {status_text}.",
        'student': student.to_dict()
    }), 200

@students_bp.route('/students/<int:student_id>/photo', methods=['GET'])
def get_student_photo(student_id):
    """Retrieve and stream the student portrait photograph or default SVG avatar."""
    student = db.session.get(Student, student_id)
    if not student or not student.photo_path:
        return Response(DEFAULT_STUDENT_AVATAR_SVG, mimetype='image/svg+xml')

    photos_dir = get_photos_dir()
    target_file = photos_dir / student.photo_path
    if not target_file.is_file():
        return Response(DEFAULT_STUDENT_AVATAR_SVG, mimetype='image/svg+xml')

    ext = student.photo_path.rsplit('.', 1)[-1].lower() if '.' in student.photo_path else 'jpg'
    mimetype = PHOTO_MIME_MAP.get(ext, 'image/jpeg')
    file_bytes = target_file.read_bytes()
    response = send_file(io.BytesIO(file_bytes), mimetype=mimetype, max_age=3600)
    response.headers['Cache-Control'] = 'public, max-age=3600'
    return response


@students_bp.route('/students/<int:student_id>/photo', methods=['POST'])
@require_roles('admin', 'teacher')
def upload_student_photo(student_id):
    """Upload or replace student portrait photograph with validation and audit trail."""
    student = db.session.get(Student, student_id)
    if not student:
        return jsonify({'success': False, 'error': 'Student not found.'}), 404

    if request.current_user.role == 'teacher' and student.class_name != request.current_user.assigned_class:
        return jsonify({'success': False, 'error': 'You do not have permission to modify this student.'}), 403

    if 'photo' not in request.files:
        return jsonify({'success': False, 'error': 'No photo file provided in request.'}), 400

    file = request.files['photo']
    if not file.filename:
        return jsonify({'success': False, 'error': 'Selected photo file is empty.'}), 400

    content = file.read()
    valid, err_msg, processed_bytes, saved_ext = validate_and_process_photo(content, file.filename)
    if not valid:
        return jsonify({'success': False, 'error': err_msg}), 400

    photos_dir = get_photos_dir()

    # Safely remove previous photo file if it exists
    if student.photo_path:
        old_file = photos_dir / student.photo_path
        if old_file.is_file():
            try:
                old_file.unlink()
            except OSError:
                pass

    # Save new file
    timestamp = int(time.time())
    new_filename = f"student_{student.id}_{timestamp}.{saved_ext}"
    target_path = photos_dir / new_filename
    target_path.write_bytes(processed_bytes)

    student.photo_path = new_filename
    student.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    record_audit(
        'student.photo_upload',
        'student',
        student.id,
        {'filename': new_filename, 'size': len(processed_bytes), 'ext': saved_ext},
        actor_user_id=request.current_user.id
    )
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f"Photograph for '{student.full_name}' updated successfully.",
        'photo_url': f"/api/students/{student.id}/photo?v={timestamp}",
        'student': student.to_dict()
    }), 200


@students_bp.route('/students/<int:student_id>/photo', methods=['DELETE'])
@require_roles('admin')
def delete_student_photo(student_id):
    """Remove student portrait photograph and restore default avatar."""
    student = db.session.get(Student, student_id)
    if not student:
        return jsonify({'success': False, 'error': 'Student not found.'}), 404

    if student.photo_path:
        photos_dir = get_photos_dir()
        target_file = photos_dir / student.photo_path
        if target_file.is_file():
            try:
                target_file.unlink()
            except OSError:
                pass

        old_filename = student.photo_path
        student.photo_path = None
        student.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

        record_audit(
            'student.photo_delete',
            'student',
            student.id,
            {'previous_filename': old_filename},
            actor_user_id=request.current_user.id
        )
        db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Student photograph removed successfully.',
        'student': student.to_dict()
    }), 200


@students_bp.route('/classes', methods=['GET'])
@require_auth
def list_classes():
    """List all available classes and sections for dropdown filters."""
    if request.current_user.role == 'teacher':
        classes = [request.current_user.assigned_class] if request.current_user.assigned_class else []
        return jsonify({'success': True, 'classes': classes}), 200

    academic_classes = AcademicClass.query.filter_by(is_active=True).all()
    if academic_classes:
        classes = sorted(list({c.name for c in academic_classes}))
    else:
        records = db.session.query(Student.class_name).filter_by(is_active=True).distinct().all()
        classes = sorted(list({r[0] for r in records}))

    return jsonify({
        'success': True,
        'classes': classes if classes else ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5']
    }), 200
