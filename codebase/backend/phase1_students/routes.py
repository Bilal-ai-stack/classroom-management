from flask import Blueprint, request, jsonify
from db import db
from phase1_students.models import Student

students_bp = Blueprint('students', __name__)

@students_bp.route('/students', methods=['GET'])
def list_students():
    """List students with search, class filter, and active/archive toggle."""
    query_str = request.args.get('q', '').strip()
    class_name = request.args.get('class_name', '').strip()
    include_archived = request.args.get('include_archived', 'false').lower() == 'true'

    query = Student.query
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
def create_student():
    """Create a new student with validation."""
    data = request.get_json() or {}
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

    student = Student(
        roll_number=roll_number,
        full_name=full_name,
        class_name=class_name,
        section=section,
        guardian_contact=str(data.get('guardian_contact', '')).strip() or None,
        enrollment_date=enrollment_date,
        photo_path=str(data.get('photo_path', '')).strip() or None,
        notes=str(data.get('notes', '')).strip() or None,
        is_active=True
    )

    db.session.add(student)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f"Student '{full_name}' registered successfully.",
        'student': student.to_dict()
    }), 201

@students_bp.route('/students/<int:student_id>', methods=['GET'])
def get_student(student_id):
    """Fetch individual student portfolio details."""
    student = db.session.get(Student, student_id)
    if not student:
        return jsonify({'success': False, 'error': 'Student not found.'}), 404

    return jsonify({
        'success': True,
        'student': student.to_dict()
    }), 200

@students_bp.route('/students/<int:student_id>', methods=['PUT'])
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
    student.enrollment_date = str(data.get('enrollment_date', student.enrollment_date)).strip()
    student.photo_path = str(data.get('photo_path', student.photo_path or '')).strip() or None
    student.notes = str(data.get('notes', student.notes or '')).strip() or None
    if 'is_active' in data:
        student.is_active = bool(data['is_active'])

    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Student updated successfully.',
        'student': student.to_dict()
    }), 200

@students_bp.route('/students/<int:student_id>/archive', methods=['PATCH'])
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

    db.session.commit()
    status_text = 'active' if student.is_active else 'archived'

    return jsonify({
        'success': True,
        'message': f"Student status changed to {status_text}.",
        'student': student.to_dict()
    }), 200

@students_bp.route('/classes', methods=['GET'])
def list_classes():
    """List all available classes and sections for dropdown filters."""
    records = db.session.query(Student.class_name, Student.section).filter_by(is_active=True).distinct().all()
    classes = sorted(list({f"{r[0]}" for r in records}))
    return jsonify({
        'success': True,
        'classes': classes if classes else ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5']
    }), 200
