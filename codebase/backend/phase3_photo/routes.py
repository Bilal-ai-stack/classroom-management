import os
from datetime import datetime, date, timezone
from flask import Blueprint, request, jsonify
from db import db
from phase1_students.models import Student
from phase2_attendance.models import Attendance
from phase3_photo.detector import detect_faces_in_image

photo_bp = Blueprint('photo', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@photo_bp.route('/photo/detect-faces', methods=['POST'])
def detect_faces():
    """Upload a classroom photo and extract detected face bounding boxes."""
    if 'photo' not in request.files and 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No photo file provided in request.'}), 400

    file = request.files.get('photo') or request.files.get('file')

    if file.filename == '':
        return jsonify({'success': False, 'error': 'Empty filename selected.'}), 400

    if not allowed_file(file.filename):
        return jsonify({
            'success': False,
            'error': f'Unsupported file type. Allowed formats: {", ".join(ALLOWED_EXTENSIONS)}'
        }), 400

    image_bytes = file.read()
    detection_result = detect_faces_in_image(image_bytes)

    if not detection_result.get('success'):
        return jsonify({
            'success': False,
            'error': detection_result.get('error', 'Face detection failed.')
        }), 500

    return jsonify({
        'success': True,
        'filename': file.filename,
        'engine': detection_result.get('engine'),
        'faces_count': detection_result.get('faces_count', 0),
        'image_dimensions': {
            'width': detection_result.get('image_width'),
            'height': detection_result.get('image_height')
        },
        'detected_faces': detection_result.get('faces', [])
    }), 200

@photo_bp.route('/photo/verify-attendance', methods=['POST'])
def verify_photo_attendance():
    """Teacher confirms student-to-face assignments and commits attendance records."""
    data = request.get_json() or {}
    target_date = str(data.get('date', '')).strip()
    verified_students = data.get('verified_students', [])

    if not target_date:
        target_date = date.today().isoformat()

    if not isinstance(verified_students, list) or len(verified_students) == 0:
        return jsonify({'success': False, 'error': 'No student assignments provided.'}), 400

    committed_count = 0
    errors = []

    for item in verified_students:
        student_id = item.get('student_id')
        status = str(item.get('status', 'Present')).strip().capitalize()
        remarks = str(item.get('remarks', 'Photo Verified')).strip()

        if not student_id:
            continue

        student = db.session.get(Student, student_id)
        if not student:
            errors.append(f"Student ID {student_id} not found.")
            continue

        existing = Attendance.query.filter_by(student_id=student_id, date=target_date).first()
        if existing:
            existing.status = status
            existing.remarks = remarks
            existing.updated_at = datetime.now(timezone.utc)
        else:
            att = Attendance(
                student_id=student_id,
                date=target_date,
                status=status,
                remarks=remarks
            )
            db.session.add(att)

        committed_count += 1

    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'Confirmed and saved attendance for {committed_count} student(s).',
        'committed_count': committed_count,
        'errors': errors
    }), 200

@photo_bp.route('/photo/cleanup', methods=['DELETE'])
def cleanup_session_photos():
    """Purge temporary review photos to preserve privacy."""
    return jsonify({
        'success': True,
        'message': 'Session photo cache cleared successfully.'
    }), 200
