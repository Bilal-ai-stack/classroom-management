from datetime import datetime, date, timezone
from flask import Blueprint, request, jsonify
from db import db
from phase1_students.models import Student
from phase2_attendance.models import Attendance

attendance_bp = Blueprint('attendance', __name__)

VALID_STATUSES = {'Present', 'Absent', 'Late'}

@attendance_bp.route('/attendance', methods=['GET'])
def get_daily_attendance():
    """Fetch class roster with recorded attendance for a specific date."""
    target_date = request.args.get('date', '').strip()
    if not target_date:
        target_date = date.today().isoformat()

    class_name = request.args.get('class_name', '').strip()

    # Query active students
    student_query = Student.query.filter_by(is_active=True)
    if class_name:
        student_query = student_query.filter_by(class_name=class_name)

    students = student_query.order_by(Student.class_name, Student.roll_number).all()

    # Query existing attendance for this date
    student_ids = [s.id for s in students]
    existing_records = {}
    if student_ids:
        attendances = Attendance.query.filter(
            Attendance.student_id.in_(student_ids),
            Attendance.date == target_date
        ).all()
        for att in attendances:
            existing_records[att.student_id] = att

    roster = []
    present_count = 0
    absent_count = 0
    late_count = 0
    unrecorded_count = 0

    for s in students:
        att = existing_records.get(s.id)
        if att:
            current_status = att.status
            remarks = att.remarks
            att_id = att.id
            if current_status == 'Present':
                present_count += 1
            elif current_status == 'Absent':
                absent_count += 1
            elif current_status == 'Late':
                late_count += 1
        else:
            current_status = 'Unrecorded'
            remarks = None
            att_id = None
            unrecorded_count += 1

        roster.append({
            'student_id': s.id,
            'roll_number': s.roll_number,
            'full_name': s.full_name,
            'class_name': s.class_name,
            'section': s.section,
            'status': current_status,
            'remarks': remarks,
            'attendance_id': att_id
        })

    total_recorded = present_count + absent_count + late_count
    attendance_rate = round((present_count / total_recorded * 100), 1) if total_recorded > 0 else 100.0

    return jsonify({
        'success': True,
        'date': target_date,
        'class_name': class_name or 'All Classes',
        'summary': {
            'total_students': len(students),
            'present_count': present_count,
            'absent_count': absent_count,
            'late_count': late_count,
            'unrecorded_count': unrecorded_count,
            'attendance_rate': attendance_rate
        },
        'roster': roster
    }), 200

@attendance_bp.route('/attendance/bulk', methods=['POST'])
def save_bulk_attendance():
    """Bulk upsert attendance records for a specified date."""
    data = request.get_json() or {}
    target_date = str(data.get('date', '')).strip()
    records = data.get('records', [])

    if not target_date:
        return jsonify({'success': False, 'error': 'Date is required in YYYY-MM-DD format.'}), 400

    if not isinstance(records, list) or len(records) == 0:
        return jsonify({'success': False, 'error': 'Records array cannot be empty.'}), 400

    saved_count = 0
    errors = []

    for item in records:
        student_id = item.get('student_id')
        status = str(item.get('status', 'Present')).strip().capitalize()
        remarks = str(item.get('remarks', '')).strip() or None

        if not student_id:
            errors.append('Missing student_id in record.')
            continue

        if status not in VALID_STATUSES:
            status = 'Present'

        # Verify student exists
        student = db.session.get(Student, student_id)
        if not student:
            errors.append(f'Student with ID {student_id} not found.')
            continue

        # Upsert: check for existing record for (student_id, target_date)
        existing = Attendance.query.filter_by(
            student_id=student_id,
            date=target_date
        ).first()

        if existing:
            existing.status = status
            existing.remarks = remarks
            existing.updated_at = datetime.now(timezone.utc)
        else:
            new_att = Attendance(
                student_id=student_id,
                date=target_date,
                status=status,
                remarks=remarks
            )
            db.session.add(new_att)

        saved_count += 1

    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'Successfully saved attendance for {saved_count} student(s) on {target_date}.',
        'saved_count': saved_count,
        'errors': errors
    }), 200

@attendance_bp.route('/students/<int:student_id>/attendance', methods=['GET'])
def get_student_attendance_history(student_id):
    """Fetch complete attendance history and percentage metrics for a student."""
    student = db.session.get(Student, student_id)
    if not student:
        return jsonify({'success': False, 'error': 'Student not found.'}), 404

    records = Attendance.query.filter_by(student_id=student_id).order_by(Attendance.date.desc()).all()

    total_days = len(records)
    present_days = sum(1 for r in records if r.status == 'Present')
    late_days = sum(1 for r in records if r.status == 'Late')
    absent_days = sum(1 for r in records if r.status == 'Absent')
    rate = round((present_days / total_days * 100), 1) if total_days > 0 else 100.0

    return jsonify({
        'success': True,
        'student': student.to_dict(),
        'metrics': {
            'total_days': total_days,
            'present_days': present_days,
            'late_days': late_days,
            'absent_days': absent_days,
            'attendance_rate': rate
        },
        'history': [r.to_dict() for r in records]
    }), 200

@attendance_bp.route('/reports/attendance', methods=['GET'])
def get_attendance_report():
    """Generate attendance summary and trends across date range and classes."""
    start_date = request.args.get('start_date', '').strip()
    end_date = request.args.get('end_date', '').strip()
    class_name = request.args.get('class_name', '').strip()

    query = Attendance.query.join(Student)
    if class_name:
        query = query.filter(Student.class_name == class_name)
    if start_date:
        query = query.filter(Attendance.date >= start_date)
    if end_date:
        query = query.filter(Attendance.date <= end_date)

    attendances = query.order_by(Attendance.date.asc()).all()

    total_records = len(attendances)
    present_count = sum(1 for a in attendances if a.status == 'Present')
    late_count = sum(1 for a in attendances if a.status == 'Late')
    absent_count = sum(1 for a in attendances if a.status == 'Absent')
    overall_rate = round((present_count / total_records * 100), 1) if total_records > 0 else 100.0

    # Aggregate by date for trend chart
    daily_stats = {}
    for a in attendances:
        if a.date not in daily_stats:
            daily_stats[a.date] = {'date': a.date, 'present': 0, 'absent': 0, 'late': 0, 'total': 0}
        daily_stats[a.date]['total'] += 1
        if a.status == 'Present':
            daily_stats[a.date]['present'] += 1
        elif a.status == 'Late':
            daily_stats[a.date]['late'] += 1
        elif a.status == 'Absent':
            daily_stats[a.date]['absent'] += 1

    timeline = sorted(list(daily_stats.values()), key=lambda x: x['date'])

    return jsonify({
        'success': True,
        'summary': {
            'total_records': total_records,
            'present_count': present_count,
            'late_count': late_count,
            'absent_count': absent_count,
            'overall_rate': overall_rate
        },
        'timeline': timeline,
        'records': [a.to_dict() for a in attendances]
    }), 200
